"use client";

import React, { useState } from "react";
import { useTranslation } from "@/i18n/i18nContext";
import { MessageSquare, Phone, ChevronDown, ChevronUp, Search, HelpCircle, LifeBuoy } from "lucide-react";

interface FAQItem {
  key: string;
  qKey: string;
  aKey: string;
}

/**
 * Support contact, read from config instead of living in the source tree, so
 * the number is set per environment and no placeholder can ship as a live link.
 * When unset the contact cards are hidden rather than rendered pointing at
 * nobody.
 *
 * NEXT_PUBLIC_ values are inlined at build time and frozen into the bundle, so
 * changing the number still needs a rebuild — it just no longer needs a code
 * edit. Keep this a full literal `process.env.X` reference: Next substitutes
 * these textually, and a computed key would silently read undefined.
 */
const SUPPORT_PHONE = (process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "").trim();

/** wa.me takes bare digits; `tel:` takes the E.164 "+" form. */
const SUPPORT_PHONE_DIGITS = SUPPORT_PHONE.replace(/\D/g, "");
const HAS_SUPPORT_PHONE = SUPPORT_PHONE_DIGITS.length > 0;

export default function HelpSupportPage() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const faqs: FAQItem[] = [
    { key: "faq1", qKey: "help.faq1Question", aKey: "help.faq1Answer" },
    { key: "faq2", qKey: "help.faq2Question", aKey: "help.faq2Answer" },
    { key: "faq3", qKey: "help.faq3Question", aKey: "help.faq3Answer" },
    { key: "faq4", qKey: "help.faq4Question", aKey: "help.faq4Answer" },
    { key: "faq5", qKey: "help.faq5Question", aKey: "help.faq5Answer" },
    { key: "faq6", qKey: "help.faq6Question", aKey: "help.faq6Answer" },
  ];

  const filteredFaqs = faqs.filter((faq) => {
    const question = t(faq.qKey).toLowerCase();
    const answer = t(faq.aKey).toLowerCase();
    const query = searchQuery.toLowerCase();
    return question.includes(query) || answer.includes(query);
  });

  const toggleFaq = (key: string) => {
    setExpandedFaq(expandedFaq === key ? null : key);
  };

  return (
    <div className="flex-1 flex flex-col p-6 space-y-8 md:p-8 max-w-4xl mx-auto w-full animate-fade-in">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-lighter text-primary flex items-center justify-center">
            <LifeBuoy className="w-6 h-6 animate-pulse" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl">
            {t("help.title")}
          </h1>
        </div>
        <p className="text-sm font-medium text-foreground-muted">
          {t("help.subtitle")}
        </p>
      </div>

      {/* Support Options Grid — omitted entirely when no contact is configured */}
      {HAS_SUPPORT_PHONE && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* WhatsApp Card */}
        <div className="group relative overflow-hidden bg-card border border-border-strong rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-success/5 rounded-bl-full transition-all group-hover:scale-110" />
          <div className="space-y-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-success-light text-success flex items-center justify-center">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground group-hover:text-success transition-colors">
                {t("help.whatsappTitle")}
              </h2>
              <p className="text-sm text-foreground-secondary mt-1">
                {t("help.whatsappDesc")}
              </p>
            </div>
          </div>
          <div className="mt-6 pt-2">
            <a
              href={`https://wa.me/${SUPPORT_PHONE_DIGITS}?text=${encodeURIComponent(
                "Hi MoneyLens Support, I need assistance."
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-success hover:bg-success/90 text-white font-bold text-sm rounded-xl shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              {t("help.whatsappBtn")}
            </a>
          </div>
        </div>

        {/* Call Card */}
        <div className="group relative overflow-hidden bg-card border border-border-strong rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full transition-all group-hover:scale-110" />
          <div className="space-y-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-primary-lighter text-primary flex items-center justify-center">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                {t("help.callTitle")}
              </h2>
              <p className="text-sm text-foreground-secondary mt-1">
                {t("help.callDesc")}
              </p>
            </div>
          </div>
          <div className="mt-6 pt-2">
            <a
              href={`tel:${SUPPORT_PHONE}`}
              className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold text-sm rounded-xl shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Phone className="w-4 h-4 mr-2" />
              {t("help.callBtn")}
            </a>
          </div>
        </div>
      </div>
      )}

      {/* FAQ Section */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-black text-foreground">
            {t("help.faqsTitle")}
          </h2>

          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-foreground-muted" />
            <input
              type="text"
              placeholder={t("help.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border-strong rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
        </div>

        {filteredFaqs.length > 0 ? (
          <div className="space-y-3">
            {filteredFaqs.map((faq) => {
              const isExpanded = expandedFaq === faq.key;
              return (
                <div
                  key={faq.key}
                  className="bg-card border border-border-strong rounded-xl overflow-hidden transition-all duration-200"
                >
                  <button
                    onClick={() => toggleFaq(faq.key)}
                    className="w-full flex items-center justify-between p-5 text-left font-bold text-foreground hover:bg-secondary/40 transition-colors cursor-pointer"
                  >
                    <span className="pr-4">{t(faq.qKey)}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 shrink-0 text-primary" />
                    ) : (
                      <ChevronDown className="w-5 h-5 shrink-0 text-foreground-muted" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 text-sm font-semibold text-foreground-secondary leading-relaxed border-t border-border-strong/50 animate-slide-down">
                      {t(faq.aKey)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-card border border-border-strong rounded-xl animate-fade-in">
            <HelpCircle className="w-12 h-12 mx-auto text-foreground-muted mb-3" />
            <p className="text-sm font-semibold text-foreground-secondary">
              {t("common.noResults")}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
