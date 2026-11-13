/**
 * Konversi koordinat antara:
 * - **Viewport** (CSS px relatif ke page container, origin kiri-atas)
 * - **Normalized** (0..1 relatif ke page unrotated, origin kiri-atas)
 *
 * Normalized dipakai agar anotasi tetap valid saat zoom/rotate.
 */

import type { PageEntry, Point, Rect } from "@core/types";

/** Viewport px (relatif container) → koordinat ternormalisasi 0..1. */
export function viewportPointToNorm(
  px: number,
  py: number,
  entry: PageEntry,
): Point {
  if (!entry.viewport) return { x: 0, y: 0 };
  const [ux, uy] = entry.viewport.convertToPdfPoint(px, py);
  return { x: ux / entry.baseW, y: (entry.baseH - uy) / entry.baseH };
}

/** Koordinat ternormalisasi 0..1 → viewport px. */
export function normToViewport(
  nx: number,
  ny: number,
  entry: PageEntry,
): Point {
  if (!entry.viewport) return { x: 0, y: 0 };
  const ux = nx * entry.baseW;
  const uy = entry.baseH - ny * entry.baseH;
  const [vx, vy] = entry.viewport.convertToViewportPoint(ux, uy);
  return { x: vx, y: vy };
}

/** Rect ternormalisasi → rect viewport (bounding box, aman untuk rotasi 90°). */
export function normRectToViewport(rect: Rect, entry: PageEntry): Rect {
  const p1 = normToViewport(rect.x, rect.y, entry);
  const p2 = normToViewport(rect.x + rect.w, rect.y + rect.h, entry);
  return {
    x: Math.min(p1.x, p2.x),
    y: Math.min(p1.y, p2.y),
    w: Math.abs(p2.x - p1.x),
    h: Math.abs(p2.y - p1.y),
  };
}
