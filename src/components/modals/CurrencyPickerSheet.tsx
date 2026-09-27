"use client";

import React, { useState } from "react";
import { X, Search, Globe, Check } from "lucide-react";
import { PRESET_CURRENCIES, CurrencyInfo } from "@/core/utils/currencyManager";

interface CurrencyPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (code: string) => void;
  activeCurrencyCode?: string;
}

export default function CurrencyPickerSheet({
  isOpen,
  onClose,
  onSelect,
  activeCurrencyCode = "INR",
}: CurrencyPickerSheetProps) {
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  const currenciesList = Object.values(PRESET_CURRENCIES);

  const filteredCurrencies = currenciesList.filter(
    (cur) =>
      cur.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cur.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (code: string) => {
    localStorage.setItem("active_currency", code);
    if (onSelect) {
      onSelect(code);
    }
    onClose();
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
              <Globe className="w-5 h-5 text-primary" />
              Currency Settings
            </h3>
            <p className="text-xs font-semibold text-foreground-muted">Select default base formatting symbol.</p>
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
              placeholder="Search currency code or country..."
              autoFocus
            />
          </div>
        </div>

        {/* Scrollable Currency Selection List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/60 p-2">
          {filteredCurrencies.length === 0 ? (
            <div className="text-center py-8 text-sm text-foreground-muted">
              No matching currencies found.
            </div>
          ) : (
            filteredCurrencies.map((cur) => {
              const isSelected = cur.code === activeCurrencyCode.toUpperCase();
              return (
                <button
                  key={cur.code}
                  type="button"
                  onClick={() => handleSelect(cur.code)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all text-left hover:bg-secondary/70 cursor-pointer ${
                    isSelected ? "bg-primary text-white font-bold shadow-[0_6px_14px_-2px_rgba(29,78,216,0.45),inset_1.5px_1.5px_2.5px_rgba(255,255,255,0.45),inset_-1.5px_-1.5px_2.5px_rgba(15,23,42,0.3)]" : "text-foreground-secondary"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm bg-background border border-border shadow-sm ${
                      isSelected ? "border-primary text-primary" : "text-foreground-secondary"
                    }`}>
                      {cur.symbol}
                    </span>
                    <div>
                      <span className="font-extrabold text-foreground">{cur.code}</span>
                      <span className="text-xs text-foreground-muted block">{cur.name}</span>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="text-primary pr-1">
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
