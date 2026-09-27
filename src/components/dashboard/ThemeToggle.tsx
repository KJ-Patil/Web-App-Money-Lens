"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/providers/themeProvider";
import { useTranslation } from "@/i18n/i18nContext";

/**
 * Light/dark switch styled to match the notification bell beside it.
 *
 * Both icons are always rendered and stacked on top of each other; only their
 * rotation/scale changes, which gives the sun↔moon swap a smooth crossfade
 * instead of a pop. The icon shown reflects the theme currently in effect.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();

  const label = theme === "dark" ? t("common.switchToLight") : t("common.switchToDark");

  return (
    <button
      onClick={toggleTheme}
      className="relative p-3 rounded-2xl border border-border bg-card text-icon-default hover:text-icon-active shadow-[4px_6px_14px_-2px_rgba(148,163,184,0.25),inset_1.5px_1.5px_3px_rgba(255,255,255,0.9),inset_-1.5px_-1.5px_3px_rgba(148,163,184,0.15)] dark:shadow-[0_6px_14px_-2px_rgba(0,0,0,0.5),inset_1.5px_1.5px_3px_rgba(255,255,255,0.07)] transition-all cursor-pointer hover:-translate-y-0.5 active:translate-y-0.5"
      aria-label={label}
      title={label}
    >
      {/* Sized box so the two absolutely-positioned icons keep the button square. */}
      <span className="relative block w-5 h-5">
        <Sun
          className="absolute inset-0 w-5 h-5 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0"
          aria-hidden="true"
        />
        <Moon
          className="absolute inset-0 w-5 h-5 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100"
          aria-hidden="true"
        />
      </span>
    </button>
  );
}

export default ThemeToggle;
