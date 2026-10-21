"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, CreditCard, CheckCircle2, Info } from "lucide-react";
import { formatAmount, toBaseAmount } from "@/core/utils/currencyManager";
import { calcEmi, calcOutstandingPrincipal } from "@/core/math/loan";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface LoanRecord {
  id: string;
  name: string;
  lender: string;
  principal: number;
  annualInterestRate: number;
  tenureMonths: number;
  monthsPaid: number;
  startDate: string;
}

interface AddLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (loan: LoanRecord) => void;
  currencyCode?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

const LENDER_PRESETS = [
  "HDFC Bank",
  "SBI",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Bank",
  "LIC Housing",
  "Bajaj Finance",
  "Other",
];

export default function AddLoanModal({
  isOpen,
  onClose,
  onSave,
  currencyCode = "INR",
}: AddLoanModalProps) {
  const [name, setName] = useState("");
  const [lender, setLender] = useState("HDFC Bank");
  const [customLender, setCustomLender] = useState("");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [tenure, setTenure] = useState("");
  const [monthsPaid, setMonthsPaid] = useState("0");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        setName("");
        setLender("HDFC Bank");
        setCustomLender("");
        setPrincipal("");
        setRate("");
        setTenure("");
        setMonthsPaid("0");
        setStartDate(new Date().toISOString().split("T")[0]);
        setSuccess(false);
      }, 0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const p = parseFloat(principal) || 0;
  const r = parseFloat(rate) || 0;
  const n = parseInt(tenure) || 0;
  const mp = Math.min(parseInt(monthsPaid) || 0, n);

  // Live preview calculations
  const emi = p > 0 && r >= 0 && n > 0 ? calcEmi(p, r, n) : 0;
  const totalPayable = emi * n;
  const totalInterest = totalPayable - p;
  const remaining = n - mp;
  // What would settle the loan today. The old expression here was an ad-hoc
  // formula that no one read (it was never rendered); this is the standard
  // present value of the instalments still due.
  const outstandingPrincipal = calcOutstandingPrincipal({
    principal: p,
    annualInterestRate: r,
    tenureMonths: n,
    monthsPaid: mp,
  });

  const isFormValid =
    name.trim().length > 0 &&
    p > 0 &&
    r >= 0 &&
    n > 0 &&
    mp >= 0 &&
    mp <= n;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    const loan: LoanRecord = {
      id: Math.random().toString(36).substring(2, 9),
      name: name.trim(),
      lender: lender === "Other" ? (customLender.trim() || "Other") : lender,
      // `p` is what the user typed, in `currencyCode` (the active display
      // currency). Loans are stored in base (INR) like every other amount, and
      // the EMI/interest figures are re-derived from this on read.
      principal: toBaseAmount(p, currencyCode),
      annualInterestRate: r,
      tenureMonths: n,
      monthsPaid: mp,
      startDate,
    };

    setSuccess(true);
    setTimeout(() => {
      onSave(loan);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center p-0 md:p-4 animate-in fade-in duration-200">
      <div
        className="w-full bg-card border-t md:border border-border rounded-t-3xl md:rounded-2xl max-w-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom md:zoom-in-95 duration-300 max-h-[92vh] md:max-h-[90vh] flex flex-col"
        role="dialog"
        aria-label="Add Loan"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex justify-between items-center bg-background-subtle shrink-0">
          <div>
            <h3 className="text-lg font-black text-foreground flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Add Loan / EMI
            </h3>
            <p className="text-xs font-semibold text-foreground-muted">
              Track outstanding liability with amortization breakdown.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-icon-muted hover:text-icon-active p-1.5 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scroll area */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {success ? (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-success-light text-success flex items-center justify-center shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="font-extrabold text-foreground text-lg">Loan Recorded</h4>
              <p className="text-sm text-foreground-muted">Amortization schedule computed and saved.</p>
            </div>
          ) : (
            <>
              {/* Loan Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                  Loan Label
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-base w-full"
                  placeholder="e.g. Home Loan, Car Loan, Personal Loan"
                  required
                  autoFocus
                />
              </div>

              {/* Lender */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                  Lender / Institution
                </label>
                <div className="flex flex-wrap gap-2">
                  {LENDER_PRESETS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLender(l)}
                      className={`inline-flex items-center px-3 py-1.5 rounded-full border text-xs transition-all cursor-pointer ${
                        lender === l
                          ? "bg-primary text-white border-transparent font-bold shadow-md scale-105"
                          : "bg-card border-border-strong/40 text-foreground-secondary hover:bg-secondary/70 hover:text-foreground font-semibold shadow-xs hover:scale-102"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                {lender === "Other" && (
                  <input
                    type="text"
                    value={customLender}
                    onChange={(e) => setCustomLender(e.target.value)}
                    className="input-base w-full mt-2"
                    placeholder="Enter lender name"
                  />
                )}
              </div>

              {/* Two-column: Principal + Rate */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                    Loan Amount
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 font-bold text-foreground-secondary pointer-events-none">
                      ₹
                    </span>
                    <input
                      type="number"
                      value={principal}
                      onChange={(e) => setPrincipal(e.target.value)}
                      className="input-base pl-7 pr-3 w-full font-bold"
                      placeholder="500000"
                      min="1"
                      step="1"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                    Annual Rate (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      className="input-base pr-8 w-full font-bold"
                      placeholder="8.5"
                      min="0"
                      max="50"
                      step="0.01"
                      required
                    />
                    <span className="absolute inset-y-0 right-0 flex items-center pr-3.5 font-bold text-foreground-secondary text-sm">
                      %
                    </span>
                  </div>
                </div>
              </div>

              {/* Two-column: Tenure + Months Paid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                    Tenure (Months)
                  </label>
                  <input
                    type="number"
                    value={tenure}
                    onChange={(e) => setTenure(e.target.value)}
                    className="input-base w-full font-bold"
                    placeholder="240"
                    min="1"
                    max="600"
                    step="1"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                    Months Paid
                  </label>
                  <input
                    type="number"
                    value={monthsPaid}
                    onChange={(e) => setMonthsPaid(e.target.value)}
                    className="input-base w-full font-bold"
                    placeholder="0"
                    min="0"
                    max={tenure || undefined}
                    step="1"
                    required
                  />
                </div>
              </div>

              {/* Start Date */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                  Loan Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input-base w-full"
                  max={new Date().toISOString().slice(0, 10)}
                />
              </div>

              {/* Live Preview Card */}
              {emi > 0 && (
                <div className="bg-primary-lighter border border-primary/15 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <Info className="w-3.5 h-3.5" />
                    Amortization Preview
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* These are derived from the principal as TYPED, so they
                        are already in `currencyCode` — formatting must not
                        convert again (that only applies to stored base amounts). */}
                    {[
                      { label: "Monthly EMI", value: formatAmount(emi, currencyCode, { convert: false }) },
                      { label: "Total Payable", value: formatAmount(totalPayable, currencyCode, { convert: false }) },
                      { label: "Total Interest", value: formatAmount(totalInterest, currencyCode, { convert: false }) },
                      {
                        label: "Outstanding Now",
                        value: formatAmount(outstandingPrincipal, currencyCode, { convert: false }),
                      },
                    ].map(({ label, value }) => (
                      <div key={label} className="space-y-0.5">
                        <span className="text-[10px] font-bold text-primary/70 uppercase tracking-wider block">
                          {label}
                        </span>
                        <span className="text-sm font-black text-primary tracking-tight">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar preview */}
                  {n > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-primary/70">
                        <span>{mp} of {n} months paid</span>
                        <span>{((mp / n) * 100).toFixed(1)}% complete</span>
                      </div>
                      <div className="w-full bg-primary/10 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${Math.min((mp / n) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isFormValid}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                >
                  Save Loan
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
