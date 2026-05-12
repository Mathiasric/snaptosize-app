export interface CustomPack {
  id: string;
  name: string;
  sizes: string[];
  createdAt: number;
}

export const SIZE_CATEGORIES = [
  { label: "2×3 Ratio", sizes: ["4x6", "6x9", "8x12", "10x15", "12x18", "16x24", "20x30"] },
  { label: "3×4 Ratio", sizes: ["6x8", "9x12", "12x16", "15x20", "18x24"] },
  { label: "4×5 Ratio", sizes: ["8x10", "12x15", "16x20", "20x25", "24x30"] },
  { label: "ISO A-Series", sizes: ["A5", "A4", "A3", "A2", "A1"] },
  { label: "Common Sizes", sizes: ["5x7", "8.5x11", "11x14", "11x17", "13x19", "20x24"] },
] as const;
