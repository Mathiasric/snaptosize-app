"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X, ImageIcon, Maximize2 } from "lucide-react";
import { usePostHog } from "posthog-js/react";

// Runner (Pillow) reliably handles only these. Block others (HEIC/AVIF/TIFF…)
// up front instead of accepting then failing the export at the runner.
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
function isSupportedImage(f: File): boolean {
  if (SUPPORTED_IMAGE_TYPES.includes(f.type)) return true;
  // Some OSes report an empty/odd MIME for valid files — trust the extension.
  return /\.(jpe?g|png|webp)$/i.test(f.name);
}

interface UploadZoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled: boolean;
  isPro?: boolean;
  /** Compact variant: reduced vertical padding for sidebar/secondary placements */
  compact?: boolean;
}

export function UploadZone({ file, onFileChange, disabled, isPro = false, compact = false }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const posthog = usePostHog();

  const handleFile = useCallback(
    (f: File | null) => {
      if (preview) URL.revokeObjectURL(preview);
      if (f && isSupportedImage(f)) {
        setFormatError(null);
        setPreview(URL.createObjectURL(f));
        onFileChange(f);
      } else {
        setPreview(null);
        onFileChange(null);
        setFormatError(f ? "Use a JPG, PNG, or WEBP file." : null);
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
        <label className="mb-2 block text-sm font-medium text-foreground/75">
          Image
        </label>
        <div className="relative overflow-hidden rounded-xl border border-border">
          <div className="flex items-stretch">
            {/* Left: thumb preview (click to zoom) */}
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="group relative grid w-32 shrink-0 cursor-pointer place-items-center p-2 sm:w-40"
              style={{
                background:
                  "radial-gradient(ellipse at center, #12101a 0%, #0b0b0f 100%)",
              }}
              aria-label="Zoom preview"
            >
              <img
                src={preview}
                alt="Preview"
                style={{ maxHeight: "120px" }}
                className="h-auto w-auto max-w-full rounded object-contain object-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
              />
              <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] text-white/55 opacity-0 transition-opacity group-hover:opacity-100">
                <Maximize2 size={9} />
                Zoom
              </span>
            </button>

            {/* Middle: filename + size + watermark notice */}
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 border-l border-border/50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <ImageIcon size={13} className="shrink-0 text-foreground/40" />
                <span className="truncate font-medium text-foreground/80">
                  {file.name}
                </span>
              </div>
              <p className="text-xs tabular-nums text-foreground/40">
                {formatSize(file.size)}
              </p>
              {!isPro && (
                <a
                  href="/app/billing?source=watermark-preview"
                  onClick={() =>
                    posthog?.capture("watermark_remove_clicked", {
                      source: "upload_zone",
                    })
                  }
                  className="mt-0.5 inline-flex items-center gap-1 self-start text-[10px] font-medium text-foreground/40 transition-colors hover:text-accent-light"
                >
                  <span className="text-foreground/25">Free: includes watermark</span>
                  <span className="text-accent-light">&middot; Remove</span>
                </a>
              )}
            </div>

            {/* Right: remove button */}
            {!disabled && (
              <button
                onClick={handleRemove}
                aria-label="Remove image"
                className="flex shrink-0 items-center justify-center border-l border-border/50 px-3 text-foreground/40 transition-colors hover:bg-error/10 hover:text-error"
              >
                <X size={16} />
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
      <label className="mb-2 block text-sm font-medium text-foreground/75">
        Image
      </label>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload image — drag and drop or click to browse"
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed ${compact ? "py-7" : "py-12"} transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
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
          <p className="mt-1.5 text-[11px] text-foreground/25">JPG, JPEG, PNG, or WEBP</p>
          {formatError && (
            <p className="mt-1.5 text-xs font-medium text-amber-300">{formatError}</p>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          disabled={disabled}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  );
}
