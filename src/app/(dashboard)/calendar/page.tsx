"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { formatAmount } from "@/core/utils/currencyManager";
import {
  useTransactions,
  useLedgerCustomers,
  useLoans,
  useManualSubscriptions,
  type Transaction,
} from "@/core/store/dataStore";
import { toDateKey, isSameDay, buildMonthGrid } from "@/core/utils/calendar";
import { getMonthLabels, getWeekdayLabels } from "@/core/utils/dateFormat";
import { computeDueDates } from "@/core/utils/dueDates";

export default function CalendarPage() {
  const router = useRouter();
  const transactions = useTransactions();
  const ledgerCustomers = useLedgerCustomers();
  const loans = useLoans();
  const manualSubs = useManualSubscriptions();
  const today = new Date();

  const [viewDate, setViewDate] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );

  // Built once per mount rather than per render: each call runs 12 (or 7) Intl
  // formats. The language can only change via a full reload, so there is nothing
  // to re-derive while this page is mounted.
  const monthLabels = useMemo(() => getMonthLabels("long"), []);
  const weekdayLabels = useMemo(() => getWeekdayLabels("narrow"), []);
  const [activeCurrency, setActiveCurrency] = useState("INR");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cur = localStorage.getItem("active_currency");
      if (cur) setActiveCurrency(cur);
    }
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  // Ledger-mirrored transaction ids — kept out of the transaction totals so
  // they aren't double-counted (they show under Notebook Ledger on the day page).
  const ledgerTxIds = useMemo(() => {
    const set = new Set<string>();
    ledgerCustomers.forEach((c) =>
      c.history.forEach((entry) => {
        if (entry.txId) set.add(entry.txId);
      })
    );
    return set;
  }, [ledgerCustomers]);

  // Group standalone transactions (excluding ledger-mirrored ones) by local day.
  const dayMap = useMemo(() => {
    const map: Record<
      string,
      { income: number; expense: number; txs: Transaction[] }
    > = {};
    transactions.forEach((tx) => {
      if (ledgerTxIds.has(tx.id)) return;
      const key = toDateKey(new Date(tx.date));
      if (!map[key]) map[key] = { income: 0, expense: 0, txs: [] };
      if (tx.type === "income") map[key].income += tx.amount;
      else map[key].expense += tx.amount;
      map[key].txs.push(tx);
    });
    return map;
  }, [transactions, ledgerTxIds]);

  // Local day keys that have any notebook-ledger activity.
  const ledgerDays = useMemo(() => {
    const set = new Set<string>();
    ledgerCustomers.forEach((c) =>
      c.history.forEach((entry) => set.add(toDateKey(new Date(entry.date))))
    );
    return set;
  }, [ledgerCustomers]);

  // Upcoming EMIs + subscription renewals projected onto days.
  const dueMap = useMemo(
    () => computeDueDates(loans, transactions, manualSubs),
    [loans, transactions, manualSubs]
  );

  // Totals for the month in view + the busiest expense day (drives the heatmap).
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    let maxExpense = 0;
    Object.entries(dayMap).forEach(([key, v]) => {
      if (!key.startsWith(monthPrefix)) return;
      income += v.income;
      expense += v.expense;
      if (v.expense > maxExpense) maxExpense = v.expense;
    });
    return { income, expense, maxExpense };
  }, [dayMap, monthPrefix]);

  const shiftMonth = (delta: number) =>
    setViewDate(new Date(year, month + delta, 1));

  const goToday = () =>
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));

  const openDay = (d: Date) => router.push(`/calendar/${toDateKey(d)}`);

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 md:p-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl">
            Calendar
          </h1>
          <p className="text-sm font-medium text-foreground-muted">
            Browse your income and expenses day by day.
          </p>
        </div>
        <button
          onClick={goToday}
          className="btn-secondary shrink-0 flex items-center justify-center gap-2"
        >
          <CalendarDays className="w-4 h-4" />
          Today
        </button>
      </div>

      {/* Month calendar */}
      <section className="bg-card border border-border rounded-2xl shadow-sm p-4 md:p-5">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="p-2 rounded-lg text-icon-muted hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-base font-black text-foreground tracking-tight">
            {monthLabels[month]} {year}
          </span>
          <button
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="p-2 rounded-lg text-icon-muted hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Month summary */}
        <div className="flex items-center justify-center gap-4 mb-4 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-success">
            <ArrowUpRight className="w-3.5 h-3.5" />
            {formatAmount(monthStats.income, activeCurrency)}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-error">
            <ArrowDownRight className="w-3.5 h-3.5" />
            {formatAmount(monthStats.expense, activeCurrency)}
          </span>
        </div>

        {/* Weekday labels */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekdayLabels.map((label, i) => (
            <span
              key={i}
              className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider text-center py-1"
            >
              {label}
            </span>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1">
          {grid.map((d) => {
            const key = toDateKey(d);
            const inMonth = d.getMonth() === month;
            const isToday = isSameDay(d, today);
            const data = dayMap[key];
            const hasLedger = ledgerDays.has(key);
            const hasDue = (dueMap[key]?.length ?? 0) > 0;
            // Heatmap: shade cell by expense relative to the month's busiest day.
            const intensity =
              inMonth && monthStats.maxExpense > 0 && data
                ? data.expense / monthStats.maxExpense
                : 0;
            return (
              <button
                key={key}
                onClick={() => openDay(d)}
                className={`relative overflow-hidden min-h-[52px] sm:min-h-[68px] rounded-xl border border-transparent p-1.5 flex flex-col items-start text-left transition-all cursor-pointer hover:bg-secondary hover:border-border ${
                  !inMonth ? "opacity-40" : ""
                }`}
              >
                {/* Expense heatmap tint (kept behind the content) */}
                {intensity > 0 && (
                  <span
                    aria-hidden
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundColor: "var(--color-error)",
                      opacity: 0.06 + intensity * 0.22,
                    }}
                  />
                )}

                <span
                  className={`relative z-10 text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground-secondary"
                  }`}
                >
                  {d.getDate()}
                </span>

                {/* Daily activity (amounts on sm+, dots on mobile) */}
                {(data || hasLedger || hasDue) && (
                  <div className="relative z-10 mt-auto w-full space-y-0.5">
                    {data && data.income > 0 && (
                      <span className="hidden sm:block text-[9px] font-bold text-success truncate">
                        +{formatAmount(data.income, activeCurrency)}
                      </span>
                    )}
                    {data && data.expense > 0 && (
                      <span className="hidden sm:block text-[9px] font-bold text-error truncate">
                        -{formatAmount(data.expense, activeCurrency)}
                      </span>
                    )}
                    {hasLedger && (
                      <span className="hidden sm:block text-[9px] font-bold text-primary truncate">
                        Ledger
                      </span>
                    )}
                    {hasDue && (
                      <span className="hidden sm:block text-[9px] font-bold text-warning truncate">
                        Due
                      </span>
                    )}
                    <span className="sm:hidden flex gap-0.5">
                      {data && data.income > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-success" />
                      )}
                      {data && data.expense > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-error" />
                      )}
                      {hasLedger && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                      {hasDue && (
                        <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                      )}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Hint */}
      <p className="text-xs font-medium text-foreground-muted text-center">
        Tap any day to open its full income, expense and ledger details.
      </p>
    </div>
  );
}
