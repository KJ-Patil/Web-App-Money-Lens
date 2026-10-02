"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Repeat,
  CalendarClock,
  AlertTriangle,
  TrendingDown,
  Layers,
  Inbox,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { formatAmount } from "@/core/utils/currencyManager";
import {
  useTransactions,
  useManualSubscriptions,
  addManualSubscription,
  deleteManualSubscription,
} from "@/core/store/dataStore";
import {
  detectSubscriptions,
  summarizeSubscriptions,
  type DetectedSubscription,
} from "@/core/insights/subscriptions";

import { formatDate } from "@/core/utils/dateFormat";
/** A row in the tracker: either auto-detected or user-added (`manual`). */
type SubscriptionRow = DetectedSubscription & { manual?: boolean };

const SUB_CATEGORIES = [
  "Entertainment",
  "Software",
  "Utilities",
  "Health & Fitness",
  "Education",
  "Other",
];

export default function SubscriptionsPage() {
  const [activeCurrency, setActiveCurrency] = useState("INR");
  const [showAddModal, setShowAddModal] = useState(false);
  const transactions = useTransactions();
  const manualSubs = useManualSubscriptions();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cur = localStorage.getItem("active_currency");
    if (cur) setActiveCurrency(cur);
  }, []);

  const detected = useMemo(
    () => detectSubscriptions(transactions),
    [transactions]
  );

  // Merge user-added subscriptions with auto-detected ones, manual first,
  // then sorted together by annual cost so the headline figures add up.
  const subscriptions = useMemo<SubscriptionRow[]>(() => {
    const manualRows: SubscriptionRow[] = manualSubs.map((m) => {
      const next = new Date();
      next.setMonth(next.getMonth() + 1);
      return {
        id: m.id,
        name: m.name,
        category: m.category,
        monthlyAmount: m.monthlyAmount,
        annualCost: m.monthlyAmount * 12,
        occurrences: 0,
        lastChargedISO: m.createdAt,
        nextEstimatedISO: next.toISOString(),
        possiblyUnused: false,
        manual: true,
      };
    });
    return [...manualRows, ...detected].sort((a, b) => b.annualCost - a.annualCost);
  }, [manualSubs, detected]);

  const summary = useMemo(
    () => summarizeSubscriptions(subscriptions),
    [subscriptions]
  );

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 md:p-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl flex items-center gap-2">
            <Repeat className="w-8 h-8 text-brand" />
            Subscription Tracker
          </h1>
          <p className="text-sm font-medium text-foreground-muted">
            Recurring payments auto-detected from your transactions — spot what&apos;s
            draining your wallet.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary shrink-0 inline-flex items-center gap-2 px-4"
          title="Add a subscription manually"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add</span>
        </button>
      </div>

      {/* ── Summary KPIs ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={Layers}
          tone="primary"
          label="Detected"
          value={`${summary.count}`}
          hint={summary.count === 1 ? "subscription" : "subscriptions"}
        />
        <SummaryCard
          icon={CalendarClock}
          tone="brand"
          label="Monthly Cost"
          value={formatAmount(summary.monthlyTotal, activeCurrency, { decimalPlaces: 0 })}
          hint="per month"
        />
        <SummaryCard
          icon={TrendingDown}
          tone="error"
          label="Annual Cost"
          value={formatAmount(summary.annualTotal, activeCurrency, { decimalPlaces: 0 })}
          hint="per year"
        />
        <SummaryCard
          icon={AlertTriangle}
          tone="warning"
          label="Possibly Unused"
          value={`${summary.unusedCount}`}
          hint="review these"
        />
      </section>

      {/* ── Subscription list ── */}
      {subscriptions.length === 0 ? (
        <section className="bg-card border border-border rounded-2xl shadow-sm p-12 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-icon-muted">
            <Inbox className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-foreground-muted max-w-md">
            No recurring payments detected yet. Once the same merchant is charged
            across two or more months, it will show up here automatically.
          </p>
        </section>
      ) : (
        <section className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden divide-y divide-border">
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center gap-4 p-4 sm:p-5 hover:bg-background-subtle transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-primary-lighter text-primary flex items-center justify-center shrink-0">
                <Repeat className="w-5 h-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-sm text-foreground capitalize truncate">
                    {sub.name}
                  </h3>
                  {sub.manual && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary-lighter px-2 py-0.5 rounded-full">
                      Manual
                    </span>
                  )}
                  {sub.possiblyUnused && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-warning bg-warning-light px-2 py-0.5 rounded-full">
                      Possibly unused
                    </span>
                  )}
                </div>
                <p className="text-xs text-foreground-muted mt-0.5">
                  {sub.category}
                  {sub.manual ? "" : ` · ${sub.occurrences} charges`} · next ~
                  {formatDate(sub.nextEstimatedISO, {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>

              <div className="text-right shrink-0">
                <p className="font-extrabold text-sm text-foreground">
                  {formatAmount(sub.monthlyAmount, activeCurrency, { decimalPlaces: 0 })}
                  <span className="text-[10px] font-semibold text-foreground-muted">/mo</span>
                </p>
                <p className="text-[11px] font-semibold text-foreground-muted">
                  {formatAmount(sub.annualCost, activeCurrency, { decimalPlaces: 0 })}/yr
                </p>
              </div>

              {sub.manual && (
                <button
                  onClick={() => deleteManualSubscription(sub.id)}
                  className="p-2 text-icon-default hover:text-error hover:bg-error-light rounded-xl transition-all cursor-pointer shrink-0"
                  title="Remove subscription"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {showAddModal && (
        <AddSubscriptionModal
          activeCurrency={activeCurrency}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

function AddSubscriptionModal({
  activeCurrency,
  onClose,
}: {
  activeCurrency: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(SUB_CATEGORIES[0]);
  const [amount, setAmount] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const monthlyAmount = parseFloat(amount);
    if (!name.trim() || isNaN(monthlyAmount) || monthlyAmount <= 0) return;
    addManualSubscription({ name: name.trim(), category, monthlyAmount });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center p-0 md:p-4 animate-in fade-in duration-200">
      <div
        className="w-full bg-card border-t md:border border-border rounded-t-3xl md:rounded-2xl max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom md:zoom-in-95 duration-300 flex flex-col"
        role="dialog"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex justify-between items-center bg-background-subtle">
          <div>
            <h3 className="text-lg font-black text-foreground">Add Subscription</h3>
            <p className="text-xs font-semibold text-foreground-muted">
              Track a recurring payment manually.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-icon-muted hover:text-icon-active p-1.5 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div className="space-y-1">
            <label htmlFor="sub-name" className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
              Subscription Name
            </label>
            <input
              id="sub-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-base w-full"
              placeholder="e.g. Netflix, Spotify, Gym"
              required
              autoFocus
            />
          </div>

          {/* Monthly amount */}
          <div className="space-y-1">
            <label htmlFor="sub-amount" className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
              Monthly Cost
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 font-bold text-foreground-secondary text-lg">
                ₹
              </span>
              <input
                id="sub-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-base pl-9 w-full text-lg font-extrabold tracking-tight"
                placeholder="0.00"
                min="0.01"
                step="0.01"
                required
              />
            </div>
            {parseFloat(amount) > 0 && (
              <p className="text-[11px] font-semibold text-foreground-muted pt-0.5">
                {formatAmount(parseFloat(amount) * 12, activeCurrency, { decimalPlaces: 0 })} per year
              </p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-1">
            <label htmlFor="sub-category" className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
              Category
            </label>
            <select
              id="sub-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-base w-full cursor-pointer"
            >
              {SUB_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1">
              Add Subscription
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "brand" | "error" | "warning";
  label: string;
  value: string;
  hint: string;
}) {
  const toneClasses = {
    primary: "bg-primary-lighter text-primary",
    brand: "bg-brand-light text-brand",
    error: "bg-error-light text-error",
    warning: "bg-warning-light text-warning",
  }[tone];

  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
          {label}
        </span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${toneClasses}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <p className="text-xl font-black text-foreground tracking-tight truncate">{value}</p>
        <p className="text-[11px] font-semibold text-foreground-muted">{hint}</p>
      </div>
    </div>
  );
}
