"use client";

import { Check, FileImage, Sparkles, ImageIcon } from "lucide-react";
import type { SizeEntry, Orientation } from "../lib/size-catalog";
import { getOrientedDimensions } from "../lib/size-catalog";

interface Props {
  file: File | null;
  sizeEntry: SizeEntry | null;
  orientation: Orientation;
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

function sanitizeArtworkName(name: string): string {
  return stripExt(name).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function sizeIdForFilename(entry: SizeEntry, orientation: Orientation): string {
  // Mirrors getSizeLabel: ISO keeps ID, inches swap on landscape.
  if (orientation !== "Landscape") return entry.id;
  if (entry.id.startsWith("A")) return entry.id;
  const parts = entry.id.split("x");
  if (parts.length === 2) return `${parts[1]}x${parts[0]}`;
  return entry.id;
}

export function QuickExportPreviewPanel({ file, sizeEntry, orientation }: Props) {
  const artworkName = file ? sanitizeArtworkName(file.name) : "your_artwork";
  const hasSize = !!sizeEntry;
  const ready = !!file && hasSize;

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
          <FileImage size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-1.5 text-sm">
            {file ? (
              <span className="flex min-w-0 items-baseline gap-1.5">
                <ImageIcon size={11} className="shrink-0 self-center text-foreground/40" />
                <span className="truncate font-mono text-foreground/80">{file.name}</span>
              </span>
            ) : (
              <span className="font-mono text-foreground/55">your_artwork</span>
            )}
            <span className="text-foreground/30">→</span>
            <span className="tabular-nums text-foreground/55">
              {hasSize ? "1 JPG" : "—"}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] tabular-nums text-foreground/40">
            {hasSize ? "single print-ready file" : "no size selected"}
          </p>
        </div>
      </div>

      {/* Body: single size preview row, or empty state */}
      <div className="px-5 py-4">
        {!hasSize ? (
          <EmptyState />
        ) : (
          <SinglePreviewRow
            sizeEntry={sizeEntry}
            orientation={orientation}
            artworkName={artworkName}
          />
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
            Single JPG
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
          Pick a size on the left to preview your export.
        </p>
        <p className="mt-1 text-xs text-foreground/40">
          One size, one print-ready JPG — no pack.
        </p>
      </div>
    </div>
  );
}

function StackedFilesIllustration() {
  return (
    <div className="relative h-24 w-24" aria-hidden>
      <div
        className="absolute left-2 top-3 h-20 w-16 rounded-md border border-foreground/15 bg-foreground/[0.03]"
        style={{ transform: "rotate(-4deg)" }}
      />
      <div
        className="absolute left-4 top-0 h-20 w-16 rounded-md border border-accent/30 bg-accent/[0.06]"
        style={{ transform: "rotate(4deg)" }}
      />
    </div>
  );
}

function SinglePreviewRow({
  sizeEntry,
  orientation,
  artworkName,
}: {
  sizeEntry: SizeEntry;
  orientation: Orientation;
  artworkName: string;
}) {
  const { width, height } = getOrientedDimensions(sizeEntry, orientation);
  const ratio = width / height;
  // Fit inside a 56×56 box, longest axis = 52px
  const maxAxis = 52;
  const w = ratio >= 1 ? maxAxis : Math.round(maxAxis * ratio);
  const h = ratio >= 1 ? Math.round(maxAxis / ratio) : maxAxis;
  const fileId = sizeIdForFilename(sizeEntry, orientation);
  const fileName = `${artworkName}_${fileId}.jpg`;
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center">
        <div
          className="rounded-[4px] border border-foreground/20 bg-foreground/[0.04]"
          style={{ width: `${w}px`, height: `${h}px` }}
          aria-hidden
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[11px] text-foreground/65">{fileName}</p>
        <p className="mt-0.5 truncate text-[11px] tabular-nums text-foreground/40">
          {width}×{height} px · {orientation}
        </p>
      </div>
    </div>
  );
}
