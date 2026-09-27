"use client";

import React, { useState, useEffect } from "react";
import { X, Check, Save } from "lucide-react";
import { getBudgets, setBudgets } from "@/core/store/dataStore";
import { getActiveCategories } from "@/core/utils/categories";
import { getCurrencySymbol, toBaseAmount, fromBaseAmount } from "@/core/utils/currencyManager";

interface SetBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function SetBudgetModal({
  isOpen,
  onClose,
  onSuccess,
}: SetBudgetModalProps) {
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [success, setSuccess] = useState(false);
  // Budgetable categories are the user's active expense categories.
  const [categories, setCategories] = useState<string[]>([]);
  // Budgets are stored in base (INR) but entered and shown in the user's active
  // display currency, so the field converts on the way in and out. Without this
  // a budget typed under a "$" label would be saved as ₹ and then compared
  // against spending in a different unit.
  const [activeCurrency, setActiveCurrency] = useState("INR");

  /** A stored base budget as a plain number in the active currency, for the input. */
  const toField = (base: number | undefined, currency: string): string =>
    base ? String(Math.round(fromBaseAmount(base, currency))) : "";

  useEffect(() => {
    if (isOpen) {
      const names = getActiveCategories("expense").map((c) => c.name);
      const first = names[0] ?? "";
      const budgets = getBudgets();
      const currency = localStorage.getItem("active_currency") || "INR";
      setTimeout(() => {
        setCategories(names);
        setSuccess(false);
        setCategory(first);
        setActiveCurrency(currency);
        setLimit(first ? toField(budgets[first], currency) : "");
      }, 0);
    }
  }, [isOpen]);

  const handleCategorySelect = (cat: string) => {
    setCategory(cat);
    setLimit(toField(getBudgets()[cat], activeCurrency));
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numLimit = parseFloat(limit);
    if (isNaN(numLimit) || numLimit <= 0) return;

    // Route through the data store so the write is persisted, synced to the
    // cloud, and broadcast to reactive subscribers (e.g. the home dashboard).
    // Writing localStorage directly here would be silently reverted by the
    // next Firestore snapshot and would never notify other pages.
    setBudgets({ ...getBudgets(), [category]: toBaseAmount(numLimit, activeCurrency) });

    setSuccess(true);
    setTimeout(() => {
      onClose();
      if (onSuccess) onSuccess();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center p-0 md:p-4 animate-in fade-in duration-200">
      {/* Modal Container */}
      <div 
        className="w-full clay-card rounded-t-[32px] md:rounded-3xl max-w-md shadow-clay-lg flex flex-col animate-in slide-in-from-bottom md:zoom-in-95 duration-300 overflow-hidden"
        role="dialog"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border/40 flex justify-between items-center bg-slate-500/5">
          <div>
            <h3 className="text-lg font-black text-foreground">Adjust Category Budget</h3>
            <p className="text-xs font-semibold text-foreground-muted">Configure active expenditure limit caps.</p>
          </div>
          <button
            onClick={onClose}
            className="text-foreground-muted hover:text-foreground p-2 rounded-xl clay-surface-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {success ? (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl clay-btn-success text-white flex items-center justify-center shadow-clay-success">
                <Check className="w-7 h-7 stroke-[3px]" />
              </div>
              <div>
                <h4 className="font-black text-foreground text-base">Budget Adjusted</h4>
                <p className="text-xs font-semibold text-foreground-muted">Expenditure alert lines updated successfully.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Category Chips Selector */}
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold text-foreground-secondary uppercase tracking-wider block">
                  Select Category
                </span>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const isSelected = category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleCategorySelect(cat)}
                        className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                          isSelected
                            ? "clay-btn-brand text-white shadow-clay-primary scale-102"
                            : "clay-surface-sm text-foreground-secondary hover:text-foreground hover:scale-105 active:scale-95"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Numeric Limit Input */}
              <div className="space-y-1.5">
                <label htmlFor="limit" className="text-[10px] font-extrabold text-foreground-secondary uppercase tracking-wider">
                  Monthly Capital Limit ({activeCurrency})
                </label>
                <div className="relative flex items-center">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 font-black text-primary pointer-events-none">
                    {getCurrencySymbol(activeCurrency) || "₹"}
                  </span>
                  <input
                    id="limit"
                    type="number"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    className="clay-inset pl-9 pr-4 py-3.5 w-full text-base font-black tracking-tight rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Enter limit threshold"
                    min="1"
                    step="1"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Action Tray */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="clay-surface-sm hover:scale-102 active:scale-95 flex-1 py-3 text-xs font-bold rounded-2xl text-foreground-muted hover:text-foreground transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="clay-btn-brand text-white shadow-clay-primary flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-xs active:scale-95 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4 stroke-[2.5px]" />
                  Save Budget
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
