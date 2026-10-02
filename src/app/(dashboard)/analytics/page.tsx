"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { formatAmount } from "@/core/utils/currencyManager";
import {
  useTransactions,
  getTotals,
  getMonthTotals,
  getCategoryBreakdown,
  getMonthlyTrend,
  getSavingsRate,
} from "@/core/store/dataStore";
import {
  PieChart as PieIcon,
  BarChart3,
  TrendingUp,
  Award,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
  Layers,
  Activity,
  Inbox,
} from "lucide-react";

import { formatDate } from "@/core/utils/dateFormat";
// ──────────────── THEME-ALIGNED COLOR PALETTE ────────────────
// Maps to CSS variables: --color-chart-1 through --color-chart-6
const CHART_COLORS = [
  "#1d4ed8", // chart-1 Blue
  "#ea580c", // chart-2 Orange
  "#059669", // chart-3 Emerald
  "#7c3aed", // chart-4 Purple
  "#dc2626", // chart-5 Red
  "#0891b2", // chart-6 Cyan
];

// Percentage change between two values (null when there's no prior baseline).
function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-background-subtle rounded-xl text-center px-6 py-10">
      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-icon-muted">
        <Inbox className="w-6 h-6" />
      </div>
      <p className="text-xs font-medium text-foreground-muted max-w-xs">{message}</p>
    </div>
  );
}

// ──────────────── CUSTOM TOOLTIP ────────────────
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  currency: string;
}

const CustomTooltip = ({
  active,
  payload,
  label,
  currency,
}: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg p-3 space-y-1.5">
      <span className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider">
        {label}
      </span>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs font-bold">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-foreground-secondary">{p.name}:</span>
          <span className="text-foreground">
            {formatAmount(p.value, currency)}
          </span>
        </div>
      ))}
    </div>
  );
};

// ──────────────── CUSTOM PIE TOOLTIP ────────────────
interface PieTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { percentage: number };
  }>;
  currency: string;
}

const PieTooltip = ({ active, payload, currency }: PieTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg p-3 space-y-0.5">
      <span className="text-xs font-black text-foreground block">
        {item.name}
      </span>
      <span className="text-sm font-black text-foreground">
        {formatAmount(item.value, currency)}
      </span>
      <span className="text-[10px] font-bold text-foreground-muted block">
        {item.payload.percentage}% of total
      </span>
    </div>
  );
};

export default function AnalyticsPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [activeCurrency, setActiveCurrency] = useState("INR");

  const transactions = useTransactions();

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      const cur = localStorage.getItem("active_currency");
      if (cur) setActiveCurrency(cur);
    }
  }, []);

  // ── All metrics below are derived live from the user's real ledger ──
  const totals = useMemo(() => getTotals(transactions), [transactions]);
  const thisMonth = useMemo(() => getMonthTotals(0, transactions), [transactions]);
  const lastMonth = useMemo(() => getMonthTotals(-1, transactions), [transactions]);

  // Lifetime expenditure allocation by category (pie + side ledger).
  const ALLOCATION_DATA = useMemo(
    () => getCategoryBreakdown("expense", null, transactions),
    [transactions]
  );
  const TOTAL_ALLOCATION = totals.expense;

  // This-month vs last-month spend for the top categories (grouped bars).
  const COMPARATIVE_DATA = useMemo(() => {
    const cur = getCategoryBreakdown("expense", 0, transactions);
    const prev = getCategoryBreakdown("expense", -1, transactions);
    const prevMap = new Map(prev.map((c) => [c.name, c.value]));
    const names = Array.from(new Set([...cur, ...prev].map((c) => c.name))).slice(0, 6);
    const curMap = new Map(cur.map((c) => [c.name, c.value]));
    return names.map((category) => ({
      category,
      "This Month": curMap.get(category) || 0,
      "Last Month": prevMap.get(category) || 0,
    }));
  }, [transactions]);

  // Top 5 cost centers, ranked relative to the largest category.
  const RANKING_DATA = useMemo(() => {
    const top = ALLOCATION_DATA.slice(0, 5);
    const max = top[0]?.value || 0;
    return top.map((item, i) => ({
      category: item.name,
      spent: item.value,
      ratio: max > 0 ? Math.round((item.value / max) * 1000) / 10 : 0,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [ALLOCATION_DATA]);

  // Income vs expense across the last 6 months.
  const MONTHLY_TREND_DATA = useMemo(
    () => getMonthlyTrend(6, transactions),
    [transactions]
  );

  // KPI headline values (lifetime) with month-over-month change badges.
  const savingsRate = getSavingsRate(transactions);
  const lastSavingsRate = lastMonth.income > 0
    ? Math.round(((lastMonth.income - lastMonth.expense) / lastMonth.income) * 1000) / 10
    : 0;
  const KPI_CARDS = [
    {
      label: "Total Income",
      value: totals.income,
      displayValue: undefined as string | undefined,
      change: pctChange(thisMonth.income, lastMonth.income),
      icon: ArrowUpRight,
      accentClass: "text-success",
      bgClass: "bg-success-light",
      borderClass: "border-success/15",
    },
    {
      label: "Total Expense",
      value: totals.expense,
      displayValue: undefined as string | undefined,
      change: pctChange(thisMonth.expense, lastMonth.expense),
      icon: ArrowDownRight,
      accentClass: "text-error",
      bgClass: "bg-error-light",
      borderClass: "border-error/15",
    },
    {
      label: "Net Savings",
      value: totals.balance,
      displayValue: undefined as string | undefined,
      change: pctChange(
        thisMonth.income - thisMonth.expense,
        lastMonth.income - lastMonth.expense
      ),
      icon: DollarSign,
      accentClass: "text-primary",
      bgClass: "bg-primary-lighter",
      borderClass: "border-primary/15",
    },
    {
      label: "Savings Rate",
      value: null as number | null,
      displayValue: `${savingsRate}%`,
      change: lastSavingsRate > 0
        ? Math.round((savingsRate - lastSavingsRate) * 10) / 10
        : null,
      icon: Activity,
      accentClass: "text-brand",
      bgClass: "bg-brand-light",
      borderClass: "border-brand/15",
    },
  ];

  const hasData = transactions.length > 0;

  // Determine current/last month labels
  const currentMonth = formatDate(new Date(), { month: "long" });

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 md:p-8 max-w-6xl mx-auto w-full">
      {/* ────────────────── HEADER ────────────────── */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl">
            Analytical Dashboard
          </h1>
          <p className="text-sm font-medium text-foreground-muted">
            Compare structural capital outlays and performance margins.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider flex items-center gap-1.5 bg-secondary px-3 py-1.5 rounded-lg border border-border">
            <CalendarDays className="w-3.5 h-3.5 text-icon-muted" />
            {currentMonth} Report
          </span>
        </div>
      </div>

      {/* ────────────────── KPI SUMMARY CARDS ────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map((kpi) => {
          const Icon = kpi.icon;
          const isUp = (kpi.change ?? 0) >= 0;
          const changeLabel =
            kpi.change === null
              ? "—"
              : `${kpi.change > 0 ? "+" : ""}${kpi.change}%`;
          return (
            <div
              key={kpi.label}
              className="bg-card border border-border p-5 rounded-2xl shadow-sm space-y-3 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider">
                  {kpi.label}
                </span>
                <div
                  className={`w-8 h-8 rounded-xl ${kpi.bgClass} ${kpi.accentClass} border ${kpi.borderClass} flex items-center justify-center group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-4 h-4 stroke-[2.5px]" />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black tracking-tight text-foreground">
                  {kpi.displayValue
                    ? kpi.displayValue
                    : formatAmount(kpi.value!, activeCurrency)}
                </h3>
                <div className="flex items-center gap-1">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      kpi.change === null
                        ? "bg-secondary text-foreground-muted"
                        : isUp
                          ? "bg-success-light text-success"
                          : "bg-error-light text-error"
                    }`}
                  >
                    {changeLabel}
                  </span>
                  <span className="text-[9px] font-semibold text-foreground-muted">
                    vs last month
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* ────────────────── INCOME VS EXPENSE TREND ────────────────── */}
      <section className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="space-y-1">
            <h3 className="font-extrabold text-foreground text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-success" />
              Cash Flow Overview
            </h3>
            <p className="text-xs text-foreground-muted">
              Monthly income vs expense trend across the last 6 months
            </p>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-bold">
            <div className="flex items-center gap-1.5">
              <span
                className="w-3 h-1.5 rounded-full"
                style={{ backgroundColor: CHART_COLORS[2] }}
              />
              <span className="text-foreground-secondary">Income</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-3 h-1.5 rounded-full"
                style={{ backgroundColor: CHART_COLORS[4] }}
              />
              <span className="text-foreground-secondary">Expense</span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full">
          {!isMounted ? (
            <div className="w-full h-full flex items-center justify-center bg-background-subtle rounded-xl animate-pulse text-xs text-foreground-muted">
              Loading chart metrics...
            </div>
          ) : !hasData ? (
            <EmptyState message="No cash-flow history yet — add income and expenses to see your monthly trend." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={MONTHLY_TREND_DATA}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="incomeGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={CHART_COLORS[2]}
                      stopOpacity={0.25}
                    />
                    <stop
                      offset="95%"
                      stopColor={CHART_COLORS[2]}
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient
                    id="expenseGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={CHART_COLORS[4]}
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="95%"
                      stopColor={CHART_COLORS[4]}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) =>
                    `${(v / 1000).toFixed(0)}k`
                  }
                />
                <Tooltip
                  content={
                    <CustomTooltip currency={activeCurrency} />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="Income"
                  stroke={CHART_COLORS[2]}
                  strokeWidth={2.5}
                  fill="url(#incomeGradient)"
                  dot={{
                    r: 4,
                    stroke: CHART_COLORS[2],
                    strokeWidth: 2,
                    fill: "#ffffff",
                  }}
                  activeDot={{ r: 6 }}
                />
                <Area
                  type="monotone"
                  dataKey="Expense"
                  stroke={CHART_COLORS[4]}
                  strokeWidth={2.5}
                  fill="url(#expenseGradient)"
                  dot={{
                    r: 4,
                    stroke: CHART_COLORS[4],
                    strokeWidth: 2,
                    fill: "#ffffff",
                  }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* ────────────────── TWO-COLUMN: ALLOCATION + COMPARATIVE ────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Allocation Module (Pie Chart with side ledger) */}
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-5 flex flex-col">
          <div className="space-y-1">
            <h3 className="font-extrabold text-foreground text-base flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-primary" />
              Capital Allocation
            </h3>
            <p className="text-xs text-foreground-muted">
              Expenditure distribution by category
            </p>
          </div>

          <div className="flex-1 flex flex-col sm:flex-row items-center gap-6 py-2">
            {/* Pie Chart Node */}
            <div className="h-56 w-56 shrink-0 relative flex items-center justify-center">
              {!isMounted ? (
                <div className="w-full h-full rounded-full border border-dashed border-border animate-pulse" />
              ) : ALLOCATION_DATA.length === 0 ? (
                <div className="w-44 h-44 rounded-full border border-dashed border-border flex items-center justify-center text-center px-4">
                  <span className="text-[11px] font-medium text-foreground-muted">No expenses recorded yet</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ALLOCATION_DATA}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={82}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {ALLOCATION_DATA.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={
                        <PieTooltip currency={activeCurrency} />
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="absolute text-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-foreground-muted block">
                  Total Spent
                </span>
                <span className="text-lg font-black text-foreground">
                  {formatAmount(TOTAL_ALLOCATION, activeCurrency)}
                </span>
              </div>
            </div>

            {/* Color Dot Data Ledger */}
            <div className="flex-1 w-full space-y-2.5">
              {ALLOCATION_DATA.map((item, index) => (
                <div
                  key={item.name}
                  className="flex justify-between items-center text-xs font-semibold group hover:bg-secondary/30 px-2 py-1.5 rounded-lg transition-colors -mx-2"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-sm shrink-0 group-hover:scale-125 transition-transform"
                      style={{
                        backgroundColor:
                          CHART_COLORS[index % CHART_COLORS.length],
                      }}
                    />
                    <span className="text-foreground-secondary">
                      {item.name}
                    </span>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <span className="text-foreground font-bold">
                      {formatAmount(item.value, activeCurrency)}
                    </span>
                    <span className="text-foreground-muted text-[10px] font-bold w-10 text-right">
                      {item.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Comparative Monitoring (Grouped Bar Chart) */}
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-5 flex flex-col">
          <div className="space-y-1">
            <h3 className="font-extrabold text-foreground text-base flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-brand" />
              Comparative Metrics
            </h3>
            <p className="text-xs text-foreground-muted">
              Current month spending vs previous month baseline
            </p>
          </div>

          <div className="h-64 w-full flex-1">
            {!isMounted ? (
              <div className="w-full h-full flex items-center justify-center bg-background-subtle rounded-xl animate-pulse text-xs text-foreground-muted">
                Loading chart metrics...
              </div>
            ) : COMPARATIVE_DATA.length === 0 ? (
              <EmptyState message="No spending yet to compare across months." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={COMPARATIVE_DATA}
                  margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="category"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) =>
                      `${(v / 1000).toFixed(0)}k`
                    }
                  />
                  <Tooltip
                    content={
                      <CustomTooltip currency={activeCurrency} />
                    }
                  />
                  <Legend
                    iconSize={10}
                    iconType="square"
                    wrapperStyle={{ fontSize: 11, fontWeight: "bold" }}
                  />
                  <Bar
                    dataKey="This Month"
                    fill={CHART_COLORS[0]}
                    radius={[4, 4, 0, 0]}
                    barSize={18}
                  />
                  <Bar
                    dataKey="Last Month"
                    fill={CHART_COLORS[1]}
                    radius={[4, 4, 0, 0]}
                    barSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* ────────────────── TOP CATEGORY RANKERS ────────────────── */}
      <section className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="space-y-1">
            <h3 className="font-extrabold text-foreground text-base flex items-center gap-2">
              <Award className="w-5 h-5 text-chart-4" />
              Top Outflow Rankers
            </h3>
            <p className="text-xs text-foreground-muted">
              Top 5 cost centers sorted by density percentage
            </p>
          </div>
          <span className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider bg-secondary px-3 py-1.5 rounded-lg border border-border">
            <Layers className="w-3 h-3 inline mr-1 text-icon-muted" />
            {RANKING_DATA.length} categories tracked
          </span>
        </div>

        {/* Sorted ranking column tracking top 5 categories */}
        <div className="space-y-5">
          {RANKING_DATA.length === 0 && (
            <p className="text-xs font-medium text-foreground-muted py-6 text-center">
              No expense categories to rank yet — add some transactions to populate this list.
            </p>
          )}
          {RANKING_DATA.map((item, index) => (
            <div key={item.category} className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <div className="flex items-center gap-3">
                  <span
                    className="w-7 h-7 rounded-lg text-[11px] font-black flex items-center justify-center border"
                    style={{
                      backgroundColor: `${item.color}15`,
                      borderColor: `${item.color}30`,
                      color: item.color,
                    }}
                  >
                    {index + 1}
                  </span>
                  <span className="text-foreground font-bold text-sm">
                    {item.category}
                  </span>
                </div>
                <div className="text-right flex items-center gap-3">
                  <span className="text-foreground font-black">
                    {formatAmount(item.spent, activeCurrency)}
                  </span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                    style={{
                      backgroundColor: `${item.color}15`,
                      color: item.color,
                    }}
                  >
                    {item.ratio}%
                  </span>
                </div>
              </div>

              {/* Progress visualizer */}
              <div className="w-full bg-secondary h-3 rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden"
                  style={{
                    width: isMounted ? `${item.ratio}%` : "0%",
                    backgroundColor: item.color,
                  }}
                >
                  {/* Subtle shimmer animation overlay */}
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
