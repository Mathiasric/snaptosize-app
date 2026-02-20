export type CatalogGroup = "2x3" | "3x4" | "4x5" | "iso" | "extras";
export type Orientation = "Portrait" | "Landscape" | "Square";

export interface SizeEntry {
  /** Stable identifier sent to backend: "12x18", "A4", "8.5x11" */
  id: string;
  /** Width in px at 300 DPI (portrait) */
  widthPx: number;
  /** Height in px at 300 DPI (portrait) */
  heightPx: number;
  /** Friendly label for dropdown */
  label: string;
}

interface GroupDef {
  key: CatalogGroup;
  label: string;
  sizes: SizeEntry[];
}

const PPI = 300;
function inToPx(inches: number): number {
  return Math.round(inches * PPI);
}

function inchSize(w: number, h: number): SizeEntry {
  const id = `${w}x${h}`;
  const wpx = inToPx(w);
  const hpx = inToPx(h);
  return { id, widthPx: wpx, heightPx: hpx, label: `${id} in (${wpx}\u00d7${hpx})` };
}

function isoSize(name: string, wpx: number, hpx: number): SizeEntry {
  return { id: name, widthPx: wpx, heightPx: hpx, label: `${name} (${wpx}\u00d7${hpx})` };
}

export const SIZE_CATALOG: GroupDef[] = [
  {
    key: "2x3",
    label: "2\u00d73 Ratio",
    sizes: [
      inchSize(4, 6),
      inchSize(8, 12),
      inchSize(10, 15),
      inchSize(12, 18),
      inchSize(16, 24),
      inchSize(20, 30),
    ],
  },
  {
    key: "3x4",
    label: "3\u00d74 Ratio",
    sizes: [
      inchSize(6, 8),
      inchSize(9, 12),
      inchSize(12, 16),
      inchSize(15, 20),
      inchSize(18, 24),
    ],
  },
  {
    key: "4x5",
    label: "4\u00d75 Ratio",
    sizes: [
      inchSize(8, 10),
      inchSize(12, 15),
      inchSize(16, 20),
      inchSize(20, 25),
    ],
  },
  {
    key: "iso",
    label: "ISO A-Series",
    sizes: [
      isoSize("A5", 1748, 2480),
      isoSize("A4", 2480, 3508),
      isoSize("A3", 3508, 4961),
      isoSize("A2", 4961, 7016),
      isoSize("A1", 7016, 9933),
    ],
  },
  {
    key: "extras",
    label: "Common Sizes",
    sizes: [
      inchSize(5, 7),
      { id: "8.5x11", widthPx: inToPx(8.5), heightPx: inToPx(11), label: `8.5x11 in (${inToPx(8.5)}\u00d7${inToPx(11)})` },
      inchSize(11, 14),
      inchSize(16, 20),
      inchSize(20, 24),
    ],
  },
];

function squareSize(side: number): SizeEntry {
  const px = inToPx(side);
  return { id: `${side}x${side}`, widthPx: px, heightPx: px, label: `${side}x${side} in (${px}\u00d7${px})` };
}

export const SQUARE_SIZES: SizeEntry[] = [
  squareSize(8),
  squareSize(10),
  squareSize(12),
  squareSize(16),
  squareSize(20),
  squareSize(24),
];

export function getSizesForGroup(group: CatalogGroup | "SQUARE"): SizeEntry[] {
  if (group === "SQUARE") return SQUARE_SIZES;
  return SIZE_CATALOG.find((g) => g.key === group)?.sizes ?? [];
}

export function getOrientedDimensions(
  entry: SizeEntry,
  orientation: Orientation,
): { width: number; height: number } {
  if (orientation === "Landscape") {
    return { width: entry.heightPx, height: entry.widthPx };
  }
  return { width: entry.widthPx, height: entry.heightPx };
}

export function getSizeLabel(entry: SizeEntry, orientation: Orientation): string {
  if (orientation === "Square") {
    return entry.label;
  }
  const { width, height } = getOrientedDimensions(entry, orientation);
  if (entry.id.startsWith("A")) {
    return `${entry.id} (${width}\u00d7${height})`;
  }
  return `${entry.id} in (${width}\u00d7${height})`;
}
