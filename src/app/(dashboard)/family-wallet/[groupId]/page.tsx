"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, Receipt, Plus, Settings, CheckCircle2, TrendingDown, AlertTriangle, Copy, Check, X, User, ChevronDown, Trash2, Loader2 } from "lucide-react";
import { doc, collection, onSnapshot, getDoc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, increment } from "firebase/firestore";
import { formatAmount, getAllCurrencies, getExchangeRate, toBaseAmount, fromBaseAmount } from "@/core/utils/currencyManager";
import { GroupExpense, useFamilyGroups, getFamilyGroups, setFamilyGroups, computeGroupPoolBalance } from "@/core/store/dataStore";
import { db, auth } from "@/config/firebase";

import { formatDate } from "@/core/utils/dateFormat";
/** The signed-in user's display name, matching how the rest of the app resolves it. */
function getMyName(): string {
  if (typeof window !== "undefined") {
    try {
      const session = localStorage.getItem("user_session");
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed?.name) return parsed.name as string;
      }
    } catch {
      // Ignore malformed session.
    }
  }
  return auth.currentUser?.displayName || "You";
}

export default function FamilyGroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const groupId = resolvedParams.groupId;

  const groups = useFamilyGroups();
  const group = groups.find((g) => g.id === groupId);

  // Expenses now live in the shared Firestore subcollection
  // `familyGroups/{code}/expenses`, so every member sees the same history.
  const [expenses, setExpenses] = useState<GroupExpense[]>([]);

  const [activeCurrency, setActiveCurrency] = useState("INR");

  // The pool balance is the sum of the shared expenses (base INR) — a single
  // source of truth, so it can never drift from the listed history.
  const poolBalance = computeGroupPoolBalance(expenses);

  const isOverLimit = group?.spendingLimit && group.spendingLimit > 0 && poolBalance > group.spendingLimit;

  // Claim overlay
  const [isClaimOpen, setIsClaimOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  // Currency the claim is entered in. Defaults to the active display currency
  // each time the modal opens; the amount is converted to base (INR) on submit.
  const [claimCurrency, setClaimCurrency] = useState("INR");

  const handleOpenClaim = () => {
    setAmount("");
    setDescription("");
    setClaimCurrency(activeCurrency);
    setIsClaimOpen(true);
  };

  // Limit overlay
  const [isLimitOpen, setIsLimitOpen] = useState(false);
  const [limitInput, setLimitInput] = useState("");

  // Member roster popup + copy-code feedback
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Delete-group confirmation
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Removes this group from the user's device and detaches them from the shared
  // roster. When the last member leaves, the shared directory doc is deleted too.
  const handleDeleteGroup = async () => {
    if (!group || isDeleting) return;
    setIsDeleting(true);
    try {
      const ref = doc(db, "familyGroups", group.code);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        const myName = getMyName();
        const names = Array.isArray(data.memberNames) ? (data.memberNames as string[]) : [];
        const remaining = names.filter((n) => n !== myName);
        const remainingCount = names.length > 0
          ? remaining.length
          : Math.max(0, (typeof data.members === "number" ? data.members : 1) - 1);

        if (remainingCount <= 0) {
          // Last one out — remove the shared expense history, then the group.
          const expSnap = await getDocs(collection(db, "familyGroups", group.code, "expenses"));
          await Promise.all(expSnap.docs.map((d) => deleteDoc(d.ref)));
          await deleteDoc(ref);
        } else {
          await updateDoc(ref, { memberNames: remaining, members: remainingCount });
        }
      }
    } catch {
      // Even if the shared update fails (offline etc.), still remove locally so
      // the user isn't stuck with a group they asked to delete.
    } finally {
      // Drop the group from this device's store.
      setFamilyGroups(getFamilyGroups().filter((g) => g.id !== groupId));
      setIsDeleting(false);
      setIsDeleteOpen(false);
      router.push("/family-wallet");
    }
  };

  // Names to display: prefer the roster synced live from Firestore below.
  const memberNames = group?.memberNames ?? [];
  const memberCount = memberNames.length || group?.members || 0;

  const handleCopyCode = async () => {
    if (!group) return;
    try {
      await navigator.clipboard.writeText(group.code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. insecure context) — silently ignore.
    }
  };

  const handleOpenLimit = () => {
    // The limit is stored in base (INR) but the field is shown in the active
    // display currency, so convert out here and back in on save — otherwise the
    // limit would be compared against a pool balance in a different unit.
    const stored = group?.spendingLimit;
    setLimitInput(stored ? String(Math.round(fromBaseAmount(stored, activeCurrency))) : "");
    setIsLimitOpen(true);
  };

  const handleSaveLimit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(limitInput);
    if (isNaN(num)) return;

    const baseLimit = toBaseAmount(num, activeCurrency);
    const updatedGroups = groups.map((g) => g.id === groupId ? { ...g, spendingLimit: baseLimit } : g);
    setFamilyGroups(updatedGroups);
    setIsLimitOpen(false);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cur = localStorage.getItem("active_currency");
      if (cur) setActiveCurrency(cur);
    }
  }, []);

  useEffect(() => {
    if (groups.length > 0 && !group) {
      router.push("/family-wallet");
    }
  }, [group, groups, router]);

  // Live-sync the shared group doc so every logged-in member always sees the
  // full, up-to-date roster — even people who joined after this device did.
  const groupCode = group?.code;
  useEffect(() => {
    if (!groupCode) return;
    const ref = doc(db, "familyGroups", groupCode);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const names = Array.isArray(data.memberNames) ? (data.memberNames as string[]) : [];

      // Merge the fresh roster + shared pool total into this device's local
      // store, but only when something actually changed (avoid a write loop).
      setFamilyGroups(
        getFamilyGroups().map((g) => {
          if (g.code !== groupCode) return g;
          const nextCount = names.length || g.members;
          const nextBalance = typeof data.totalBalance === "number" ? data.totalBalance : g.totalBalance;
          const sameNames = JSON.stringify(g.memberNames ?? []) === JSON.stringify(names);
          if (sameNames && g.members === nextCount && g.totalBalance === nextBalance) return g;
          return { ...g, memberNames: names, members: nextCount, totalBalance: nextBalance };
        })
      );
    });
    return () => unsub();
  }, [groupCode]);

  // Live-sync the shared expense history for this group. This is the single
  // source of truth for both the listed claims and the pool balance.
  useEffect(() => {
    if (!groupCode) return;
    const coll = collection(db, "familyGroups", groupCode, "expenses");
    const unsub = onSnapshot(coll, (snap) => {
      const list: GroupExpense[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          groupId,
          amount: typeof data.amount === "number" ? data.amount : 0,
          description: typeof data.description === "string" ? data.description : "Expense claim",
          paidBy: typeof data.paidBy === "string" ? data.paidBy : "Member",
          date: typeof data.date === "string" ? data.date : new Date().toISOString(),
        };
      });
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setExpenses(list);
    });
    return () => unsub();
  }, [groupCode, groupId]);

  const handleAddClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!num || !group) return;

    // The pool is stored in base currency (INR). Convert the amount the user
    // typed in `claimCurrency` back to base so totals stay consistent no matter
    // which currency was chosen. (rate = target units per 1 INR ⇒ INR = num/rate.)
    const amountInBase = num / getExchangeRate(claimCurrency);

    // Close the form immediately; the live listener will surface the new entry.
    setAmount("");
    setDescription("");
    setIsClaimOpen(false);

    try {
      // Write the claim to the shared subcollection so every member sees it.
      await addDoc(collection(db, "familyGroups", group.code, "expenses"), {
        amount: amountInBase,
        description: description || "Expense claim",
        paidBy: getMyName(),
        date: new Date().toISOString(),
        createdAt: serverTimestamp(),
      });
      // Mirror the running pool total onto the group doc so the card list
      // (which reads group.totalBalance) stays in sync for everyone.
      //
      // `increment` rather than `poolBalance + amountInBase`: that read-then-write
      // used a total captured from THIS render, so two members filing a claim at
      // the same time both started from the same figure and the second write
      // silently dropped the first. increment() is applied server-side against
      // whatever the current value is, so concurrent claims both land.
      await updateDoc(doc(db, "familyGroups", group.code), {
        totalBalance: increment(amountInBase),
      });
    } catch {
      // Offline / permission error — the claim just won't be saved; the live
      // listener keeps the UI reflecting whatever is actually in Firestore.
    }
  };

  if (!group) return null;

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 md:p-8 max-w-4xl mx-auto w-full">
      {/* Header */}
      <header className="flex justify-between items-center bg-card border border-border p-4 rounded-2xl shadow-sm">
        <Link
          href="/family-wallet"
          className="flex items-center gap-2 text-xs font-bold text-foreground-secondary hover:text-primary transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Shared Wallets
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyCode}
            title="Copy group code"
            className="text-[10px] font-bold text-foreground-muted flex items-center gap-1.5 bg-secondary px-2 py-1 rounded-md hover:bg-border transition-colors cursor-pointer"
          >
            <Users className="w-3 h-3" /> Code: {group.code}
            {codeCopied ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
          <button
            onClick={() => setIsDeleteOpen(true)}
            title="Delete group"
            aria-label="Delete group"
            className="text-icon-muted hover:text-red-500 p-1.5 rounded-md hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Info */}
      <section className="bg-primary-lighter border border-primary/20 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-5">
        <div className="space-y-1.5">
          <h2 className="text-2xl font-black text-primary">
            {group.name}
          </h2>
          <button
            onClick={() => setIsMembersOpen(true)}
            title="View all members"
            className="text-xs font-semibold text-primary/70 flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            {memberCount} {memberCount === 1 ? "Member" : "Members"} Syncing
            <span className="underline underline-offset-2">View</span>
          </button>
        </div>

        <div className="text-left sm:text-right space-y-1">
          <div className="flex flex-col sm:items-end">
            {isOverLimit && (
              <div className="flex items-center gap-1.5 text-red-500 mb-1">
                <AlertTriangle className="w-4 h-4 animate-bounce" />
                <span className="text-xs font-bold uppercase tracking-wider">Limit Exceeded</span>
              </div>
            )}
            <div className="flex items-end sm:justify-end gap-2">
              <span className={`text-3xl font-black tracking-tight ${isOverLimit ? 'text-red-500' : 'text-primary'}`}>
                {formatAmount(poolBalance, activeCurrency)}
              </span>
              {group.spendingLimit && group.spendingLimit > 0 ? (
                <span className={`text-sm font-bold mb-1 ${isOverLimit ? 'text-red-500/70' : 'text-primary/50'}`}>
                  / {formatAmount(group.spendingLimit, activeCurrency)}
                </span>
              ) : null}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider block text-primary/70 mt-1">
              Total Group Pool
            </span>
          </div>
        </div>
      </section>

      {/* Actions */}
      <section className="flex gap-4">
        <button
          onClick={handleOpenClaim}
          className="btn-primary flex-1 py-4 text-sm font-extrabold flex items-center justify-center gap-2"
        >
          <Receipt className="w-5 h-5" />
          Add Expense Claim
        </button>
        <button 
          onClick={handleOpenLimit}
          className="bg-card border border-border text-foreground px-6 py-4 rounded-xl font-bold flex items-center gap-2 hover:bg-secondary"
        >
          <Settings className="w-5 h-5" />
          Limits
        </button>
      </section>

      {/* Expense History List */}
      <section className="space-y-4">
        <h3 className="text-xs font-bold text-foreground-secondary uppercase tracking-widest pl-2">
          Collaborative History
        </h3>

        <div className="space-y-3">
          {expenses.map((exp) => (
            <div key={exp.id} className="bg-card border border-border p-4 rounded-xl shadow-sm flex justify-between items-center group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center border border-border">
                  <TrendingDown className="w-5 h-5 text-icon-default" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground text-sm">{exp.description}</h4>
                  <span className="text-[10px] text-foreground-muted font-bold">
                    Paid by: {exp.paidBy} • {formatDate(exp.date)}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-foreground">
                  {formatAmount(exp.amount, activeCurrency)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Add Claim Overlay */}
      {isClaimOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center p-0 md:p-4 animate-in fade-in duration-200">
          <div
            className="w-full bg-card border-t md:border border-border rounded-t-3xl md:rounded-2xl max-w-sm shadow-2xl overflow-hidden animate-in slide-in-from-bottom md:zoom-in-95 duration-300 flex flex-col"
            role="dialog"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-border flex justify-between items-center bg-background-subtle">
              <div>
                <h3 className="text-lg font-black text-foreground">New Group Expense</h3>
                <p className="text-xs font-semibold text-foreground-muted">Add a claim to the shared pool.</p>
              </div>
              <button
                onClick={() => setIsClaimOpen(false)}
                className="text-icon-muted hover:text-icon-active p-1.5 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddClaim} className="p-6 space-y-5">
              <div className="space-y-1">
                <label htmlFor="claim-amount" className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                  Amount
                </label>
                <div className="flex gap-2">
                  {/* Currency selector — defaults to the active display currency */}
                  <div className="relative shrink-0">
                    <select
                      value={claimCurrency}
                      onChange={(e) => setClaimCurrency(e.target.value)}
                      aria-label="Currency"
                      className="input-base h-full appearance-none pl-3 pr-8 font-bold cursor-pointer"
                    >
                      {getAllCurrencies().map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.symbol} {c.code}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-icon-muted pointer-events-none" />
                  </div>
                  <input
                    id="claim-amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="input-base w-full text-lg font-extrabold tracking-tight"
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                    required
                    autoFocus
                  />
                </div>
                {claimCurrency !== "INR" && amount && parseFloat(amount) > 0 && (
                  <p className="text-[11px] font-semibold text-foreground-muted pt-0.5">
                    ≈ {formatAmount(parseFloat(amount) / getExchangeRate(claimCurrency), activeCurrency)} in the pool
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label htmlFor="claim-description" className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                  Description
                </label>
                <input
                  id="claim-description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-base w-full"
                  placeholder="e.g. Groceries for the week"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsClaimOpen(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set Limit Overlay */}
      {isLimitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
          <div className="w-full bg-card border border-border rounded-2xl max-w-sm shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-black text-foreground text-center">Set Group Limit</h3>
            <p className="text-xs text-foreground-muted text-center">
              Set a maximum spending limit for this shared wallet (enter 0 for no limit).
            </p>
            <form onSubmit={handleSaveLimit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-foreground-secondary uppercase">Limit Amount</label>
                <input
                  type="number"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  className="input-base w-full"
                  placeholder="e.g. 5000"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsLimitOpen(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Save Limit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Members Roster Overlay */}
      {isMembersOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
          <div className="w-full bg-card border border-border rounded-2xl max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Members ({memberCount})
              </h3>
              <button
                onClick={() => setIsMembersOpen(false)}
                className="text-icon-muted hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {memberNames.length > 0 ? (
              <ul className="space-y-2 max-h-72 overflow-y-auto">
                {memberNames.map((name) => (
                  <li
                    key={name}
                    className="flex items-center gap-3 bg-secondary rounded-xl p-3"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary-lighter text-primary flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm text-foreground">{name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-foreground-muted text-center py-4">
                No member names recorded yet for this group.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Delete Group Confirmation Overlay */}
      {isDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
          <div className="w-full bg-card border border-border rounded-2xl max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
                <Trash2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-foreground">Delete “{group.name}”?</h3>
                <p className="text-xs text-foreground-muted leading-relaxed">
                  You’ll be removed from this shared wallet and its expense history will be
                  cleared from your device. {memberCount > 1
                    ? "Other members will keep the group."
                    : "As the last member, the group will be deleted for everyone."}
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                className="btn-secondary flex-1"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteGroup}
                className="flex-1 bg-red-500 text-white font-bold rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 hover:bg-red-600 transition-colors disabled:opacity-60 cursor-pointer"
                disabled={isDeleting}
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
