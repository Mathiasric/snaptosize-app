import type { Orientation } from "../../lib/size-catalog";

export interface CustomPack {
  id: string;
  name: string;
  sizes: string[];
  orientation: Orientation;
  createdAt: number;
}

export const MAX_SIZES_PER_PACK = 8;
export const MAX_PACKS_PER_USER = 10;
export const ZIP_SOFT_LIMIT_MB = 18;
export const ZIP_HARD_LIMIT_MB = 20;

/**
 * Conservative estimate of compressed JPG size at 300 DPI quality ~85.
 * Per square inch ≈ 0.03 MB after compression for typical photographic content.
 */
export function estimatePackZipMb(sizes: string[]): number {
  let totalSqIn = 0;
  for (const sizeId of sizes) {
    totalSqIn += squareInchesForSize(sizeId);
  }
  return Math.round(totalSqIn * 0.03 * 10) / 10;
}

/**
 * Best-effort derive orientation from sizes alone.
 * Returns "Square" if all sizes are W=H (e.g. 5x5, 8x8).
 * Otherwise returns null (orientation must come from explicit field).
 * Used as fallback when Worker doesn't persist the orientation field.
 */
export function deriveOrientationFromSizes(sizes: string[]): "Square" | null {
  if (sizes.length === 0) return null;
  for (const id of sizes) {
    if (id.startsWith("A")) return null; // ISO sizes are portrait by default
    const parts = id.split("x").map(parseFloat);
    if (parts.length !== 2 || parts.some((n) => isNaN(n))) return null;
    if (parts[0] !== parts[1]) return null;
  }
  return "Square";
}

function squareInchesForSize(sizeId: string): number {
  const iso: Record<string, number> = {
    A0: 33.1 * 46.8,
    A1: 23.4 * 33.1,
    A2: 16.5 * 23.4,
    A3: 11.7 * 16.5,
    A4: 8.3 * 11.7,
    A5: 5.8 * 8.3,
  };
  if (sizeId in iso) return iso[sizeId];

  const parts = sizeId.split("x").map((s) => parseFloat(s));
  if (parts.length === 2 && parts.every((n) => !isNaN(n))) {
    return parts[0] * parts[1];
  }
  return 0;
}
