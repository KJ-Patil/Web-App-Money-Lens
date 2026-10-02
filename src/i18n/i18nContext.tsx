"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

// Import dictionaries statically for client-side use
import en from "./dictionaries/en.json";
import hi from "./dictionaries/hi.json";
import mr from "./dictionaries/mr.json";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dictionary = Record<string, any>;

const DICTIONARIES: Record<string, Dictionary> = { en, hi, mr };

/**
 * Resolve a dot-notated key against a nested dictionary object.
 *   t("home.greeting")  →  dictionary.home.greeting
 *   t("common.save")    →  dictionary.common.save
 *
 * Returns the English fallback when the key is missing in the active
 * language, and the raw key itself as a last resort.
 */
function resolve(dict: Dictionary, key: string): string {
  const parts = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = dict;
  for (const part of parts) {
    if (node == null || typeof node !== "object") return "";
    node = node[part];
  }
  return typeof node === "string" ? node : "";
}

interface I18nContextValue {
  /** The active BCP-47 language code (e.g. "en", "hi"). */
  locale: string;
  /**
   * Look up a translated string by its dot-notated key.
   * Supports simple placeholder interpolation:
   *   t("login.sentTo", { phone: "+91…" })
   *     → "Sent to +91…."
   */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Switch language (persists to localStorage and reloads the page). */
  setLocale: (code: string) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState("en");
  const [dict, setDict] = useState<Dictionary>(en);

  // On mount, read the persisted language preference.
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("active_language") || "en";
      const effectiveLocale = DICTIONARIES[saved] ? saved : "en";
      setLocaleState(effectiveLocale);
      setDict(DICTIONARIES[effectiveLocale] || en);
      // Keep the document's language in step with the dictionary. The root
      // layout hardcodes `lang="en"`, so without this a Hindi or Marathi UI is
      // still announced to screen readers with English pronunciation rules and
      // offered for translation *from* English by the browser.
      document.documentElement.lang = effectiveLocale;
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      let value = resolve(dict, key);
      // Fallback to English when the key is missing in the active dictionary.
      if (!value) {
        value = resolve(en, key);
      }
      // Last resort: return the key itself so the UI never shows blank text.
      if (!value) return key;

      // Simple template interpolation: replace {varName} with the value.
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return value;
    },
    [dict]
  );

  const setLocale = useCallback((code: string) => {
    localStorage.setItem("active_language", code);
    // Reload so every component picks up the new dictionary cleanly.
    window.location.reload();
  }, []);

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * Hook consumed by every page / component that needs translated strings.
 *
 *   const { t } = useTranslation();
 *   <h1>{t("home.greeting")}</h1>
 */
export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslation must be used inside <I18nProvider>");
  }
  return ctx;
}
