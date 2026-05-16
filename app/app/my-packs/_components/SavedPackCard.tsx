"use client";

import { Pencil, Trash2, RectangleVertical, RectangleHorizontal, Square as SquareIcon } from "lucide-react";
import type { CustomPack } from "./types";

function formatSizeLabel(sizeId: string, orientation: string): string {
  if (orientation !== "Landscape") return sizeId;
  if (sizeId.startsWith("A")) return sizeId;
  const parts = sizeId.split("x");
  if (parts.length === 2) return `${parts[1]}x${parts[0]}`;
  return sizeId;
}

function OrientationBadge({ orientation }: { orientation: string }) {
  const Icon =
    orientation === "Landscape"
      ? RectangleHorizontal
      : orientation === "Square"
      ? SquareIcon
      : RectangleVertical;
  return (
    <span
      title={orientation}
      className="shrink-0 inline-flex items-center rounded-md border border-border bg-background/40 p-1 text-foreground/45"
    >
      <Icon size={10} />
    </span>
  );
}

interface Props {
  pack: CustomPack;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

export function SavedPackCard({ pack, selected, onSelect, onEdit, onDelete, disabled }: Props) {
  const orientation = pack.orientation ?? "Portrait";
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={`group relative w-full rounded-xl border p-3 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
        selected
          ? "border-accent bg-accent/8 glow-purple"
          : "border-border bg-background/30 hover:border-foreground/20 hover:bg-background/50"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <div className="pr-12">
        <div className="flex items-center gap-1.5">
          <p
            className={`text-sm font-medium truncate ${
              selected ? "text-foreground" : "text-foreground/80"
            }`}
          >
            {pack.name}
          </p>
          <OrientationBadge orientation={orientation} />
        </div>
        <p className="mt-0.5 text-xs text-foreground/35 truncate">{pack.sizes.map((s) => formatSizeLabel(s, orientation)).join(", ")}</p>
      </div>

      <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          disabled={disabled}
          className="rounded p-1 text-foreground/40 hover:bg-surface hover:text-foreground/70"
          aria-label="Edit"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={disabled}
          className="rounded p-1 text-foreground/40 hover:bg-surface hover:text-red-400"
          aria-label="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </button>
  );
}
