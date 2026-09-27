"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  ClipboardPaste,
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
  Save,
} from "lucide-react";
import { parseSmsMessage, type ParsedSmsTransaction } from "@/core/automation/SmsParser";
import { formatAmount } from "@/core/utils/currencyManager";
import { addTransaction } from "@/core/store/dataStore";

// ─── Sub-component: Parsed result confirmation sheet ─────────────────────────

interface ConfirmSheetProps {
  parsed: ParsedSmsTransaction;
  currencyCode: string;
  onSave: (tx: ParsedSmsTransaction) => void;
  onDiscard: () => void;
}

function ConfirmSheet({ parsed, currencyCode, onSave, onDiscard }: ConfirmSheetProps) {
  const [type, setType] = useState(parsed.type);
  const [description, setDescription] = useState(parsed.description);

  const isIncome = type === "income";

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm animate-in slide-in-from-top-1 duration-200">
      {/* Sheet Header */}
      <div className={`px-4 py-3 flex items-center justify-between ${
        isIncome ? "bg-success-light border-b border-success/20" : "bg-error-light border-b border-error/20"
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
            isIncome ? "bg-success/15 text-success" : "bg-error/15 text-error"
          }`}>
            {isIncome
              ? <ArrowUpRight className="w-4 h-4" />
              : <ArrowDownRight className="w-4 h-4" />
            }
          </div>
          <div>
            <span className="text-xs font-extrabold text-foreground">Parsed Transaction</span>
            <span className="text-[10px] text-foreground-muted block">
              Detected via {parsed.source}
            </span>
          </div>
        </div>
        <span className={`text-base font-black tracking-tight ${
          isIncome ? "text-success" : "text-foreground"
        }`}>
          {isIncome ? "+" : "−"}{formatAmount(parsed.amount, currencyCode)}
        </span>
      </div>

      {/* Editable Fields */}
      <div className="p-4 space-y-3">
        {/* Type toggle */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider">
            Transaction Type
          </span>
          <div className="grid grid-cols-2 gap-2 p-1 bg-secondary rounded-xl">
            <button
              type="button"
              onClick={() => setType("expense")}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                type === "expense"
                  ? "bg-destructive text-destructive-foreground shadow-sm"
                  : "text-foreground-secondary hover:text-foreground"
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setType("income")}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                type === "income"
                  ? "bg-success text-success-foreground shadow-sm"
                  : "text-foreground-secondary hover:text-foreground"
              }`}
            >
              Income
            </button>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-base w-full text-sm"
            placeholder="Vendor / narration"
          />
        </div>

        {/* Raw message preview (collapsed) */}
        <details className="group">
          <summary className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider cursor-pointer select-none list-none flex items-center gap-1 hover:text-foreground-secondary transition-colors">
            <span>Raw SMS</span>
            <ChevronDown className="w-3 h-3 group-open:hidden" />
            <ChevronUp className="w-3 h-3 hidden group-open:block" />
          </summary>
          <p className="mt-1.5 text-[10px] text-foreground-muted bg-secondary/60 rounded-lg px-3 py-2 font-mono leading-relaxed break-all">
            {parsed.rawMessage}
          </p>
        </details>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onDiscard}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl bg-secondary border border-border text-foreground-secondary hover:bg-secondary/80 transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Discard
          </button>
          <button
            type="button"
            onClick={() => onSave({ ...parsed, type, description })}
            className="flex-2 flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-extrabold rounded-xl bg-primary text-primary-foreground hover:bg-primary-hover transition-all cursor-pointer shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            Save to Ledger
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface SmsPasteZoneProps {
  currencyCode?: string;
  onTransactionSaved?: () => void;
}

export default function SmsPasteZone({
  currencyCode = "INR",
  onTransactionSaved,
}: SmsPasteZoneProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [parsed, setParsed] = useState<ParsedSmsTransaction | null>(null);
  const [uiState, setUiState] = useState<"idle" | "error" | "saved">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Parse incoming text ──────────────────────────────────────────────────
  const processText = useCallback((text: string) => {
    const result = parseSmsMessage(text);
    if (result) {
      setParsed(result);
      setUiState("idle");
    } else {
      setParsed(null);
      if (text.trim().length > 10) {
        setUiState("error");
        setTimeout(() => setUiState("idle"), 3000);
      }
    }
  }, []);

  // ── Paste event handler ──────────────────────────────────────────────────
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pasted = e.clipboardData.getData("text");
      if (pasted) {
        setInputValue(pasted);
        processText(pasted);
      }
    },
    [processText]
  );

  // ── Manual text input (Enter to parse) ──────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        processText(inputValue);
      }
    },
    [inputValue, processText]
  );

  // ── Save confirmed transaction to localStorage ledger ────────────────────
  const handleSave = useCallback(
    (tx: ParsedSmsTransaction) => {
      addTransaction({
        amount: tx.amount,
        type: tx.type,
        category: tx.type === "income" ? "Salary" : "Other",
        description: tx.description,
        date: tx.date,
      });

      setParsed(null);
      setInputValue("");
      setUiState("saved");
      setTimeout(() => setUiState("idle"), 2500);
      onTransactionSaved?.();
    },
    [onTransactionSaved]
  );

  const handleDiscard = useCallback(() => {
    setParsed(null);
    setInputValue("");
    setUiState("idle");
  }, []);

  // ── Collapse when saved and no parsed result ─────────────────────────────
  const handleToggle = () => {
    if (isExpanded) {
      setParsed(null);
      setInputValue("");
      setUiState("idle");
      setIsExpanded(false);
    } else {
      setIsExpanded(true);
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="bg-card border border-border rounded-3xl shadow-[8px_14px_28px_-4px_rgba(148,163,184,0.25),inset_2px_2px_4px_rgba(255,255,255,0.95),inset_-2.5px_-2.5px_5px_rgba(148,163,184,0.18)] dark:shadow-[0_16px_32px_-6px_rgba(0,0,0,0.55),inset_2px_2px_4px_rgba(255,255,255,0.08)] overflow-hidden">

      {/* ── Collapsed trigger bar ── */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/40 transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors shadow-[inset_1px_1px_2px_rgba(255,255,255,0.9),inset_-1px_-1px_2px_rgba(29,78,216,0.15)]">
            <ClipboardPaste className="w-4.5 h-4.5" />
          </div>
          <div className="text-left">
            <span className="text-sm font-black text-foreground block">
              SMS Auto-Parser
            </span>
            <span className="text-[11px] font-semibold text-foreground-muted">
              Paste a bank alert to auto-extract transaction details
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {uiState === "saved" && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-success bg-success-light px-2.5 py-1 rounded-full shadow-xs">
              <CheckCircle2 className="w-3 h-3" />
              Saved
            </span>
          )}
          {uiState === "error" && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-error bg-error-light px-2.5 py-1 rounded-full shadow-xs">
              <AlertCircle className="w-3 h-3" />
              Not recognised
            </span>
          )}
          <span className={`text-[10px] font-bold px-3 py-1 rounded-xl transition-all shadow-xs ${
            isExpanded
              ? "bg-primary text-primary-foreground shadow-[inset_1px_1px_2px_rgba(255,255,255,0.4),0_4px_8px_rgba(29,78,216,0.3)]"
              : "bg-secondary text-foreground-secondary group-hover:bg-secondary/80 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(148,163,184,0.15)]"
          }`}>
            {isExpanded ? "Close" : "Open"}
          </span>
        </div>
      </button>

      {/* ── Expanded paste area ── */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-3 border-t border-border animate-in slide-in-from-top-1 duration-150">
          <div className="pt-3 space-y-1.5">
            <label className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-brand" />
              Paste SMS / Bank Alert
            </label>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setParsed(null);
                  setUiState("idle");
                }}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                rows={3}
                className={`input-base w-full text-xs resize-none font-mono leading-relaxed transition-all ${
                  uiState === "error" ? "border-error/60 bg-error-light/30" : ""
                }`}
                placeholder={
                  "Paste your bank SMS here, e.g.:\n" +
                  '"HDFC Bank: Rs.1,500.00 debited from A/c XX1234. Info: SWIGGY"\n' +
                  "Press Enter or paste to auto-parse."
                }
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={() => {
                    setInputValue("");
                    setParsed(null);
                    setUiState("idle");
                    textareaRef.current?.focus();
                  }}
                  className="absolute top-2 right-2 text-icon-muted hover:text-icon-active p-1 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {!parsed && inputValue.trim().length > 0 && uiState === "idle" && (
              <button
                type="button"
                onClick={() => processText(inputValue)}
                className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
              >
                Parse now →
              </button>
            )}

            {uiState === "error" && (
              <p className="text-[10px] font-semibold text-error flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                No transaction pattern recognised in this message. Try a different alert.
              </p>
            )}
          </div>

          {/* Confirmation sheet slides in when a result is ready */}
          {parsed && (
            <ConfirmSheet
              parsed={parsed}
              currencyCode={currencyCode}
              onSave={handleSave}
              onDiscard={handleDiscard}
            />
          )}
        </div>
      )}
    </div>
  );
}
