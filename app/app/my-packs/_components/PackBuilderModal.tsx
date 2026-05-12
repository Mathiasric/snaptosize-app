"use client";

import { useState } from "react";
import { X, Check } from "lucide-react";
import { SIZE_CATEGORIES, CustomPack } from "./types";

interface Props {
  initial?: CustomPack;
  onSave: (name: string, sizes: string[], id?: string) => Promise<void>;
  onClose: () => void;
}

export function PackBuilderModal({ initial, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(initial?.sizes ?? []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggle(size: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(size)) next.delete(size);
      else if (next.size < 20) next.add(size);
      return next;
    });
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) { setError("Gi pakken et navn"); return; }
    if (selected.size === 0) { setError("Velg minst én størrelse"); return; }
    setSaving(true);
    setError("");
    try {
      await onSave(trimmed, Array.from(selected), initial?.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Noe gikk galt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">{initial ? "Rediger pakke" : "Ny pakke"}</h2>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground/70">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground/60">Pakkenavn</label>
            <input
              type="text"
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="f.eks. Etsy Bundle"
              className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30"
            />
          </div>

          {/* Size picker */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-foreground/60">Størrelser</label>
              <span className="text-xs text-foreground/40">{selected.size}/20 valgt</span>
            </div>
            <div className="space-y-3">
              {SIZE_CATEGORIES.map((cat) => (
                <div key={cat.label}>
                  <p className="mb-1.5 text-xs text-foreground/40">{cat.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.sizes.map((size) => {
                      const on = selected.has(size);
                      return (
                        <button
                          key={size}
                          onClick={() => toggle(size)}
                          disabled={!on && selected.size >= 20}
                          className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-30 ${
                            on
                              ? "border-accent bg-accent/10 text-foreground"
                              : "border-border bg-background/30 text-foreground/60 hover:border-foreground/20"
                          }`}
                        >
                          {on && <Check size={10} className="text-accent" strokeWidth={3} />}
                          {size}
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

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-foreground/50 hover:text-foreground/70"
          >
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Lagrer..." : "Lagre"}
          </button>
        </div>
      </div>
    </div>
  );
}
