"use client";

import { useMemo, useState } from "react";
import { X, Check, AlertTriangle } from "lucide-react";
import type { CustomPack } from "./types";
import { MAX_SIZES_PER_PACK, ZIP_SOFT_LIMIT_MB, ZIP_HARD_LIMIT_MB, estimatePackZipMb } from "./types";
import { SIZE_CATALOG, SQUARE_SIZES, type Orientation, type SizeEntry } from "../../lib/size-catalog";

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
  const estimatedMb = useMemo(() => estimatePackZipMb(Array.from(selected)), [selected]);
  const overSoft = estimatedMb >= ZIP_SOFT_LIMIT_MB;
  const overHard = estimatedMb >= ZIP_HARD_LIMIT_MB;

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
              className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30"
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
              <span className="text-xs text-foreground/40">
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

          {selected.size > 0 && (
            <div
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                overHard
                  ? "border-amber-500/40 bg-amber-500/5 text-amber-400"
                  : overSoft
                  ? "border-amber-500/30 bg-amber-500/5 text-amber-300/90"
                  : "border-border bg-background/30 text-foreground/50"
              }`}
            >
              {overHard && <AlertTriangle size={12} className="mt-0.5 shrink-0" />}
              <div>
                <p>
                  <span className="font-medium">Estimated ZIP:</span> ~{estimatedMb.toFixed(1)} MB
                  <span className="text-foreground/30"> · Etsy limit 20 MB</span>
                </p>
                {overHard && (
                  <p className="mt-0.5 text-amber-300/80">
                    Larger sizes will be auto-compressed by SnapToSize to fit Etsy&apos;s 20 MB limit. Quality may be slightly reduced on the biggest prints.
                  </p>
                )}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-foreground/50 hover:text-foreground/70"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
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
    sizes: g.sizes,
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
