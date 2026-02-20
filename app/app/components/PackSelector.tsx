"use client";

import { Package, Check } from "lucide-react";

export type Group = "2x3" | "3x4" | "4x5" | "iso" | "extras";

export interface PackConfig {
  key: Group;
  label: string;
  sizes: string[];
}

export const PACKS: PackConfig[] = [
  { key: "2x3", label: "2\u00d73 Ratio", sizes: ["4x6", "6x9", "8x12", "10x15", "12x18", "16x24", "20x30", "24x36"] },
  { key: "3x4", label: "3\u00d74 Ratio", sizes: ["6x8", "9x12", "12x16", "15x20", "18x24", "24x32"] },
  { key: "4x5", label: "4\u00d75 Ratio", sizes: ["8x10", "12x15", "16x20", "20x25", "24x30"] },
  { key: "iso", label: "ISO A-Series", sizes: ["A5", "A4", "A3", "A2", "A1"] },
  { key: "extras", label: "Common Sizes", sizes: ["5x7", "8.5x11", "11x14", "20x24"] },
];

export const ALL_KEYS = PACKS.map((p) => p.key);

interface PackSelectorProps {
  selected: Record<Group, boolean>;
  onToggle: (group: Group, value: boolean) => void;
  onSelectAll: (value: boolean) => void;
  disabled: boolean;
}

export function PackSelector({ selected, onToggle, onSelectAll, disabled }: PackSelectorProps) {
  const allSelected = ALL_KEYS.every((k) => selected[k]);
  const noneSelected = ALL_KEYS.every((k) => !selected[k]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
          Packs
        </label>
        <div className="flex gap-2">
          <button
            disabled={disabled || allSelected}
            onClick={() => onSelectAll(true)}
            className="text-xs text-foreground/40 transition-colors hover:text-accent-light disabled:opacity-30"
          >
            Select all
          </button>
          <span className="text-foreground/20">|</span>
          <button
            disabled={disabled || noneSelected}
            onClick={() => onSelectAll(false)}
            className="text-xs text-foreground/40 transition-colors hover:text-accent-light disabled:opacity-30"
          >
            Deselect all
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {PACKS.map((pack) => {
          const isSelected = selected[pack.key];
          return (
            <button
              key={pack.key}
              disabled={disabled}
              onClick={() => onToggle(pack.key, !isSelected)}
              className={`relative rounded-xl border p-3 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1 focus-visible:ring-offset-surface ${
                isSelected
                  ? "border-accent bg-accent/8 glow-purple"
                  : "border-border bg-background/30 hover:border-foreground/20 hover:bg-background/50"
              } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
            >
              {isSelected && (
                <div className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent">
                  <Check size={10} className="text-white" strokeWidth={3} />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Package
                  size={14}
                  className={isSelected ? "text-accent-light" : "text-foreground/30"}
                />
                <span
                  className={`text-sm font-medium ${
                    isSelected ? "text-foreground" : "text-foreground/70"
                  }`}
                >
                  {pack.label}
                </span>
              </div>
              <p className="mt-1 pl-[22px] text-xs text-foreground/35">
                {pack.sizes.join(", ")}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
