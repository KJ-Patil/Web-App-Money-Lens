"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Target,
  Activity,
  Inbox,
  PiggyBank,
  User,
  ShieldCheck,
  Info,
} from "lucide-react";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { formatAmount } from "@/core/utils/currencyManager";
import { useSessionProfile } from "@/core/store/userProfile";
import SmsPasteZone from "@/components/automation/SmsPasteZone";
import { useTranslation } from "@/i18n/i18nContext";
import { computeSafeToSpend } from "@/core/insights/safeToSpend";
import {
  useTransactions,
  useBudgets,
  getTotals,
  getMonthTotals,
  getCategoryBreakdown,
  getDailyBalanceTrend,
  getSavingsGoals,
  getSavingsRate,
} from "@/core/store/dataStore";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function WorkspacePage() {
  const [isMounted, setIsMounted] = useState(false);
  const session = useSessionProfile();
  const userName = session.name || "Guest";
  const userAvatar = session.avatarUrl;
  const [activeCurrency, setActiveCurrency] = useState("INR");
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [chartView, setChartView] = useState<"both" | "income" | "spent">("both");

  const { t } = useTranslation();

  const transactions = useTransactions();
  const budgets = useBudgets();

  // ── Derived, real-time metrics computed from the user's own transactions ──
  const totals = useMemo(() => getTotals(transactions), [transactions]);
  const monthTotals = useMemo(() => getMonthTotals(0, transactions), [transactions]);
  const lineTrendData = useMemo(() => getDailyBalanceTrend(7, transactions), [transactions]);
  const categoryBarData = useMemo(
    () =>
      getCategoryBreakdown("expense", 0, transactions).map((c) => ({
        category: c.name,
        Amount: c.value,
      })),
    [transactions]
  );

  // Remaining budget %: this month's spend against the sum of configured budgets.
  const budgetRemaining = useMemo(() => {
    const totalBudget = Object.values(budgets).reduce((a, b) => a + b, 0);
    if (totalBudget <= 0) return null;
    const remaining = Math.max(0, totalBudget - monthTotals.expense);
    return Math.round((remaining / totalBudget) * 1000) / 10;
  }, [budgets, monthTotals.expense]);

  // Overall savings-goal progress.
  const goalProgress = useMemo(() => {
    const goals = getSavingsGoals();
    const target = goals.reduce((a, g) => a + g.target, 0);
    const current = goals.reduce((a, g) => a + g.current, 0);
    if (target <= 0) return null;
    return Math.round((Math.min(current, target) / target) * 1000) / 10;
  }, [transactions]);

  // Health index derived from the real savings rate.
  const healthScore = useMemo(() => {
    if (transactions.length === 0) return null;
    const rate = getSavingsRate(transactions);
    return Math.min(Math.max(Math.round(40 + rate * 0.6), 0), 100);
  }, [transactions]);

  // Total saved across all expenses via discounts.
  const totalSaved = useMemo(
    () => transactions.reduce((acc, t) => acc + (t.discountAmount ?? 0), 0),
    [transactions]
  );

  // Safe to Spend today calculation
  const safe = useMemo(
    () => computeSafeToSpend(transactions, budgets, getSavingsGoals()),
    [transactions, budgets]
  );

  const hasData = transactions.length > 0;

  // Prevent Next.js hydration issues with Recharts + load client-only state.
  useEffect(() => {
    setTimeout(() => {
      setIsMounted(true);
    }, 0);
    if (typeof window !== "undefined") {
      const loadData = () => {
        const configCurrency = localStorage.getItem("active_currency");
        if (configCurrency) {
          setActiveCurrency(configCurrency);
        }

        const storedNotes = localStorage.getItem("notifications");
        if (storedNotes) {
          try {
            const parsed = JSON.parse(storedNotes);
            setNotifications(
              parsed.map((n: unknown) =>
                typeof n === "string"
                  ? n
                  : (n as { text?: string }).text || (n as { message?: string }).message || String(n)
              )
            );
          } catch {
            // Ignore malformed notification cache
          }
        } else {
          setNotifications([]);
        }
      };

      loadData();
      window.addEventListener("datastore:change", loadData);
      window.addEventListener("storage", loadData);
      return () => {
        window.removeEventListener("datastore:change", loadData);
        window.removeEventListener("storage", loadData);
      };
    }
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("home.goodMorning");
    if (hour < 17) return t("home.goodAfternoon");
    return t("home.goodEvening");
  };

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 md:p-8 max-w-7xl mx-auto w-full">
      {/* ────────────────── HEADER ────────────────── */}
      <header className="flex justify-between items-center bg-card border border-border p-5 md:p-6 rounded-3xl shadow-[8px_14px_28px_-4px_rgba(148,163,184,0.24),inset_2px_2px_4px_rgba(255,255,255,0.95),inset_-2px_-2px_4px_rgba(148,163,184,0.15)] dark:shadow-[0_16px_32px_-6px_rgba(0,0,0,0.55),inset_2px_2px_4px_rgba(255,255,255,0.08)]">
        <div className="flex items-center gap-3.5">
          {/* Profile photo beside the greeting */}
          <div className="w-13 h-13 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/40 text-primary flex items-center justify-center border-2 border-white dark:border-white/10 shadow-[0_6px_14px_-2px_rgba(148,163,184,0.3),inset_2px_2px_4px_rgba(255,255,255,0.9),inset_-2px_-2px_4px_rgba(148,163,184,0.2)] shrink-0 overflow-hidden">
            {userAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userAvatar}
                alt={userName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-6 h-6" />
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-foreground tracking-tight sm:text-3xl">
              {getGreeting()}, {userName}
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-foreground-muted">
              {t("home.financialOverview")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Light / Dark theme switch */}
          <ThemeToggle />

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-3 rounded-2xl border border-border bg-card text-icon-default hover:text-icon-active shadow-[4px_6px_14px_-2px_rgba(148,163,184,0.25),inset_1.5px_1.5px_3px_rgba(255,255,255,0.9),inset_-1.5px_-1.5px_3px_rgba(148,163,184,0.15)] dark:shadow-[0_6px_14px_-2px_rgba(0,0,0,0.5),inset_1.5px_1.5px_3px_rgba(255,255,255,0.07)] transition-all cursor-pointer hover:-translate-y-0.5 active:translate-y-0.5"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <>
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-error animate-ping"></span>
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-error"></span>
                </>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 bg-card border border-border rounded-2xl shadow-[0_16px_36px_-6px_rgba(148,163,184,0.4),inset_2px_2px_4px_rgba(255,255,255,0.9)] dark:shadow-[0_16px_36px_-6px_rgba(0,0,0,0.7),inset_2px_2px_4px_rgba(255,255,255,0.08)] z-40 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                    {t("home.alertCenter")}
                  </span>
                  <button
                    onClick={() => {
                      setNotifications([]);
                      localStorage.setItem("notifications", "[]");
                    }}
                    className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    {t("home.clearAll")}
                  </button>
                </div>
                <div className="space-y-2 divide-y divide-border">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-foreground-muted pt-2">{t("home.noAlerts")}</p>
                  ) : (
                    notifications.map((note, i) => (
                      <p key={i} className="text-xs font-medium text-foreground-secondary pt-2 first:pt-0">
                        {note}
                      </p>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ────────────────── BENTO GRID ────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Bento Tile 1: Available Liquidity (Col-Span 2) */}
        <section className="col-span-1 md:col-span-2 rounded-3xl border border-white/80 dark:border-white/10 bg-gradient-to-br from-blue-500/10 via-card to-card p-6 md:p-7 shadow-[8px_16px_32px_-4px_rgba(148,163,184,0.28),inset_2px_2px_4px_rgba(255,255,255,0.95),inset_-3px_-3px_6px_rgba(148,163,184,0.18)] dark:shadow-[0_16px_32px_-6px_rgba(0,0,0,0.6),inset_2px_2px_4px_rgba(255,255,255,0.08)] flex flex-col justify-between gap-6 hover:-translate-y-1 transition-all duration-300">
          <div className="space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-primary">
              {t("home.availableLiquidity")}
            </span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-primary drop-shadow-xs">
              {formatAmount(totals.balance, activeCurrency)}
            </h2>
            <p className="text-xs font-semibold text-primary/70">
              {t("home.computedAcrossVaults")}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="bg-card/95 dark:bg-card/80 backdrop-blur-sm px-4 py-3 rounded-2xl flex items-center gap-3 border border-border shadow-[3px_5px_12px_-2px_rgba(148,163,184,0.2),inset_1.5px_1.5px_2px_rgba(255,255,255,0.9)] dark:shadow-[0_4px_10px_-2px_rgba(0,0,0,0.5)]">
              <div className="w-8 h-8 rounded-xl bg-success/15 text-success flex items-center justify-center shrink-0 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(5,150,105,0.2)]">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider block">
                  {t("home.inflow")}
                </span>
                <span className="text-sm font-black text-foreground">
                  {formatAmount(monthTotals.income, activeCurrency)}
                </span>
              </div>
            </div>

            <div className="bg-card/95 dark:bg-card/80 backdrop-blur-sm px-4 py-3 rounded-2xl flex items-center gap-3 border border-border shadow-[3px_5px_12px_-2px_rgba(148,163,184,0.2),inset_1.5px_1.5px_2px_rgba(255,255,255,0.9)] dark:shadow-[0_4px_10px_-2px_rgba(0,0,0,0.5)]">
              <div className="w-8 h-8 rounded-xl bg-error/15 text-error flex items-center justify-center shrink-0 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(220,38,38,0.2)]">
                <ArrowDownRight className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider block">
                  {t("home.outflow")}
                </span>
                <span className="text-sm font-black text-foreground">
                  {formatAmount(monthTotals.expense, activeCurrency)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Bento Tile 2: Safe to Spend Today (Col-Span 2) */}
        <section className="col-span-1 md:col-span-2 rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white p-6 md:p-7 shadow-[0_16px_32px_-4px_rgba(29,78,216,0.45),inset_2.5px_2.5px_4px_rgba(255,255,255,0.35),inset_-3px_-3px_6px_rgba(15,23,42,0.4)] flex flex-col justify-between gap-6 hover:-translate-y-1 transition-all duration-300 border border-white/20">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-white/95" />
              <span className="text-xs font-black uppercase tracking-widest text-white/95">
                Safe to Spend Today
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-sm">
              {!isMounted
                ? "—"
                : safe.insufficientData
                ? "Set a budget"
                : formatAmount(safe.perDay, activeCurrency, { decimalPlaces: 0 })}
            </h2>
            <p className="text-xs font-medium text-white/85 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0" />
              {!isMounted
                ? "Calculating your daily number…"
                : safe.insufficientData
                ? "Add income or a budget this month to get your daily number."
                : `After this month's spending & savings, across ${safe.daysLeft} day${
                    safe.daysLeft === 1 ? "" : "s"
                  } left.`}
            </p>
          </div>

          {!safe.insufficientData && isMounted && (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-white/15 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 shadow-[inset_1.5px_1.5px_3px_rgba(255,255,255,0.25),0_4px_12px_rgba(0,0,0,0.15)]">
                <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider block">
                  Left this month
                </span>
                <span className="text-sm font-extrabold text-white">
                  {formatAmount(safe.remainingForMonth, activeCurrency, { decimalPlaces: 0 })}
                </span>
              </div>
              <div className="bg-white/15 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 shadow-[inset_1.5px_1.5px_3px_rgba(255,255,255,0.25),0_4px_12px_rgba(0,0,0,0.15)]">
                <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider block">
                  Reserved to save
                </span>
                <span className="text-sm font-extrabold text-white">
                  {formatAmount(safe.reservedForSavings, activeCurrency, { decimalPlaces: 0 })}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Bento Tile 3: Remaining Budget (Col-Span 1) */}
        <Link
          href="/budgets"
          className="col-span-1 bg-card border border-border p-6 rounded-3xl shadow-[8px_14px_28px_-4px_rgba(148,163,184,0.25),inset_2px_2px_4px_rgba(255,255,255,0.95),inset_-2.5px_-2.5px_5px_rgba(148,163,184,0.18)] dark:shadow-[0_16px_32px_-6px_rgba(0,0,0,0.55),inset_2px_2px_4px_rgba(255,255,255,0.08)] space-y-3 flex flex-col justify-between hover:-translate-y-1 hover:shadow-[12px_20px_36px_-6px_rgba(148,163,184,0.35)] dark:hover:shadow-[0_20px_40px_-6px_rgba(0,0,0,0.7)] transition-all duration-300 group"
        >
          <div className="flex items-center justify-between text-icon-default">
            <span className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
              {t("home.remainingBudget")}
            </span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-[inset_1px_1px_2px_rgba(255,255,255,0.9),inset_-1px_-1px_2px_rgba(29,78,216,0.15)]">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-foreground">
              {!isMounted || budgetRemaining === null ? "—" : `${budgetRemaining}%`}
            </h3>
            <div className="w-full bg-secondary/80 h-2.5 rounded-full overflow-hidden shadow-[inset_1.5px_1.5px_3px_rgba(148,163,184,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.8)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)]">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500 shadow-[0_2px_6px_rgba(29,78,216,0.35),inset_1px_1px_2px_rgba(255,255,255,0.4)]"
                style={{ width: `${isMounted ? budgetRemaining ?? 0 : 0}%` }}
              ></div>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-foreground-muted pt-1 border-t border-border/50">
            <span className="font-semibold">Monthly Plan</span>
            <span className="font-bold text-primary group-hover:translate-x-0.5 transition-transform">View →</span>
          </div>
        </Link>

        {/* Bento Tile 4: Goal Progress (Col-Span 1) */}
        <Link
          href="/savings"
          className="col-span-1 bg-card border border-border p-6 rounded-3xl shadow-[8px_14px_28px_-4px_rgba(148,163,184,0.25),inset_2px_2px_4px_rgba(255,255,255,0.95),inset_-2.5px_-2.5px_5px_rgba(148,163,184,0.18)] dark:shadow-[0_16px_32px_-6px_rgba(0,0,0,0.55),inset_2px_2px_4px_rgba(255,255,255,0.08)] space-y-3 flex flex-col justify-between hover:-translate-y-1 hover:shadow-[12px_20px_36px_-6px_rgba(148,163,184,0.35)] dark:hover:shadow-[0_20px_40px_-6px_rgba(0,0,0,0.7)] transition-all duration-300 group"
        >
          <div className="flex items-center justify-between text-icon-default">
            <span className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
              {t("home.goalProgress")}
            </span>
            <div className="w-8 h-8 rounded-xl bg-brand/10 flex items-center justify-center text-brand group-hover:scale-110 transition-transform shadow-[inset_1px_1px_2px_rgba(255,255,255,0.9),inset_-1px_-1px_2px_rgba(234,88,12,0.15)]">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-foreground">
              {!isMounted || goalProgress === null ? "—" : `${goalProgress}%`}
            </h3>
            <div className="w-full bg-secondary/80 h-2.5 rounded-full overflow-hidden shadow-[inset_1.5px_1.5px_3px_rgba(148,163,184,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.8)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)]">
              <div
                className="bg-brand h-full rounded-full transition-all duration-500 shadow-[0_2px_6px_rgba(234,88,12,0.35),inset_1px_1px_2px_rgba(255,255,255,0.4)]"
                style={{ width: `${isMounted ? goalProgress ?? 0 : 0}%` }}
              ></div>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-foreground-muted pt-1 border-t border-border/50">
            <span className="font-semibold">Savings Vault</span>
            <span className="font-bold text-brand group-hover:translate-x-0.5 transition-transform">Goals →</span>
          </div>
        </Link>

        {/* Bento Tile 5: Health Index (Col-Span 1) */}
        <Link
          href="/health-score"
          className="col-span-1 bg-card border border-border p-6 rounded-3xl shadow-[8px_14px_28px_-4px_rgba(148,163,184,0.25),inset_2px_2px_4px_rgba(255,255,255,0.95),inset_-2.5px_-2.5px_5px_rgba(148,163,184,0.18)] dark:shadow-[0_16px_32px_-6px_rgba(0,0,0,0.55),inset_2px_2px_4px_rgba(255,255,255,0.08)] space-y-3 flex flex-col justify-between hover:-translate-y-1 hover:shadow-[12px_20px_36px_-6px_rgba(148,163,184,0.35)] dark:hover:shadow-[0_20px_40px_-6px_rgba(0,0,0,0.7)] transition-all duration-300 group"
        >
          <div className="flex items-center justify-between text-icon-default">
            <span className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
              {t("home.healthIndex")}
            </span>
            <div className="w-8 h-8 rounded-xl bg-success/10 flex items-center justify-center text-success group-hover:scale-110 transition-transform shadow-[inset_1px_1px_2px_rgba(255,255,255,0.9),inset_-1px_-1px_2px_rgba(5,150,105,0.15)]">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-foreground">
              {!isMounted || healthScore === null ? "—" : `${healthScore} / 100`}
            </h3>
            <p className="text-xs font-semibold text-foreground-muted">
              {healthScore === null ? t("home.addTransactionsToCompute") : t("home.basedOnSavingsRate")}
            </p>
          </div>
          <div className="flex items-center justify-between text-xs text-foreground-muted pt-1 border-t border-border/50">
            <span className="font-semibold">Savings Rate Score</span>
            <span className="font-bold text-success group-hover:translate-x-0.5 transition-transform">Report →</span>
          </div>
        </Link>

        {/* Bento Tile 6: Total Saved & Ledger (Col-Span 1) */}
        <Link
          href="/streaks"
          className="col-span-1 bg-card border border-border p-6 rounded-3xl shadow-[8px_14px_28px_-4px_rgba(148,163,184,0.25),inset_2px_2px_4px_rgba(255,255,255,0.95),inset_-2.5px_-2.5px_5px_rgba(148,163,184,0.18)] dark:shadow-[0_16px_32px_-6px_rgba(0,0,0,0.55),inset_2px_2px_4px_rgba(255,255,255,0.08)] space-y-3 flex flex-col justify-between hover:-translate-y-1 hover:shadow-[12px_20px_36px_-6px_rgba(148,163,184,0.35)] dark:hover:shadow-[0_20px_40px_-6px_rgba(0,0,0,0.7)] transition-all duration-300 group"
        >
          <div className="flex items-center justify-between text-icon-default">
            <span className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
              {t("home.totalSaved")}
            </span>
            <div className="w-8 h-8 rounded-xl bg-success/10 flex items-center justify-center text-success group-hover:scale-110 transition-transform shadow-[inset_1px_1px_2px_rgba(255,255,255,0.9),inset_-1px_-1px_2px_rgba(5,150,105,0.15)]">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-success">
              {!isMounted ? "—" : formatAmount(totalSaved, activeCurrency)}
            </h3>
            <p className="text-xs font-semibold text-foreground-muted">
              {totalSaved > 0 ? t("home.savedThroughDiscounts") : `${transactions.length} total entries`}
            </p>
          </div>
          <div className="flex items-center justify-between text-xs text-foreground-muted pt-1 border-t border-border/50">
            <span className="font-semibold">Discounts Captured</span>
            <span className="font-bold text-success group-hover:translate-x-0.5 transition-transform">Streaks →</span>
          </div>
        </Link>

        {/* Bento Tile 7: SMS Auto-Parser (Col-Span 4) */}
        <div className="col-span-1 md:col-span-2 lg:col-span-4">
          <SmsPasteZone currencyCode={activeCurrency} onTransactionSaved={() => {}} />
        </div>

        {/* Bento Tile 8: Balance Development Trend (Col-Span 2) */}
        {chartView !== "spent" && (
          <div className={`col-span-1 ${chartView === "both" ? "md:col-span-2 lg:col-span-2" : "md:col-span-2 lg:col-span-4"} bg-card border border-border p-6 rounded-3xl shadow-[8px_14px_28px_-4px_rgba(148,163,184,0.25),inset_2px_2px_4px_rgba(255,255,255,0.95),inset_-2.5px_-2.5px_5px_rgba(148,163,184,0.18)] dark:shadow-[0_16px_32px_-6px_rgba(0,0,0,0.55),inset_2px_2px_4px_rgba(255,255,255,0.08)] space-y-4 hover:-translate-y-1 transition-all duration-300`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-foreground text-lg">{t("home.balanceDevelopment")}</h3>
                <p className="text-xs font-semibold text-foreground-muted">{t("home.balanceTrajectory")}</p>
              </div>
              {/* Chart view filter */}
              <div className="inline-flex items-center gap-1 bg-secondary/80 p-1.5 rounded-2xl border border-border shadow-[inset_1.5px_1.5px_3px_rgba(148,163,184,0.25),inset_-1px_-1px_2px_rgba(255,255,255,0.9)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.5)]">
                {([
                  { key: "both", label: t("common.both") },
                  { key: "income", label: t("common.income") },
                  { key: "spent", label: t("common.spent") },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setChartView(opt.key)}
                    className={`text-xs font-bold px-3 py-1 rounded-xl transition-all cursor-pointer ${
                      chartView === opt.key
                        ? "bg-card text-foreground shadow-[2px_4px_8px_-1px_rgba(148,163,184,0.3),inset_1px_1px_2px_rgba(255,255,255,0.9)] dark:shadow-[0_4px_8px_-1px_rgba(0,0,0,0.5)]"
                        : "text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-72 w-full">
              {!isMounted ? (
                <div className="w-full h-full flex items-center justify-center bg-background-subtle rounded-2xl animate-pulse text-xs text-foreground-muted">
                  {t("home.loadingChartMetrics")}
                </div>
              ) : !hasData ? (
                <EmptyChart message={t("home.noBalanceHistory")} />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "16px",
                        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
                      }}
                      labelStyle={{ fontWeight: "bold", color: "#0f172a" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Balance"
                      stroke="#1d4ed8"
                      strokeWidth={3}
                      dot={{ r: 4, stroke: "#1d4ed8", strokeWidth: 2, fill: "#ffffff" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {/* Bento Tile 9: Outflow Categories (Col-Span 2) */}
        {chartView !== "income" && (
          <div className={`col-span-1 ${chartView === "both" ? "md:col-span-2 lg:col-span-2" : "md:col-span-2 lg:col-span-4"} bg-card border border-border p-6 rounded-3xl shadow-[8px_14px_28px_-4px_rgba(148,163,184,0.25),inset_2px_2px_4px_rgba(255,255,255,0.95),inset_-2.5px_-2.5px_5px_rgba(148,163,184,0.18)] dark:shadow-[0_16px_32px_-6px_rgba(0,0,0,0.55),inset_2px_2px_4px_rgba(255,255,255,0.08)] space-y-4 hover:-translate-y-1 transition-all duration-300`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-foreground text-lg">{t("home.outflowCategories")}</h3>
                <p className="text-xs font-semibold text-foreground-muted">{t("home.consolidatedMetrics")}</p>
              </div>
            </div>

            <div className="h-72 w-full">
              {!isMounted ? (
                <div className="w-full h-full flex items-center justify-center bg-background-subtle rounded-2xl animate-pulse text-xs text-foreground-muted">
                  {t("home.loadingChartMetrics")}
                </div>
              ) : categoryBarData.length === 0 ? (
                <EmptyChart message={t("home.noExpensesThisMonth")} />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryBarData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="category" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "16px",
                        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
                      }}
                      labelStyle={{ fontWeight: "bold", color: "#0f172a" }}
                    />
                    <Bar dataKey="Amount" fill="#ea580c" radius={[6, 6, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-background-subtle rounded-xl text-center px-6">
      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-icon-muted">
        <Inbox className="w-6 h-6" />
      </div>
      <p className="text-xs font-medium text-foreground-muted max-w-xs">{message}</p>
    </div>
  );
}
