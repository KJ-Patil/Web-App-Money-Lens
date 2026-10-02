"use client";

import React, { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  List,
  BookOpen,
  Search,
  CalendarClock,
  CreditCard,
  Repeat,
} from "lucide-react";
import { formatAmount } from "@/core/utils/currencyManager";
import {
  useTransactions,
  useLedgerCustomers,
  useLoans,
  useManualSubscriptions,
  type Transaction,
} from "@/core/store/dataStore";
import { toDateKey, parseDateKey } from "@/core/utils/calendar";
import { computeDueDates } from "@/core/utils/dueDates";

import { formatDate } from "@/core/utils/dateFormat";
interface LedgerHit {
  customerName: string;
  /** The account's current running balance (+ you get, − you give). */
  customerBalance: number;
  entry: { id: string; amount: number; type: "gave" | "got"; description: string };
}

export default function CalendarDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date: dateParam } = use(params);
  const transactions = useTransactions();
  const ledgerCustomers = useLedgerCustomers();
  const loans = useLoans();
  const manualSubs = useManualSubscriptions();
  const [activeCurrency, setActiveCurrency] = useState("INR");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cur = localStorage.getItem("active_currency");
      if (cur) setActiveCurrency(cur);
    }
  }, []);

  const parsed = parseDateKey(dateParam);
  const dayKey = parsed ? toDateKey(parsed) : "";

  // Ledger-mirrored transaction ids — these belong under Notebook Ledger only.
  const ledgerTxIds = useMemo(() => {
    const set = new Set<string>();
    ledgerCustomers.forEach((c) =>
      c.history.forEach((e) => {
        if (e.txId) set.add(e.txId);
      })
    );
    return set;
  }, [ledgerCustomers]);

  // Standalone transactions recorded on this day.
  const dayTxs = useMemo<Transaction[]>(() => {
    if (!dayKey) return [];
    return transactions
      .filter(
        (tx) => !ledgerTxIds.has(tx.id) && toDateKey(new Date(tx.date)) === dayKey
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, ledgerTxIds, dayKey]);

  // Notebook ledger activity recorded on this day.
  const dayLedger = useMemo<LedgerHit[]>(() => {
    if (!dayKey) return [];
    const hits: LedgerHit[] = [];
    ledgerCustomers.forEach((c) =>
      c.history.forEach((entry) => {
        if (toDateKey(new Date(entry.date)) === dayKey) {
          hits.push({ customerName: c.name, customerBalance: c.balance, entry });
        }
      })
    );
    return hits;
  }, [ledgerCustomers, dayKey]);

  // Upcoming obligations (EMIs + subscription renewals) falling on this day.
  const dayDue = useMemo(() => {
    if (!dayKey) return [];
    return computeDueDates(loans, transactions, manualSubs)[dayKey] ?? [];
  }, [loans, transactions, manualSubs, dayKey]);

  // Search filter across all lists. Totals and the section counts reflect the
  // currently-filtered results.
  const query = searchQuery.trim().toLowerCase();
  const filteredTxs = query
    ? dayTxs.filter(
        (tx) =>
          tx.description.toLowerCase().includes(query) ||
          tx.category.toLowerCase().includes(query)
      )
    : dayTxs;
  const filteredLedger = query
    ? dayLedger.filter(
        (h) =>
          h.customerName.toLowerCase().includes(query) ||
          h.entry.description.toLowerCase().includes(query)
      )
    : dayLedger;
  const filteredDue = query
    ? dayDue.filter((item) => item.label.toLowerCase().includes(query))
    : dayDue;

  // Totals combine transactions and ledger movements: "Got" is money in,
  // "Gave" is money out — so both reflect in the KPI cards under any filter.
  const income =
    filteredTxs
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0) +
    filteredLedger
      .filter((h) => h.entry.type === "got")
      .reduce((s, h) => s + h.entry.amount, 0);
  const expense =
    filteredTxs
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + t.amount, 0) +
    filteredLedger
      .filter((h) => h.entry.type === "gave")
      .reduce((s, h) => s + h.entry.amount, 0);

  const heading = parsed
    ? formatDate(parsed, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Invalid date";

  const hasAnyData =
    dayTxs.length > 0 || dayLedger.length > 0 || dayDue.length > 0;
  const isEmpty =
    filteredTxs.length === 0 &&
    filteredLedger.length === 0 &&
    filteredDue.length === 0;

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 md:p-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="space-y-3">
        <Link
          href="/calendar"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Calendar
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl">
            {heading}
          </h1>
          <p className="text-sm font-medium text-foreground-muted">
            All income, expenses and ledger activity on this day.
          </p>
        </div>
      </div>

      {/* Search / filter */}
      {hasAnyData && (
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-icon-muted">
            <Search className="w-5 h-5" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-base pl-10 w-full"
            placeholder="Filter by name, category or note (e.g. Viraj)..."
          />
        </div>
      )}

      {/* Day totals */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-success-light text-success flex items-center justify-center shrink-0 border border-success/15">
            <ArrowUpRight className="w-6 h-6 stroke-[2.5px]" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider block">
              Total Income
            </span>
            <span className="text-2xl font-black tracking-tight text-success">
              {formatAmount(income, activeCurrency)}
            </span>
          </div>
        </div>
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-error-light text-error flex items-center justify-center shrink-0 border border-error/15">
            <ArrowDownRight className="w-6 h-6 stroke-[2.5px]" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider block">
              Total Expense
            </span>
            <span className="text-2xl font-black tracking-tight text-error">
              {formatAmount(expense, activeCurrency)}
            </span>
          </div>
        </div>
      </div>

      {isEmpty ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-sm text-foreground-muted shadow-sm">
          {hasAnyData
            ? "No matches for your search."
            : "Nothing recorded on this day."}
        </div>
      ) : (
        <>
          {/* Upcoming / due */}
          {filteredDue.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                <CalendarClock className="w-3.5 h-3.5" />
                Due / Upcoming ({filteredDue.length})
              </div>
              <div className="bg-card border border-border rounded-2xl shadow-sm divide-y divide-border overflow-hidden">
                {filteredDue.map((item, i) => {
                  const Icon = item.kind === "emi" ? CreditCard : Repeat;
                  return (
                    <div
                      key={`${item.kind}-${item.label}-${i}`}
                      className="p-4 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-warning-light text-warning flex items-center justify-center shrink-0 border border-warning/15">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-sm text-foreground block truncate">
                            {item.label}
                          </span>
                          <span className="text-[11px] text-foreground-muted font-semibold capitalize">
                            {item.kind === "emi" ? "Loan EMI" : "Subscription"}
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-black tracking-tight shrink-0 text-warning">
                        {formatAmount(item.amount, activeCurrency)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Transactions */}
          {filteredTxs.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                <List className="w-3.5 h-3.5" />
                Transactions ({filteredTxs.length})
              </div>
              <div className="bg-card border border-border rounded-2xl shadow-sm divide-y divide-border overflow-hidden">
                {filteredTxs.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-sm text-foreground block truncate">
                        {tx.description}
                      </span>
                      <span className="text-[11px] text-foreground-muted font-semibold">
                        {tx.category}
                      </span>
                    </div>
                    <span
                      className={`text-sm font-black tracking-tight shrink-0 ${
                        tx.type === "income" ? "text-success" : "text-error"
                      }`}
                    >
                      {tx.type === "income" ? "+" : "-"}
                      {formatAmount(tx.amount, activeCurrency)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Notebook ledger */}
          {filteredLedger.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                <BookOpen className="w-3.5 h-3.5" />
                Notebook Ledger ({filteredLedger.length})
              </div>
              <div className="bg-card border border-border rounded-2xl shadow-sm divide-y divide-border overflow-hidden">
                {filteredLedger.map(({ customerName, customerBalance, entry }) => {
                  const isGot = entry.type === "got";
                  // Overall account standing (independent of this single entry).
                  const balanceText =
                    customerBalance > 0
                      ? `You will get ${formatAmount(customerBalance, activeCurrency)}`
                      : customerBalance < 0
                        ? `You will give ${formatAmount(Math.abs(customerBalance), activeCurrency)}`
                        : "Settled";
                  const balanceCls =
                    customerBalance > 0
                      ? "text-success"
                      : customerBalance < 0
                        ? "text-error"
                        : "text-foreground-muted";
                  return (
                    <div
                      key={entry.id}
                      className="p-4 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-sm text-foreground block truncate">
                          {customerName}
                        </span>
                        <span className="text-[11px] text-foreground-muted font-semibold">
                          {isGot ? "Got" : "Gave"}
                          {entry.description ? ` · ${entry.description}` : ""}
                        </span>
                        <span className={`text-[11px] font-bold block ${balanceCls}`}>
                          {balanceText}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-black tracking-tight shrink-0 ${
                          isGot ? "text-success" : "text-error"
                        }`}
                      >
                        {isGot ? "+" : "-"}
                        {formatAmount(entry.amount, activeCurrency)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
