"use client";

import React, { useState } from "react";
import { X, Search, Languages, Check } from "lucide-react";
import { INDIAN_LANGUAGES } from "@/core/utils/languages";
import { useTranslation } from "@/i18n/i18nContext";

interface LanguagePickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (code: string) => void;
  activeLanguageCode?: string;
}

export default function LanguagePickerSheet({
  isOpen,
  onClose,
  onSelect,
  activeLanguageCode = "en",
}: LanguagePickerSheetProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { t, setLocale } = useTranslation();

  if (!isOpen) return null;

  const query = searchQuery.toLowerCase();
  const filteredLanguages = INDIAN_LANGUAGES.filter(
    (lang) =>
      lang.name.toLowerCase().includes(query) ||
      lang.nativeName.toLowerCase().includes(query) ||
      lang.regions.toLowerCase().includes(query) ||
      lang.code.toLowerCase().includes(query)
  );

  const handleSelect = (code: string) => {
    if (onSelect) {
      onSelect(code);
    }
    // Use i18n setLocale which persists to localStorage and reloads
    setLocale(code);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center p-0 md:p-4 animate-in fade-in duration-200">

      {/* Searchable sheet container */}
      <div
        className="w-full bg-card border-t md:border border-border rounded-t-3xl md:rounded-3xl max-w-md shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25),inset_2px_2px_4px_rgba(255,255,255,0.9)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7),inset_2px_2px_4px_rgba(255,255,255,0.08)] flex flex-col animate-in slide-in-from-bottom md:zoom-in-95 duration-300 max-h-[80vh] md:max-h-[600px] overflow-hidden"
        role="dialog"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border/80 flex justify-between items-center bg-background-subtle">
          <div className="space-y-1">
            <h3 className="text-lg font-black text-foreground flex items-center gap-2">
              <Languages className="w-5 h-5 text-primary" />
              {t('settings.languageSettings')}
            </h3>
            <p className="text-xs font-semibold text-foreground-muted">{t('settings.chooseLanguage')}</p>
          </div>
          <button
            onClick={onClose}
            className="text-icon-muted hover:text-icon-active p-1.5 rounded-xl hover:bg-secondary transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar Input */}
        <div className="p-4 border-b border-border/80">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-icon-muted">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base pl-9 w-full"
              placeholder={t('settings.searchLanguageOrState')}
              autoFocus
            />
          </div>
        </div>

        {/* Scrollable Language Selection List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/60 p-2">
          {filteredLanguages.length === 0 ? (
            <div className="text-center py-8 text-sm text-foreground-muted">
              {t('settings.noMatchingLanguages')}
            </div>
          ) : (
            filteredLanguages.map((lang) => {
              const isSelected = lang.code === activeLanguageCode;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelect(lang.code)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all text-left hover:bg-secondary/70 cursor-pointer ${
                    isSelected ? "bg-primary text-white font-bold shadow-[0_6px_14px_-2px_rgba(29,78,216,0.45),inset_1.5px_1.5px_2.5px_rgba(255,255,255,0.45),inset_-1.5px_-1.5px_2.5px_rgba(15,23,42,0.3)]" : "text-foreground-secondary"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-10 h-8 rounded-lg flex items-center justify-center font-bold text-sm bg-background border border-border shadow-sm shrink-0 ${
                      isSelected ? "border-primary text-primary" : "text-foreground-secondary"
                    }`}>
                      {lang.nativeName.slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <span className="font-extrabold text-foreground">
                        {lang.name}
                        <span className="font-medium text-foreground-muted"> · {lang.nativeName}</span>
                      </span>
                      <span className="text-xs text-foreground-muted block truncate">{lang.regions}</span>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="text-primary pr-1 shrink-0">
                      <Check className="w-4 h-4 stroke-[3px]" />
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
