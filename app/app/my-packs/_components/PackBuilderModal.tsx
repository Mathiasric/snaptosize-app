"use client";

import { useMemo, useState } from "react";
import { X, Check } from "lucide-react";
import type { CustomPack } from "./types";
import { MAX_SIZES_PER_PACK } from "./types";
import { SIZE_CATALOG, SQUARE_SIZES, type Orientation, type SizeEntry } from "../../lib/size-catalog";

// Sizes excluded from pack mode to prevent runner OOM on the 4GB Fly machine.
// Mirrors PACK_SIZES exclusions in runner/main.py. Still available for Quick Export
// (single mode resizes don't hit the same memory pressure).
const PACK_EXCLUDED_SIZE_IDS = new Set<string>(["24x32", "A0"]);

interface Props {
  initial?: CustomPack;
  onSave: (name: string, sizes: string[], orientation: Orientation, id?: string) => Promise<void>;
  onClose: () => void;
}

type OrientationOption = { value: Orientation; label: string };
const ORIENTATIONS: OrientationOption[] = [
  { value: "Portrait", label: "Portrait" },
  { value: "Landscape", label: "Landscape" },
  { value: "Square", label: "Square" },
];

export function PackBuilderModal({ initial, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [orientation, setOrientation] = useState<Orientation>(initial?.orientation ?? "Portrait");
  const [selected, setSelected] = useState<Set<string>>(new Set(initial?.sizes ?? []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const groups = useMemo(() => buildGroupsFor(orientation), [orientation]);

  function setOrientationKeepValid(next: Orientation) {
    if (next === orientation) return;
    // Drop sizes not valid in the new orientation
    const nextSizes = SQUARE_SIZES;
    const validIds = new Set(
      next === "Square"
        ? nextSizes.map((s) => s.id)
        : SIZE_CATALOG.flatMap((g) => g.sizes.map((s) => s.id)),
    );
    setSelected((prev) => new Set(Array.from(prev).filter((s) => validIds.has(s))));
    setOrientation(next);
    setError("");
  }

  function toggle(sizeId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sizeId)) next.delete(sizeId);
      else if (next.size < MAX_SIZES_PER_PACK) next.add(sizeId);
      return next;
    });
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) { setError("Give your pack a name"); return; }
    if (selected.size === 0) { setError("Pick at least one size"); return; }
    setSaving(true);
    setError("");
    try {
      await onSave(trimmed, Array.from(selected), orientation, initial?.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">{initial ? "Edit pack" : "New pack"}</h2>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground/70">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground/60">Pack name</label>
            <input
              type="text"
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Etsy Standard"
              className="w-full rounded-md border border-border bg-background/50 px-3 py-2 text-sm outline-none focus:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent/50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground/60">Orientation</label>
            <div className="flex gap-1">
              {ORIENTATIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setOrientationKeepValid(o.value)}
                  className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    orientation === o.value
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border bg-background/30 text-foreground/60 hover:border-foreground/20"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-foreground/60">Sizes</label>
              <span className="text-xs text-foreground/40 tabular-nums">
                {selected.size}/{MAX_SIZES_PER_PACK} selected
              </span>
            </div>
            <div className="space-y-3">
              {groups.map((cat) => (
                <div key={cat.label}>
                  <p className="mb-1.5 text-xs text-foreground/40">{cat.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.sizes.map((entry) => {
                      const on = selected.has(entry.id);
                      const atMax = !on && selected.size >= MAX_SIZES_PER_PACK;
                      return (
                        <button
                          key={entry.id}
                          onClick={() => toggle(entry.id)}
                          disabled={atMax}
                          className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                            on
                              ? "border-accent bg-accent/10 text-foreground"
                              : "border-border bg-background/30 text-foreground/60 hover:border-foreground/20"
                          }`}
                        >
                          {on && <Check size={10} className="text-accent" strokeWidth={3} />}
                          {labelFor(entry, orientation)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>


          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-foreground/50 hover:text-foreground/70 outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {saving ? "Saving..." : "Save pack"}
          </button>
        </div>
      </div>
    </div>
  );
}

function buildGroupsFor(orientation: Orientation): { label: string; sizes: SizeEntry[] }[] {
  if (orientation === "Square") {
    return [{ label: "Square Sizes", sizes: SQUARE_SIZES }];
  }
  return SIZE_CATALOG.map((g) => ({
    label: groupLabelFor(g.key, orientation),
    sizes: g.sizes.filter((s) => !PACK_EXCLUDED_SIZE_IDS.has(s.id)),
  }));
}

function groupLabelFor(key: string, orientation: Orientation): string {
  const swap = orientation === "Landscape";
  switch (key) {
    case "2x3":
      return swap ? "3×2 Ratio" : "2×3 Ratio";
    case "3x4":
      return swap ? "4×3 Ratio" : "3×4 Ratio";
    case "4x5":
      return swap ? "5×4 Ratio" : "4×5 Ratio";
    case "iso":
      return "ISO A-Series";
    case "extras":
      return "Common Sizes";
    default:
      return key;
  }
}

function labelFor(entry: SizeEntry, orientation: Orientation): string {
  if (orientation === "Square" || entry.id.startsWith("A")) return entry.id;
  if (orientation === "Landscape") {
    const parts = entry.id.split("x");
    if (parts.length === 2) return `${parts[1]}x${parts[0]}`;
  }
  return entry.id;
}
