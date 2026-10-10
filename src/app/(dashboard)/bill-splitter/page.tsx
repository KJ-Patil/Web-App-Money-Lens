"use client";

import React, { useState, useMemo } from "react";
import { Receipt, Plus, Users, ArrowRight, MessageCircle, X, UserCheck, ArrowDownLeft, ArrowUpRight, Scale, Phone, User, Smartphone } from "lucide-react";
import { simplifyDebts, calculateBalances, ExpenseEntry, Settlement, BalanceRecord } from "@/core/math/DebtSimplifier";
import { formatAmount } from "@/core/utils/currencyManager";
import { getLedgerCustomers } from "@/core/store/dataStore";
import FlashReminderModal from "@/components/modals/FlashReminderModal";
import UpiPayModal from "@/components/modals/UpiPayModal";
import { toast } from "sonner";

export default function BillSplitterPage() {
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [balances, setBalances] = useState<BalanceRecord[]>([]);

  // Mobile numbers per person (name -> phone), and who "you" are
  const [contacts, setContacts] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    const ledger = getLedgerCustomers();
    const initial: Record<string, string> = {};
    ledger.forEach((c) => {
      if (c.phone) {
        initial[c.name] = c.phone;
      }
    });
    return initial;
  });
  const [youName, setYouName] = useState("");
  const [activeReminder, setActiveReminder] = useState<{ recipientName: string; balance: number; phone: string } | null>(null);
  const [upiIds, setUpiIds] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    const ledger = getLedgerCustomers();
    const initial: Record<string, string> = {};
    ledger.forEach((c) => {
      if (c.upiId) initial[c.name] = c.upiId;
    });
    return initial;
  });
  const [activeUpiSettle, setActiveUpiSettle] = useState<{ from: string; to: string; amount: number } | null>(null);

  // Form State
  const [splitMode, setSplitMode] = useState<"equal" | "individual">("equal");
  const [description, setDescription] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [amount, setAmount] = useState("");
  const [participantsStr, setParticipantsStr] = useState("");
  const [assignTo, setAssignTo] = useState("");

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paidBy || !amount) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    let participants: string[];

    if (splitMode === "individual") {
      if (!assignTo.trim()) return;
      // In individual mode, the entire bill is assigned to one person
      participants = [assignTo.trim()];
    } else {
      if (!participantsStr) return;
      participants = participantsStr.split(",").map(p => p.trim()).filter(Boolean);
    }
    
    const newExpense: ExpenseEntry = {
      paidBy: paidBy.trim(),
      amount: parsedAmount,
      participants,
      description: description.trim() || undefined,
    };

    const newExpenses = [...expenses, newExpense];
    setExpenses(newExpenses);

    // Automatically recalculate settlements + per-person balances
    setSettlements(simplifyDebts(newExpenses));
    setBalances(calculateBalances(newExpenses));

    // Reset fields
    setDescription("");
    setPaidBy("");
    setAmount("");
    setParticipantsStr("");
    setAssignTo("");
  };

  const removeExpense = (index: number) => {
    const newExpenses = expenses.filter((_, i) => i !== index);
    setExpenses(newExpenses);
    setSettlements(simplifyDebts(newExpenses));
    setBalances(calculateBalances(newExpenses));
  };

  // Strip everything but digits so wa.me gets a clean international number.
  const toWaNumber = (raw: string) => (raw || "").replace(/\D/g, "");

  const getWhatsAppLink = (settlement: Settlement) => {
    const message = `Hi ${settlement.from}, you owe me ${formatAmount(settlement.amount, "INR")} for our shared expenses. Please transfer when possible!`;
    const number = toWaNumber(contacts[settlement.from]);
    // wa.me/<number> targets the debtor directly; without a number it just opens WhatsApp.
    return number
      ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  // Every unique person seen across all expenses (payers + participants).
  const people = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e) => {
      set.add(e.paidBy);
      e.participants.forEach((p) => set.add(p));
    });
    return Array.from(set).sort();
  }, [expenses]);

  const setContact = (person: string, phone: string) =>
    setContacts((prev) => ({ ...prev, [person]: phone }));

  const setUpiId = (person: string, vpa: string) =>
    setUpiIds((prev) => ({ ...prev, [person]: vpa }));

  // Automatically lookup ledger contacts if names match (ledger is checked on state init and can be updated dynamic, or typed)

  const handleOpenReminder = (recipientName: string, balance: number) => {
    const phone = contacts[recipientName] || "";
    setActiveReminder({ recipientName, balance, phone });
  };

  // Split the net balances into people who get money back, who owe, and who are square.
  const takeBack = balances.filter((b) => b.balance > 0);
  const toGive = balances.filter((b) => b.balance < 0);
  const settled = balances.filter((b) => b.balance === 0);

  // Personalized view (from "your" perspective), derived from the optimal transfers.
  const whoOwesYou = youName ? settlements.filter((s) => s.to === youName) : [];
  const youOwe = youName ? settlements.filter((s) => s.from === youName) : [];

  // Live "₹X each" hint shown under the form as the user types.
  const splitPreview = (() => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return "";
    if (splitMode === "equal") {
      const count = participantsStr.split(",").map((p) => p.trim()).filter(Boolean).length;
      if (count === 0) return "";
      return `${formatAmount(amt / count, "INR")} each · split between ${count} ${count === 1 ? "person" : "people"}`;
    }
    if (assignTo.trim()) {
      return `${assignTo.trim()} owes the full ${formatAmount(amt, "INR")}${paidBy.trim() ? ` to ${paidBy.trim()}` : ""}`;
    }
    return "";
  })();

  return (
    <div className="flex-1 flex flex-col p-6 space-y-8 md:p-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl flex items-center gap-2">
          <Receipt className="w-8 h-8 text-primary" />
          Smart Bill Splitter
        </h1>
        <p className="text-sm font-medium text-foreground-muted">
          Add group expenses and instantly generate the minimum optimal transfer paths.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Col: Workspace Input */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            {/* Card header */}
            <div className="px-6 pt-6 pb-4 border-b border-border">
              <h3 className="font-extrabold text-foreground flex items-center gap-2">
                <Receipt className="w-4 h-4 text-primary" />
                Log Shared Expense
              </h3>
            </div>

            <form onSubmit={handleAddExpense}>
              {/* Description + amount — the focal hero block */}
              <div className="px-6 py-6 space-y-5 bg-background-subtle/40">
                {/* Description with category avatar */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary-lighter border border-primary/20 flex items-center justify-center shrink-0">
                    <Receipt className="w-5 h-5 text-primary" />
                  </div>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What was this for? e.g. Dinner at Cafe"
                    className="flex-1 bg-transparent border-0 border-b-2 border-border focus:border-primary focus:ring-0 outline-none px-1 py-2 text-base font-bold text-foreground placeholder:text-foreground-muted placeholder:font-medium transition-colors"
                  />
                </div>

                {/* Big amount input */}
                <div className="flex items-center justify-center gap-2 pt-1 relative">
                  <span className="text-3xl font-black text-foreground-muted">₹</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-44 bg-transparent border-0 focus:ring-0 outline-none text-center text-4xl font-black text-foreground placeholder:text-foreground-muted/40 tabular-nums pr-0"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              {/* Details */}
              <div className="px-6 py-5 space-y-4">
                {/* Split Mode segmented control */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider">How to split</span>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-secondary rounded-xl">
                    <button
                      type="button"
                      onClick={() => setSplitMode("equal")}
                      className={`py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        splitMode === "equal"
                          ? "bg-primary text-white shadow-sm font-extrabold"
                          : "text-foreground-secondary hover:text-foreground"
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      Equally
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitMode("individual")}
                      className={`py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        splitMode === "individual"
                          ? "bg-brand text-white shadow-sm font-extrabold"
                          : "text-foreground-secondary hover:text-foreground"
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      One person
                    </button>
                  </div>
                </div>

                {/* Paid by */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider">Paid by</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-icon-muted">
                      <User className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      value={paidBy}
                      onChange={(e) => setPaidBy(e.target.value)}
                      placeholder="e.g. Rahul"
                      className="input-base pl-10 w-full"
                      required
                    />
                  </div>
                </div>

                {splitMode === "equal" ? (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider">Split between</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-icon-muted">
                        <Users className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        value={participantsStr}
                        onChange={(e) => setParticipantsStr(e.target.value)}
                        placeholder="Rahul, Amit, Sneha"
                        className="input-base pl-10 w-full"
                        required
                      />
                    </div>
                    <p className="text-[10px] font-semibold text-foreground-muted mt-0.5">
                      Comma-separated. Everyone listed shares the bill evenly.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider">Assign full bill to</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-icon-muted">
                        <UserCheck className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        value={assignTo}
                        onChange={(e) => setAssignTo(e.target.value)}
                        placeholder="e.g. Amit"
                        className="input-base pl-10 w-full"
                        required
                      />
                    </div>
                    <p className="text-[10px] font-semibold text-foreground-muted mt-0.5">
                      The entire amount will be owed by this person to the payer.
                    </p>
                  </div>
                )}

                {/* Live split preview */}
                {splitPreview && (
                  <div className="flex items-center gap-2 rounded-xl bg-primary-lighter border border-primary/20 px-3 py-2.5 text-xs font-bold text-primary">
                    <Scale className="w-3.5 h-3.5 shrink-0" />
                    <span>{splitPreview}</span>
                  </div>
                )}

                <button type="submit" className="btn-primary w-full flex justify-center items-center gap-2 mt-1">
                  <Plus className="w-4 h-4" />
                  Add to Pool
                </button>
              </div>
            </form>
          </div>

          {/* Logged Expenses */}
          {expenses.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground-secondary uppercase tracking-widest pl-2">
                Logged Bills
              </h4>
              <div className="space-y-2">
                {expenses.map((exp, idx) => (
                  <div key={idx} className="bg-background-subtle border border-border p-3 rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-primary-lighter border border-primary/20 flex items-center justify-center shrink-0">
                        <Receipt className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        {exp.description && (
                          <span className="font-extrabold text-foreground block text-sm truncate">{exp.description}</span>
                        )}
                        <span className={`text-foreground block truncate ${exp.description ? "text-[11px] font-semibold text-foreground-muted" : "text-sm font-bold"}`}>
                          {exp.paidBy} paid {formatAmount(exp.amount, "INR")}
                        </span>
                        <span className="text-[10px] font-bold text-foreground-muted truncate block">For: {exp.participants.join(", ")}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => removeExpense(idx)}
                      className="text-icon-muted hover:text-error p-1 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* People, their mobile numbers, and who "you" are */}
          {people.length > 0 && (
            <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4">
              <div className="space-y-1">
                <h3 className="font-extrabold text-foreground flex items-center gap-2">
                  <Phone className="w-4 h-4 text-brand" />
                  People & Contact Details
                </h3>
                <p className="text-[11px] font-semibold text-foreground-muted">
                  Add numbers for WhatsApp reminders and UPI IDs for one-tap settlements.
                </p>
              </div>

              {/* Who are you? */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3 h-3" /> You are
                </label>
                <select
                  value={youName}
                  onChange={(e) => setYouName(e.target.value)}
                  className="input-base w-full"
                >
                  <option value="">Select yourself…</option>
                  {people.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                {people.map((p) => (
                  <div key={p} className="space-y-1.5">
                    <span className="font-bold text-foreground text-sm block">{p}</span>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="tel"
                        value={contacts[p] || ""}
                        onChange={(e) => setContact(p, e.target.value)}
                        placeholder="+919876543210"
                        className="input-base w-full"
                      />
                      <input
                        type="text"
                        value={upiIds[p] || ""}
                        onChange={(e) => setUpiId(p, e.target.value.toLowerCase())}
                        placeholder="upi@okaxis"
                        className="input-base w-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Optimized Settlements */}
        <div className="space-y-6">
          <div className="bg-primary-lighter border border-primary/20 p-6 rounded-2xl shadow-sm flex flex-col h-full">
            <div className="space-y-1 mb-6">
              <h3 className="font-extrabold text-primary flex items-center gap-2 text-lg">
                <Users className="w-5 h-5" />
                Optimized Settlements
              </h3>
              <p className="text-xs font-semibold text-primary/70">
                Minimum necessary transfers to settle all debts.
              </p>
            </div>

            {settlements.length === 0 ? (
              <div className="flex-1 flex items-center justify-center border-2 border-dashed border-primary/20 rounded-xl p-8 text-center text-primary/50 text-sm font-bold">
                Add expenses to see who owes whom.
              </div>
            ) : (
              <div className="space-y-3 flex-1">
                {settlements.map((settlement, idx) => (
                  <div key={idx} className="bg-card p-4 rounded-xl shadow-sm border border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-foreground text-sm w-16 truncate">{settlement.from}</span>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-extrabold text-foreground-muted uppercase">Pays</span>
                        <ArrowRight className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-bold text-foreground text-sm w-16 truncate">{settlement.to}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-foreground">
                        {formatAmount(settlement.amount, "INR")}
                      </span>
                      <button
                        onClick={() => setActiveUpiSettle({ from: settlement.from, to: settlement.to, amount: settlement.amount })}
                        className="w-8 h-8 rounded-full bg-primary-lighter text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors cursor-pointer"
                        title="Settle via UPI"
                      >
                        <Smartphone className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenReminder(settlement.from, settlement.amount)}
                        className="w-8 h-8 rounded-full bg-success-light text-success flex items-center justify-center hover:bg-success hover:text-white transition-colors cursor-pointer"
                        title="Send SMS/WhatsApp Reminder"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ────────────────── YOUR PERSPECTIVE ────────────────── */}
      {youName && settlements.length > 0 && (
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <div className="space-y-1 mb-6">
            <h3 className="font-extrabold text-foreground flex items-center gap-2 text-lg">
              <User className="w-5 h-5 text-primary" />
              Your Summary · {youName}
            </h3>
            <p className="text-xs font-semibold text-foreground-muted">
              What people owe you, and what you owe others.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Who owes you */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-success">
                <ArrowDownLeft className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Who Owes You</span>
              </div>
              {whoOwesYou.length === 0 ? (
                <p className="text-xs font-semibold text-foreground-muted pl-1">
                  Nobody owes you right now.
                </p>
              ) : (
                whoOwesYou.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-success-light border border-success/20 p-3 rounded-xl"
                  >
                    <span className="font-bold text-foreground text-sm truncate pr-2">{s.from}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-black text-success text-sm">
                        + {formatAmount(s.amount, "INR")}
                      </span>
                      <button
                        onClick={() => handleOpenReminder(s.from, s.amount)}
                        className="w-7 h-7 rounded-full bg-success text-white flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer"
                        title="Send SMS/WhatsApp Reminder"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* You owe */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-error">
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">You Owe</span>
              </div>
              {youOwe.length === 0 ? (
                <p className="text-xs font-semibold text-foreground-muted pl-1">
                  You&apos;re all settled up.
                </p>
              ) : (
                youOwe.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-error-light border border-error/20 p-3 rounded-xl"
                  >
                    <span className="font-bold text-foreground text-sm truncate pr-2">{s.to}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-black text-error text-sm">
                        − {formatAmount(s.amount, "INR")}
                      </span>
                      <button
                        onClick={() => setActiveUpiSettle({ from: s.from, to: s.to, amount: s.amount })}
                        className="w-7 h-7 rounded-full bg-primary-lighter text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors cursor-pointer"
                        title="Pay via UPI"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── PER-PERSON NET BALANCES ────────────────── */}
      {balances.length > 0 && (
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <div className="space-y-1 mb-6">
            <h3 className="font-extrabold text-foreground flex items-center gap-2 text-lg">
              <Scale className="w-5 h-5 text-brand" />
              Net Balances
            </h3>
            <p className="text-xs font-semibold text-foreground-muted">
              Who needs to give money, and who gets it back.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Gets money back (creditors) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-success">
                <ArrowDownLeft className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  To Take Back
                </span>
              </div>
              {takeBack.length === 0 ? (
                <p className="text-xs font-semibold text-foreground-muted pl-1">
                  Nobody is owed money yet.
                </p>
              ) : (
                takeBack.map((b) => (
                  <div
                    key={b.person}
                    className="flex items-center justify-between bg-success-light border border-success/20 p-3 rounded-xl"
                  >
                    <span className="font-bold text-foreground text-sm truncate pr-2">
                      {b.person}
                    </span>
                    <span className="font-black text-success text-sm shrink-0">
                      + {formatAmount(b.balance, "INR")}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Owes money (debtors) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-error">
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  To Give
                </span>
              </div>
              {toGive.length === 0 ? (
                <p className="text-xs font-semibold text-foreground-muted pl-1">
                  Nobody owes money yet.
                </p>
              ) : (
                toGive.map((b) => (
                  <div
                    key={b.person}
                    className="flex items-center justify-between bg-error-light border border-error/20 p-3 rounded-xl"
                  >
                    <span className="font-bold text-foreground text-sm truncate pr-2">
                      {b.person}
                    </span>
                    <span className="font-black text-error text-sm shrink-0">
                      − {formatAmount(Math.abs(b.balance), "INR")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {settled.length > 0 && (
            <p className="text-[11px] font-semibold text-foreground-muted mt-5 pt-4 border-t border-border">
              Settled up: {settled.map((b) => b.person).join(", ")}
            </p>
          )}
        </div>
      )}
      {activeReminder && (
        <FlashReminderModal
          isOpen={true}
          onClose={() => setActiveReminder(null)}
          recipientName={activeReminder.recipientName}
          recipientPhone={activeReminder.phone}
          balance={activeReminder.balance}
          relation="settlement"
          onSendSuccess={() => {
            // Keep phone synced if modified in the modal
            if (activeReminder) {
              // Note: activeReminder.phone can be updated, let's keep it clean
            }
          }}
        />
      )}

      {activeUpiSettle && (
        <UpiPayModal
          isOpen={true}
          onClose={() => setActiveUpiSettle(null)}
          recipientName={activeUpiSettle.to}
          upiId={upiIds[activeUpiSettle.to] || ""}
          amount={activeUpiSettle.amount}
          note={`Bill settlement: ${activeUpiSettle.from} → ${activeUpiSettle.to}`}
          onPaymentConfirmed={() => {
            toast.success(`Settled ${formatAmount(activeUpiSettle.amount, "INR")} with ${activeUpiSettle.to}`);
          }}
        />
      )}
    </div>
  );
}
