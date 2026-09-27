"use client";

import React, { useState, useEffect } from "react";
import { Search, Calendar, Edit2, Trash2, ArrowUpRight, ArrowDownRight, Tag, Check, AlertCircle, X, Plus } from "lucide-react";
import { formatAmount } from "@/core/utils/currencyManager";
import {
  Transaction,
  useTransactions,
  updateTransaction as storeUpdateTransaction,
  deleteTransaction as storeDeleteTransaction,
} from "@/core/store/dataStore";
import AddTransactionModal from "@/components/modals/AddTransactionModal";
import { useTranslation } from "@/i18n/i18nContext";

export default function TransactionsPage() {
  const transactions = useTransactions();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "income" | "expense">("all");
  const [activeCurrency, setActiveCurrency] = useState("INR");

  // Edit & Delete Actions State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Add Transaction modal (the list re-renders live via the useTransactions hook)
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { t } = useTranslation();

  // Load active currency preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      const cur = localStorage.getItem("active_currency");
      if (cur) {
        setActiveCurrency(cur);
      }
    }
  }, []);

  // Filter list on search query & active type tabs
  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "income" && tx.type === "income") ||
      (activeTab === "expense" && tx.type === "expense");

    return matchesSearch && matchesTab;
  });

  // Income / expense totals for just the currently-shown (searched/filtered)
  // transactions, surfaced as KPI cards under the search box while searching.
  const filteredTotals = filteredTransactions.reduce(
    (acc, tx) => {
      if (tx.type === "income") {
        acc.income += tx.amount;
        acc.incomeCount += 1;
      } else {
        acc.expense += tx.amount;
        acc.expenseCount += 1;
      }
      return acc;
    },
    { income: 0, expense: 0, incomeCount: 0, expenseCount: 0 }
  );

  // Relative Date sorting classification helper
  const groupTransactionsByDate = (txs: Transaction[]) => {
    const today = new Date().toDateString();
    
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toDateString();

    const groups: { today: Transaction[]; yesterday: Transaction[]; previous: Transaction[] } = {
      today: [],
      yesterday: [],
      previous: [],
    };

    txs.forEach((tx) => {
      const txDateStr = new Date(tx.date).toDateString();
      if (txDateStr === today) {
        groups.today.push(tx);
      } else if (txDateStr === yesterday) {
        groups.yesterday.push(tx);
      } else {
        groups.previous.push(tx);
      }
    });

    return groups;
  };

  const grouped = groupTransactionsByDate(filteredTransactions);

  // Action: Trigger Inline Deletion
  const handleDelete = (id: string) => {
    storeDeleteTransaction(id);
    setDeleteConfirmId(null);
  };

  // Action: Save Inline Edits
  const handleSaveEdit = (id: string) => {
    const numAmount = parseFloat(editAmount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    storeUpdateTransaction(id, {
      amount: numAmount,
      description: editDescription,
      // Editing the amount directly overrides any prior discount breakdown.
      originalAmount: undefined,
      discountAmount: undefined,
    });
    setEditingId(null);
  };

  // Action: Enter Edit Mode
  const startEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditAmount(String(tx.amount));
    setEditDescription(tx.description);
  };

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 md:p-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-foreground tracking-tight sm:text-3xl">
            {t('transactions.ledgerWorkspace')}
          </h1>
          <p className="text-sm font-medium text-foreground-muted">
            {t('transactions.reviewAndAudit')}
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="clay-btn-brand text-white shadow-clay-primary shrink-0 flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-black text-sm active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3px]" />
          {t('transactions.addTransaction')}
        </button>
      </div>

      {/* ────────────────── SEARCH AND FILTERS ────────────────── */}
      <section className="clay-card p-5 rounded-3xl space-y-4">
        {/* Search Input */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-icon-muted pointer-events-none">
            <Search className="w-5 h-5 text-primary/70" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 rounded-2xl clay-inset text-foreground placeholder:text-foreground-muted/60 font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder={t('transactions.filterPlaceholder')}
          />
        </div>

        {/* Income / expense totals for the currently-searched transactions */}
        {searchQuery.trim() !== "" && (
          <div className="grid grid-cols-2 gap-3.5">
            <div className="clay-surface-sm p-4 rounded-2xl flex items-center gap-3.5 border border-emerald-500/10">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.4),1px_2px_4px_rgba(0,0,0,0.06)]">
                <ArrowUpRight className="w-5 h-5 stroke-[2.5px]" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-foreground-secondary uppercase tracking-wider block">
                  Total Income
                  <span className="ml-1.5 normal-case text-foreground-muted font-bold">
                    · {filteredTotals.incomeCount} {filteredTotals.incomeCount === 1 ? "time" : "times"}
                  </span>
                </span>
                <span className="text-lg font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                  {formatAmount(filteredTotals.income, activeCurrency)}
                </span>
              </div>
            </div>

            <div className="clay-surface-sm p-4 rounded-2xl flex items-center gap-3.5 border border-rose-500/10">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.4),1px_2px_4px_rgba(0,0,0,0.06)]">
                <ArrowDownRight className="w-5 h-5 stroke-[2.5px]" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-foreground-secondary uppercase tracking-wider block">
                  Total Expense
                  <span className="ml-1.5 normal-case text-foreground-muted font-bold">
                    · {filteredTotals.expenseCount} {filteredTotals.expenseCount === 1 ? "time" : "times"}
                  </span>
                </span>
                <span className="text-lg font-black tracking-tight text-rose-600 dark:text-rose-400">
                  {formatAmount(filteredTotals.expense, activeCurrency)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab Segment Selector inside sunken clay well */}
        <div className="clay-inset p-1.5 rounded-2xl flex gap-1.5 bg-slate-200/50 dark:bg-slate-900/50">
          {(["all", "income", "expense"] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 px-4 text-xs font-black capitalize transition-all rounded-xl cursor-pointer ${
                  isActive
                    ? "clay-pill bg-white dark:bg-slate-800 text-primary shadow-clay-sm"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </section>

      {/* ────────────────── TRANSACTIONS LIST BY DATE ────────────────── */}
      <section className="space-y-6 flex-grow">
        {filteredTransactions.length === 0 ? (
          <div className="clay-card rounded-3xl p-12 text-center text-foreground-muted text-sm">
            {t('transactions.noMatchingTransactions')}
          </div>
        ) : (
          <>
            {/* Render Category Blocks */}
            {(["today", "yesterday", "previous"] as const).map((blockKey) => {
              const list = grouped[blockKey];
              if (list.length === 0) return null;

              const blockTitle = 
                blockKey === "today" 
                  ? t('common.today') 
                  : blockKey === "yesterday" 
                    ? t('common.yesterday') 
                    : t('common.previousWeeks');

              return (
                <div key={blockKey} className="space-y-3">
                  <h3 className="text-xs font-black text-foreground-secondary uppercase tracking-widest pl-2 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    {blockTitle}
                  </h3>
                  
                  {/* Rows Container */}
                  <div className="clay-card rounded-3xl overflow-hidden divide-y divide-border/40">
                    {list.map((tx) => {
                      const isEditing = editingId === tx.id;
                      const isDeleting = deleteConfirmId === tx.id;

                      return (
                        <div 
                          key={tx.id} 
                          className={`p-4 transition-all hover:bg-slate-500/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 ${
                            isEditing ? "bg-primary/5" : ""
                          }`}
                        >
                          {isEditing ? (
                            /* Inline Editing Block */
                            <div className="flex-1 flex flex-col sm:flex-row gap-3 w-full">
                              <input
                                type="text"
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                className="clay-inset px-3.5 py-2.5 rounded-xl flex-grow text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                                placeholder={t('transactions.editDescription')}
                                required
                              />
                              <input
                                type="number"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                                className="clay-inset px-3.5 py-2.5 rounded-xl w-full sm:w-32 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                                placeholder="Amount"
                                min="0.01"
                                step="0.01"
                                required
                              />
                              <div className="flex gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(tx.id)}
                                  className="p-2.5 rounded-xl clay-btn-success text-white transition-all active:scale-95 cursor-pointer shadow-clay-sm"
                                  title="Save Changes"
                                >
                                  <Check className="w-4 h-4 stroke-[3px]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="p-2.5 rounded-xl clay-surface-sm text-foreground-muted hover:text-foreground transition-all active:scale-95 cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ) : isDeleting ? (
                            /* Delete Confirmation Banner */
                            <div className="flex-1 flex items-center justify-between w-full p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl">
                              <span className="text-xs font-bold flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {t('transactions.deleteEntry')}
                              </span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleDelete(tx.id)}
                                  className="px-3.5 py-1.5 text-xs font-black rounded-xl clay-btn-danger text-white transition-all active:scale-95 cursor-pointer shadow-clay-sm"
                                >
                                  {t('common.confirm')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-3.5 py-1.5 text-xs font-bold rounded-xl clay-surface-sm text-foreground transition-all active:scale-95 cursor-pointer"
                                >
                                  {t('common.cancel')}
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Standard View Row */
                            <>
                              {/* Left Columns (Description, Category) */}
                              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.4),1px_3px_6px_rgba(0,0,0,0.06)] border ${
                                  tx.type === "income" 
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                                    : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                }`}>
                                  {tx.type === "income" ? (
                                    <ArrowUpRight className="w-5 h-5 stroke-[2.5px]" />
                                  ) : (
                                    <ArrowDownRight className="w-5 h-5 stroke-[2.5px]" />
                                  )}
                                </div>
                                <div className="space-y-1 min-w-0">
                                  <span className="font-black text-foreground text-sm block truncate">
                                    {tx.description}
                                  </span>
                                  <span className="text-[10px] font-extrabold text-foreground-secondary uppercase tracking-wider clay-surface-sm px-2.5 py-0.5 rounded-lg inline-flex items-center gap-1.5">
                                    <Tag className="w-3 h-3 text-primary/70" />
                                    {tx.category}
                                  </span>
                                </div>
                              </div>

                              {/* Right Columns (Amount, Action Buttons) */}
                              <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 border-t sm:border-0 pt-3 sm:pt-0 border-border/40">
                                <div className="flex flex-col items-end">
                                  <span className={`text-base font-black tracking-tight ${
                                    tx.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                                  }`}>
                                    {tx.type === "income" ? "+" : "-"}
                                    {formatAmount(tx.amount, activeCurrency)}
                                  </span>
                                  {tx.originalAmount !== undefined && tx.discountAmount !== undefined && (
                                    <span className="text-[10px] font-semibold leading-tight mt-0.5">
                                      <span className="text-foreground-muted line-through">
                                        {formatAmount(tx.originalAmount, activeCurrency)}
                                      </span>
                                      <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-1.5">
                                        {t('common.saved')} {formatAmount(tx.discountAmount, activeCurrency)}
                                      </span>
                                    </span>
                                  )}
                                </div>
                                
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => startEdit(tx)}
                                    className="p-2.5 text-foreground-muted hover:text-primary hover:scale-105 active:scale-95 clay-surface-sm rounded-xl transition-all cursor-pointer"
                                    title="Edit Transaction"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(tx.id)}
                                    className="p-2.5 text-foreground-muted hover:text-rose-500 hover:scale-105 active:scale-95 clay-surface-sm rounded-xl transition-all cursor-pointer"
                                    title="Delete Transaction"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </section>

      {/* Add Transaction Modal */}
      <AddTransactionModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
      />
    </div>
  );
}
