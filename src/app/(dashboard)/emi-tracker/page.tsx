"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  CreditCard,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Wallet,
  Calendar,
  Percent,
  ChevronDown,
  ChevronUp,
  Building2,
} from "lucide-react";
import { formatAmount } from "@/core/utils/currencyManager";
import AddLoanModal, { type LoanRecord } from "@/components/modals/AddLoanModal";
import { useLoans, setLoans } from "@/core/store/dataStore";
import { calcEmi, calcOutstandingPrincipal, calcRemainingPayments } from "@/core/math/loan";

import { formatDate } from "@/core/utils/dateFormat";
// ─── Amortization ─────────────────────────────────────────────────────────────

function calcAmortization(loan: LoanRecord) {
  const emi = calcEmi(loan.principal, loan.annualInterestRate, loan.tenureMonths);
  const totalPayable = emi * loan.tenureMonths;
  const totalInterest = totalPayable - loan.principal;
  const remaining = loan.tenureMonths - loan.monthsPaid;
  const amountPaid = emi * loan.monthsPaid;
  // What is genuinely still owed — NOT `emi * remaining`, which is the sum of
  // future instalments and so bundles in every future interest charge.
  const outstandingBalance = calcOutstandingPrincipal(loan);
  // The sum of instalments still to be paid. Shown separately so the two
  // numbers are never confused for each other again.
  const remainingPayments = calcRemainingPayments(loan);
  const progressPct =
    loan.tenureMonths > 0 ? (loan.monthsPaid / loan.tenureMonths) * 100 : 0;

  // Estimate completion date
  const completionDate = (() => {
    if (remaining <= 0) return "Completed";
    const start = new Date(loan.startDate);
    start.setMonth(start.getMonth() + loan.tenureMonths);
    return formatDate(start, {
      month: "short",
      year: "numeric",
    });
  })();

  return {
    emi,
    totalPayable,
    totalInterest,
    remaining,
    amountPaid,
    outstandingBalance,
    remainingPayments,
    progressPct,
    completionDate,
  };
}

// ─── Sub-component: Single Loan Card ─────────────────────────────────────────

interface LoanCardProps {
  loan: LoanRecord;
  currencyCode: string;
  onDelete: (id: string) => void;
}

function LoanCard({ loan, currencyCode, onDelete }: LoanCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const calc = useMemo(() => calcAmortization(loan), [loan]);

  const isCompleted = loan.monthsPaid >= loan.tenureMonths;
  const isNearEnd = calc.remaining > 0 && calc.remaining <= 6;

  // Progress colour
  const barColor =
    isCompleted
      ? "bg-success"
      : calc.progressPct >= 75
      ? "bg-primary"
      : calc.progressPct >= 40
      ? "bg-brand"
      : "bg-warning";

  const statusColor = isCompleted
    ? "text-success bg-success-light border-success/20"
    : isNearEnd
    ? "text-warning bg-warning-light border-warning/20"
    : "text-primary bg-primary-lighter border-primary/15";

  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">

      {/* ── Card Header ── */}
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Title + Lender */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary-lighter text-primary flex items-center justify-center shrink-0 border border-primary/15">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-foreground text-base truncate">
                {loan.name}
              </h3>
              <span className="text-[10px] font-bold text-foreground-muted flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {loan.lender}
              </span>
            </div>
          </div>

          {/* Right: Status badge + menu */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full border ${statusColor}`}>
              {isCompleted ? "Completed" : isNearEnd ? "Near Closure" : "Active"}
            </span>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 text-icon-muted hover:text-error hover:bg-error-light rounded-lg transition-all cursor-pointer"
                title="Remove loan"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex gap-1.5">
                <button
                  onClick={() => onDelete(loan.id)}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-error text-error-foreground hover:bg-error/90 transition-all cursor-pointer"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-secondary border border-border text-foreground-secondary hover:bg-secondary/80 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Key metrics row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-0.5">
            <span className="text-[9px] font-bold text-foreground-muted uppercase tracking-wider block">
              Monthly EMI
            </span>
            <span className="text-sm font-black text-foreground tracking-tight">
              {formatAmount(calc.emi, currencyCode)}
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[9px] font-bold text-foreground-muted uppercase tracking-wider block">
              Outstanding
            </span>
            <span className="text-sm font-black text-error tracking-tight">
              {formatAmount(calc.outstandingBalance, currencyCode)}
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[9px] font-bold text-foreground-muted uppercase tracking-wider block">
              Closes
            </span>
            <span className="text-sm font-black text-foreground tracking-tight">
              {calc.completionDate}
            </span>
          </div>
        </div>

        {/* Amortization progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-foreground-secondary">
              {loan.monthsPaid} of {loan.tenureMonths} months paid
            </span>
            <span className={isCompleted ? "text-success" : "text-primary"}>
              {calc.progressPct.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-secondary h-3 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden ${barColor}`}
              style={{ width: `${Math.min(calc.progressPct, 100)}%` }}
            >
              {/* Shimmer overlay */}
              <div
                className="absolute inset-0 opacity-25"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)",
                }}
              />
            </div>
          </div>
          <div className="flex justify-between text-[9px] text-foreground-muted font-semibold">
            <span>{formatAmount(calc.amountPaid, currencyCode)} paid</span>
            <span>{formatAmount(calc.remainingPayments, currencyCode)} left to pay</span>
          </div>
        </div>
      </div>

      {/* ── Expandable details ── */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-bold text-foreground-muted hover:text-foreground hover:bg-secondary/40 border-t border-border transition-all cursor-pointer"
      >
        {expanded ? (
          <>
            <ChevronUp className="w-3.5 h-3.5" />
            Hide Details
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5" />
            Full Breakdown
          </>
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-border animate-in slide-in-from-top-1 duration-150">
          <div className="pt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              {
                icon: Wallet,
                label: "Principal",
                value: formatAmount(loan.principal, currencyCode),
                color: "text-foreground",
                bg: "bg-secondary",
              },
              {
                icon: Percent,
                label: "Annual Rate",
                value: `${loan.annualInterestRate}% p.a.`,
                color: "text-brand",
                bg: "bg-brand-light",
              },
              {
                icon: TrendingDown,
                label: "Total Interest",
                value: formatAmount(calc.totalInterest, currencyCode),
                color: "text-error",
                bg: "bg-error-light",
              },
              {
                icon: CreditCard,
                label: "Total Payable",
                value: formatAmount(calc.totalPayable, currencyCode),
                color: "text-foreground",
                bg: "bg-secondary",
              },
              {
                icon: Calendar,
                label: "Start Date",
                value: formatDate(loan.startDate, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }),
                color: "text-foreground-secondary",
                bg: "bg-secondary",
              },
              {
                icon: Calendar,
                label: "Months Left",
                value: `${calc.remaining} months`,
                color: calc.remaining <= 6 ? "text-warning" : "text-primary",
                bg: calc.remaining <= 6 ? "bg-warning-light" : "bg-primary-lighter",
              },
            ].map(({ icon: Icon, label, value, color, bg }) => (
              <div
                key={label}
                className={`${bg} rounded-xl p-3 space-y-1`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                  <span className="text-[9px] font-bold text-foreground-muted uppercase tracking-wider">
                    {label}
                  </span>
                </div>
                <span className={`text-sm font-extrabold ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmiTrackerPage() {
  // Loans are read from the central data layer, which mirrors every write to
  // Firestore (offline-first: localStorage is the instant cache, cloud syncs).
  const loans = useLoans();
  const [activeCurrency, setActiveCurrency] = useState("INR");
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cur = localStorage.getItem("active_currency");
    if (cur) setActiveCurrency(cur);
  }, []);

  const saveLoan = (loan: LoanRecord) => {
    setLoans([loan, ...loans]);
  };

  const deleteLoan = (id: string) => {
    setLoans(loans.filter((l) => l.id !== id));
  };

  // ── Aggregate summary ────────────────────────────────────────────────────
  const summary = useMemo(() => {
    let totalOutstanding = 0;
    let totalEmi = 0;
    let totalInterest = 0;
    let activeCount = 0;

    loans.forEach((loan) => {
      const c = calcAmortization(loan);
      if (loan.monthsPaid < loan.tenureMonths) {
        totalOutstanding += c.outstandingBalance;
        totalEmi += c.emi;
        activeCount++;
      }
      totalInterest += c.totalInterest;
    });

    return { totalOutstanding, totalEmi, totalInterest, activeCount };
  }, [loans]);

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 md:p-8 max-w-4xl mx-auto w-full">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl">
            EMI Tracker
          </h1>
          <p className="text-sm font-medium text-foreground-muted">
            Monitor outstanding liabilities and amortization schedules.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2 shrink-0 self-start"
        >
          <Plus className="w-4 h-4" />
          Add Loan
        </button>
      </div>

      {/* ── Summary Cards ─────────────────────────────────────────────────── */}
      {loans.length > 0 && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Active Loans",
              value: String(summary.activeCount),
              sub: "Currently running",
              icon: CreditCard,
              accent: "text-primary",
              bg: "bg-primary-lighter",
              border: "border-primary/15",
            },
            {
              label: "Monthly Outflow",
              value: formatAmount(summary.totalEmi, activeCurrency),
              sub: "Combined EMI burden",
              icon: Wallet,
              accent: "text-error",
              bg: "bg-error-light",
              border: "border-error/15",
            },
            {
              label: "Total Outstanding",
              value: formatAmount(summary.totalOutstanding, activeCurrency),
              sub: "Settle-today balance",
              icon: TrendingDown,
              accent: "text-brand",
              bg: "bg-brand-light",
              border: "border-brand/15",
            },
            {
              label: "Total Interest",
              value: formatAmount(summary.totalInterest, activeCurrency),
              sub: "Lifetime interest cost",
              icon: Percent,
              accent: "text-warning",
              bg: "bg-warning-light",
              border: "border-warning/15",
            },
          ].map(({ label, value, sub, icon: Icon, accent, bg, border }) => (
            <div
              key={label}
              className={`bg-card border ${border} p-5 rounded-2xl shadow-sm space-y-3 group hover:shadow-md transition-shadow`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider">
                  {label}
                </span>
                <div
                  className={`w-8 h-8 rounded-xl ${bg} ${accent} border ${border} flex items-center justify-center group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-4 h-4 stroke-[2.5px]" />
                </div>
              </div>
              <div className="space-y-0.5">
                <h3 className="text-lg font-black tracking-tight text-foreground">
                  {value}
                </h3>
                <p className="text-[10px] font-semibold text-foreground-muted">
                  {sub}
                </p>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── Loan Cards ────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        {loans.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-2xl p-14 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
              <CreditCard className="w-7 h-7 text-icon-muted" />
            </div>
            <div className="space-y-1">
              <h3 className="font-extrabold text-foreground">No loans recorded</h3>
              <p className="text-sm text-foreground-muted">
                Add a home loan, car loan, or any EMI to start tracking outstanding liability.
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add First Loan
            </button>
          </div>
        ) : (
          loans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              currencyCode={activeCurrency}
              onDelete={deleteLoan}
            />
          ))
        )}
      </section>

      {/* ── Disclaimer ────────────────────────────────────────────────────── */}
      {loans.length > 0 && (
        <p className="text-[10px] text-foreground-muted text-center flex items-center justify-center gap-1.5">
          <AlertTriangle className="w-3 h-3 text-warning shrink-0" />
          EMI values use the standard reducing-balance compound formula. Verify against your lender statements for accuracy.
        </p>
      )}

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      <AddLoanModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={saveLoan}
        currencyCode={activeCurrency}
      />
    </div>
  );
}
