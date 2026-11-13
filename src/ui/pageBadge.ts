/**
 * Badge halaman di pojok kanan-bawah viewer.
 */

import { $opt } from "@utils/dom";

let el: HTMLElement | null = null;

export function updatePageBadge(current: number, total: number): void {
  if (!el || !el.isConnected) el = $opt("#pageBadge");
  if (!el) return;
  el.textContent = `${current} / ${total || "–"}`;
}
