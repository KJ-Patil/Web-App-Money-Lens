"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  UserPlus,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Phone,
  MessageSquare,
  X,
  Filter,
  Users,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Clock,
  AlertCircle,
} from "lucide-react";
import { formatAmount } from "@/core/utils/currencyManager";
import { validatePhone, toFullNumber, getCountryByCurrency } from "@/core/utils/countries";
import PhoneNumberInput from "@/components/inputs/PhoneNumberInput";
import {
  useLedgerCustomers,
  setLedgerCustomers,
  addTransaction,
  generateId,
  type LedgerCustomer,
  type LedgerEntry as StoreLedgerEntry,
} from "@/core/store/dataStore";
import FlashReminderModal from "@/components/modals/FlashReminderModal";

// Re-exported from the central data store so other ledger pages keep importing
// `Customer` / `LedgerEntry` from here.
export type LedgerEntry = StoreLedgerEntry;
export type Customer = LedgerCustomer;

type FilterTab = "all" | "credit" | "debit" | "settled";

export default function LedgerPage() {
  const customers = useLedgerCustomers();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCurrency, setActiveCurrency] = useState(() => {
    if (typeof window === "undefined") return "INR";
    return localStorage.getItem("active_currency") || "INR";
  });
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [selectedReminderCustomer, setSelectedReminderCustomer] = useState<Customer | null>(null);
  const [now] = useState(() => Date.now());

  // New account form fields
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState(""); // national number (no dial code)
  const [newCountry, setNewCountry] = useState(() => {
    if (typeof window === "undefined") return "IN";
    const cur = localStorage.getItem("active_currency") || "INR";
    const match = getCountryByCurrency(cur);
    return match ? match.iso2 : "IN";
  });
  const [phoneError, setPhoneError] = useState<string | null>(null);
  // Direction of the opening balance: "get" = they owe us, "give" = we owe them.
  const [newDirection, setNewDirection] = useState<"get" | "give">("get");
  const [initialBalance, setInitialBalance] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newUpiId, setNewUpiId] = useState("");

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    // Validate the phone number against the selected country's digit rules.
    const phoneValidationError = validatePhone(newCountry, newPhone);
    if (phoneValidationError) {
      setPhoneError(phoneValidationError);
      return;
    }
    setPhoneError(null);

    const numBal = parseFloat(initialBalance) || 0;
    const finalBalance =
      newDirection === "give" ? -Math.abs(numBal) : Math.abs(numBal);

    const name = newName;
    let history: LedgerEntry[] = [];

    if (finalBalance !== 0) {
      const openingType: "gave" | "got" = finalBalance > 0 ? "gave" : "got";
      // Mirror the opening balance into the transactions ledger so it reflects
      // in the dashboard's balance / expense totals (and syncs to the DB).
      const tx = addTransaction({
        amount: Math.abs(finalBalance),
        type: openingType === "gave" ? "expense" : "income",
        category: "Ledger",
        description: `${openingType === "gave" ? "Gave to" : "Got from"} ${name}: Opening balance`,
      });
      history = [
        {
          id: generateId(),
          amount: Math.abs(finalBalance),
          type: openingType,
          description: "Initial balance recording",
          date: tx.date,
          txId: tx.id,
        },
      ];
    }

    const newCust: Customer = {
      id: generateId(),
      name,
      phone: toFullNumber(newCountry, newPhone), // e.g. "+919876543210"
      balance: finalBalance,
      history,
      ...(newDescription ? { description: newDescription } : {}),
      ...(newUpiId.trim() ? { upiId: newUpiId.trim() } : {}),
    };

    setLedgerCustomers([newCust, ...customers]);

    // Clear form
    setNewName("");
    setNewPhone("");
    setPhoneError(null);
    setNewDirection("get");
    setInitialBalance("");
    setNewDescription("");
    setNewUpiId("");
    setIsAddOpen(false);
  };

  // Computed values
  const filteredCustomers = useMemo(() => {
    let filtered = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery)
    );

    switch (activeFilter) {
      case "credit":
        filtered = filtered.filter((c) => c.balance > 0);
        break;
      case "debit":
        filtered = filtered.filter((c) => c.balance < 0);
        break;
      case "settled":
        filtered = filtered.filter((c) => c.balance === 0);
        break;
    }

    // Sort: unsettled accounts first (by absolute balance desc), then settled
    return filtered.sort(
      (a, b) => Math.abs(b.balance) - Math.abs(a.balance)
    );
  }, [customers, searchQuery, activeFilter]);

  const netStats = useMemo(() => {
    let toGet = 0;
    let toGive = 0;
    let settledCount = 0;
    customers.forEach((c) => {
      if (c.balance > 0) toGet += c.balance;
      else if (c.balance < 0) toGive += Math.abs(c.balance);
      else settledCount++;
    });
    return { toGet, toGive, settledCount, netBalance: toGet - toGive };
  }, [customers]);

  // Receivable / payable totals for just the currently-shown (searched) accounts,
  // surfaced as KPI cards under the search box while a search is active.
  const filteredStats = useMemo(() => {
    let receivable = 0;
    let payable = 0;
    filteredCustomers.forEach((c) => {
      if (c.balance > 0) receivable += c.balance;
      else if (c.balance < 0) payable += Math.abs(c.balance);
    });
    return { receivable, payable };
  }, [filteredCustomers]);

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "All Books", count: customers.length },
    {
      key: "credit",
      label: "Credits",
      count: customers.filter((c) => c.balance > 0).length,
    },
    {
      key: "debit",
      label: "Debits",
      count: customers.filter((c) => c.balance < 0).length,
    },
    {
      key: "settled",
      label: "Settled",
      count: customers.filter((c) => c.balance === 0).length,
    },
  ];

  const getLastActivityLabel = (c: Customer) => {
    if (c.history.length === 0) return "No activity";
    const last = c.history[0];
    const daysDiff = Math.floor(
      (now - new Date(last.date).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff === 0) return "Today";
    if (daysDiff === 1) return "Yesterday";
    return `${daysDiff}d ago`;
  };

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 md:p-8 max-w-5xl mx-auto w-full">
      {/* ────────────────── HEADER ────────────────── */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl">
            Notebook Ledger
          </h1>
          <p className="text-sm font-medium text-foreground-muted">
            Track credits and debts across your account books.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="btn-primary shrink-0 flex items-center justify-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Add Account Book
        </button>
      </div>

      {/* ────────────────── NET BALANCE SUMMARY GRID ────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Credits summary */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-center gap-4 group hover:border-success/30 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-success-light text-success flex items-center justify-center shrink-0 border border-success/15 group-hover:scale-105 transition-transform">
            <TrendingUp className="w-6 h-6 stroke-[2.5px]" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider block">
              Total Receivable
            </span>
            <span className="text-2xl font-black tracking-tight text-success">
              {formatAmount(netStats.toGet, activeCurrency)}
            </span>
          </div>
        </div>

        {/* Debits summary */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-center gap-4 group hover:border-error/30 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-error-light text-error flex items-center justify-center shrink-0 border border-error/15 group-hover:scale-105 transition-transform">
            <TrendingDown className="w-6 h-6 stroke-[2.5px]" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider block">
              Total Payable
            </span>
            <span className="text-2xl font-black tracking-tight text-error">
              {formatAmount(netStats.toGive, activeCurrency)}
            </span>
          </div>
        </div>

        {/* Net position */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-center gap-4 group hover:border-primary/30 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-primary-lighter text-primary flex items-center justify-center shrink-0 border border-primary/15 group-hover:scale-105 transition-transform">
            <Users className="w-6 h-6 stroke-[2.5px]" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider block">
              Net Position
            </span>
            <span
              className={`text-2xl font-black tracking-tight ${
                netStats.netBalance >= 0 ? "text-success" : "text-error"
              }`}
            >
              {netStats.netBalance >= 0 ? "+" : "-"}
              {formatAmount(Math.abs(netStats.netBalance), activeCurrency)}
            </span>
          </div>
        </div>
      </section>

      {/* ────────────────── FILTER TABS + SEARCH ────────────────── */}
      <section className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {/* Filter Tabs */}
        <div className="flex border-b border-border overflow-x-auto">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`flex items-center gap-1.5 px-5 py-3.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap border-b-2 ${
                activeFilter === tab.key
                  ? "text-primary border-primary bg-primary-lighter/50"
                  : "text-foreground-muted border-transparent hover:text-foreground-secondary hover:bg-secondary/50"
              }`}
            >
              {tab.label}
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
                  activeFilter === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground-secondary"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="p-4">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-icon-muted">
              <Search className="w-5 h-5" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base pl-10 w-full"
              placeholder="Search accounts by name or phone digits..."
            />
          </div>

          {/* Receivable / payable totals for the currently-searched accounts */}
          {searchQuery.trim() !== "" && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-card border border-border p-3.5 rounded-xl shadow-sm flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-success-light text-success flex items-center justify-center shrink-0 border border-success/15">
                  <TrendingUp className="w-4 h-4 stroke-[2.5px]" />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-foreground-secondary uppercase tracking-wider block">
                    Total Receivable
                  </span>
                  <span className="text-lg font-black tracking-tight text-success">
                    {formatAmount(filteredStats.receivable, activeCurrency)}
                  </span>
                </div>
              </div>

              <div className="bg-card border border-border p-3.5 rounded-xl shadow-sm flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-error-light text-error flex items-center justify-center shrink-0 border border-error/15">
                  <TrendingDown className="w-4 h-4 stroke-[2.5px]" />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-foreground-secondary uppercase tracking-wider block">
                    Total Payable
                  </span>
                  <span className="text-lg font-black tracking-tight text-error">
                    {formatAmount(filteredStats.payable, activeCurrency)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ────────────────── CUSTOMER DIRECTORY LIST ────────────────── */}
      <section className="space-y-3">
        {filteredCustomers.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-secondary text-foreground-muted flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-foreground-muted">
              No matching account books found.
            </p>
            <p className="text-xs text-foreground-muted">
              Try adjusting your search or filter criteria.
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl shadow-sm divide-y divide-border overflow-hidden">
            {filteredCustomers.map((c) => {
              const isCredit = c.balance > 0;
              const isDebit = c.balance < 0;
              const absVal = Math.abs(c.balance);
              const isSettled = c.balance === 0;

              return (
                <div
                  key={c.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-secondary/20 transition-all group"
                >
                  {/* Left Block: Avatar + Name + Phone + Last Activity */}
                  <Link
                    href={`/ledger/${c.id}`}
                    className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer"
                  >
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-sm border shrink-0 transition-all ${
                        isCredit
                          ? "bg-success-light text-success border-success/15 group-hover:bg-success group-hover:text-success-foreground"
                          : isDebit
                            ? "bg-error-light text-error border-error/15 group-hover:bg-error group-hover:text-error-foreground"
                            : "bg-secondary text-foreground-secondary border-border group-hover:bg-primary-lighter group-hover:text-primary"
                      }`}
                    >
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <span className="font-extrabold text-foreground text-sm block truncate group-hover:text-primary transition-colors">
                        {c.name}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-foreground-muted font-semibold flex items-center gap-1">
                          <Phone className="w-3 h-3 text-icon-muted" />
                          {c.phone}
                        </span>
                        <span className="text-[10px] text-foreground-muted font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3 text-icon-muted" />
                          {getLastActivityLabel(c)}
                        </span>
                      </div>
                      {c.description && (
                        <p className="text-[11px] text-foreground-secondary italic mt-1 font-medium truncate max-w-xs sm:max-w-md">
                          {c.description}
                        </p>
                      )}
                    </div>
                  </Link>

                  {/* Right Block: Balance + WhatsApp + Navigate */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-0 pt-3 sm:pt-0 border-border">
                    {/* Dynamic balances indicators */}
                    <div className="text-right space-y-0.5 min-w-[80px]">
                      <span
                        className={`text-base font-black tracking-tight ${
                          isCredit
                            ? "text-success"
                            : isDebit
                              ? "text-error"
                              : "text-foreground-secondary"
                        }`}
                      >
                        {isSettled ? "—" : formatAmount(absVal, activeCurrency)}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider block text-foreground-muted">
                        {isCredit
                          ? "You will get"
                          : isDebit
                            ? "You will give"
                            : "Settled"}
                      </span>
                    </div>

                    {/* Quick SMS/WhatsApp Reminder Trigger */}
                    {c.balance !== 0 && (
                      <button
                        onClick={() => setSelectedReminderCustomer(c)}
                        className="p-2.5 rounded-xl border border-border bg-background hover:bg-success-light text-success hover:border-success transition-all cursor-pointer flex items-center justify-center"
                        title="Send SMS/WhatsApp Balance Statement"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    )}

                    {/* Chevron to detail */}
                    <Link
                      href={`/ledger/${c.id}`}
                      className="p-2 rounded-lg text-icon-muted hover:text-primary hover:bg-primary-lighter transition-all cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ────────────────── ADD ACCOUNT OVERLAY DIALOG ────────────────── */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center p-0 md:p-4 animate-in fade-in duration-200">
          <div className="w-full bg-card border-t md:border border-border rounded-t-3xl md:rounded-2xl max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-background-subtle">
              <h3 className="text-base font-black text-foreground">
                Add New Account Book
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-icon-muted hover:text-icon-active p-1 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddAccount} className="p-6 space-y-4">
              {/* Opening balance direction (who owes whom) */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-secondary rounded-xl">
                <button
                  type="button"
                  onClick={() => setNewDirection("get")}
                  className={`py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    newDirection === "get"
                      ? "bg-card text-primary shadow-sm"
                      : "text-foreground-secondary hover:text-foreground"
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5 inline mr-1" />
                  You will get
                </button>
                <button
                  type="button"
                  onClick={() => setNewDirection("give")}
                  className={`py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    newDirection === "give"
                      ? "bg-card text-destructive shadow-sm"
                      : "text-foreground-secondary hover:text-foreground"
                  }`}
                >
                  <ArrowDownRight className="w-3.5 h-3.5 inline mr-1" />
                  You will give
                </button>
              </div>

              {/* Account Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                  Contact / Account Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="input-base w-full"
                  placeholder="e.g. Arun Kumar"
                  required
                />
              </div>

              {/* Phone Number — country-aware with per-country length limits */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                  Phone Number
                </label>
                <PhoneNumberInput
                  country={newCountry}
                  onCountryChange={(iso2) => {
                    setNewCountry(iso2);
                    setPhoneError(null);
                  }}
                  value={newPhone}
                  onChange={(num) => {
                    setNewPhone(num);
                    if (phoneError) setPhoneError(null);
                  }}
                  error={phoneError}
                />
              </div>

              {/* UPI ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                  UPI ID (Optional)
                </label>
                <input
                  type="text"
                  value={newUpiId}
                  onChange={(e) => setNewUpiId(e.target.value)}
                  className="input-base w-full"
                  placeholder="e.g. name@okaxis"
                />
                <p className="text-[10px] font-semibold text-foreground-muted">
                  Add their UPI ID to enable one-tap payments.
                </p>
              </div>

              {/* Initial Balance */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                  Opening Balance ({activeCurrency})
                </label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    className="input-base pr-3 w-full"
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>

              {/* Account Description / Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                  Account Description / Notes
                </label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="input-base w-full"
                  placeholder="e.g. Regular wholesale grocery buyer"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  <UserPlus className="w-4 h-4 inline mr-1" />
                  Create Book
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Flash message reminder dispatcher */}
      {selectedReminderCustomer && (
        <FlashReminderModal
          isOpen={true}
          onClose={() => setSelectedReminderCustomer(null)}
          recipientName={selectedReminderCustomer.name}
          recipientPhone={selectedReminderCustomer.phone}
          balance={selectedReminderCustomer.balance}
          relation={selectedReminderCustomer.balance > 0 ? "credit" : "debit"}
          currency={activeCurrency}
        />
      )}
    </div>
  );
}
