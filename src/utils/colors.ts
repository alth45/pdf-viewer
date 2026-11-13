/**
 * Color conversion helpers.
 * Semua nilai channel dinormalisasi ke range [0, 1] untuk kompatibilitas pdf-lib.
 */

export interface Rgb01 {
  r: number;
  g: number;
  b: number;
}

/** Parse hex (#rgb atau #rrggbb) → { r, g, b } di range [0, 1]. */
export function hexToRgb01(hex: string): Rgb01 {
  const h = hex.replace(/^#/, "");
  const channels =
    h.length === 3
      ? h.split("").map((c) => parseInt(c + c, 16))
      : [
          parseInt(h.slice(0, 2), 16),
          parseInt(h.slice(2, 4), 16),
          parseInt(h.slice(4, 6), 16),
        ];
  return { r: channels[0] / 255, g: channels[1] / 255, b: channels[2] / 255 };
}

/** Ubah hex + alpha → string rgba() CSS. */
export function hexA(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb01(hex);
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${alpha})`;
}
