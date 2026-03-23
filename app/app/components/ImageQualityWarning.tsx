"use client";

import { AlertTriangle } from "lucide-react";

interface ImageQualityWarningProps {
  imageWidth: number;
  imageHeight: number;
  /** Largest required width in pixels (at 300 DPI) */
  requiredWidth: number;
  /** Largest required height in pixels (at 300 DPI) */
  requiredHeight: number;
}

export function ImageQualityWarning({
  imageWidth,
  imageHeight,
  requiredWidth,
  requiredHeight,
}: ImageQualityWarningProps) {
  // Check if image is large enough in either orientation
  const fitsNormal = imageWidth >= requiredWidth && imageHeight >= requiredHeight;
  const fitsRotated = imageWidth >= requiredHeight && imageHeight >= requiredWidth;

  if (fitsNormal || fitsRotated) return null;

  const pctWidth = Math.round((imageWidth / requiredWidth) * 100);
  const pctHeight = Math.round((imageHeight / requiredHeight) * 100);
  const pct = Math.min(pctWidth, pctHeight);

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
      <div>
        <p className="text-xs font-medium text-amber-300">
          Low resolution — your image is {pct}% of recommended size
        </p>
        <p className="mt-0.5 text-xs text-amber-300/60">
          Your image ({imageWidth}&times;{imageHeight}px) may appear pixelated at larger print sizes.
          For best quality, use at least {requiredWidth}&times;{requiredHeight}px.
        </p>
      </div>
    </div>
  );
}
