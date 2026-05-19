"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, X, Upload, Layers, Download } from "lucide-react";
import { PACKS } from "./PackSelector";
import type { Group } from "./PackSelector";

const ONBOARDING_KEY = "onboarding_dismissed";

interface Props {
  selectedGroups: Group[];
  fileSelected: boolean;
}

export function OutputPreviewPanel({ selectedGroups, fileSelected }: Props) {
  const stats = useMemo(() => {
    const sel = selectedGroups
      .map((k) => PACKS.find((p) => p.key === k))
      .filter(Boolean) as (typeof PACKS)[number][];
    const totalSizes = sel.reduce((sum, p) => sum + p.sizes.length, 0);
    return { selectedPacks: sel, totalSizes };
  }, [selectedGroups]);

  const ready = fileSelected && stats.selectedPacks.length > 0;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-surface/40 p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="text-sm font-medium text-foreground/75">Output preview</h3>
          {stats.totalSizes > 0 && (
            <span className="text-xs text-foreground/40 tabular-nums">
              {stats.totalSizes} {stats.totalSizes === 1 ? "size" : "sizes"} · {stats.selectedPacks.length} {stats.selectedPacks.length === 1 ? "pack" : "packs"}
            </span>
          )}
        </div>

        {stats.selectedPacks.length === 0 ? (
          <EmptyStateCopy />
        ) : (
          <RatioPreviewRow packs={stats.selectedPacks} />
        )}

        {/* Trust strip */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs text-foreground/40">
          <span className="flex items-center gap-1">
            <Check size={11} className="text-accent/70" /> 300 DPI
          </span>
          <span className="flex items-center gap-1">
            <Check size={11} className="text-accent/70" /> Print-ready
          </span>
          <span className="flex items-center gap-1">
            <Check size={11} className="text-accent/70" /> Instant ZIP
          </span>
        </div>

        {ready && (
          <p className="mt-3 text-xs font-medium text-accent-light">
            Ready to export — click Generate.
          </p>
        )}
      </div>

      <OnboardingHint />
    </div>
  );
}

function EmptyStateCopy() {
  return (
    <p className="text-xs text-foreground/40 leading-relaxed">
      Select packs on the left to see what your ZIP will include. Each size is delivered at print-shop quality.
    </p>
  );
}

function RatioPreviewRow({ packs }: { packs: (typeof PACKS)[number][] }) {
  // For each pack render one representative rectangle scaled to the pack's aspect ratio.
  // Baseline 30px on the long side.
  const baseSize = 30;
  return (
    <div className="flex h-9 items-end gap-3" aria-hidden>
      {packs.map((pack) => {
        const ratio = ratioForPack(pack.key);
        const w = ratio.w * baseSize;
        const h = ratio.h * baseSize;
        return (
          <div key={pack.key} className="flex flex-col items-center gap-1">
            <div
              className="rounded-[3px] border border-foreground/15 bg-foreground/5"
              style={{ width: `${w}px`, height: `${h}px` }}
            />
            <span className="text-[9px] uppercase tracking-wider text-foreground/30">
              {pack.key === "iso" ? "ISO" : pack.label.split(" ")[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ratioForPack(key: Group): { w: number; h: number } {
  // Portrait orientation, normalized so longest side = 1.
  switch (key) {
    case "2x3":
      return { w: 2 / 3, h: 1 };
    case "3x4":
      return { w: 3 / 4, h: 1 };
    case "4x5":
      return { w: 4 / 5, h: 1 };
    case "iso":
      return { w: 1 / Math.SQRT2, h: 1 }; // A-series 1:√2
    case "extras":
      return { w: 0.78, h: 1 }; // Mixed; show 11x14-ish as representative
    default:
      return { w: 1, h: 1 };
  }
}

// ---------------------------------------------------------------------------
// Onboarding hint — 3-step inline, dismissible, hides after first export
// ---------------------------------------------------------------------------

const steps = [
  { icon: Upload, label: "Upload artwork" },
  { icon: Layers, label: "Select sizes" },
  { icon: Download, label: "Download ZIP" },
];

function OnboardingHint() {
  const [dismissed, setDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(ONBOARDING_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  if (!mounted || dismissed) return null;

  return (
    <div className="relative rounded-xl border border-info/20 bg-info/[0.04] px-4 py-3">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded p-1 text-foreground/30 hover:text-foreground/60"
      >
        <X size={12} />
      </button>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-info/80">
        How it works
      </p>
      <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/65">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-foreground/20">→</span>}
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-info/15">
              <step.icon size={11} className="text-info" />
            </span>
            <span>{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
