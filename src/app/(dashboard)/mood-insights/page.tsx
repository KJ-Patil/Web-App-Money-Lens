"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Smile, Meh, Frown, BrainCircuit, TrendingUp, AlertTriangle, ArrowDownRight, ArrowUpRight } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from "recharts";
import { formatAmount } from "@/core/utils/currencyManager";
import { useTransactions } from "@/core/store/dataStore";

import { formatDate } from "@/core/utils/dateFormat";
const MOOD_COLORS: Record<string, string> = {
  Good: "#059669",     // text-success
  Okay: "#ea580c",     // text-warning
  Stressed: "#dc2626", // text-error
};

const MOOD_LOG_KEY = "mood_logs";

// YYYY-MM-DD key for a given date (used to store/look up the day's mood).
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MoodInsightsPage() {
  const [activeCurrency, setActiveCurrency] = useState("INR");
  const [currentMood, setCurrentMood] = useState<string | null>(null);
  const [moodLogs, setMoodLogs] = useState<Record<string, string>>({});
  const [isMounted, setIsMounted] = useState(false);
  const [viewMode, setViewMode] = useState<"expense" | "income">("expense");

  const transactions = useTransactions();

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      const cur = localStorage.getItem("active_currency");
      if (cur) setActiveCurrency(cur);

      try {
        const stored = JSON.parse(localStorage.getItem(MOOD_LOG_KEY) || "{}");
        setMoodLogs(stored);
        const today = stored[dayKey(new Date())];
        if (today) setCurrentMood(today);
      } catch {
        // Ignore malformed mood cache
      }
    }
  }, []);

  // Persist the mood the user logs for today so the correlation builds over time.
  const handleLogMood = (mood: string) => {
    setCurrentMood(mood);
    const updated = { ...moodLogs, [dayKey(new Date())]: mood };
    setMoodLogs(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(MOOD_LOG_KEY, JSON.stringify(updated));
    }
  };

  // Real 7-day spend/income per day, tagged with the mood logged for that day.
  const chartData = useMemo(() => {
    const days: { date: string; key: string; spend: number; income: number; mood: string }[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      days.push({
        date: formatDate(d, { weekday: "short" }),
        key: dayKey(d),
        spend: 0,
        income: 0,
        mood: moodLogs[dayKey(d)] || "Okay",
      });
    }
    const byKey = new Map(days.map((d) => [d.key, d]));
    for (const tx of transactions) {
      const k = dayKey(new Date(tx.date));
      const bucket = byKey.get(k);
      if (bucket) {
        if (tx.type === "expense") bucket.spend += tx.amount;
        if (tx.type === "income") bucket.income += tx.amount;
      }
    }
    return days;
  }, [transactions, moodLogs]);

  const hasData = transactions.some((t) => t.type === viewMode);

  // Calculate Variance Insights from real data (guarded against empty buckets).
  const stressedDays = chartData.filter((d) => d.mood === "Stressed");
  const goodDays = chartData.filter((d) => d.mood === "Good");
  
  const avgStressedSpend = stressedDays.length
    ? stressedDays.reduce((acc, c) => acc + c.spend, 0) / stressedDays.length : 0;
  const avgGoodSpend = goodDays.length
    ? goodDays.reduce((acc, c) => acc + c.spend, 0) / goodDays.length : 0;

  const avgStressedIncome = stressedDays.length
    ? stressedDays.reduce((acc, c) => acc + c.income, 0) / stressedDays.length : 0;
  const avgGoodIncome = goodDays.length
    ? goodDays.reduce((acc, c) => acc + c.income, 0) / goodDays.length : 0;

  const spendVariancePercent = avgGoodSpend > 0 ? ((avgStressedSpend - avgGoodSpend) / avgGoodSpend) * 100 : 0;
  const incomeVariancePercent = avgStressedIncome > 0 ? ((avgGoodIncome - avgStressedIncome) / avgStressedIncome) * 100 : 0;

  return (
    <div className="flex-1 flex flex-col p-6 space-y-8 md:p-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl flex items-center gap-2">
          <BrainCircuit className="w-8 h-8 text-brand" />
          Behavioral Insights
        </h1>
        <p className="text-sm font-medium text-foreground-muted">
          Map your emotional states to your spending and earning patterns to identify stress-induced habits.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Log Current Mood & Summary */}
        <div className="space-y-6">
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="font-extrabold text-foreground">Log Today's Mood</h3>
            
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => handleLogMood("Good")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                  currentMood === "Good" ? "border-success bg-success-light text-success scale-105" : "border-border bg-background hover:bg-secondary text-icon-muted"
                }`}
              >
                <Smile className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Good</span>
              </button>
              
              <button 
                onClick={() => handleLogMood("Okay")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                  currentMood === "Okay" ? "border-warning bg-warning-light text-warning scale-105" : "border-border bg-background hover:bg-secondary text-icon-muted"
                }`}
              >
                <Meh className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Okay</span>
              </button>
              
              <button 
                onClick={() => handleLogMood("Stressed")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                  currentMood === "Stressed" ? "border-error bg-error-light text-error scale-105" : "border-border bg-background hover:bg-secondary text-icon-muted"
                }`}
              >
                <Frown className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Stressed</span>
              </button>
            </div>
            {currentMood && (
              <p className="text-xs font-semibold text-foreground-secondary text-center pt-2">
                Mood recorded. Transactions today will be tagged as <span className="font-black text-foreground">{currentMood}</span>.
              </p>
            )}
          </div>

          {viewMode === "expense" ? (
            <div className="bg-error-light border border-error/20 p-6 rounded-2xl shadow-sm space-y-3">
              <h3 className="font-extrabold text-error flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Variance Alert
              </h3>
              <p className="text-sm font-semibold text-error/80 leading-relaxed">
                You tend to spend <span className="font-black text-error text-base">{Math.round(spendVariancePercent)}% more</span> on days you report feeling <strong>Stressed</strong> compared to Good days.
              </p>
              <div className="pt-2 flex justify-between items-end border-t border-error/20 mt-2">
                <div>
                  <span className="text-[10px] font-bold text-error/60 uppercase">Avg Stressed Spend</span>
                  <span className="block font-black text-error">{formatAmount(avgStressedSpend, activeCurrency)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-error/60 uppercase">Avg Good Spend</span>
                  <span className="block font-black text-error">{formatAmount(avgGoodSpend, activeCurrency)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-success-light border border-success/20 p-6 rounded-2xl shadow-sm space-y-3">
              <h3 className="font-extrabold text-success flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                The Hustle Alert
              </h3>
              <p className="text-sm font-semibold text-success/80 leading-relaxed">
                You tend to earn <span className="font-black text-success text-base">{Math.round(incomeVariancePercent)}% more</span> on days you report feeling <strong>Good</strong> compared to Stressed days.
              </p>
              <div className="pt-2 flex justify-between items-end border-t border-success/20 mt-2">
                <div>
                  <span className="text-[10px] font-bold text-success/60 uppercase">Avg Good Earn</span>
                  <span className="block font-black text-success">{formatAmount(avgGoodIncome, activeCurrency)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-success/60 uppercase">Avg Stressed Earn</span>
                  <span className="block font-black text-success">{formatAmount(avgStressedIncome, activeCurrency)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Chart */}
        <div className="lg:col-span-2 bg-card border border-border p-6 rounded-2xl shadow-sm space-y-6 flex flex-col min-h-[400px]">
          <div className="flex flex-col xl:flex-row justify-between items-start gap-4">
            <div className="space-y-3">
              <div className="space-y-1">
                <h3 className="font-extrabold text-foreground flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-brand" />
                  Mood vs. {viewMode === "expense" ? "Spending" : "Earning"} Trajectory
                </h3>
                <p className="text-xs text-foreground-muted">
                  7-day rolling view of your emotional finance correlation.
                </p>
              </div>
              
              <div className="flex gap-3 text-[10px] font-bold">
                {Object.entries(MOOD_COLORS).map(([mood, color]) => (
                  <div key={mood} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-foreground-secondary uppercase">{mood}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex bg-background-subtle border border-border rounded-lg p-1 shadow-inner shrink-0">
              <button
                onClick={() => setViewMode("expense")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-colors ${
                  viewMode === "expense" ? "bg-card text-error shadow-sm border border-border" : "text-icon-muted hover:text-foreground"
                }`}
              >
                <ArrowDownRight className="w-4 h-4" />
                Expenses
              </button>
              <button
                onClick={() => setViewMode("income")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-colors ${
                  viewMode === "income" ? "bg-card text-success shadow-sm border border-border" : "text-icon-muted hover:text-foreground"
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                Income
              </button>
            </div>
          </div>

          <div className="flex-1 w-full h-full min-h-[250px]">
            {isMounted && !hasData ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-background-subtle rounded-xl text-center px-6">
                <BrainCircuit className="w-8 h-8 text-icon-muted" />
                <p className="text-xs font-medium text-foreground-muted max-w-xs">
                  No {viewMode}s recorded yet. As you add transactions and log your daily mood, your correlation will appear here.
                </p>
              </div>
            ) : isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(val) => `${val/1000}k`}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-card border border-border rounded-xl shadow-lg p-3 space-y-1">
                            <span className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider block">
                              {data.date}
                            </span>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-sm font-black text-foreground">
                                {formatAmount(viewMode === "expense" ? data.spend : data.income, activeCurrency)}
                              </span>
                              <span 
                                className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md text-white"
                                style={{ backgroundColor: MOOD_COLORS[data.mood] }}
                              >
                                {data.mood}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey={viewMode === "expense" ? "spend" : "income"} radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={MOOD_COLORS[entry.mood]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
