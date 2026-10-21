"use client";

import React, { useState } from "react";
import { X, CheckCircle2, Home, ShoppingBag, Tv, Layers, Navigation, Bus, HeartPulse, Shield, Book, Briefcase, Zap, Coffee } from "lucide-react";
import { BUCKET_LABELS, type BucketType } from "@/core/utils/bucketConfig";
import type { CategoryData } from "@/core/utils/categories";

export type { CategoryData };

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (category: CategoryData) => void;
}

const PRESET_COLORS = [
  "#1d4ed8", "#ea580c", "#059669", "#7c3aed", 
  "#dc2626", "#0891b2", "#c026d3", "#65a30d"
];

const PRESET_ICONS = [
  { name: "Home", icon: Home },
  { name: "ShoppingBag", icon: ShoppingBag },
  { name: "Tv", icon: Tv },
  { name: "Layers", icon: Layers },
  { name: "Navigation", icon: Navigation },
  { name: "Bus", icon: Bus },
  { name: "HeartPulse", icon: HeartPulse },
  { name: "Shield", icon: Shield },
  { name: "Book", icon: Book },
  { name: "Briefcase", icon: Briefcase },
  { name: "Zap", icon: Zap },
  { name: "Coffee", icon: Coffee }
];

export default function AddCategoryModal({
  isOpen,
  onClose,
  onSuccess,
}: AddCategoryModalProps) {
  const [type, setType] = useState<"expense" | "income">("expense");
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState("Layers");
  const [bucket, setBucket] = useState<BucketType>("needs");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newCategory: CategoryData = {
      id: Math.random().toString(36).substring(2, 9),
      name: name.trim(),
      type,
      color: selectedColor,
      iconName: selectedIcon,
      // Buckets are an expense-only concept; income is grouped by source.
      ...(type === "expense" ? { bucket } : {}),
    };

    if (onSuccess) onSuccess(newCategory);

    // Reset state
    setName("");
    setType("expense");
    setSelectedColor(PRESET_COLORS[0]);
    setSelectedIcon("Layers");
    setBucket("needs");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center p-0 md:p-4 animate-in fade-in duration-200">
      <div className="w-full bg-card border-t md:border border-border rounded-t-3xl md:rounded-2xl max-w-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom md:slide-in-from-bottom-0 md:zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex justify-between items-center bg-background-subtle">
          <div>
            <h3 className="text-lg font-black text-foreground">Custom Category</h3>
            <p className="text-xs font-semibold text-foreground-muted">Add a new tracking bucket to your ledger.</p>
          </div>
          <button
            onClick={onClose}
            className="text-icon-muted hover:text-icon-active p-1.5 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          {/* Type Toggle */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">Type</span>
            <div className="grid grid-cols-2 gap-2 p-1 bg-secondary rounded-xl relative">
              <button
                type="button"
                onClick={() => setType("expense")}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  type === "expense" ? "bg-card text-foreground shadow-sm" : "text-foreground-secondary hover:text-foreground"
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => setType("income")}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  type === "income" ? "bg-card text-foreground shadow-sm" : "text-foreground-secondary hover:text-foreground"
                }`}
              >
                Income
              </button>
            </div>
          </div>

          {/* Bucket — expense only; drives the 50/30/20 Money Rule split */}
          {type === "expense" && (
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">Counts Toward</span>
              <div className="grid grid-cols-3 gap-2 p-1 bg-secondary rounded-xl">
                {(Object.keys(BUCKET_LABELS) as BucketType[]).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBucket(b)}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                      bucket === b ? "bg-card text-foreground shadow-sm" : "text-foreground-secondary hover:text-foreground"
                    }`}
                  >
                    {BUCKET_LABELS[b]}
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-semibold text-foreground-muted">
                Which side of your 50/30/20 split this spending lands on.
              </p>
            </div>
          )}

          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">Category Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Subscriptions"
              className="input-base w-full"
              required
            />
          </div>

          {/* Color Matrix */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-foreground-secondary uppercase tracking-wider block">Visual Tint</span>
            <div className="flex flex-wrap gap-3">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${selectedColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                  style={{ backgroundColor: color }}
                >
                  {selectedColor === color && <CheckCircle2 className="w-4 h-4 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Icon Selector */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-foreground-secondary uppercase tracking-wider block">Symbol</span>
            <div className="grid grid-cols-6 gap-3">
              {PRESET_ICONS.map(({ name: iconName, icon: Icon }) => (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setSelectedIcon(iconName)}
                  className={`flex items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedIcon === iconName 
                      ? "bg-primary text-white border-transparent font-bold shadow-md scale-105" 
                      : "border-border-strong/40 bg-card text-foreground-secondary hover:bg-secondary/70 hover:text-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Create Category</button>
          </div>
        </form>
      </div>
    </div>
  );
}
