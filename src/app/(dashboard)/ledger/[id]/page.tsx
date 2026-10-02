"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Phone,
  Calendar,
  Save,
  X,
  MessageSquare,
  Hash,
  FileText,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { formatAmount, toBaseAmount } from "@/core/utils/currencyManager";
import { Customer, LedgerEntry } from "../page";
import {
  getLedgerCustomers,
  setLedgerCustomers,
  addTransaction,
  deleteTransaction,
  generateId,
} from "@/core/store/dataStore";
import FlashReminderModal from "@/components/modals/FlashReminderModal";

import { formatDate } from "@/core/utils/dateFormat";
export default function CustomerLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const customerId = resolvedParams.id;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activeCurrency, setActiveCurrency] = useState("INR");
  const [loading, setLoading] = useState(true);

  // Flow logs variables
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [entryType, setEntryType] = useState<"gave" | "got">("gave");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isReminderOpen, setIsReminderOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Re-derive this customer whenever the ledger store changes (local edits,
    // cross-tab writes, or remote Firestore sync).
    const sync = () => {
      const cur = localStorage.getItem("active_currency");
      if (cur) setActiveCurrency(cur);
      const found = getLedgerCustomers().find((c) => c.id === customerId);
      if (found) {
        setCustomer(found);
      } else {
        router.push("/ledger");
      }
      setLoading(false);
    };
    sync();
    window.addEventListener("datastore:change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("datastore:change", sync);
      window.removeEventListener("storage", sync);
    };
  }, [customerId, router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!customer) return null;

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    // The field is labelled with the active currency, but balances and the
    // transaction ledger are stored in base (INR) — convert before recording.
    const baseAmount = toBaseAmount(numAmount, activeCurrency);

    // Load active lists
    const customersList = getLedgerCustomers();
    if (customersList.length === 0) return;

    // Calculate new balance
    // Gave: we gave goods/money, they owe us more (increases balance)
    // Got: we got payment/money, they owe us less (decreases balance)
    const balanceAdjustment = entryType === "gave" ? baseAmount : -baseAmount;
    const nextBalance = customer.balance + balanceAdjustment;

    const entryDescription =
      description || (entryType === "gave" ? "Gave credit" : "Got payment");

    // Mirror into the transactions ledger through the data store so the change
    // syncs to the DB, fires the change event, and updates the dashboard totals.
    const tx = addTransaction({
      amount: baseAmount,
      type: entryType === "gave" ? "expense" : "income",
      category: "Ledger",
      description: `${entryType === "gave" ? "Gave to" : "Got from"} ${customer.name}: ${entryDescription}`,
    });

    const newLog: LedgerEntry = {
      id: generateId(),
      amount: baseAmount,
      type: entryType,
      description: entryDescription,
      date: tx.date,
      txId: tx.id,
    };

    const updatedCust: Customer = {
      ...customer,
      balance: nextBalance,
      history: [newLog, ...customer.history],
    };

    const updatedList = customersList.map((c) =>
      c.id === customer.id ? updatedCust : c
    );
    setLedgerCustomers(updatedList);
    setCustomer(updatedCust);

    // Clear state
    setAmount("");
    setDescription("");
    setIsEntryOpen(false);
  };

  const handleDeleteEntry = (entryId: string) => {
    const customersList = getLedgerCustomers();
    if (customersList.length === 0) return;

    const entry = customer.history.find((h) => h.id === entryId);
    if (!entry) return;

    // Remove the linked transaction so the dashboard totals reverse too.
    if (entry.txId) deleteTransaction(entry.txId);

    // Reverse the balance effect
    const balanceReverse = entry.type === "gave" ? -entry.amount : entry.amount;
    const nextBalance = customer.balance + balanceReverse;

    const updatedCust: Customer = {
      ...customer,
      balance: nextBalance,
      history: customer.history.filter((h) => h.id !== entryId),
    };

    const updatedList = customersList.map((c) =>
      c.id === customer.id ? updatedCust : c
    );
    setLedgerCustomers(updatedList);
    setCustomer(updatedCust);
    setDeleteConfirmId(null);
  };

  const handleOpenForm = (type: "gave" | "got") => {
    setEntryType(type);
    setIsEntryOpen(true);
  };

  const absBal = Math.abs(customer.balance);
  const isCredit = customer.balance > 0;
  const isDebit = customer.balance < 0;
  const isSettled = customer.balance === 0;

  // Compute running balance for each history entry (newest first)
  const historyWithRunning = (() => {
    const result = [];
    let running = customer.balance;
    for (let i = 0; i < customer.history.length; i++) {
      const entry = customer.history[i];
      const currentRunning = running;
      if (i < customer.history.length - 1) {
        running =
          entry.type === "gave"
            ? running - entry.amount
            : running + entry.amount;
      }
      result.push({ ...entry, runningBalance: currentRunning });
    }
    return result;
  })();

  // Stats
  const totalGave = customer.history
    .filter((h) => h.type === "gave")
    .reduce((s, h) => s + h.amount, 0);
  const totalGot = customer.history
    .filter((h) => h.type === "got")
    .reduce((s, h) => s + h.amount, 0);

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 md:p-8 max-w-4xl mx-auto w-full">
      {/* ────────────────── NAVIGATION HEADER ────────────────── */}
      <header className="flex justify-between items-center bg-card border border-border p-4 rounded-2xl shadow-sm">
        <Link
          href="/ledger"
          className="flex items-center gap-2 text-xs font-bold text-foreground-secondary hover:text-primary transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Notebook Ledger
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-foreground-muted flex items-center gap-1">
            <Hash className="w-3 h-3" />
            {customer.id}
          </span>
        </div>
      </header>

      {/* ────────────────── CUSTOMER BALANCE CARD ────────────────── */}
      <section
        className={`border p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-5 ${
          isCredit
            ? "bg-success-light/30 border-success/20"
            : isDebit
              ? "bg-error-light/30 border-error/20"
              : "bg-card border-border"
        }`}
      >
        <div className="space-y-1.5">
          <h2 className="text-2xl font-black text-foreground">
            {customer.name}
          </h2>
          <span className="text-xs font-semibold text-foreground-secondary flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-icon-muted" />
            {customer.phone}
          </span>
          {customer.description && (
            <div className="text-xs font-bold text-foreground-secondary/90 bg-background/50 border border-border px-3 py-1.5 rounded-lg mt-2 inline-block max-w-sm">
              Notes: <span className="font-semibold text-foreground-muted">{customer.description}</span>
            </div>
          )}
        </div>

        <div className="text-left sm:text-right space-y-1">
          <span
            className={`text-3xl font-black tracking-tight ${
              isCredit
                ? "text-success"
                : isDebit
                  ? "text-error"
                  : "text-foreground-secondary"
            }`}
          >
            {isSettled ? "₹ 0" : formatAmount(absBal, activeCurrency)}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider block text-foreground-muted">
            {isCredit
              ? "Net Credit (You will get)"
              : isDebit
                ? "Net Debit (You will give)"
                : "Settled Balance"}
          </span>
        </div>
      </section>

      {/* ────────────────── TRANSACTION TOTALS STRIP ────────────────── */}
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-success-light text-success flex items-center justify-center shrink-0 border border-success/10">
            <ArrowUpRight className="w-4 h-4 stroke-[2.5px]" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-foreground-muted uppercase tracking-wider block">
              Total Given
            </span>
            <span className="text-lg font-black text-success tracking-tight">
              {formatAmount(totalGave, activeCurrency)}
            </span>
          </div>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-error-light text-error flex items-center justify-center shrink-0 border border-error/10">
            <ArrowDownRight className="w-4 h-4 stroke-[2.5px]" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-foreground-muted uppercase tracking-wider block">
              Total Received
            </span>
            <span className="text-lg font-black text-error tracking-tight">
              {formatAmount(totalGot, activeCurrency)}
            </span>
          </div>
        </div>
      </section>

      {/* ────────────────── QUICK BOOK ENTRIES (GAVE / GOT) + WHATSAPP ────────────────── */}
      <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <button
          onClick={() => handleOpenForm("gave")}
          className="py-4 rounded-2xl bg-success text-success-foreground border border-success hover:brightness-110 text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
        >
          <ArrowUpRight className="w-5 h-5 stroke-[2.5px]" />
          You Gave
        </button>

        <button
          onClick={() => handleOpenForm("got")}
          className="py-4 rounded-2xl bg-error text-error-foreground border border-error hover:brightness-110 text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
        >
          <ArrowDownRight className="w-5 h-5 stroke-[2.5px]" />
          You Got
        </button>

        {/* WhatsApp Quick Action */}
        {!isSettled && (
          <button
            onClick={() => setIsReminderOpen(true)}
            className="py-4 rounded-2xl bg-card border-2 border-dashed border-success/40 text-success hover:bg-success-light hover:border-success text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer col-span-2 sm:col-span-1"
          >
            <MessageSquare className="w-5 h-5 stroke-[2.5px]" />
            Send Reminder
          </button>
        )}
      </section>

      {/* ────────────────── ENTRY SUB-FORM (INLINE OVERLAY) ────────────────── */}
      {isEntryOpen && (
        <div className="bg-card border border-border p-5 rounded-2xl shadow-md space-y-4 animate-in slide-in-from-top duration-200">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-icon-muted" />
              New Ledger Entry:{" "}
              <span
                className={`px-2.5 py-0.5 rounded-md text-[10px] uppercase ${
                  entryType === "gave"
                    ? "bg-success-light text-success"
                    : "bg-error-light text-error"
                }`}
              >
                {entryType === "gave" ? "Gave credit" : "Got payment"}
              </span>
            </h3>
            <button
              onClick={() => setIsEntryOpen(false)}
              className="text-icon-muted hover:text-foreground p-1.5 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form
            onSubmit={handleAddEntry}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end"
          >
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider">
                Value Amount ({activeCurrency})
              </label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input-base pr-3 w-full text-sm font-bold"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider">
                Ledger Narrative
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-base w-full text-sm"
                placeholder="e.g. Credit sale invoice"
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full flex items-center justify-center gap-2 h-[42px]"
            >
              <Save className="w-4 h-4" />
              Save Record
            </button>
          </form>
        </div>
      )}

      {/* ────────────────── RUNNING LEDGER ROW HISTORY ────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-foreground-secondary uppercase tracking-widest">
            Ledger Sheet History
          </h3>
          <span className="text-[10px] font-bold text-foreground-muted">
            {customer.history.length} entries
          </span>
        </div>

        {customer.history.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center text-foreground-muted text-sm shadow-sm space-y-2">
            <FileText className="w-8 h-8 text-icon-muted mx-auto" />
            <p className="font-semibold">
              No entries registered in this notebook sheet yet.
            </p>
            <p className="text-xs">
              Use the Gave / Got buttons above to start recording.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {historyWithRunning.map((entry) => {
              const isGave = entry.type === "gave";
              const isRunningPositive = entry.runningBalance >= 0;
              return (
                <div
                  key={entry.id}
                  className="bg-card border border-border p-4 rounded-xl shadow-sm transition-all hover:shadow-md group"
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Left: icon + description + date */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                          isGave
                            ? "bg-success-light text-success border-success/10"
                            : "bg-error-light text-error border-error/10"
                        }`}
                      >
                        {isGave ? (
                          <ArrowUpRight className="w-4 h-4 stroke-[2.5px]" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 stroke-[2.5px]" />
                        )}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <span className="font-extrabold text-foreground text-sm block truncate">
                          {entry.description}
                        </span>
                        <span className="text-[10px] text-foreground-muted font-semibold flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-icon-muted" />
                          {formatDate(entry.date, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Right: amount + running balance + delete */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right space-y-0.5">
                        <span
                          className={`text-base font-black tracking-tight ${
                            isGave ? "text-success" : "text-error"
                          }`}
                        >
                          {isGave ? "+" : "-"}
                          {formatAmount(entry.amount, activeCurrency)}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider block text-foreground-muted">
                          {isGave ? "You Gave" : "You Got"}
                        </span>
                      </div>

                      {/* Running balance indicator */}
                      <div className="hidden sm:block text-right border-l border-border pl-4 min-w-[80px]">
                        <span
                          className={`text-xs font-black tracking-tight ${
                            isRunningPositive
                              ? "text-success"
                              : "text-error"
                          }`}
                        >
                          {formatAmount(
                            Math.abs(entry.runningBalance),
                            activeCurrency
                          )}
                        </span>
                        <span className="text-[8px] font-bold uppercase tracking-wider block text-foreground-muted">
                          Running Bal.
                        </span>
                      </div>

                      {/* Delete action */}
                      {deleteConfirmId === entry.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="p-1.5 rounded-lg bg-error text-error-foreground hover:brightness-110 transition-all cursor-pointer"
                            title="Confirm Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="p-1.5 rounded-lg bg-secondary text-foreground-secondary hover:bg-border transition-all cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(entry.id)}
                          className="p-1.5 rounded-lg text-icon-muted opacity-0 group-hover:opacity-100 hover:text-error hover:bg-error-light transition-all cursor-pointer"
                          title="Delete Entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Flash message reminder dispatcher */}
      {isReminderOpen && (
        <FlashReminderModal
          isOpen={true}
          onClose={() => setIsReminderOpen(false)}
          recipientName={customer.name}
          recipientPhone={customer.phone}
          balance={customer.balance}
          relation={customer.balance > 0 ? "credit" : "debit"}
          currency={activeCurrency}
        />
      )}
    </div>
  );
}
