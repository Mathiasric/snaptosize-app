"use client";

import { Check, FileArchive, Sparkles, ImageIcon } from "lucide-react";
import type { CustomPack } from "./types";
import type { Orientation } from "../../lib/size-catalog";

interface Props {
  file: File | null;
  pack: CustomPack;
  labelForSize: (size: CustomPack["sizes"][number], orientation: Orientation) => string;
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

function sanitizeName(name: string): string {
  return stripExt(name).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function ratioForOrientation(orientation: Orientation): { w: number; h: number } {
  switch (orientation) {
    case "Portrait":
      return { w: 0.75, h: 1 };
    case "Landscape":
      return { w: 1, h: 0.75 };
    case "Square":
      return { w: 1, h: 1 };
    default:
      return { w: 1, h: 1 };
  }
}

export function MyPacksPreviewPanel({ file, pack, labelForSize }: Props) {
  const artworkName = file ? sanitizeName(file.name) : "your_artwork";
  const packSlug = sanitizeName(pack.name).toLowerCase();
  const zipName = `${artworkName}_${packSlug}.zip`;
  const ratio = ratioForOrientation(pack.orientation);
  const baseSize = 56;
  const ready = !!file;
  const sizeCount = pack.sizes.length;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-accent/15 bg-surface/40"
      style={{
        backgroundImage:
          "radial-gradient(140% 90% at 100% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 60%)",
      }}
    >
      {/* Header */}
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
              <span className="font-mono text-foreground/55">your_artwork</span>
            )}
            <span className="text-foreground/30">→</span>
            <span className="tabular-nums text-foreground/55">1 ZIP</span>
          </p>
          <p className="mt-0.5 text-[11px] tabular-nums text-foreground/40">
            {sizeCount} {sizeCount === 1 ? "file" : "files"} · {pack.orientation.toLowerCase()}
          </p>
        </div>
        <span className="rounded-md border border-border bg-background/40 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-foreground/50">
          {pack.orientation}
        </span>
      </div>

      {/* Body: pack preview row */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center">
            <div
              className="rounded-[4px] border border-foreground/20 bg-foreground/[0.04]"
              style={{
                width: `${ratio.w * baseSize}px`,
                height: `${ratio.h * baseSize}px`,
              }}
              aria-hidden
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[11px] text-foreground/65">{zipName}</p>
            <p className="mt-0.5 truncate text-[11px] tabular-nums text-foreground/40">
              {pack.sizes.map((s) => labelForSize(s, pack.orientation)).join(", ")}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
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
