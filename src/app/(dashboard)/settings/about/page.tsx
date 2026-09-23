"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, ShieldCheck, FileText, Sparkles, Database, Lock, UserCheck, Smartphone } from "lucide-react";
import { useTranslation } from "@/i18n/i18nContext";

type TabType = "about" | "terms" | "privacy";

export default function AboutUsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>("about");

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 md:p-8 max-w-4xl mx-auto w-full animate-fade-in">
      {/* Header Navigation */}
      <header className="flex justify-between items-center bg-card border border-border-strong p-4 rounded-2xl shadow-sm">
        <Link
          href="/settings"
          className="flex items-center gap-2 text-xs font-bold text-foreground-secondary hover:text-primary transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("nav.settings")}
        </Link>
        <span className="text-[10px] font-black text-foreground-muted uppercase tracking-widest bg-secondary px-3 py-1 rounded-full">
          v1.0.0 (Stable)
        </span>
      </header>

      {/* Hero Card with Gradient Background */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary to-primary-hover text-white rounded-3xl p-6 md:p-8 shadow-md">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-12 translate-x-12 pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg shrink-0">
            <BookOpen className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-tight md:text-3xl">
              {t("settings.aboutApp")}
            </h1>
            <p className="text-sm font-semibold text-white/80 max-w-xl">
              A premium, offline-first personal wealth manager designed to track transactions, simulate budgets, calculate financial health scores, and maintain shared wallets.
            </p>
          </div>
        </div>
      </section>

      {/* Glassmorphic Tab Switcher */}
      <div className="bg-card border border-border-strong p-1.5 rounded-2xl flex shadow-sm w-full md:max-w-md mx-auto">
        <button
          onClick={() => setActiveTab("about")}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === "about"
              ? "bg-primary-lighter text-primary shadow-sm"
              : "text-foreground-secondary hover:bg-secondary/50"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          {t("settings.aboutUs").split(" ")[0]} {/* About */}
        </button>

        <button
          onClick={() => setActiveTab("terms")}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === "terms"
              ? "bg-primary-lighter text-primary shadow-sm"
              : "text-foreground-secondary hover:bg-secondary/50"
          }`}
        >
          <FileText className="w-4 h-4" />
          Terms
        </button>

        <button
          onClick={() => setActiveTab("privacy")}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === "privacy"
              ? "bg-primary-lighter text-primary shadow-sm"
              : "text-foreground-secondary hover:bg-secondary/50"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Privacy
        </button>
      </div>

      {/* Content Panels */}
      <main className="bg-card border border-border-strong rounded-3xl p-6 md:p-8 shadow-sm min-h-[300px] flex flex-col justify-between">
        {activeTab === "about" && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-2">
              <h2 className="text-xl font-black text-foreground">
                About MoneyLens
              </h2>
              <p className="text-sm font-semibold text-foreground-secondary leading-relaxed">
                MoneyLens is a state-of-the-art wealth tracking shell built specifically for users looking to manage budgets, ledgers, and savings rates securely. The app balances advanced offline independence with absolute cloud transparency, ensuring you are always in complete control of your financial records.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <div className="p-4 bg-background-subtle border border-border rounded-2xl space-y-2">
                <div className="w-8 h-8 rounded-lg bg-primary-lighter text-primary flex items-center justify-center">
                  <Database className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-foreground">IndexedDB Storage</h3>
                <p className="text-xs font-semibold text-foreground-muted">
                  Everything stays local. Your database runs inside the browser container for lightning-fast access, with optional cloud back-ups.
                </p>
              </div>

              <div className="p-4 bg-background-subtle border border-border rounded-2xl space-y-2">
                <div className="w-8 h-8 rounded-lg bg-primary-lighter text-primary flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Cryptographic Privacy</h3>
                <p className="text-xs font-semibold text-foreground-muted">
                  Your application security PIN is cryptographically hashed locally before comparison. We never read or store raw security keys.
                </p>
              </div>

              <div className="p-4 bg-background-subtle border border-border rounded-2xl space-y-2">
                <div className="w-8 h-8 rounded-lg bg-primary-lighter text-primary flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Offline Capabilities</h3>
                <p className="text-xs font-semibold text-foreground-muted">
                  Designed from the ground up as a Progressive Web App (PWA). Functions smoothly on standard mobile browsers, even under spotty network connections.
                </p>
              </div>

              <div className="p-4 bg-background-subtle border border-border rounded-2xl space-y-2">
                <div className="w-8 h-8 rounded-lg bg-primary-lighter text-primary flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Smart Analytics</h3>
                <p className="text-xs font-semibold text-foreground-muted">
                  Tracks budget limits, savings rates, credit score simulations, and emotional spending habits locally to empower your decision-making.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "terms" && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-2">
              <h2 className="text-xl font-black text-foreground">
                {t("settings.termsConditions")}
              </h2>
              <p className="text-xs font-bold text-foreground-muted">
                Last Updated: July 1, 2026
              </p>
            </div>

            <div className="space-y-4 text-sm font-semibold text-foreground-secondary leading-relaxed">
              <p>
                By using MoneyLens, you agree to these Terms and Conditions. Please review them carefully before starting your ledger work.
              </p>
              
              <div className="space-y-1">
                <h3 className="font-extrabold text-foreground">1. User Data Ownership</h3>
                <p className="text-xs text-foreground-secondary">
                  Your transactions, notebook sheets, and category configs belong 100% to you. We hold no interest in your ledger data, and you maintain the absolute right to write, export, clear, or purge your records at any time.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-extrabold text-foreground">2. Financial Guidance Disclaimer</h3>
                <p className="text-xs text-foreground-secondary">
                  The insights, CIBIL scores, and budget recommendations generated by the application are simulated models based on mathematical formulas and user inputs. They do not constitute formal financial advice or professional credit ratings.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-extrabold text-foreground">3. Application Availability</h3>
                <p className="text-xs text-foreground-secondary">
                  Since the database operates offline-first on your device, we are not responsible for data loss caused by clearing browser cookies, wiping application cache, or physical damage to the hosting device. Please use the export center to back up your records periodically.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "privacy" && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-2">
              <h2 className="text-xl font-black text-foreground">
                {t("settings.privacyPolicy")}
              </h2>
              <p className="text-xs font-bold text-foreground-muted">
                Last Updated: July 1, 2026
              </p>
            </div>

            <div className="space-y-4 text-sm font-semibold text-foreground-secondary leading-relaxed">
              <p>
                We value your privacy above everything else. That is why MoneyLens is designed to operate on a zero-tracking framework.
              </p>

              <div className="space-y-1">
                <h3 className="font-extrabold text-foreground">1. Local Storage First</h3>
                <p className="text-xs text-foreground-secondary">
                  Your primary ledger files, bills, savings target milestones, and configuration parameters are stored locally on your device via IndexedDB. Your finance info never hits our servers unless you explicitly configure the Firebase Cloud sync feature.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-extrabold text-foreground">2. Zero Analytics & Trackers</h3>
                <p className="text-xs text-foreground-secondary">
                  We carry no tracking tags, telemetry tools, or advertising cookies. Your personal profile email is only collected if you choose to create a synced account for data restoration.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-extrabold text-foreground">3. Security Standards</h3>
                <p className="text-xs text-foreground-secondary">
                  If sync is enabled, all cloud transactions are protected using secure transmission protocols and Firebase security rules. The security PIN is hashed locally in your browser sandbox, rendering it inaccessible to external agents.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-border flex justify-between items-center text-[10px] font-bold text-foreground-muted">
          <span>© KJ.Patil</span>
          <span>Open Source PWA</span>
        </div>
      </main>
    </div>
  );
}
