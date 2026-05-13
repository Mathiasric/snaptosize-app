import type { Orientation } from "../../lib/size-catalog";

export interface PackTemplate {
  id: string;
  name: string;
  description: string;
  orientation: Orientation;
  sizes: string[];
}

export const TEMPLATES: PackTemplate[] = [
  {
    id: "etsy-bestsellers",
    name: "Etsy Bestsellers",
    description: "Top-selling sizes US & EU buyers expect. Frame-fit at Target, Michaels, Ikea.",
    orientation: "Portrait",
    sizes: ["5x7", "8x10", "11x14", "16x20", "A4"],
  },
  {
    id: "square-print-set",
    name: "Square Print Set",
    description: "Most-popular square sizes for Instagram-aesthetic and minimalist art prints.",
    orientation: "Square",
    sizes: ["5x5", "8x8", "10x10", "12x12", "16x16"],
  },
  // Landscape Print Set hidden until Worker persists `orientation` field in KV.
  // Once Worker accepts/stores orientation in /custom-packs POST + returns it in GET,
  // re-enable this template entry.
  // {
  //   id: "landscape-print-set",
  //   name: "Landscape Print Set",
  //   description: "Wide formats for scenic photography and panoramic art.",
  //   orientation: "Landscape",
  //   sizes: ["5x7", "8x10", "11x14", "16x20", "A4"],
  // },
];

export function getTemplate(id: string): PackTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
