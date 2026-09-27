"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Settings, LogOut, Plus, Globe, List, BookOpen, BarChart3, Download, CreditCard, Mic, Users, Activity, SlidersHorizontal, Receipt, BrainCircuit, GraduationCap, Target, PiggyBank, Sparkles, Flame, Repeat, ArrowLeftRight, CalendarDays, PieChart } from "lucide-react";
import { useLazyCatchUpSync } from "@/core/store/CatchUpSync";
import { clearLocalCache, flushPendingWrites, hasUnsyncedWrites, isUnlocked, lockDataStore, tryAutoUnlock } from "@/core/store/dataStore";
import { auth } from "@/config/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import AddTransactionModal from "@/components/modals/AddTransactionModal";
import CurrencyPickerSheet from "@/components/modals/CurrencyPickerSheet";
import VoiceLoggingModal from "@/components/voice/VoiceLoggingModal";
import GlobalFloatingCalculator from "@/components/inputs/GlobalFloatingCalculator";
import { refreshExchangeRates } from "@/core/utils/currencyManager";
import { useTranslation } from "@/i18n/i18nContext";

interface NavigationItem {
  nameKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavigationItem[] = [
  { nameKey: "nav.workspace", href: "/home", icon: Home },
  { nameKey: "nav.transactions", href: "/transactions", icon: List },
  { nameKey: "nav.notebooks", href: "/ledger", icon: BookOpen },
  { nameKey: "nav.calendar", href: "/calendar", icon: CalendarDays },
  { nameKey: "nav.budgets", href: "/budgets", icon: Target },
  { nameKey: "nav.savingsGoals", href: "/savings", icon: PiggyBank },
  { nameKey: "nav.billSplitter", href: "/bill-splitter", icon: Receipt },
  { nameKey: "nav.familyWallet", href: "/family-wallet", icon: Users },
  { nameKey: "nav.moodInsights", href: "/mood-insights", icon: BrainCircuit },
  { nameKey: "nav.healthScore", href: "/health-score", icon: Activity },
  { nameKey: "nav.cibilSim", href: "/cibil-simulator", icon: SlidersHorizontal },
  { nameKey: "nav.academy", href: "/academy", icon: GraduationCap },
  { nameKey: "nav.analytics", href: "/analytics", icon: BarChart3 },
  { nameKey: "nav.compareMonths", href: "/comparison", icon: ArrowLeftRight },
  { nameKey: "nav.subscriptions", href: "/subscriptions", icon: Repeat },
  { nameKey: "nav.whatIfSim", href: "/what-if", icon: Sparkles },
  { nameKey: "nav.streaks", href: "/streaks", icon: Flame },
  { nameKey: "nav.emiTracker", href: "/emi-tracker", icon: CreditCard },
  { nameKey: "nav.export", href: "/export", icon: Download },
  { nameKey: "nav.settings", href: "/settings", icon: Settings },
];

/**
 * Local-only caches written by an older build that seeded fabricated values.
 * Nothing here is synced or user-entered — see the cleanup effect below.
 */
const LEGACY_SEED_KEYS = [
  "total_income",
  "total_savings",
  "financial_health_score",
  "weekly_insights",
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();

  // ─── Auth guard ───────────────────────────────────────────────────────────
  // The dashboard must only render for a genuinely signed-in Firebase user.
  // We trust Firebase's own session (onAuthStateChanged), NOT a localStorage
  // flag — a localStorage value can be forged in devtools, a real session can't.
  // `authChecked` stays false until Firebase resolves the restored session, so
  // we show a spinner instead of flashing the app or a wrong redirect.
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Being signed in isn't enough: the encrypted data must also be UNLOCKED.
        // A refresh wipes the in-memory key, so try to restore it from the
        // session-cached PIN. If that fails (fresh browser session, or the user
        // never unlocked), send them to the lock screen instead of rendering the
        // dashboard with empty/undecryptable data.
        if (!isUnlocked()) {
          const unlocked = await tryAutoUnlock();
          if (!unlocked) {
            router.replace("/pin-lock");
            return;
          }
        }
        setIsAuthed(true);
      } else {
        setIsAuthed(false);
        router.replace("/login");
      }
      setAuthChecked(true);
    });
    return unsub;
  }, [router]);

  // One-time removal of legacy seeded/demo values (the old fabricated balances
  // and derived caches from an earlier build).
  //
  // This must NOT go through clearFinancialData(): that writes empty defaults
  // through the data store, which mirrors them to Firestore. The "already ran"
  // flag lives in localStorage, so it is absent on every browser the app has not
  // run in before — meaning the purge fired on new devices, where there is no
  // legacy data to clean and the cloud holds the user's only copy. It wiped that
  // copy. The keys below are local-only derived caches, so removing them
  // directly does the intended job with no cloud write at all.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const CLEARED_FLAG = "legacy_seed_cleared_v1";
    if (localStorage.getItem(CLEARED_FLAG)) return;
    LEGACY_SEED_KEYS.forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(CLEARED_FLAG, "true");
  }, []);

  // Trigger client-side Lazy CatchUp synchronization task
  useLazyCatchUpSync();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isCurrencySheetOpen, setIsCurrencySheetOpen] = useState(false);
  const [activeCurrency, setActiveCurrency] = useState("INR");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cur = localStorage.getItem("active_currency");
      if (cur) {
        setActiveCurrency(cur);
      }
      // Keep live FX rates fresh so currency display converts, not just relabels.
      refreshExchangeRates();

      const handleOpenAddTx = () => setIsModalOpen(true);
      const handleOpenVoice = () => setIsVoiceOpen(true);

      window.addEventListener("app:open-add-transaction", handleOpenAddTx);
      window.addEventListener("app:open-voice", handleOpenVoice);

      return () => {
        window.removeEventListener("app:open-add-transaction", handleOpenAddTx);
        window.removeEventListener("app:open-voice", handleOpenVoice);
      };
    }
  }, []);

  // Hook up Page Visibility API for security lock (60 seconds idle limit)
  useEffect(() => {
    let backgroundTime: number | null = null;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "hidden") {
        backgroundTime = Date.now();
      } else if (document.visibilityState === "visible" && backgroundTime !== null) {
        const elapsed = Date.now() - backgroundTime;
        // Check if user has been away from tab/workspace for >60 seconds
        if (elapsed > 60000) {
          const storedHash = localStorage.getItem("pin_hash");
          if (storedHash) {
            backgroundTime = null;
            // Actually lock, don't just navigate. Routing to /pin-lock alone
            // left the encryption key and the fully decrypted cache sitting in
            // memory, so the "lock" protected nothing beyond the view.
            //
            // Flush first: lockDataStore() drops the pending-write bookkeeping,
            // and an auto-lock must not silently turn an unsynced change into
            // one the user is never warned about. On-disk data stays encrypted
            // and is re-read when they unlock, so nothing is lost either way.
            await flushPendingWrites();
            lockDataStore();
            router.push("/pin-lock");
            return;
          }
        }
        backgroundTime = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router]);

  const handleLogout = async () => {
    // Logout wipes the local cache trusting the cloud has everything. So FIRST
    // make sure every change is actually saved to the cloud — otherwise a
    // transaction that never synced would be lost for good. Try to flush pending
    // writes; if some still can't be saved (e.g. offline), warn before wiping.
    const allSaved = await flushPendingWrites();
    if (!allSaved && hasUnsyncedWrites()) {
      const proceed = window.confirm(
        "Some changes haven't been saved to the cloud yet (you may be offline). " +
          "If you log out now they will be lost. Log out anyway?"
      );
      if (!proceed) return; // stay signed in so the user can retry / reconnect
    }

    // End the REAL Firebase session (not just a localStorage key), then purge
    // the local cache so leftover financial data can't be read by the next
    // person on a shared device. The cloud copy is preserved and re-synced on
    // the user's next login.
    try {
      await signOut(auth);
    } catch {
      /* even if signOut fails (offline), still clear locally and leave */
    }
    clearLocalCache();
    router.replace("/login");
  };

  const handleCurrencySelect = (code: string) => {
    setActiveCurrency(code);
    // Reload active route to re-format values
    window.location.reload();
  };

  // Until Firebase confirms the session, show a spinner rather than flashing the
  // dashboard. If the user isn't authenticated, render nothing while the
  // redirect to /login (fired in the effect above) takes effect.
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-subtle">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isAuthed) return null;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background clay-mesh-bg">
      {/* ────────────────── DESKTOP SIDEBAR ────────────────── */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-card/95 backdrop-blur-sm border-r border-border shadow-[6px_0_24px_-6px_rgba(148,163,184,0.2)] dark:shadow-[6px_0_24px_-6px_rgba(0,0,0,0.6)] z-20">
        {/* Brand Header */}
        <div className="flex items-center px-6 pt-8 pb-4 border-b border-border/80">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center shadow-[0_6px_12px_-2px_rgba(29,78,216,0.4),inset_1.5px_1.5px_2.5px_rgba(255,255,255,0.5),inset_-1.5px_-1.5px_2.5px_rgba(0,0,0,0.25)]">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <span className="ml-3 font-black text-xl text-foreground tracking-tight">
            {t('common.appName')}
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.nameKey}
                href={item.href}
                className={`flex items-center px-4 py-3 text-sm font-semibold rounded-2xl transition-all duration-200 ${
                  isActive
                    ? "bg-primary text-white shadow-[0_8px_16px_-3px_rgba(29,78,216,0.45),inset_2px_2px_3px_rgba(255,255,255,0.4),inset_-2px_-2px_3px_rgba(15,23,42,0.3)] font-bold scale-[1.02]"
                    : "text-foreground-secondary hover:bg-secondary/70 hover:text-foreground hover:translate-x-1"
                }`}
              >
                <Icon className={`mr-3 h-5 w-5 shrink-0 ${isActive ? "text-white" : ""}`} />
                {t(item.nameKey)}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Footer Actions */}
        <div className="p-4 border-t border-border/80 space-y-2.5">
          {/* Currency Trigger Option */}
          <button
            onClick={() => setIsCurrencySheetOpen(true)}
            className="w-full flex items-center px-4 py-2.5 text-sm font-semibold text-foreground-secondary bg-secondary/60 hover:bg-secondary rounded-xl transition-all shadow-[inset_1.5px_1.5px_3px_rgba(255,255,255,0.9),inset_-1.5px_-1.5px_3px_rgba(148,163,184,0.2)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(255,255,255,0.06),inset_-1.5px_-1.5px_3px_rgba(0,0,0,0.5)] cursor-pointer"
          >
            <Globe className="mr-3 h-5 w-5 shrink-0 text-icon-default" />
            {t('common.currency')}: <span className="ml-1 text-primary font-bold">{activeCurrency}</span>
          </button>

          {/* Central Add Transaction Trigger on Desktop */}
          <div className="flex gap-2 w-full">
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              {t('common.add')}
            </button>
            <button
              onClick={() => setIsVoiceOpen(true)}
              className="btn-secondary px-3 flex items-center justify-center shrink-0 border-primary/30 text-primary hover:bg-primary-lighter/80"
              aria-label="Voice Logging"
            >
              <Mic className="w-5 h-5" />
            </button>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive-light/60 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="mr-3 h-5 w-5 shrink-0" />
            {t('common.signOut')}
          </button>
        </div>
      </aside>

      {/* ────────────────── MOBILE MAIN NAVIGATION TRAY (Claymorphic Floating Dock) ────────────────── */}
      <nav className="fixed bottom-3 left-3 right-3 md:hidden bg-card/95 backdrop-blur-md border border-white/70 dark:border-white/10 rounded-3xl shadow-[0_12px_28px_-4px_rgba(148,163,184,0.35),inset_1.5px_1.5px_3px_rgba(255,255,255,0.95)] dark:shadow-[0_12px_28px_-4px_rgba(0,0,0,0.7),inset_1.5px_1.5px_3px_rgba(255,255,255,0.08)] z-30 h-16 flex items-center justify-around px-2">
        <Link
          href="/home"
          className={`flex flex-col items-center justify-center flex-1 h-full text-xs font-bold transition-all ${
            pathname === "/home" ? "text-primary scale-105" : "text-foreground-muted hover:text-foreground"
          }`}
        >
          <Home className="h-5 w-5 mb-0.5" />
          {t('nav.workspace')}
        </Link>

        <Link
          href="/transactions"
          className={`flex flex-col items-center justify-center flex-1 h-full text-[10px] font-bold transition-all ${
            pathname === "/transactions" ? "text-primary scale-105" : "text-foreground-muted hover:text-foreground"
          }`}
        >
          <List className="h-5 w-5 mb-0.5" />
          {t('nav.transactions')}
        </Link>

        <Link
          href="/ledger"
          className={`flex flex-col items-center justify-center flex-1 h-full text-[10px] font-bold transition-all ${
            pathname === "/ledger" ? "text-primary scale-105" : "text-foreground-muted hover:text-foreground"
          }`}
        >
          <BookOpen className="h-5 w-5 mb-0.5" />
          {t('nav.notebooks')}
        </Link>

        {/* Central Prominent Mobile Floating Action Button (FAB) */}
        <div className="relative -top-5 flex items-center justify-center gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-13 h-13 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-[0_8px_20px_-2px_rgba(234,88,12,0.5),inset_2px_2px_3px_rgba(255,255,255,0.5),inset_-2px_-2px_4px_rgba(0,0,0,0.25)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all focus:outline-none border-2 border-white dark:border-slate-800 cursor-pointer"
            aria-label="Add Transaction"
          >
            <Plus className="w-6 h-6" />
          </button>
          <button
            onClick={() => setIsVoiceOpen(true)}
            className="absolute -right-11 bottom-0.5 w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-[0_6px_14px_-2px_rgba(37,99,235,0.4),inset_1.5px_1.5px_2px_rgba(255,255,255,0.5),inset_-1.5px_-1.5px_3px_rgba(0,0,0,0.25)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all focus:outline-none border-2 border-white dark:border-slate-800 cursor-pointer"
            aria-label="Voice Logging"
          >
            <Mic className="w-4 h-4" />
          </button>
        </div>

        <Link
          href="/analytics"
          className={`flex flex-col items-center justify-center flex-1 h-full text-[10px] font-bold transition-all ${
            pathname === "/analytics" ? "text-primary scale-105" : "text-foreground-muted hover:text-foreground"
          }`}
        >
          <BarChart3 className="h-5 w-5 mb-0.5" />
          {t('nav.analytics')}
        </Link>

        <Link
          href="/settings"
          className={`flex flex-col items-center justify-center flex-1 h-full text-[10px] font-bold transition-all ${
            pathname === "/settings" ? "text-primary scale-105" : "text-foreground-muted hover:text-foreground"
          }`}
        >
          <Settings className="h-5 w-5 mb-0.5" />
          {t('nav.settings')}
        </Link>
      </nav>

      {/* ────────────────── CONTENT LAYOUT AREA ────────────────── */}
      <div className="flex flex-1 flex-col md:pl-64 pb-20 md:pb-0">
        <main className="flex-1 flex flex-col">{children}</main>
      </div>

      {/* Add Transaction Modal.
          No onSuccess reload: the store emits `datastore:change` on every write
          and both /home and /transactions read through subscribing hooks
          (useTransactions, useBudgets), so they already re-render live. The
          reload was not merely redundant — it tore the page down mid-save, which
          could abandon a Firestore write that had not been acknowledged yet. */}
      <AddTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Voice Logging Modal — same reasoning as above. */}
      <VoiceLoggingModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
      />

      {/* Floating calculator — only inside the authenticated app, not on
          the login/register screens (which the root layout also wraps). */}
      <GlobalFloatingCalculator />

      {/* Currency Picker Sheet */}
      <CurrencyPickerSheet 
        isOpen={isCurrencySheetOpen} 
        onClose={() => setIsCurrencySheetOpen(false)}
        activeCurrencyCode={activeCurrency}
        onSelect={handleCurrencySelect}
      />
    </div>
  );
}
