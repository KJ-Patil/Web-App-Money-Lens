"use client";

import React, { useState, useEffect } from "react";
import { X, AlertTriangle, CheckCircle2, Tag, MoreHorizontal } from "lucide-react";
import { addTransaction, getTransactions, getBudgets } from "@/core/store/dataStore";
import {
  getActiveCategories,
  resolveCategoryIcon,
  EXTRA_CATEGORY_GROUPS,
  INCOME_EXTRA_CATEGORY_GROUPS,
  isExtraCategory,
  isIncomeExtraCategory,
} from "@/core/utils/categories";
import { getCurrencySymbol, toBaseAmount } from "@/core/utils/currencyManager";
import type { CategoryData } from "@/components/modals/AddCategoryModal";

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddTransactionModal({
  isOpen,
  onClose,
  onSuccess,
}: AddTransactionModalProps) {
  const [transactionType, setTransactionType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [discountMode, setDiscountMode] = useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [success, setSuccess] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  // Category lists are read from the user's managed categories each time the
  // modal opens, so newly created / archived categories show up immediately.
  const [expenseCategories, setExpenseCategories] = useState<CategoryData[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<CategoryData[]>([]);
  // Whether the "Other" expander (the full extra-category list) is open.
  const [showOther, setShowOther] = useState(false);
  // Currency symbol shown in the amount/discount fields follows the user's
  // active currency instead of a hardcoded rupee sign.
  const [activeCurrency, setActiveCurrency] = useState("INR");

  useEffect(() => {
    // Reset state on open
    if (isOpen) {
      const expenses = getActiveCategories("expense");
      const incomes = getActiveCategories("income");
      setTimeout(() => {
        setExpenseCategories(expenses);
        setIncomeCategories(incomes);
        setActiveCurrency(localStorage.getItem("active_currency") || "INR");
        setTransactionType("expense");
        setAmount("");
        setCategory(expenses[0]?.name ?? "");
        setDescription("");
        setDiscountMode("percent");
        setDiscountValue("");
        setShowOther(false);
        setSuccess(false);
        setAlertMessage(null);
      }, 0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currencySymbol = getCurrencySymbol(activeCurrency) || "₹";

  // ── Discount math (expenses only) ──────────────────────────────
  // The price the user typed is the actual/pre-discount price. The discount
  // can be a percentage of it or a flat ₹ amount. The discount is clamped so
  // it can never exceed the price (no negative final amounts).
  const grossAmount = parseFloat(amount) || 0;
  const rawDiscount = parseFloat(discountValue) || 0;
  const discountAmount =
    transactionType === "expense" && grossAmount > 0 && rawDiscount > 0
      ? Math.min(
          discountMode === "percent" ? (grossAmount * rawDiscount) / 100 : rawDiscount,
          grossAmount
        )
      : 0;
  const finalAmount = grossAmount - discountAmount;
  const hasDiscount = discountAmount > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    // For expenses, what hits the ledger is the post-discount price; the
    // original price + discount are kept so the saving stays visible.
    const effectiveAmount = transactionType === "expense" ? finalAmount : numAmount;

    // The figures above are in the ACTIVE display currency — that's what the
    // user typed, and what the live breakdown above shows. The store holds
    // everything in base (INR), so convert on the way in; otherwise "100" typed
    // under a "$" label would be saved as ₹100 and read back as $1.20.
    const baseAmount = toBaseAmount(effectiveAmount, activeCurrency);

    // Create and persist the new record through the central store.
    addTransaction({
      amount: baseAmount,
      type: transactionType,
      category: category,
      description: description || (transactionType === "income" ? `${category} Inflow` : `${category} Cost`),
      ...(hasDiscount && {
        originalAmount: toBaseAmount(numAmount, activeCurrency),
        discountAmount: toBaseAmount(discountAmount, activeCurrency),
      }),
    });

    // Perform Budget Threshold Check (80% capacity checks) for expenses,
    // but only when the user has actually configured a budget for the category.
    if (transactionType === "expense") {
      const budgets = getBudgets();
      const activeBudget = budgets[category];

      if (activeBudget && activeBudget > 0) {
        // Sum active monthly costs in this category (now includes the new entry)
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const categorySpent = getTransactions()
          .filter((tx) => {
            const txDate = new Date(tx.date);
            return (
              tx.type === "expense" &&
              tx.category === category &&
              txDate.getMonth() === currentMonth &&
              txDate.getFullYear() === currentYear
            );
          })
          .reduce((sum, tx) => sum + tx.amount, 0);

        const usageRate = categorySpent / activeBudget;

        if (usageRate >= 0.8) {
          const usagePercentage = Math.round(usageRate * 100);
          const warning = `Alert: Budget usage for ${category} has reached ${usagePercentage}% (${categorySpent} spent out of ${activeBudget}).`;

          // Write to alert notification system feed
          const storedNotes = localStorage.getItem("notifications");
          const notifications = storedNotes ? JSON.parse(storedNotes) : [];

          const updatedNotes = [warning, ...notifications];
          localStorage.setItem("notifications", JSON.stringify(updatedNotes));
          setAlertMessage(`Warning: Cross-category threshold alert triggered! ${category} budget utilization is at ${usagePercentage}%.`);
        }
      }
    }

    setSuccess(true);
    setTimeout(() => {
      onClose();
      if (onSuccess) onSuccess();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center p-0 md:p-4 animate-in fade-in duration-200">
      
      {/* Drawer overlay on Mobile, Modal Container on Desktop */}
      <div 
        className="w-full bg-card border-t md:border border-border rounded-t-3xl md:rounded-3xl max-w-lg shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25),inset_2px_2px_4px_rgba(255,255,255,0.9)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7),inset_2px_2px_4px_rgba(255,255,255,0.08)] overflow-hidden animate-in slide-in-from-bottom md:slide-in-from-bottom-0 md:zoom-in-95 duration-300 max-h-[90vh] md:max-h-none flex flex-col"
        role="dialog"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border/80 flex justify-between items-center bg-background-subtle">
          <div>
            <h3 className="text-lg font-black text-foreground">Record Transaction</h3>
            <p className="text-xs font-semibold text-foreground-muted">Update ledger balance instant data syncs.</p>
          </div>
          <button
            onClick={onClose}
            className="text-icon-muted hover:text-icon-active p-1.5 rounded-xl hover:bg-secondary transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Scroll Area */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {success ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-success-light text-success flex items-center justify-center shadow-[0_4px_12px_rgba(5,150,105,0.2),inset_1.5px_1.5px_3px_rgba(255,255,255,0.9)]">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-foreground text-lg">Transaction Recorded</h4>
                <p className="text-sm text-foreground-muted">Ledger calculations synced in real-time.</p>
              </div>
              {alertMessage && (
                <div className="flex items-center gap-2 p-3 text-xs text-warning bg-warning-light rounded-2xl font-medium max-w-sm mt-2 shadow-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-brand" />
                  <span className="text-left leading-relaxed text-brand-hover">{alertMessage}</span>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Type Switcher Toggle (Expense vs Income) */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                  Transaction Mode
                </span>
                <div className="grid grid-cols-2 gap-2 p-1.5 bg-secondary/80 rounded-2xl shadow-[inset_1.5px_1.5px_3px_rgba(148,163,184,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.8)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] relative">
                  <button
                    type="button"
                    onClick={() => {
                      setTransactionType("expense");
                      setShowOther(false);
                      if (!expenseCategories.find(c => c.name === category) && !isExtraCategory(category)) {
                        setCategory(expenseCategories[0]?.name ?? "");
                      }
                    }}
                    className={`py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      transactionType === "expense"
                        ? "clay-btn-danger font-extrabold"
                        : "text-foreground-secondary hover:text-foreground"
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTransactionType("income");
                      setShowOther(false);
                      if (!incomeCategories.find(c => c.name === category) && !isIncomeExtraCategory(category)) {
                        setCategory(incomeCategories[0]?.name ?? "");
                      }
                    }}
                    className={`py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      transactionType === "income"
                        ? "clay-btn-success font-extrabold"
                        : "text-foreground-secondary hover:text-foreground"
                    }`}
                  >
                    Income
                  </button>
                </div>
              </div>

              {/* Amount Inputs */}
              <div className="space-y-1">
                <label htmlFor="amount" className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                  Transaction Amount (Value)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 font-bold text-foreground-secondary text-lg pointer-events-none">
                    {currencySymbol}
                  </span>
                  <input
                    id="amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="input-base pl-9 pr-3 w-full text-lg font-extrabold tracking-tight"
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Discount (expenses only) */}
              {transactionType === "expense" && (
                <div className="space-y-1">
                  <label htmlFor="discount" className="text-xs font-bold text-foreground-secondary uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    Discount (Optional)
                  </label>
                  <div className="flex gap-2">
                    {/* Mode switch: percentage vs flat amount */}
                    <div className="grid grid-cols-2 gap-1 p-1 bg-secondary rounded-xl shrink-0">
                      <button
                        type="button"
                        onClick={() => setDiscountMode("percent")}
                        className={`px-3 py-1.5 text-sm font-bold rounded-lg transition-all cursor-pointer ${
                          discountMode === "percent"
                            ? "bg-card text-primary shadow-sm"
                            : "text-foreground-secondary hover:text-foreground"
                        }`}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountMode("amount")}
                        className={`px-3 py-1.5 text-sm font-bold rounded-lg transition-all cursor-pointer ${
                          discountMode === "amount"
                            ? "bg-card text-primary shadow-sm"
                            : "text-foreground-secondary hover:text-foreground"
                        }`}
                      >
                        {currencySymbol}
                      </button>
                    </div>
                    <div className="relative flex items-center flex-1">
                      <input
                        id="discount"
                        type="number"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        className="input-base pr-3 w-full font-bold"
                        placeholder={discountMode === "percent" ? "e.g. 50" : "e.g. 500"}
                        min="0"
                        max={discountMode === "percent" ? "100" : undefined}
                        step="0.01"
                      />
                    </div>
                  </div>

                  {/* Live final-amount breakdown */}
                  {hasDiscount && (
                    <div className="mt-2 rounded-xl border border-border bg-background-subtle px-4 py-3 text-sm space-y-1">
                      <div className="flex justify-between text-foreground-muted">
                        <span>Actual price</span>
                        <span className="line-through">{currencySymbol}{grossAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-success font-semibold">
                        <span>
                          Discount{discountMode === "percent" ? ` (${rawDiscount}%)` : ""}
                        </span>
                        <span>− {currencySymbol}{discountAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-t border-border pt-1.5 mt-1.5 font-extrabold text-foreground">
                        <span>Final amount</span>
                        <span>{currencySymbol}{finalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Category Grid */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-foreground-secondary uppercase tracking-wider block">
                  {transactionType === "expense" ? "Choose Budget Category" : "Choose Income Category"}
                </span>
                <div className="grid grid-cols-4 gap-3">
                  {(transactionType === "expense" ? expenseCategories : incomeCategories).map((opt) => {
                    const Icon = resolveCategoryIcon(opt.iconName);
                    const isSelected = category === opt.name;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => { setCategory(opt.name); setShowOther(false); }}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-primary text-white border-transparent font-bold scale-105 shadow-[0_6px_14px_-2px_rgba(29,78,216,0.45),inset_1.5px_1.5px_2.5px_rgba(255,255,255,0.45),inset_-1.5px_-1.5px_2.5px_rgba(15,23,42,0.3)]"
                            : "bg-card border-border text-icon-default hover:bg-secondary/70 hover:text-foreground shadow-[3px_5px_10px_-2px_rgba(148,163,184,0.2),inset_1px_1px_2px_rgba(255,255,255,0.9)] dark:shadow-[0_4px_8px_-2px_rgba(0,0,0,0.5)]"
                        }`}
                      >
                        <Icon className="w-5 h-5 mb-1" />
                        <span className="text-[10px] truncate max-w-full">{opt.name}</span>
                      </button>
                    );
                  })}

                  {/* "Other" expander — reveals the full extra-category list */}
                  <button
                    type="button"
                    onClick={() => setShowOther((v) => !v)}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer ${
                      showOther || isExtraCategory(category) || isIncomeExtraCategory(category)
                        ? "bg-primary text-white border-transparent font-bold scale-105 shadow-[0_6px_14px_-2px_rgba(29,78,216,0.45),inset_1.5px_1.5px_2.5px_rgba(255,255,255,0.45),inset_-1.5px_-1.5px_2.5px_rgba(15,23,42,0.3)]"
                        : "bg-card border-border text-icon-default hover:bg-secondary/70 hover:text-foreground shadow-[3px_5px_10px_-2px_rgba(148,163,184,0.2),inset_1px_1px_2px_rgba(255,255,255,0.9)] dark:shadow-[0_4px_8px_-2px_rgba(0,0,0,0.5)]"
                    }`}
                  >
                    <MoreHorizontal className="w-5 h-5 mb-1" />
                    <span className="text-[10px] truncate max-w-full">Other</span>
                  </button>
                </div>

                {/* Expanded "Other" list: grouped by bucket for expense, flat for income */}
                {showOther && (
                  <div className="mt-1 rounded-2xl border border-border bg-background-subtle p-3 space-y-3 max-h-64 overflow-y-auto">
                    {transactionType === "expense" ? (
                      EXTRA_CATEGORY_GROUPS.map((group) => (
                        <div key={group.bucket} className="space-y-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-foreground-muted block">
                            {group.bucket}
                          </span>
                          <div className="grid grid-cols-4 gap-2">
                            {group.categories.map((opt) => {
                              const Icon = resolveCategoryIcon(opt.iconName);
                              const isSelected = category === opt.name;
                              return (
                                <button
                                  key={opt.name}
                                  type="button"
                                  onClick={() => setCategory(opt.name)}
                                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-primary-lighter text-primary border-primary font-bold"
                                      : "bg-card border-border text-icon-default hover:bg-secondary hover:text-foreground"
                                  }`}
                                >
                                  <Icon className="w-4 h-4 mb-1" />
                                  <span className="text-[9px] leading-tight text-center break-words max-w-full">{opt.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    ) : (
                      INCOME_EXTRA_CATEGORY_GROUPS.map((group) => (
                        <div key={group.group} className="space-y-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-foreground-muted block">
                            {group.group}
                          </span>
                          <div className="grid grid-cols-4 gap-2">
                            {group.categories.map((opt) => {
                              const Icon = resolveCategoryIcon(opt.iconName);
                              const isSelected = category === opt.name;
                              return (
                                <button
                                  key={opt.name}
                                  type="button"
                                  onClick={() => setCategory(opt.name)}
                                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-primary-lighter text-primary border-primary font-bold"
                                      : "bg-card border-border text-icon-default hover:bg-secondary hover:text-foreground"
                                  }`}
                                >
                                  <Icon className="w-4 h-4 mb-1" />
                                  <span className="text-[9px] leading-tight text-center break-words max-w-full">{opt.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Narrative Description */}
              <div className="space-y-1">
                <label htmlFor="description" className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                  Description / Vendor Detail
                </label>
                <input
                  id="description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-base w-full"
                  placeholder="e.g. Weekly organic vegetables"
                />
              </div>

              {/* Submission Tray */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                >
                  Save Entry
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
