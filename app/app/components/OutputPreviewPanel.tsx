"use client";

import { useMemo } from "react";
import { Check, FileArchive, Sparkles, ImageIcon } from "lucide-react";
import { PACKS } from "./PackSelector";
import type { Group } from "./PackSelector";

interface Props {
  selectedGroups: Group[];
  file: File | null;
}

const GROUP_SUFFIX: Record<Group, string> = {
  "2x3": "2x3_print_sizes",
  "3x4": "3x4_print_sizes",
  "4x5": "4x5_print_sizes",
  iso: "iso_print_sizes",
  extras: "extras_print_sizes",
};

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

function sanitizeArtworkName(name: string): string {
  return stripExt(name).replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function OutputPreviewPanel({ selectedGroups, file }: Props) {
  const stats = useMemo(() => {
    const sel = selectedGroups
      .map((k) => PACKS.find((p) => p.key === k))
      .filter(Boolean) as (typeof PACKS)[number][];
    const totalSizes = sel.reduce((sum, p) => sum + p.sizes.length, 0);
    return { selectedPacks: sel, totalSizes };
  }, [selectedGroups]);

  const artworkName = file ? sanitizeArtworkName(file.name) : "your_artwork";
  const ready = !!file && stats.selectedPacks.length > 0;
  const hasSelection = stats.selectedPacks.length > 0;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-accent/15 bg-surface/40"
      style={{
        backgroundImage:
          "radial-gradient(140% 90% at 100% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 60%)",
      }}
    >
      {/* Header: source file → output count */}
      <div className="flex items-center gap-3 border-b border-border/70 px-5 py-3.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent">
          <FileArchive size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-1.5 text-sm">
            {file ? (
              <span className="flex min-w-0 items-baseline gap-1.5">
                <ImageIcon size={11} className="shrink-0 self-center text-foreground/40" />
                <span className="truncate font-mono text-foreground/80">{file.name}</span>
              </span>
            ) : (
              <span className="italic text-foreground/40">Your artwork</span>
            )}
            <span className="text-foreground/30">→</span>
            <span className="tabular-nums text-foreground/55">
              {hasSelection
                ? `${stats.selectedPacks.length} ZIP${stats.selectedPacks.length === 1 ? "" : "s"}`
                : "—"}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] tabular-nums text-foreground/40">
            {hasSelection
              ? `${stats.totalSizes} ${stats.totalSizes === 1 ? "file" : "files"} total`
              : "no packs selected"}
          </p>
        </div>
      </div>

      {/* Body: per-pack ZIP preview rows */}
      <div className="px-5 py-4">
        {!hasSelection ? (
          <EmptyState />
        ) : (
          <ul className="space-y-3.5">
            {stats.selectedPacks.map((pack) => (
              <PackPreviewRow key={pack.key} pack={pack} artworkName={artworkName} />
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
    <div className="flex flex-col items-center gap-4 py-6">
      <StackedFilesIllustration />
      <div className="text-center">
        <p className="text-sm leading-relaxed text-foreground/65">
          Select packs on the left to assemble your export.
        </p>
        <p className="mt-1 text-xs text-foreground/40">
          Each ratio is delivered as its own ZIP.
        </p>
      </div>
    </div>
  );
}

function StackedFilesIllustration() {
  // CSS-drawn stack of three rectangles, fanning slightly. Linear-style minimal art.
  return (
    <div className="relative h-24 w-28" aria-hidden>
      <div
        className="absolute left-1 top-4 h-20 w-14 rounded-md border border-foreground/15 bg-foreground/[0.03]"
        style={{ transform: "rotate(-6deg)" }}
      />
      <div
        className="absolute left-7 top-2 h-20 w-14 rounded-md border border-foreground/20 bg-foreground/[0.05]"
        style={{ transform: "rotate(2deg)" }}
      />
      <div
        className="absolute left-12 top-0 h-20 w-14 rounded-md border border-accent/30 bg-accent/[0.06]"
        style={{ transform: "rotate(8deg)" }}
      />
    </div>
  );
}

function PackPreviewRow({
  pack,
  artworkName,
}: {
  pack: (typeof PACKS)[number];
  artworkName: string;
}) {
  const ratio = ratioForPack(pack.key);
  const baseSize = 56;
  const zipName = `${artworkName}_${GROUP_SUFFIX[pack.key]}.zip`;
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
      {/* Text: ZIP filename + sizes list */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[11px] text-foreground/65">{zipName}</p>
        <p className="mt-0.5 truncate text-[11px] tabular-nums text-foreground/40">
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
