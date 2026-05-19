"use client";

import { useMemo } from "react";
import { Check, FileArchive, Sparkles } from "lucide-react";
import { PACKS } from "./PackSelector";
import type { Group } from "./PackSelector";

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
  const hasSelection = stats.selectedPacks.length > 0;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border bg-surface/40"
      style={{
        // Subtle radial accent in top-right corner for visual depth (no glassmorphism).
        backgroundImage:
          "radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, var(--accent) 8%, transparent), transparent 60%)",
      }}
    >
      {/* Header: ZIP filename preview — product-as-visual */}
      <div className="flex items-center gap-2.5 border-b border-border/70 px-5 py-3.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/10 text-accent">
          <FileArchive size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-mono text-foreground/85">
            your_artwork_print_sizes.zip
          </p>
          <p className="text-[11px] text-foreground/40 tabular-nums">
            {hasSelection
              ? `${stats.totalSizes} ${stats.totalSizes === 1 ? "file" : "files"} · ${stats.selectedPacks.length} ${stats.selectedPacks.length === 1 ? "pack" : "packs"}`
              : "no packs selected"}
          </p>
        </div>
      </div>

      {/* Body: grouped preview rows (per selected pack) or empty-state */}
      <div className="px-5 py-4">
        {!hasSelection ? (
          <EmptyState />
        ) : (
          <ul className="space-y-3.5">
            {stats.selectedPacks.map((pack) => (
              <PackPreviewRow key={pack.key} pack={pack} />
            ))}
          </ul>
        )}
      </div>

      {/* Footer: trust strip + ready hint */}
      <div className="border-t border-border/70 px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11px] text-foreground/45">
          <span className="flex items-center gap-1">
            <Check size={11} className="text-accent/80" />
            300 DPI
          </span>
          <span className="text-foreground/15">/</span>
          <span className="flex items-center gap-1">
            <Check size={11} className="text-accent/80" />
            Print-ready
          </span>
          <span className="text-foreground/15">/</span>
          <span className="flex items-center gap-1">
            <Check size={11} className="text-accent/80" />
            Instant ZIP
          </span>
        </div>
        {ready && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-accent-light">
            <Sparkles size={12} />
            Ready to export
          </p>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-start gap-2 py-3">
      <p className="text-sm leading-relaxed text-foreground/55">
        Select packs on the left to assemble your export.
      </p>
      <p className="text-xs text-foreground/35">
        Each ratio gets its own folder inside the ZIP.
      </p>
    </div>
  );
}

function PackPreviewRow({ pack }: { pack: (typeof PACKS)[number] }) {
  const ratio = ratioForPack(pack.key);
  const baseSize = 56;
  return (
    <li className="flex items-center gap-4">
      {/* Visual: ratio rectangle */}
      <div className="flex h-14 w-14 shrink-0 items-end justify-center">
        <div
          className="rounded-[4px] border border-foreground/20 bg-foreground/[0.04]"
          style={{
            width: `${ratio.w * baseSize}px`,
            height: `${ratio.h * baseSize}px`,
          }}
          aria-hidden
        />
      </div>
      {/* Text: pack label + sizes list */}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground/75">{pack.label}</p>
        <p className="mt-0.5 truncate text-[11px] text-foreground/40 tabular-nums">
          {pack.sizes.join(", ")}
        </p>
      </div>
    </li>
  );
}

function ratioForPack(key: Group): { w: number; h: number } {
  switch (key) {
    case "2x3":
      return { w: 2 / 3, h: 1 };
    case "3x4":
      return { w: 3 / 4, h: 1 };
    case "4x5":
      return { w: 4 / 5, h: 1 };
    case "iso":
      return { w: 1 / Math.SQRT2, h: 1 };
    case "extras":
      return { w: 0.78, h: 1 };
    default:
      return { w: 1, h: 1 };
  }
}
