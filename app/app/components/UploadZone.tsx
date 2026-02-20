"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X, ImageIcon, Maximize2 } from "lucide-react";

interface UploadZoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled: boolean;
}

export function UploadZone({ file, onFileChange, disabled }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (f: File | null) => {
      if (preview) URL.revokeObjectURL(preview);
      if (f && f.type.startsWith("image/")) {
        setPreview(URL.createObjectURL(f));
        onFileChange(f);
      } else {
        setPreview(null);
        onFileChange(null);
      }
    },
    [onFileChange, preview],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [disabled, handleFile],
  );

  const handleRemove = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    onFileChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Escape key closes modal
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  if (file && preview) {
    return (
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-foreground/50">
          Image
        </label>
        <div className="relative rounded-xl border border-border">
          {/* Micro preview — click to zoom */}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="group relative grid w-full cursor-pointer place-items-center p-4"
            style={{
              background:
                "radial-gradient(ellipse at center, #12101a 0%, #0b0b0f 100%)",
              borderRadius: "0.75rem 0.75rem 0 0",
            }}
          >
            <img
              src={preview}
              alt="Preview"
              style={{ maxHeight: "280px" }}
              className="h-auto w-auto max-w-full rounded object-contain object-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
            />
            {/* Zoom hint */}
            <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-[10px] text-white/50 opacity-0 transition-opacity group-hover:opacity-100">
              <Maximize2 size={10} />
              Click to zoom
            </span>
          </button>

          {/* File info bar */}
          <div className="flex items-center justify-between border-t border-border/50 px-3 py-2">
            <div className="flex items-center gap-2 text-xs">
              <ImageIcon size={12} className="text-foreground/40" />
              <span className="max-w-[180px] truncate text-foreground/60">
                {file.name}
              </span>
              <span className="text-foreground/30">{formatSize(file.size)}</span>
            </div>
            {!disabled && (
              <button
                onClick={handleRemove}
                className="rounded-md p-1 text-foreground/40 transition-colors hover:bg-error/10 hover:text-error"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Zoom modal */}
        {modalOpen && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          >
            <div
              className="relative max-h-[90vh] max-w-[90vw]"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={preview}
                alt="Full preview"
                className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
              />
              <button
                onClick={() => setModalOpen(false)}
                className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-surface border border-border text-foreground/60 transition-colors hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-foreground/50">
        Image
      </label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 transition-all ${
          dragOver
            ? "border-accent bg-accent/5 glow-purple"
            : "border-border hover:border-foreground/20"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <Upload size={24} className="text-foreground/30" />
        <div className="text-center">
          <p className="text-sm text-foreground/60">
            Drag and drop your image here
          </p>
          <p className="mt-1 text-xs text-foreground/30">
            or click to browse
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          disabled={disabled}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  );
}
