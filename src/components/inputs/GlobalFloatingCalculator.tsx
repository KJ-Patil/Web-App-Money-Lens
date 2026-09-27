"use client";

import React, { useState, useEffect, useRef } from "react";
import { Calculator, Delete, Copy, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { evaluateArithmetic } from "@/core/math/mathEvaluator";

export default function GlobalFloatingCalculator() {
  const [isOpen, setIsOpen] = useState(false);
  const [expression, setExpression] = useState("");
  const [liveResult, setLiveResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Popover coordinates relative to the viewport
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });

  // Drag boundaries setup to prevent dragging the button outside the viewport
  const [dragConstraints, setDragConstraints] = useState({ left: -600, right: 0, top: -600, bottom: 0 });

  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  // Avoid SSR hydration issues
  useEffect(() => {
    setIsMounted(true);
    const updateConstraints = () => {
      // 14px size of FAB (w-14 = 56px), with a 24px (bottom-6 right-6) margin
      const margin = 24;
      const fabSize = 56;
      setDragConstraints({
        left: -window.innerWidth + fabSize + margin * 2,
        right: margin,
        top: -window.innerHeight + fabSize + margin * 2,
        bottom: margin,
      });
    };
    updateConstraints();
    window.addEventListener("resize", updateConstraints);
    return () => window.removeEventListener("resize", updateConstraints);
  }, []);

  // Compute popover position to ensure it is always inside the window bounds
  const updatePopoverPosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popWidth = 270;
    const popHeight = 390; // Popover height is ~390px
    const margin = 12;

    // Default position: above the button, aligned with the right edge of the button
    let left = rect.right - popWidth;
    let top = rect.top - popHeight - margin;

    // Viewport boundaries check
    if (left < margin) {
      // Out of bounds on the left -> push to the right margin
      left = margin;
    }
    if (left + popWidth > window.innerWidth - margin) {
      // Out of bounds on the right -> push to the left
      left = window.innerWidth - popWidth - margin;
    }
    if (top < margin) {
      // Out of bounds on the top -> display below the button instead
      top = rect.bottom + margin;
    }
    if (top + popHeight > window.innerHeight - margin) {
      // Out of bounds on the bottom -> push upwards
      top = window.innerHeight - popHeight - margin;
    }

    setPopoverPos({ x: left, y: top });
  };

  // Recalculate popover position on open and on window resize
  useEffect(() => {
    if (isOpen) {
      updatePopoverPosition();
      window.addEventListener("resize", updatePopoverPosition);
      return () => window.removeEventListener("resize", updatePopoverPosition);
    }
  }, [isOpen]);

  // Compute live result in real time
  useEffect(() => {
    if (!expression) {
      setLiveResult(null);
      return;
    }
    try {
      const res = evaluateArithmetic(expression);
      if (!isNaN(res) && isFinite(res)) {
        setLiveResult(Number(res.toFixed(4)).toString());
      } else {
        setLiveResult(null);
      }
    } catch {
      setLiveResult(null);
    }
  }, [expression]);

  // Click outside to close popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Handle physical keyboard typing when opened
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.id !== "global-calculator-fake-focus") {
        if (e.key === "Escape") {
          e.preventDefault();
          setIsOpen(false);
        }
        return;
      }

      const key = e.key;

      if (/[0-9.()+\-*/]/.test(key)) {
        e.preventDefault();
        setExpression((prev) => prev + key);
      } else if (key === "Backspace") {
        e.preventDefault();
        setExpression((prev) => prev.slice(0, -1));
      } else if (key === "Enter" || key === "=") {
        e.preventDefault();
        handleEvaluate();
      } else if (key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
      } else if (key.toLowerCase() === "c") {
        e.preventDefault();
        setExpression("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, expression, liveResult]);

  if (!isMounted) return null;

  const appendChar = (char: string) => {
    setExpression((prev) => prev + char);
  };

  const handleBackspace = () => {
    setExpression((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setExpression("");
  };

  const handleEvaluate = () => {
    try {
      if (!expression) return;
      const res = evaluateArithmetic(expression);
      if (!isNaN(res) && isFinite(res)) {
        setExpression(Number(res.toFixed(4)).toString());
      }
    } catch {
      setExpression("Error");
      setTimeout(() => setExpression(""), 1200);
    }
  };

  const handleCopy = () => {
    const finalVal = liveResult || expression || "0";
    if (finalVal === "Error") return;

    navigator.clipboard.writeText(finalVal).then(() => {
      setCopied(true);
      toast.success(`Copied "${finalVal}" to clipboard!`);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] select-none">
      {/* Draggable FAB Container */}
      <motion.div
        ref={buttonRef}
        drag
        dragMomentum={false}
        dragConstraints={dragConstraints}
        onDragStart={() => setIsOpen(false)} // Close popover when user starts dragging
        className="pointer-events-auto absolute w-14 h-14"
        style={{ bottom: 24, right: 24 }}
        whileDrag={{ scale: 1.1, cursor: "grabbing" }}
      >
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="w-full h-full bg-gradient-to-tr from-blue-600 to-blue-800 shadow-[0_10px_24px_-2px_rgba(29,78,216,0.5),inset_2px_2px_3px_rgba(255,255,255,0.45),inset_-2px_-2px_4px_rgba(15,23,42,0.3)] rounded-full flex items-center justify-center cursor-pointer border-2 border-white/40 text-white relative hover:scale-105 active:scale-95 transition-transform"
          title="Global Calculator"
        >
          {/* Animated pulsing outer ring */}
          <div className="absolute -inset-1 rounded-full bg-primary/20 animate-pulse pointer-events-none" />
          <Calculator className="w-6 h-6" />
        </div>
      </motion.div>

      {/* Popover rendered as a sibling to avoid drag inheritances and positioned relative to viewport */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed p-4 bg-slate-900/95 backdrop-blur-md border border-white/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6),inset_1.5px_1.5px_3px_rgba(255,255,255,0.1)] rounded-3xl w-[275px] text-white flex flex-col gap-3 font-sans pointer-events-auto"
            style={{
              left: popoverPos.x,
              top: popoverPos.y,
              filter: "drop-shadow(0 25px 25px rgb(0 0 0 / 0.35))",
            }}
          >
            {/* Fake input element to capture window focus for keyboard inputs */}
            <input
              id="global-calculator-fake-focus"
              className="sr-only"
              autoFocus
              readOnly
            />

            {/* Top Bar Header */}
            <div className="flex justify-between items-center px-1 text-slate-400">
              <span className="text-[10px] font-black tracking-wider uppercase">Global Calc</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono bg-slate-800 px-1.5 py-0.5 rounded-lg text-slate-400 shadow-inner">
                  RAD / SCRATCH
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* LCD Display Panel */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex flex-col justify-end items-end h-[68px] font-mono shadow-[inset_2px_2px_4px_rgba(0,0,0,0.8),inset_-1px_-1px_2px_rgba(255,255,255,0.05)] select-all relative group">
              <div className="text-[10px] text-slate-400 tracking-wider truncate max-w-full font-medium h-4">
                {expression && expression !== liveResult ? expression : ""}
              </div>
              <div className="text-xl font-extrabold text-emerald-400 tracking-tight truncate max-w-full leading-none mt-1">
                {expression === "Error" ? "Error" : liveResult || expression || "0"}
              </div>

              {/* Copy result button inside the LCD screen */}
              <button
                type="button"
                onClick={handleCopy}
                className="absolute left-2 top-2 p-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/50 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center"
                title="Copy result to clipboard"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>

            {/* Keypad Grid */}
            <div className="grid grid-cols-4 gap-2.5">
              {/* Row 1 */}
              <button
                type="button"
                onClick={handleClear}
                className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-black py-3 rounded-2xl transition-all active:scale-95 border border-rose-500/20 cursor-pointer shadow-[2px_3px_6px_rgba(0,0,0,0.35),inset_1px_1px_2px_rgba(255,255,255,0.15),inset_-1px_-1px_2px_rgba(0,0,0,0.4)]"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => appendChar("(")}
                className="bg-slate-800/90 hover:bg-slate-750 text-slate-200 text-sm font-bold py-3 rounded-2xl transition-all active:scale-95 border border-white/5 cursor-pointer shadow-[2px_3px_6px_rgba(0,0,0,0.35),inset_1px_1px_2px_rgba(255,255,255,0.12),inset_-1px_-1px_2px_rgba(0,0,0,0.4)]"
              >
                (
              </button>
              <button
                type="button"
                onClick={() => appendChar(")")}
                className="bg-slate-800/90 hover:bg-slate-750 text-slate-200 text-sm font-bold py-3 rounded-2xl transition-all active:scale-95 border border-white/5 cursor-pointer shadow-[2px_3px_6px_rgba(0,0,0,0.35),inset_1px_1px_2px_rgba(255,255,255,0.12),inset_-1px_-1px_2px_rgba(0,0,0,0.4)]"
              >
                )
              </button>
              <button
                type="button"
                onClick={() => appendChar("/")}
                className="bg-amber-600 hover:bg-amber-500 text-white text-base font-extrabold py-3 rounded-2xl transition-all active:scale-95 cursor-pointer shadow-[2px_3px_8px_rgba(217,119,6,0.4),inset_1px_1px_2px_rgba(255,255,255,0.3),inset_-1px_-1px_2px_rgba(0,0,0,0.3)]"
              >
                ÷
              </button>

              {/* Row 2 */}
              <button
                type="button"
                onClick={() => appendChar("7")}
                className="bg-slate-800/80 hover:bg-slate-700/80 text-white text-base font-bold py-3 rounded-2xl transition-all active:scale-95 border border-white/5 cursor-pointer shadow-[2px_3px_6px_rgba(0,0,0,0.3),inset_1px_1px_2px_rgba(255,255,255,0.15),inset_-1px_-1px_2px_rgba(0,0,0,0.35)]"
              >
                7
              </button>
              <button
                type="button"
                onClick={() => appendChar("8")}
                className="bg-slate-800/80 hover:bg-slate-700/80 text-white text-base font-bold py-3 rounded-2xl transition-all active:scale-95 border border-white/5 cursor-pointer shadow-[2px_3px_6px_rgba(0,0,0,0.3),inset_1px_1px_2px_rgba(255,255,255,0.15),inset_-1px_-1px_2px_rgba(0,0,0,0.35)]"
              >
                8
              </button>
              <button
                type="button"
                onClick={() => appendChar("9")}
                className="bg-slate-800/80 hover:bg-slate-700/80 text-white text-base font-bold py-3 rounded-2xl transition-all active:scale-95 border border-white/5 cursor-pointer shadow-[2px_3px_6px_rgba(0,0,0,0.3),inset_1px_1px_2px_rgba(255,255,255,0.15),inset_-1px_-1px_2px_rgba(0,0,0,0.35)]"
              >
                9
              </button>
              <button
                type="button"
                onClick={() => appendChar("*")}
                className="bg-amber-600 hover:bg-amber-500 text-white text-base font-extrabold py-3 rounded-2xl transition-all active:scale-95 cursor-pointer shadow-[2px_3px_8px_rgba(217,119,6,0.4),inset_1px_1px_2px_rgba(255,255,255,0.3),inset_-1px_-1px_2px_rgba(0,0,0,0.3)]"
              >
                ×
              </button>

              {/* Row 3 */}
              <button
                type="button"
                onClick={() => appendChar("4")}
                className="bg-slate-800/80 hover:bg-slate-700/80 text-white text-base font-bold py-3 rounded-2xl transition-all active:scale-95 border border-white/5 cursor-pointer shadow-[2px_3px_6px_rgba(0,0,0,0.3),inset_1px_1px_2px_rgba(255,255,255,0.15),inset_-1px_-1px_2px_rgba(0,0,0,0.35)]"
              >
                4
              </button>
              <button
                type="button"
                onClick={() => appendChar("5")}
                className="bg-slate-800/80 hover:bg-slate-700/80 text-white text-base font-bold py-3 rounded-2xl transition-all active:scale-95 border border-white/5 cursor-pointer shadow-[2px_3px_6px_rgba(0,0,0,0.3),inset_1px_1px_2px_rgba(255,255,255,0.15),inset_-1px_-1px_2px_rgba(0,0,0,0.35)]"
              >
                5
              </button>
              <button
                type="button"
                onClick={() => appendChar("6")}
                className="bg-slate-800/80 hover:bg-slate-700/80 text-white text-base font-bold py-3 rounded-2xl transition-all active:scale-95 border border-white/5 cursor-pointer shadow-[2px_3px_6px_rgba(0,0,0,0.3),inset_1px_1px_2px_rgba(255,255,255,0.15),inset_-1px_-1px_2px_rgba(0,0,0,0.35)]"
              >
                6
              </button>
              <button
                type="button"
                onClick={() => appendChar("-")}
                className="bg-amber-600 hover:bg-amber-500 text-white text-base font-extrabold py-3 rounded-2xl transition-all active:scale-95 cursor-pointer shadow-[2px_3px_8px_rgba(217,119,6,0.4),inset_1px_1px_2px_rgba(255,255,255,0.3),inset_-1px_-1px_2px_rgba(0,0,0,0.3)]"
              >
                −
              </button>

              {/* Row 4 */}
              <button
                type="button"
                onClick={() => appendChar("1")}
                className="bg-slate-800/80 hover:bg-slate-700/80 text-white text-base font-bold py-3 rounded-2xl transition-all active:scale-95 border border-white/5 cursor-pointer shadow-[2px_3px_6px_rgba(0,0,0,0.3),inset_1px_1px_2px_rgba(255,255,255,0.15),inset_-1px_-1px_2px_rgba(0,0,0,0.35)]"
              >
                1
              </button>
              <button
                type="button"
                onClick={() => appendChar("2")}
                className="bg-slate-800/80 hover:bg-slate-700/80 text-white text-base font-bold py-3 rounded-2xl transition-all active:scale-95 border border-white/5 cursor-pointer shadow-[2px_3px_6px_rgba(0,0,0,0.3),inset_1px_1px_2px_rgba(255,255,255,0.15),inset_-1px_-1px_2px_rgba(0,0,0,0.35)]"
              >
                2
              </button>
              <button
                type="button"
                onClick={() => appendChar("3")}
                className="bg-slate-800/80 hover:bg-slate-700/80 text-white text-base font-bold py-3 rounded-2xl transition-all active:scale-95 border border-white/5 cursor-pointer shadow-[2px_3px_6px_rgba(0,0,0,0.3),inset_1px_1px_2px_rgba(255,255,255,0.15),inset_-1px_-1px_2px_rgba(0,0,0,0.35)]"
              >
                3
              </button>
              <button
                type="button"
                onClick={() => appendChar("+")}
                className="bg-amber-600 hover:bg-amber-500 text-white text-base font-extrabold py-3 rounded-2xl transition-all active:scale-95 cursor-pointer shadow-[2px_3px_8px_rgba(217,119,6,0.4),inset_1px_1px_2px_rgba(255,255,255,0.3),inset_-1px_-1px_2px_rgba(0,0,0,0.3)]"
              >
                +
              </button>

              {/* Row 5 */}
              <button
                type="button"
                onClick={() => appendChar("0")}
                className="bg-slate-800/80 hover:bg-slate-700/80 text-white text-base font-bold py-3 rounded-2xl transition-all active:scale-95 border border-white/5 cursor-pointer shadow-[2px_3px_6px_rgba(0,0,0,0.3),inset_1px_1px_2px_rgba(255,255,255,0.15),inset_-1px_-1px_2px_rgba(0,0,0,0.35)]"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => appendChar(".")}
                className="bg-slate-800/80 hover:bg-slate-700/80 text-white text-base font-bold py-3 rounded-2xl transition-all active:scale-95 border border-white/5 cursor-pointer shadow-[2px_3px_6px_rgba(0,0,0,0.3),inset_1px_1px_2px_rgba(255,255,255,0.15),inset_-1px_-1px_2px_rgba(0,0,0,0.35)]"
              >
                .
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="bg-slate-800/90 hover:bg-slate-750 text-slate-300 py-3 rounded-2xl transition-all active:scale-95 border border-white/5 flex items-center justify-center cursor-pointer shadow-[2px_3px_6px_rgba(0,0,0,0.35),inset_1px_1px_2px_rgba(255,255,255,0.12),inset_-1px_-1px_2px_rgba(0,0,0,0.4)]"
                title="Backspace"
              >
                <Delete className="w-4 h-4 text-slate-300" />
              </button>
              <button
                type="button"
                onClick={handleEvaluate}
                className="bg-emerald-600 hover:bg-emerald-550 text-white text-lg font-black py-3 rounded-2xl transition-all active:scale-95 cursor-pointer shadow-[2px_3px_8px_rgba(16,185,129,0.4),inset_1px_1px_2px_rgba(255,255,255,0.35),inset_-1px_-1px_2px_rgba(0,0,0,0.3)]"
              >
                =
              </button>
            </div>

            {/* Bottom Actions */}
            <div className="flex gap-2.5 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleClear}
                className="flex-1 bg-slate-800/90 hover:bg-slate-750 active:scale-95 text-slate-300 text-xs font-bold py-2.5 rounded-2xl transition-all cursor-pointer text-center shadow-[2px_3px_6px_rgba(0,0,0,0.3),inset_1px_1px_2px_rgba(255,255,255,0.1)]"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 clay-btn-success text-white text-xs font-black py-2.5 rounded-2xl transition-all active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Result
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
