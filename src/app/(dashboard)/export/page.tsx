"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Download,
  FileSpreadsheet,
  Sheet,
  FileText,
  Calendar,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Receipt,
  Wallet,
  PiggyBank,
  ChevronRight,
} from "lucide-react";
import {
  exportTransactionsCsv,
  exportBudgetsCsv,
  exportSavingsCsv,
  type ExportableTransaction,
  type ExportableBudget,
  type ExportableSavingsGoal,
} from "@/core/utils/csvExporter";
import { generatePdfReport, type PdfTransaction, type PdfBudget, type PdfSavingsGoal } from "@/core/utils/pdfGenerator";
import { exportWorkbookXlsx } from "@/core/utils/excelExporter";
import { getCurrencySymbol } from "@/core/utils/currencyManager";
import { getTransactions, getBudgets, getSavingsGoals } from "@/core/store/dataStore";

import { formatDate } from "@/core/utils/dateFormat";
// ─── Types ─────────────────────────────────────────────────────────────────────

type OutputFormat = "excel" | "csv" | "pdf";
type DataType = "transactions" | "budgets" | "savings";

interface RawTransaction {
  id: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  description: string;
  date: string;
}

interface RawSavingsGoal {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const DATA_TYPE_META: {
  key: DataType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}[] = [
  {
    key: "transactions",
    label: "Transactions",
    icon: Receipt,
    description: "Income & expense ledger entries",
  },
  {
    key: "budgets",
    label: "Budgets",
    icon: Wallet,
    description: "Category limits & utilization",
  },
  {
    key: "savings",
    label: "Savings Goals",
    icon: PiggyBank,
    description: "Goal progress & deadlines",
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(iso: string): string {
  if (!iso) return "—";
  return formatDate(iso, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ExportPage() {
  // Currency
  const [currencyCode, setCurrencyCode] = useState("INR");

  // Date range
  const [dateFrom, setDateFrom] = useState(firstOfMonthIso());
  const [dateTo, setDateTo] = useState(todayIso());

  // Selection state
  const [selectedTypes, setSelectedTypes] = useState<Set<DataType>>(
    new Set(["transactions", "budgets", "savings"])
  );
  const [transactionFilter, setTransactionFilter] = useState<"all" | "income" | "expense">("all");
  const [format, setFormat] = useState<OutputFormat>("excel");

  // Raw localStorage data
  const [rawTransactions, setRawTransactions] = useState<RawTransaction[]>([]);
  const [rawBudgets, setRawBudgets] = useState<Record<string, number>>({});
  const [rawGoals, setRawGoals] = useState<RawSavingsGoal[]>([]);

  // UI state
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  // ── Load data from localStorage ────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const cur = localStorage.getItem("active_currency");
    if (cur) setCurrencyCode(cur);

    // Read the decrypted values from the data store (localStorage holds
    // ciphertext for these keys; the store serves the in-memory plaintext).
    setRawTransactions(getTransactions());
    setRawBudgets(getBudgets());
    setRawGoals(getSavingsGoals());
  }, []);

  // ── Filtered record counts ─────────────────────────────────────────────────
  const filteredTransactions = rawTransactions.filter((tx) => {
    if (transactionFilter !== "all" && tx.type !== transactionFilter) return false;
    if (!dateFrom && !dateTo) return true;
    const txDate = tx.date.slice(0, 10);
    if (dateFrom && txDate < dateFrom) return false;
    if (dateTo && txDate > dateTo) return false;
    return true;
  });

  const recordCounts: Record<DataType, number> = {
    transactions: filteredTransactions.length,
    budgets: Object.keys(rawBudgets).length,
    savings: rawGoals.length,
  };

  const totalRecords = Array.from(selectedTypes).reduce(
    (sum, key) => sum + recordCounts[key],
    0
  );

  // ── Toggle data type selection ─────────────────────────────────────────────
  const toggleType = (key: DataType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // ── Build derived export payloads ──────────────────────────────────────────
  const buildExportables = useCallback(() => {
    const currencySymbol = getCurrencySymbol(currencyCode) || currencyCode;

    const transactions: ExportableTransaction[] = filteredTransactions.map((tx) => ({
      id: tx.id,
      date: tx.date,
      type: tx.type,
      category: tx.category,
      description: tx.description,
      amount: tx.amount,
    }));

    const pdfTransactions: PdfTransaction[] = filteredTransactions.map((tx) => ({
      date: tx.date,
      type: tx.type,
      category: tx.category,
      description: tx.description,
      amount: tx.amount,
    }));

    // Compute per-category spending from the filtered transactions
    const spentByCategory: Record<string, number> = {};
    filteredTransactions
      .filter((tx) => tx.type === "expense")
      .forEach((tx) => {
        spentByCategory[tx.category] = (spentByCategory[tx.category] || 0) + tx.amount;
      });

    const budgets: ExportableBudget[] = Object.entries(rawBudgets).map(([cat, limit]) => {
      const spent = spentByCategory[cat] || 0;
      return { category: cat, limit, spent, remaining: Math.max(0, limit - spent) };
    });

    const pdfBudgets: PdfBudget[] = budgets.map((b) => ({ ...b }));

    const goals: ExportableSavingsGoal[] = rawGoals.map((g) => ({
      id: g.id,
      name: g.name,
      target: g.target,
      current: g.current,
      deadline: g.deadline,
    }));

    const pdfGoals: PdfSavingsGoal[] = rawGoals.map((g) => ({
      name: g.name,
      target: g.target,
      current: g.current,
      deadline: g.deadline,
    }));

    const dateRangeLabel =
      dateFrom || dateTo
        ? `${formatDateLabel(dateFrom)} – ${formatDateLabel(dateTo)}`
        : "All Records";

    return { transactions, budgets, goals, pdfTransactions, pdfBudgets, pdfGoals, currencySymbol, dateRangeLabel };
  }, [filteredTransactions, rawBudgets, rawGoals, currencyCode, dateFrom, dateTo]);

  // ── Export handler ─────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (selectedTypes.size === 0 || totalRecords === 0) return;

    setStatus("loading");

    const {
      transactions,
      budgets,
      goals,
      pdfTransactions,
      pdfBudgets,
      pdfGoals,
      currencySymbol,
      dateRangeLabel,
    } = buildExportables();

    if (format === "excel") {
      // Single styled workbook with one sheet per selected data type
      await exportWorkbookXlsx({
        transactions: selectedTypes.has("transactions") ? transactions : [],
        budgets: selectedTypes.has("budgets") ? budgets : [],
        savingsGoals: selectedTypes.has("savings") ? goals : [],
        currencyCode,
        currencySymbol,
        dateRangeLabel,
        filename:
          transactionFilter === "all"
            ? `moneylens-export-${new Date().toISOString().slice(0, 10)}.xlsx`
            : `moneylens-${transactionFilter}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      });
    } else if (format === "csv") {
      // Stagger multiple CSV downloads so the browser doesn't block them
      let delay = 0;
      if (selectedTypes.has("transactions") && transactions.length > 0) {
        const tFileName = transactionFilter === "all" ? `moneylens-transactions-${new Date().toISOString().slice(0, 10)}.csv` : `moneylens-${transactionFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
        setTimeout(() => exportTransactionsCsv(transactions, currencyCode, tFileName), delay);
        delay += 300;
      }
      if (selectedTypes.has("budgets") && budgets.length > 0) {
        setTimeout(() => exportBudgetsCsv(budgets, currencyCode), delay);
        delay += 300;
      }
      if (selectedTypes.has("savings") && goals.length > 0) {
        setTimeout(() => exportSavingsCsv(goals, currencyCode), delay);
      }
    } else {
      generatePdfReport({
        transactions: selectedTypes.has("transactions") ? pdfTransactions : [],
        budgets: selectedTypes.has("budgets") ? pdfBudgets : [],
        savingsGoals: selectedTypes.has("savings") ? pdfGoals : [],
        currencyCode,
        currencySymbol,
        dateRangeLabel,
        transactionFilter,
      });
    }

    // Brief "done" flash
    setTimeout(() => setStatus("done"), 600);
    setTimeout(() => setStatus("idle"), 2800);
  }, [selectedTypes, totalRecords, format, buildExportables, currencyCode, transactionFilter]);

  // ── Quick date range presets ───────────────────────────────────────────────
  const applyToday = () => {
    const t = todayIso();
    setDateFrom(t);
    setDateTo(t);
  };

  const applyLastDays = (n: number) => {
    setDateFrom(daysAgoIso(n - 1));
    setDateTo(todayIso());
  };

  const applyThisMonth = () => {
    setDateFrom(firstOfMonthIso());
    setDateTo(todayIso());
  };

  const applyAllTime = () => {
    setDateFrom("");
    setDateTo("");
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 md:p-8 max-w-3xl mx-auto w-full">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl">
          Export Reports
        </h1>
        <p className="text-sm font-medium text-foreground-muted">
          Generate and download financial data entirely on your device — no cloud, no servers.
        </p>
      </div>

      {/* ── Date Range ──────────────────────────────────────────────────────── */}
      <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Date Range
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={applyToday}
              className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-secondary border border-border text-foreground-secondary hover:bg-primary-lighter hover:text-primary hover:border-primary/20 transition-all cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={() => applyLastDays(7)}
              className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-secondary border border-border text-foreground-secondary hover:bg-primary-lighter hover:text-primary hover:border-primary/20 transition-all cursor-pointer"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => applyLastDays(30)}
              className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-secondary border border-border text-foreground-secondary hover:bg-primary-lighter hover:text-primary hover:border-primary/20 transition-all cursor-pointer"
            >
              Last 30 Days
            </button>
            <button
              onClick={applyThisMonth}
              className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-secondary border border-border text-foreground-secondary hover:bg-primary-lighter hover:text-primary hover:border-primary/20 transition-all cursor-pointer"
            >
              This Month
            </button>
            <button
              onClick={applyAllTime}
              className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-secondary border border-border text-foreground-secondary hover:bg-secondary hover:text-foreground transition-all cursor-pointer"
            >
              All Time
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full space-y-1">
            <label className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider">
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo || todayIso()}
              className="input-base w-full text-sm"
            />
          </div>

          <ArrowRight className="w-4 h-4 text-foreground-muted shrink-0 mt-5 hidden sm:block" />

          <div className="flex-1 w-full space-y-1">
            <label className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider">
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom || undefined}
              max={todayIso()}
              className="input-base w-full text-sm"
            />
          </div>
        </div>

        {(dateFrom || dateTo) && (
          <p className="text-[10px] font-semibold text-foreground-muted">
            Showing{" "}
            <span className="text-primary font-bold">{filteredTransactions.length}</span>{" "}
            transactions in range
            {dateFrom ? ` from ${formatDateLabel(dateFrom)}` : ""}
            {dateTo ? ` to ${formatDateLabel(dateTo)}` : ""}
          </p>
        )}
      </section>

      {/* ── Data Type Selection ──────────────────────────────────────────────── */}
      <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-extrabold text-foreground">
          Data to Export
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {DATA_TYPE_META.map(({ key, label, icon: Icon, description }) => {
            const isSelected = selectedTypes.has(key);
            const count = recordCounts[key];

            return (
              <button
                key={key}
                onClick={() => toggleType(key)}
                className={`relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  isSelected
                    ? "border-primary bg-primary-lighter/60 shadow-sm"
                    : "border-border bg-secondary/30 hover:border-border-strong hover:bg-secondary/60"
                }`}
              >
                {/* Checkmark indicator */}
                <div className={`absolute top-3 right-3 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                  isSelected
                    ? "border-primary bg-primary"
                    : "border-border-strong"
                }`}>
                  {isSelected && (
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>

                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isSelected
                    ? "bg-primary/10 text-primary"
                    : "bg-secondary text-foreground-muted"
                }`}>
                  <Icon className="w-4 h-4" />
                </div>

                <div className="space-y-0.5 pr-4">
                  <span className={`text-sm font-extrabold block ${
                    isSelected ? "text-primary" : "text-foreground"
                  }`}>
                    {label}
                  </span>
                  <span className="text-[10px] font-medium text-foreground-muted block">
                    {description}
                  </span>
                </div>

                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  isSelected
                    ? "bg-primary/10 text-primary"
                    : "bg-border text-foreground-secondary"
                }`}>
                  {count} {count === 1 ? "record" : "records"}
                </span>
              </button>
            );
          })}
        </div>

        {selectedTypes.has("transactions") && (
          <div className="pt-4 mt-4 border-t border-border animate-in fade-in slide-in-from-top-2">
            <h3 className="text-xs font-bold text-foreground-secondary mb-3 uppercase tracking-wider">
              Filter Transactions By Type
            </h3>
            <div className="flex flex-wrap gap-3">
              {[
                { id: "all", label: "All Transactions" },
                { id: "income", label: "Income Only" },
                { id: "expense", label: "Expenses Only" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setTransactionFilter(opt.id as any)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold border-2 transition-all ${
                    transactionFilter === opt.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-secondary text-foreground-muted hover:border-border-strong"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Output Format ────────────────────────────────────────────────────── */}
      <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-extrabold text-foreground">
          Output Format
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Excel tile */}
          <button
            onClick={() => setFormat("excel")}
            className={`flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
              format === "excel"
                ? "border-success bg-success/5 shadow-sm"
                : "border-border bg-secondary/30 hover:border-border-strong hover:bg-secondary/60"
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              format === "excel"
                ? "bg-success/10 text-success"
                : "bg-secondary text-foreground-muted"
            }`}>
              <Sheet className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 flex-1">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-extrabold ${format === "excel" ? "text-success" : "text-foreground"}`}>
                  Excel Workbook
                </span>
                {format === "excel" ? (
                  <span className="text-[9px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">
                    Selected
                  </span>
                ) : (
                  <span className="text-[9px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                )}
              </div>
              <p className="text-[10px] font-medium text-foreground-muted leading-relaxed">
                Formatted <span className="font-bold">.xlsx</span> with coloured headers, gridlines &amp; one tab per section.
              </p>
            </div>
          </button>

          {/* CSV tile */}
          <button
            onClick={() => setFormat("csv")}
            className={`flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
              format === "csv"
                ? "border-primary bg-primary-lighter/60 shadow-sm"
                : "border-border bg-secondary/30 hover:border-border-strong hover:bg-secondary/60"
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              format === "csv"
                ? "bg-primary/10 text-primary"
                : "bg-secondary text-foreground-muted"
            }`}>
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 flex-1">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-extrabold ${format === "csv" ? "text-primary" : "text-foreground"}`}>
                  CSV Spreadsheet
                </span>
                {format === "csv" && (
                  <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    Selected
                  </span>
                )}
              </div>
              <p className="text-[10px] font-medium text-foreground-muted leading-relaxed">
                Opens in Excel, Google Sheets, or any spreadsheet app. One file per data type.
              </p>
            </div>
          </button>

          {/* PDF tile */}
          <button
            onClick={() => setFormat("pdf")}
            className={`flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
              format === "pdf"
                ? "border-brand bg-brand-light/50 shadow-sm"
                : "border-border bg-secondary/30 hover:border-border-strong hover:bg-secondary/60"
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              format === "pdf"
                ? "bg-brand/10 text-brand"
                : "bg-secondary text-foreground-muted"
            }`}>
              <FileText className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 flex-1">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-extrabold ${format === "pdf" ? "text-brand" : "text-foreground"}`}>
                  PDF Report
                </span>
                {format === "pdf" && (
                  <span className="text-[9px] font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-full">
                    Selected
                  </span>
                )}
              </div>
              <p className="text-[10px] font-medium text-foreground-muted leading-relaxed">
                Professional statement layout with headers, balance boxes, and tables. All data in one document.
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* ── Export Summary & Action ──────────────────────────────────────────── */}
      <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        {/* Summary line */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted font-medium">
          {selectedTypes.size > 0 ? (
            <>
              <span>Exporting</span>
              {Array.from(selectedTypes).map((type, i, arr) => (
                <span key={type} className="flex items-center gap-1">
                  <span className="font-bold text-foreground capitalize">
                    {type === "savings" ? "Savings Goals" : type}
                  </span>
                  {i < arr.length - 2 && <span>,</span>}
                  {i === arr.length - 2 && <span>&amp;</span>}
                </span>
              ))}
              <span>as</span>
              <span className="font-bold text-foreground uppercase">
                {format}
              </span>
              <ChevronRight className="w-3 h-3 text-foreground-muted" />
              <span className="font-bold text-primary">
                {totalRecords} total records
              </span>
            </>
          ) : (
            <span className="text-warning font-semibold">
              Select at least one data type to export.
            </span>
          )}
        </div>

        {/* Main CTA button */}
        <button
          onClick={handleExport}
          disabled={selectedTypes.size === 0 || totalRecords === 0 || status === "loading"}
          className={`w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl font-extrabold text-sm transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 ${
            status === "done"
              ? "bg-success text-success-foreground border border-success/20 shadow-sm"
              : selectedTypes.size === 0 || totalRecords === 0
              ? "bg-secondary text-foreground-muted border border-border cursor-not-allowed opacity-60"
              : "bg-brand text-brand-foreground border border-brand/20 shadow-sm hover:bg-brand-hover hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm"
          }`}
        >
          {status === "loading" ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Preparing export…
            </>
          ) : status === "done" ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Export ready!
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              Download {format.toUpperCase()}
              {format === "csv" && selectedTypes.size > 1
                ? ` (${selectedTypes.size} files)`
                : ""}
            </>
          )}
        </button>

        <p className="text-[10px] text-foreground-muted text-center">
          All processing runs locally in your browser. No data leaves your device.
        </p>
      </section>
    </div>
  );
}
