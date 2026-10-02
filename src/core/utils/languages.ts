/**
 * Indian languages dataset for the app's language preference.
 *
 * Deliberately limited to the languages that actually ship a dictionary in
 * `src/i18n/dictionaries` — English, Hindi and Marathi. Each entry carries an
 * ISO/BCP-47 code, the English name, the endonym (native spelling) and a sample
 * of states/UTs where it is an official language.
 *
 * Do NOT list a language here before adding its dictionary: the picker renders
 * this array directly, and `t()` falls back to English silently, so an unbacked
 * entry looks selectable and then changes nothing the user can see.
 *
 * Selecting a language persists the choice (mirroring the currency setting) and
 * switches the active dictionary via `setLocale` in `i18n/i18nContext`.
 */

export interface LanguageInfo {
  /** BCP-47 / ISO 639 code. */
  code: string;
  /** English name of the language. */
  name: string;
  /** Native spelling (endonym). */
  nativeName: string;
  /** Indian states / union territories where it is official (sample). */
  regions: string;
  /**
   * Full BCP-47 tag handed to `Intl` for date/time formatting. The bare language
   * code is not enough: `new Intl.DateTimeFormat("hi")` has no region, so it
   * cannot pick Indian date order or month abbreviations reliably.
   */
  localeTag: string;
}

export const DEFAULT_LANGUAGE = "en";

/** localStorage key holding the user's chosen language code. */
export const ACTIVE_LANGUAGE_KEY = "active_language";

export const INDIAN_LANGUAGES: LanguageInfo[] = [
  // `en-US` (not `en-IN`) so this change is a no-op for existing English users:
  // most UI dates were already formatted as en-US, and switching them to the
  // Indian order would silently reshuffle every date for the default language.
  // Flip this one value if you'd rather English read "15 Jan 2026".
  { code: "en", name: "English", nativeName: "English", regions: "All India (associate official)", localeTag: "en-US" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", regions: "Uttar Pradesh, Bihar, Madhya Pradesh, Rajasthan, Delhi", localeTag: "hi-IN" },
  { code: "mr", name: "Marathi", nativeName: "मराठी", regions: "Maharashtra, Goa", localeTag: "mr-IN" },
];

/** Look up a language by code, falling back to English. */
export function getLanguage(code: string): LanguageInfo {
  return (
    INDIAN_LANGUAGES.find((l) => l.code === code) ??
    INDIAN_LANGUAGES.find((l) => l.code === DEFAULT_LANGUAGE)!
  );
}

/**
 * The active language code, read straight from localStorage.
 *
 * Deliberately synchronous and outside React, mirroring how `currencyManager`
 * reads `active_currency`: date formatting happens in plain modules too (the
 * chart selectors in `core/store/dataStore`), which cannot consume the i18n
 * context. An unknown or missing value resolves to English rather than throwing,
 * so a hand-edited localStorage value can't break every date in the app.
 */
export function getActiveLanguage(): string {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    const saved = localStorage.getItem(ACTIVE_LANGUAGE_KEY);
    return saved && INDIAN_LANGUAGES.some((l) => l.code === saved) ? saved : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

/** BCP-47 tag for `Intl`, defaulting to the active language. */
export function getLocaleTag(code: string = getActiveLanguage()): string {
  return getLanguage(code).localeTag;
}
