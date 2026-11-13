/**
 * Progress bar di bawah topbar.
 * `null` → sembunyikan; `0..1` → tampilkan dengan width prosentase.
 */

import { $opt } from "@utils/dom";

let wrapEl: HTMLElement | null = null;
let barEl: HTMLElement | null = null;

function ensure(): boolean {
  if (!wrapEl || !wrapEl.isConnected) wrapEl = $opt("#progressWrap");
  if (!barEl || !barEl.isConnected) barEl = $opt("#progressBar");
  return wrapEl !== null && barEl !== null;
}

export function setProgress(fraction: number | null): void {
  if (!ensure() || !wrapEl || !barEl) return;

  if (fraction == null) {
    wrapEl.classList.remove("active");
    barEl.style.width = "0%";
    return;
  }

  wrapEl.classList.add("active");
  barEl.style.width = Math.round(fraction * 100) + "%";

  if (fraction >= 1) {
    setTimeout(() => wrapEl?.classList.remove("active"), 400);
  }
}
