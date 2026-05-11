"use client";

import { Pencil, Trash2 } from "lucide-react";
import { CustomPack } from "./types";

interface Props {
  pack: CustomPack;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

export function SavedPackCard({ pack, selected, onSelect, onEdit, onDelete, disabled }: Props) {
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
        <p className={`text-sm font-medium truncate ${selected ? "text-foreground" : "text-foreground/80"}`}>
          {pack.name}
        </p>
        <p className="mt-0.5 text-xs text-foreground/35 truncate">
          {pack.sizes.join(", ")}
        </p>
      </div>

      {/* Action buttons — visible on hover */}
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          disabled={disabled}
          className="rounded p-1 text-foreground/40 hover:bg-surface hover:text-foreground/70"
          aria-label="Rediger"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          disabled={disabled}
          className="rounded p-1 text-foreground/40 hover:bg-surface hover:text-red-400"
          aria-label="Slett"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </button>
  );
}
