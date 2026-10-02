"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Edit3, ShieldCheck, AlertTriangle, PieChart, Target, Settings2, Sliders, CheckCircle, Info, RefreshCw, AlertCircle, HelpCircle, ArrowLeftRight } from "lucide-react";
import { formatAmount } from "@/core/utils/currencyManager";
import SetBudgetModal from "@/components/modals/SetBudgetModal";
import { getBudgets, getTransactions, useTransactions, useBudgets, useMonthlyIncome, useMoneyRuleSplit, setMonthlyIncome, setMoneyRuleSplit } from "@/core/store/dataStore";
import { computeMoneyRule } from "@/core/insights/moneyRule";
import { getActiveCategories, resolveCategoryIcon, getIncomeGroupForCategory, resolveBucketForCategory, isBucketExcludedCategory } from "@/core/utils/categories";
import { useTranslation } from "@/i18n/i18nContext";
import { ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Tooltip } from "recharts";

import { formatDate } from "@/core/utils/dateFormat";
interface CategorySummary {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  spent: number;
  limit: number;
}

export default function BudgetsPage() {
  const [activeTab, setActiveTab] = useState<"rule" | "categories" | "spentVsInvested">("rule");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeCurrency, setActiveCurrency] = useState("INR");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Income Input State
  const [incomeInput, setIncomeInput] = useState("");
  const [isEditingIncome, setIsEditingIncome] = useState(false);

  // Split Editing State
  const [isEditingSplit, setIsEditingSplit] = useState(false);
  const [needsPct, setNeedsPct] = useState("50");
  const [wantsPct, setWantsPct] = useState("30");
  const [investPct, setInvestPct] = useState("20");
  const [splitError, setSplitError] = useState("");

  const { t } = useTranslation();
  
  // Real-time hooks from datastore
  const transactions = useTransactions();
  const activeBudgets = useBudgets();
  const storedIncome = useMonthlyIncome();
  const storedSplit = useMoneyRuleSplit();

  useEffect(() => {
    setIsMounted(true);
    if (typeof window === "undefined") return;
    const cur = localStorage.getItem("active_currency");
    if (cur) setActiveCurrency(cur);
  }, []);

  // Update input states when stored values load
  useEffect(() => {
    if (isMounted) {
      setIncomeInput(storedIncome.toString());
      setNeedsPct(storedSplit.needs.toString());
      setWantsPct(storedSplit.wants.toString());
      setInvestPct(storedSplit.investments.toString());
    }
  }, [storedIncome, storedSplit, isMounted]);

  // Compute 50/30/20 data
  const moneyRuleData = useMemo(() => {
    return computeMoneyRule(storedIncome, transactions, selectedDate, storedSplit, activeBudgets);
  }, [storedIncome, transactions, selectedDate, storedSplit, activeBudgets]);

  // Compute Category Budgets list data
  const categorySummaries = useMemo(() => {
    const targetMonth = selectedDate.getMonth();
    const targetYear = selectedDate.getFullYear();

    return getActiveCategories("expense").map((cat) => {
      const limit = activeBudgets[cat.name] || 0;

      const spent = transactions
        .filter((tx) => {
          const txDate = new Date(tx.date);
          return (
            tx.type === "expense" &&
            tx.category === cat.name &&
            txDate.getMonth() === targetMonth &&
            txDate.getFullYear() === targetYear
          );
        })
        .reduce((sum, tx) => sum + tx.amount, 0);

      return {
        id: cat.name,
        name: cat.name,
        icon: resolveCategoryIcon(cat.iconName),
        spent,
        limit,
      };
    });
  }, [transactions, activeBudgets, selectedDate]);

  const handlePrevMonth = () => {
    setSelectedDate((prev) => {
      const copy = new Date(prev);
      copy.setMonth(copy.getMonth() - 1);
      return copy;
    });
  };

  const handleNextMonth = () => {
    setSelectedDate((prev) => {
      const copy = new Date(prev);
      copy.setMonth(copy.getMonth() + 1);
      return copy;
    });
  };

  const formatMonthLabel = (date: Date) => {
    return formatDate(date, { month: "long", year: "numeric" });
  };

  const handleSaveIncome = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(incomeInput);
    if (!isNaN(val) && val >= 0) {
      setMonthlyIncome(val);
      setIsEditingIncome(false);
    }
  };

  const handleSaveSplit = (e: React.FormEvent) => {
    e.preventDefault();
    const nVal = parseInt(needsPct, 10);
    const wVal = parseInt(wantsPct, 10);
    const iVal = parseInt(investPct, 10);

    if (isNaN(nVal) || isNaN(wVal) || isNaN(iVal) || nVal < 0 || wVal < 0 || iVal < 0) {
      setSplitError("All split percentages must be non-negative integers.");
      return;
    }

    const total = nVal + wVal + iVal;
    if (total !== 100) {
      setSplitError(`Split ratios must add up to exactly 100%. Current sum: ${total}%`);
      return;
    }

    setSplitError("");
    setMoneyRuleSplit({
      needs: nVal,
      wants: wVal,
      investments: iVal
    });
    setIsEditingSplit(false);
  };

  const handleResetSplit = () => {
    setNeedsPct("50");
    setWantsPct("30");
    setInvestPct("20");
    setSplitError("");
    setMoneyRuleSplit({
      needs: 50,
      wants: 30,
      investments: 20
    });
    setIsEditingSplit(false);
  };

  // Group transactions for detailed bucket lists
  const bucketTransactions = useMemo(() => {
    const targetMonth = selectedDate.getMonth();
    const targetYear = selectedDate.getFullYear();

    // Mirrors computeMoneyRule's filter, so the itemized lists always add up to
    // the bucket totals shown above them — notebook-ledger mirrors are money
    // lent, not spent, so they belong in neither.
    const filtered = transactions.filter((tx) => {
      const txDate = new Date(tx.date);
      return (
        tx.type === "expense" &&
        !isBucketExcludedCategory(tx.category) &&
        txDate.getMonth() === targetMonth &&
        txDate.getFullYear() === targetYear
      );
    });

    const groups = {
      needs: [] as typeof transactions,
      wants: [] as typeof transactions,
      investments: [] as typeof transactions,
    };

    for (const tx of filtered) {
      const bucket = resolveBucketForCategory(tx.category);
      if (groups[bucket]) {
        groups[bucket].push(tx);
      }
    }

    return groups;
  }, [transactions, selectedDate]);

  // ── Spent vs Invested rollups ────────────────────────────────────
  // Spent = money consumed (Needs + Wants expenses); Invested = money put into
  // investments (Investments-bucket expenses); Returns = investment INCOME
  // received this month (Dividends, Interest, …). Totals come straight from the
  // already-computed moneyRuleData / bucketTransactions; only Returns is new.
  const spentVsInvested = useMemo(() => {
    const spent = moneyRuleData.needs.spent + moneyRuleData.wants.spent;
    const invested = moneyRuleData.investments.spent;

    const targetMonth = selectedDate.getMonth();
    const targetYear = selectedDate.getFullYear();
    const returnsTxs = transactions.filter((tx) => {
      if (tx.type !== "income") return false;
      const d = new Date(tx.date);
      return (
        d.getMonth() === targetMonth &&
        d.getFullYear() === targetYear &&
        getIncomeGroupForCategory(tx.category) === "Investment"
      );
    });
    const returns = returnsTxs.reduce((sum, t) => sum + t.amount, 0);

    const outflow = spent + invested;
    const investRate = outflow > 0 ? Math.round((invested / outflow) * 100) : 0;

    // Roll a transaction list up to category totals, sorted high → low.
    const rollup = (txs: typeof transactions) => {
      const m = new Map<string, number>();
      for (const t of txs) m.set(t.category, (m.get(t.category) || 0) + t.amount);
      return [...m.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    };

    return {
      spent,
      invested,
      returns,
      investRate,
      spentItems: rollup([...bucketTransactions.needs, ...bucketTransactions.wants]),
      investedItems: rollup(bucketTransactions.investments),
      returnsItems: rollup(returnsTxs),
    };
  }, [moneyRuleData, bucketTransactions, transactions, selectedDate]);

  const spentInvestedDonut = useMemo(
    () =>
      [
        { name: "Spent", value: spentVsInvested.spent, color: "#7c3aed" },
        { name: "Invested", value: spentVsInvested.invested, color: "#10b981" },
      ].filter((d) => d.value > 0),
    [spentVsInvested]
  );

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Over Budget":
        return "bg-error-light text-error border-error-light";
      case "Near Limit":
        return "bg-warning-light text-brand border-warning-light";
      default:
        return "bg-success-light text-success border-success-light";
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case "Over Budget":
        return "bg-error";
      case "Near Limit":
        return "bg-warning";
      default:
        return "bg-primary";
    }
  };

  const getCardBorderColor = (spent: number, limit: number) => {
    const ratio = limit > 0 ? spent / limit : 0;
    if (ratio >= 1.0) return "border-error-light";
    if (ratio >= 0.8) return "border-warning-light";
    return "border-border";
  };

  const donutChartData = useMemo(() => {
    return [
      { name: "Needs Spending", value: moneyRuleData.needs.spent, color: "#1d4ed8" },
      { name: "Wants Spending", value: moneyRuleData.wants.spent, color: "#7c3aed" },
      { name: "Investments Spending", value: moneyRuleData.investments.spent, color: "#10b981" },
    ].filter(item => item.value > 0);
  }, [moneyRuleData]);

  if (!isMounted) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 md:p-8 max-w-6xl mx-auto w-full">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-foreground tracking-tight sm:text-3xl">
            {activeTab === "rule"
              ? "Budgeting Rule"
              : activeTab === "spentVsInvested"
              ? "Spent vs Invested"
              : t("budgets.categoryBudgets")}
          </h1>
          <p className="text-sm font-medium text-foreground-muted">
            {activeTab === "rule"
              ? "Plan monthly spending limits based on customized split targets."
              : activeTab === "spentVsInvested"
              ? "See what you consumed versus what you invested this month."
              : t("budgets.establishBoundaries")}
          </p>
        </div>

        {activeTab === "categories" && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="clay-btn-brand text-white shadow-clay-primary shrink-0 flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-black text-sm active:scale-95 transition-all cursor-pointer"
          >
            <Edit3 className="w-4 h-4 stroke-[2.5px]" />
            {t("budgets.adjustBudgets")}
          </button>
        )}
      </div>

      {/* ────────────────── SEGMENT SELECTOR TABS ────────────────── */}
      <div className="clay-inset p-1.5 rounded-2xl flex gap-1.5 bg-slate-200/50 dark:bg-slate-900/50">
        <button
          onClick={() => setActiveTab("rule")}
          className={`flex-1 py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === "rule"
              ? "clay-pill bg-white dark:bg-slate-800 text-primary shadow-clay-sm"
              : "text-foreground-muted hover:text-foreground"
          }`}
        >
          <PieChart className="w-4 h-4" />
          Rule Allocations
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          className={`flex-1 py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === "categories"
              ? "clay-pill bg-white dark:bg-slate-800 text-primary shadow-clay-sm"
              : "text-foreground-muted hover:text-foreground"
          }`}
        >
          <Target className="w-4 h-4" />
          Category Limits
        </button>
        <button
          onClick={() => setActiveTab("spentVsInvested")}
          className={`flex-1 py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === "spentVsInvested"
              ? "clay-pill bg-white dark:bg-slate-800 text-primary shadow-clay-sm"
              : "text-foreground-muted hover:text-foreground"
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" />
          Spent vs Invested
        </button>
      </div>

      {/* ────────────────── CALCULATION PERIOD NAVIGATION ────────────────── */}
      <section className="clay-card p-4 rounded-3xl flex items-center justify-between">
        <button
          onClick={handlePrevMonth}
          className="p-2.5 rounded-2xl clay-surface-sm hover:scale-105 active:scale-95 text-foreground-muted hover:text-foreground transition-all cursor-pointer"
          title="Previous Month"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <h2 className="text-sm md:text-base font-black text-foreground tracking-wider uppercase">
          {formatMonthLabel(selectedDate)}
        </h2>

        <button
          onClick={handleNextMonth}
          className="p-2.5 rounded-2xl clay-surface-sm hover:scale-105 active:scale-95 text-foreground-muted hover:text-foreground transition-all cursor-pointer"
          title="Next Month"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </section>

      {/* ────────────────── TAB 1: BUDGETING RULE VIEW ────────────────── */}
      {activeTab === "rule" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Income and Split Settings grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Income Card */}
            <div className="clay-card p-6 rounded-3xl flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-extrabold text-foreground-muted tracking-wider uppercase block">
                  {t("moneyRule.takeHomeIncome") !== "moneyRule.takeHomeIncome" ? t("moneyRule.takeHomeIncome") : "Monthly Take-Home Income"}
                </span>
                {isEditingIncome ? (
                  <form onSubmit={handleSaveIncome} className="flex items-center gap-2 mt-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-primary">
                        {activeCurrency === "INR" ? "₹" : "$"}
                      </span>
                      <input
                        type="number"
                        value={incomeInput}
                        onChange={(e) => setIncomeInput(e.target.value)}
                        placeholder="0"
                        className="pl-8 pr-3.5 py-2.5 w-full rounded-2xl clay-inset text-base font-black text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        autoFocus
                      />
                    </div>
                    <button type="submit" className="clay-btn-brand text-white py-2.5 px-4 text-xs font-black rounded-2xl active:scale-95 transition-all shrink-0">
                      {t("common.save")}
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-2xl font-black text-foreground tracking-tight">
                      {formatAmount(storedIncome, activeCurrency, { decimalPlaces: 0 })}
                    </span>
                    <button
                      onClick={() => setIsEditingIncome(true)}
                      className="p-2 rounded-xl clay-surface-sm text-foreground-muted hover:text-foreground hover:scale-105 active:scale-95 transition-all cursor-pointer"
                      title="Edit Income"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2.5 mt-5 pt-4 border-t border-border/40 text-xs">
                <div className="clay-surface-sm p-3 rounded-2xl">
                  <span className="text-[9px] font-black text-foreground-muted uppercase tracking-wider block">Needs ({storedSplit.needs}%)</span>
                  <span className="font-black text-foreground text-sm mt-0.5 block">
                    {formatAmount(storedIncome * (storedSplit.needs / 100), activeCurrency, { decimalPlaces: 0 })}
                  </span>
                </div>
                <div className="clay-surface-sm p-3 rounded-2xl">
                  <span className="text-[9px] font-black text-foreground-muted uppercase tracking-wider block">Wants ({storedSplit.wants}%)</span>
                  <span className="font-black text-foreground text-sm mt-0.5 block">
                    {formatAmount(storedIncome * (storedSplit.wants / 100), activeCurrency, { decimalPlaces: 0 })}
                  </span>
                </div>
                <div className="clay-surface-sm p-3 rounded-2xl">
                  <span className="text-[9px] font-black text-foreground-muted uppercase tracking-wider block">Invest ({storedSplit.investments}%)</span>
                  <span className="font-black text-foreground text-sm mt-0.5 block">
                    {formatAmount(storedIncome * (storedSplit.investments / 100), activeCurrency, { decimalPlaces: 0 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Split Percentages Configuration Card */}
            <div className="clay-card p-6 rounded-3xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold text-foreground-muted tracking-wider uppercase block">
                    Ratio Split configuration
                  </span>
                  {!isEditingSplit && (
                    <button
                      onClick={() => setIsEditingSplit(true)}
                      className="p-2 rounded-xl clay-surface-sm text-foreground-muted hover:text-foreground hover:scale-105 active:scale-95 transition-all cursor-pointer"
                      title="Configure Splitting"
                    >
                      <Settings2 className="w-3.5 h-3.5 text-primary" />
                    </button>
                  )}
                </div>
                
                {isEditingSplit ? (
                  <form onSubmit={handleSaveSplit} className="space-y-3.5 mt-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[9px] font-extrabold text-foreground-secondary uppercase tracking-wider block mb-1">Needs %</label>
                        <input
                          type="number"
                          value={needsPct}
                          onChange={(e) => setNeedsPct(e.target.value)}
                          className="w-full text-center py-2 rounded-xl clay-inset text-xs font-black text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-extrabold text-foreground-secondary uppercase tracking-wider block mb-1">Wants %</label>
                        <input
                          type="number"
                          value={wantsPct}
                          onChange={(e) => setWantsPct(e.target.value)}
                          className="w-full text-center py-2 rounded-xl clay-inset text-xs font-black text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-extrabold text-foreground-secondary uppercase tracking-wider block mb-1">Invest %</label>
                        <input
                          type="number"
                          value={investPct}
                          onChange={(e) => setInvestPct(e.target.value)}
                          className="w-full text-center py-2 rounded-xl clay-inset text-xs font-black text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>

                    {splitError && (
                      <p className="text-[10px] font-bold text-rose-500 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>{splitError}</span>
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button type="submit" className="clay-btn-brand text-white py-2 px-4 rounded-xl text-[10px] font-black uppercase active:scale-95 transition-all cursor-pointer">
                        Apply Split
                      </button>
                      <button
                        type="button"
                        onClick={handleResetSplit}
                        className="clay-surface-sm text-foreground-muted hover:text-foreground py-2 px-3 rounded-xl text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                        title="Reset to default ratios"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Reset Default
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-2xl font-black text-foreground tracking-tight">
                      {storedSplit.needs} / {storedSplit.wants} / {storedSplit.investments}
                    </span>
                    <span className="text-[10px] font-extrabold text-foreground-muted clay-surface-sm px-2.5 py-1 rounded-full">
                      Ratios Sum: 100%
                    </span>
                  </div>
                )}
              </div>

              {!isEditingSplit && (
                <p className="text-[11px] font-medium text-foreground-muted flex items-center gap-1.5 mt-4">
                  <Sliders className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Tap the gear icon to change splits (e.g. 60/20/20 or 40/40/20).</span>
                </p>
              )}
            </div>
          </div>

          {/* Core breakdown layout grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Spending Chart Column */}
            <div className="lg:col-span-1 space-y-6">
              <div className="clay-card p-6 rounded-3xl space-y-4">
                <h3 className="text-sm font-black text-foreground">Spending Chart</h3>
                
                {donutChartData.length > 0 ? (
                  <div className="h-60 w-full flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={donutChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {donutChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatAmount(value as number, activeCurrency)} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                    
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-extrabold text-foreground-muted uppercase tracking-wider">Total Spent</span>
                      <span className="text-lg font-black text-foreground">
                        {formatAmount(
                          moneyRuleData.needs.spent + moneyRuleData.wants.spent + moneyRuleData.investments.spent, 
                          activeCurrency,
                          { decimalPlaces: 0 }
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="h-60 flex flex-col items-center justify-center text-center p-4 clay-inset rounded-2xl text-foreground-muted">
                    <AlertCircle className="w-8 h-8 mb-2 text-primary/60" />
                    <span className="text-xs font-semibold">No expenses logged in {formatMonthLabel(selectedDate)}</span>
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs font-extrabold clay-surface-sm p-2.5 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#1d4ed8] shadow-sm" />
                      <span className="text-foreground">Needs ({storedSplit.needs}%)</span>
                    </div>
                    <span className="text-foreground-secondary">{formatAmount(moneyRuleData.needs.spent, activeCurrency)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-extrabold clay-surface-sm p-2.5 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#7c3aed] shadow-sm" />
                      <span className="text-foreground">Wants ({storedSplit.wants}%)</span>
                    </div>
                    <span className="text-foreground-secondary">{formatAmount(moneyRuleData.wants.spent, activeCurrency)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-extrabold clay-surface-sm p-2.5 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#10b981] shadow-sm" />
                      <span className="text-foreground">Investments ({storedSplit.investments}%)</span>
                    </div>
                    <span className="text-foreground-secondary">{formatAmount(moneyRuleData.investments.spent, activeCurrency)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bucket cards listing Column */}
            <div className="lg:col-span-2 space-y-6">
              {(["needs", "wants", "investments"] as const).map((key) => {
                const data = moneyRuleData[key];
                const txs = bucketTransactions[key];
                const title = key === "needs" 
                  ? `Needs (${storedSplit.needs}%)` 
                  : key === "wants" 
                  ? `Wants (${storedSplit.wants}%)` 
                  : `Investments (${storedSplit.investments}%)`;
                const desc = key === "needs" 
                  ? "Essential expenses (Rent, Groceries, Utilities, Insurance, EMIs)" 
                  : key === "wants" 
                  ? "Lifestyle spending (Dining out, Hobbies, Gym, Shopping, Subscriptions)" 
                  : "Financial health & future growth (FD, SIP, Mutual Funds, Stocks, Gold)";

                return (
                  <div key={key} className="clay-card rounded-3xl overflow-hidden">
                    {/* Header */}
                    <div className="p-5 border-b border-border/40 bg-slate-500/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <h3 className="text-base font-black text-foreground flex items-center gap-2">
                          {title}
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 border rounded-full tracking-wide uppercase ${getStatusBadgeClass(data.status)}`}>
                            {data.status}
                          </span>
                        </h3>
                        <p className="text-xs text-foreground-muted">{desc}</p>
                      </div>
                      
                      <div className="text-left md:text-right">
                        <span className="text-[10px] font-extrabold text-foreground-muted uppercase tracking-wider block">Remaining</span>
                        <span className={`text-base font-black tracking-tight ${data.remaining < 0 ? "text-rose-500" : "text-foreground"}`}>
                          {formatAmount(data.remaining, activeCurrency)}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Grid Stats */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                        <div className="clay-surface-sm p-3 rounded-2xl">
                          <span className="text-[9px] font-extrabold text-foreground-muted uppercase tracking-wider block">Rule Limit</span>
                          <span className="text-xs font-black text-foreground mt-0.5 block">{formatAmount(data.budget, activeCurrency)}</span>
                        </div>
                        <div className="clay-surface-sm p-3 rounded-2xl">
                          <span className="text-[9px] font-extrabold text-foreground-muted uppercase tracking-wider block">Allocated</span>
                          <span className="text-xs font-black text-foreground mt-0.5 block">{formatAmount(data.allocatedBudget, activeCurrency)}</span>
                        </div>
                        <div className="clay-surface-sm p-3 rounded-2xl">
                          <span className="text-[9px] font-extrabold text-foreground-muted uppercase tracking-wider block">Actual Spent</span>
                          <span className="text-xs font-black text-foreground mt-0.5 block">{formatAmount(data.spent, activeCurrency)}</span>
                        </div>
                        <div className="clay-surface-sm p-3 rounded-2xl">
                          <span className="text-[9px] font-extrabold text-foreground-muted uppercase tracking-wider block">Utilized %</span>
                          <span className="text-xs font-black text-foreground mt-0.5 block">{data.usage}%</span>
                        </div>
                        <div className="clay-surface-sm p-3 rounded-2xl col-span-2 sm:col-span-1 flex items-center justify-between">
                          <div>
                            <span className="text-[9px] font-extrabold text-foreground-muted uppercase tracking-wider block">Discipline</span>
                            <span className={`text-[10px] font-black uppercase ${data.status === "Over Budget" ? "text-rose-500" : data.status === "Near Limit" ? "text-amber-500" : "text-emerald-500"}`}>
                              {data.status}
                            </span>
                          </div>
                          {data.status === "On Track" ? (
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <AlertTriangle className={`w-4 h-4 shrink-0 ${data.status === "Near Limit" ? "text-amber-500" : "text-rose-500"}`} />
                          )}
                        </div>
                      </div>

                      {/* Warnings */}
                      {data.allocatedBudget > data.budget ? (
                        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-semibold">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>
                            Category budgets for this bucket exceed your target limit of {formatAmount(data.budget, activeCurrency)} by {formatAmount(data.allocatedBudget - data.budget, activeCurrency)}. Adjust category limits.
                          </span>
                        </div>
                      ) : data.allocatedBudget <= data.budget && data.allocatedBudget > 0 ? (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-semibold">
                          <ShieldCheck className="w-4 h-4 shrink-0" />
                          <span>
                            Category budgets align with limit. Allocated {formatAmount(data.allocatedBudget, activeCurrency)} of your {formatAmount(data.budget, activeCurrency)} target ({formatAmount(data.budget - data.allocatedBudget, activeCurrency)} unallocated).
                          </span>
                        </div>
                      ) : null}

                      {/* Progress bar inside sunken clay well */}
                      <div className="w-full clay-inset p-0.5 h-3.5 rounded-full overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all duration-500 shadow-sm ${getProgressColor(data.status)}`}
                          style={{ width: `${Math.min(data.usage, 100)}%` }}
                        />
                      </div>

                      {/* Itemized transactions */}
                      <div className="space-y-2 pt-2">
                        <h4 className="text-xs font-black text-foreground-secondary uppercase tracking-wider">Itemized Expenses</h4>
                        {txs.length > 0 ? (
                          <div className="clay-surface-sm rounded-2xl divide-y divide-border/40 overflow-hidden">
                            {txs.map((tx) => (
                              <div key={tx.id} className="flex justify-between items-center p-3 hover:bg-slate-500/5 transition-colors">
                                <div className="space-y-0.5">
                                  <span className="text-xs font-extrabold text-foreground block">{tx.description || tx.category}</span>
                                  <div className="flex items-center gap-2 text-[10px] font-semibold text-foreground-muted">
                                    <span className="clay-inset px-2 py-0.5 rounded-md text-[9px] font-bold text-foreground-secondary">{tx.category}</span>
                                    <span>{formatDate(tx.date, { month: "short", day: "numeric" })}</span>
                                  </div>
                                </div>
                                <span className="text-xs font-black text-foreground">{formatAmount(tx.amount, activeCurrency)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-6 text-center text-xs font-semibold text-foreground-muted clay-inset rounded-2xl">
                            No expenses logged for {title} in this month.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      )}

      {/* ────────────────── TAB 2: CATEGORY BUDGETS VIEW ────────────────── */}
      {activeTab === "categories" && (
        <section className="space-y-4 animate-in fade-in duration-200">
          {categorySummaries.map((summary) => {
            const Icon = summary.icon;
            const hasLimit = summary.limit > 0;
            const pct = hasLimit ? Math.min(Math.round((summary.spent / summary.limit) * 100), 200) : 0;
            const isOver = hasLimit && summary.spent >= summary.limit;
            const isWarning = hasLimit && summary.spent / summary.limit >= 0.8 && !isOver;

            return (
              <div
                key={summary.id}
                className="clay-card p-5 rounded-3xl space-y-4 transition-all hover:scale-[1.01]"
              >
                {/* Row Header */}
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.4),1px_3px_6px_rgba(0,0,0,0.06)] border ${
                      isOver 
                        ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20" 
                        : isWarning 
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          : "bg-primary/15 text-primary border-primary/20"
                    }`}>
                      <Icon className="w-5 h-5 stroke-[2.2px]" />
                    </div>
                    <div>
                      <h3 className="font-black text-foreground text-sm">{summary.name}</h3>
                      <span className="text-[10px] font-extrabold text-foreground-secondary tracking-wide uppercase">
                        {hasLimit ? `${t('budgets.budget')}: ${formatAmount(summary.limit, activeCurrency)}` : t('budgets.noBudgetSet')}
                      </span>
                    </div>
                  </div>

                  {/* Spent calculations */}
                  <div className="text-right space-y-0.5">
                    <span className={`text-base font-black tracking-tight ${
                      isOver ? "text-rose-500" : isWarning ? "text-amber-500" : "text-foreground"
                    }`}>
                      {formatAmount(summary.spent, activeCurrency)}
                    </span>
                    <span className="text-[10px] font-extrabold text-foreground-muted block">
                      {hasLimit ? `${pct}% ${t('budgets.consumed')}` : t('budgets.tapToSetCap')}
                    </span>
                  </div>
                </div>

                {/* Progress Bar Meter inside sunken clay well */}
                <div className="space-y-1.5">
                  <div className="w-full clay-inset p-0.5 h-3.5 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-500 shadow-sm ${
                        isOver ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-primary"
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>

                  {/* Exceeded / Approaching alert labels */}
                  {!hasLimit ? (
                    <span className="text-[10px] font-extrabold text-foreground-muted flex items-center gap-1.5 mt-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                      {t('budgets.noLimitConfigured', { amount: formatAmount(summary.spent, activeCurrency) })}
                    </span>
                  ) : isOver ? (
                    <span className="text-[10px] font-extrabold text-rose-500 flex items-center gap-1.5 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {t('budgets.budgetBreached', { amount: formatAmount(summary.spent - summary.limit, activeCurrency) })}
                    </span>
                  ) : isWarning ? (
                    <span className="text-[10px] font-extrabold text-amber-500 flex items-center gap-1.5 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {t('budgets.budgetWarning')}
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold text-emerald-500 flex items-center gap-1.5 mt-1">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                      {t('budgets.optimalStatus')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* ────────────────── TAB 3: SPENT VS INVESTED VIEW ────────────────── */}
      {activeTab === "spentVsInvested" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Spent", value: formatAmount(spentVsInvested.spent, activeCurrency), sub: "Needs + Wants", cls: "text-foreground" },
              { label: "Total Invested", value: formatAmount(spentVsInvested.invested, activeCurrency), sub: "Money you put in", cls: "text-primary" },
              { label: "Investment Returns", value: `+${formatAmount(spentVsInvested.returns, activeCurrency)}`, sub: "Income received", cls: "text-emerald-500" },
              { label: "Invest Rate", value: `${spentVsInvested.investRate}%`, sub: "of your outflow", cls: "text-foreground" },
            ].map((k) => (
              <div key={k.label} className="clay-card p-5 rounded-3xl">
                <span className="text-[10px] font-extrabold text-foreground-muted uppercase tracking-wider block">{k.label}</span>
                <span className={`text-xl font-black tracking-tight mt-0.5 block ${k.cls}`}>{k.value}</span>
                <span className="text-[10px] font-bold text-foreground-muted block mt-0.5">{k.sub}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Donut Column */}
            <div className="lg:col-span-1 space-y-6">
              <div className="clay-card p-6 rounded-3xl space-y-4">
                <h3 className="text-sm font-black text-foreground">Spent vs Invested</h3>

                {spentInvestedDonut.length > 0 ? (
                  <div className="h-60 w-full flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={spentInvestedDonut}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {spentInvestedDonut.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatAmount(value as number, activeCurrency)} />
                      </RechartsPieChart>
                    </ResponsiveContainer>

                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-extrabold text-foreground-muted uppercase tracking-wider">Outflow</span>
                      <span className="text-lg font-black text-foreground">
                        {formatAmount(spentVsInvested.spent + spentVsInvested.invested, activeCurrency, { decimalPlaces: 0 })}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="h-60 flex flex-col items-center justify-center text-center p-4 clay-inset rounded-2xl text-foreground-muted">
                    <AlertCircle className="w-8 h-8 mb-2 text-primary/60" />
                    <span className="text-xs font-semibold">No outflow logged in {formatMonthLabel(selectedDate)}</span>
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs font-extrabold clay-surface-sm p-2.5 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#7c3aed] shadow-sm" />
                      <span className="text-foreground">Spent</span>
                    </div>
                    <span className="text-foreground-secondary">{formatAmount(spentVsInvested.spent, activeCurrency)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-extrabold clay-surface-sm p-2.5 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#10b981] shadow-sm" />
                      <span className="text-foreground">Invested</span>
                    </div>
                    <span className="text-foreground-secondary">{formatAmount(spentVsInvested.invested, activeCurrency)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Breakdown sections Column */}
            <div className="lg:col-span-2 space-y-6">
              {[
                { key: "spent", title: "Spent", desc: "Money consumed on Needs & Wants this month", items: spentVsInvested.spentItems, total: spentVsInvested.spent, accent: "#7c3aed", incoming: false },
                { key: "invested", title: "Where you invested", desc: "Money you put into investments (SIP, Stocks, Mutual Funds, …)", items: spentVsInvested.investedItems, total: spentVsInvested.invested, accent: "#10b981", incoming: false },
                { key: "returns", title: "Investment Returns", desc: "Income received from investments — money coming in, not part of your spending plan", items: spentVsInvested.returnsItems, total: spentVsInvested.returns, accent: "#059669", incoming: true },
              ].map((sec) => (
                <div key={sec.key} className="clay-card rounded-3xl overflow-hidden">
                  <div className="p-5 border-b border-border/40 bg-slate-500/5 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-base font-black text-foreground">{sec.title}</h3>
                      <p className="text-xs text-foreground-muted">{sec.desc}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-extrabold text-foreground-muted uppercase tracking-wider block">
                        {sec.incoming ? "Received" : "Total"}
                      </span>
                      <span className={`text-base font-black tracking-tight ${sec.incoming ? "text-emerald-500" : "text-foreground"}`}>
                        {sec.incoming ? "+" : ""}{formatAmount(sec.total, activeCurrency)}
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    {sec.items.length > 0 ? (
                      <div className="clay-surface-sm rounded-2xl divide-y divide-border/40 overflow-hidden">
                        {sec.items.map((it) => (
                          <div key={it.name} className="flex justify-between items-center p-3 hover:bg-slate-500/5 transition-colors">
                            <div className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: sec.accent }} />
                              <span className="text-xs font-black text-foreground">{it.name}</span>
                            </div>
                            <span className="text-xs font-black text-foreground">{formatAmount(it.value, activeCurrency)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-xs font-semibold text-foreground-muted clay-inset rounded-2xl">
                        {sec.incoming
                          ? `No investment income in ${formatMonthLabel(selectedDate)}.`
                          : `No ${sec.title.toLowerCase()} logged in ${formatMonthLabel(selectedDate)}.`}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Set Budget Limit Overlay Modal */}
      <SetBudgetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          // Trigger data reload by triggering datastore change event
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("datastore:change"));
          }
        }}
      />
    </div>
  );
}
