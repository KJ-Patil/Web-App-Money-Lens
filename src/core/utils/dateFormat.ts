/**
 * Locale-aware date & time formatting — the single place that decides what
 * language a date is written in.
 *
 * Every UI date used to hardcode its own locale tag (mostly `"en-US"`, a few
 * `"en-IN"`), so switching the app to Hindi or Marathi translated the labels but
 * left every date beside them in English: a Hindi screen read "गुरु" nowhere and
 * "Thu" everywhere. These helpers resolve the tag from the user's chosen
 * language instead, via `getLocaleTag` in `core/utils/languages`.
 *
 * Scope: SCREEN dates only. File exports (CSV/Excel/PDF) deliberately keep their
 * fixed `en-IN` formatting — Marathi renders digits in Devanagari ("१५ जाने,
 * २०२६"), which a spreadsheet cannot parse back into a date.
 *
 * The browser does the translating; nothing here ships month or weekday names.
 */

import { getLocaleTag } from "@/core/utils/languages";

/** What callers may pass: a Date, an ISO string, or an epoch number. */
export type DateInput = Date | string | number;

/** Shown when a value isn't a usable date — matches `formatAmount`'s fallback. */
export const INVALID_DATE_PLACEHOLDER = "—";

/**
 * Coerce an input to a valid Date, or null.
 *
 * Call sites previously did `new Date(value).toLocaleDateString(...)` directly,
 * which renders the literal string "Invalid Date" for a missing or malformed
 * value. Returning null lets the formatters emit a placeholder instead.
 */
function toDate(value: DateInput): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format a date in the user's language.
 *
 * @param options the same `Intl.DateTimeFormatOptions` the old
 *   `toLocaleDateString` calls passed, so migrating a call site is just swapping
 *   the function and dropping the hardcoded locale tag.
 * @param localeTag override the resolved language (rarely needed; exports pin
 *   their own tag instead of calling in here).
 */
export function formatDate(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
  localeTag: string = getLocaleTag()
): string {
  const date = toDate(value);
  if (!date) return INVALID_DATE_PLACEHOLDER;
  try {
    return date.toLocaleDateString(localeTag, options);
  } catch {
    // An unsupported tag throws a RangeError rather than degrading. A date in
    // the wrong language beats a crashed render.
    return date.toLocaleDateString(undefined, options);
  }
}

/** Format a time of day in the user's language. */
export function formatTime(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: true },
  localeTag: string = getLocaleTag()
): string {
  const date = toDate(value);
  if (!date) return INVALID_DATE_PLACEHOLDER;
  try {
    return date.toLocaleTimeString(localeTag, options);
  } catch {
    return date.toLocaleTimeString(undefined, options);
  }
}

/** Format a combined date + time in the user's language. */
export function formatDateTime(
  value: DateInput,
  options: Intl.DateTimeFormatOptions,
  localeTag: string = getLocaleTag()
): string {
  const date = toDate(value);
  if (!date) return INVALID_DATE_PLACEHOLDER;
  try {
    return date.toLocaleString(localeTag, options);
  } catch {
    return date.toLocaleString(undefined, options);
  }
}

/**
 * Localized month names, index 0–11 — the replacement for the hardcoded English
 * `MONTH_LABELS` array. Built from real dates so the browser supplies the names.
 *
 * Day 1 of each month is safe here: no month is short enough for the 1st to roll
 * into the next, which is the bug `addMonthsClamped` exists to avoid elsewhere.
 */
export function getMonthLabels(
  style: "long" | "short" = "long",
  localeTag: string = getLocaleTag()
): string[] {
  return Array.from({ length: 12 }, (_, month) =>
    formatDate(new Date(2024, month, 1), { month: style }, localeTag)
  );
}

/**
 * Localized weekday labels, Monday-first, to match the calendar grid.
 *
 * 2024-01-01 was a Monday, so adding 0–6 days walks Mon→Sun.
 */
export function getWeekdayLabels(
  style: "long" | "short" | "narrow" = "narrow",
  localeTag: string = getLocaleTag()
): string[] {
  return Array.from({ length: 7 }, (_, offset) =>
    formatDate(new Date(2024, 0, 1 + offset), { weekday: style }, localeTag)
  );
}
