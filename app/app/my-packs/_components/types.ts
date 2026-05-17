import type { Orientation } from "../../lib/size-catalog";

export interface CustomPack {
  id: string;
  name: string;
  sizes: string[];
  orientation: Orientation;
  createdAt: number;
}

export const MAX_SIZES_PER_PACK = 7;
export const MAX_PACKS_PER_USER = 10;

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
