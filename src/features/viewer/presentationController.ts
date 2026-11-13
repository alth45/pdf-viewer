/**
 * Presentation mode controller.
 *
 * Menggabungkan dua konsep:
 * 1. Fullscreen API browser (jika didukung)
 * 2. Presentation CSS mode (sembunyikan topbar/sidebar/toolbar, fit-page)
 *
 * State selalu bisa dipulihkan:
 * - scale & fitMode sebelumnya disimpan
 * - exit via browser native ESC → terdeteksi via `fullscreenchange`
 */

import { state } from "@core/state";
import { fitPage, setScale } from "./viewerController";
import type { FitMode } from "@core/types";

/* ---------- State internal ---------- */
let isActive = false;
let prevScale = 1;
let prevFitMode: FitMode = "none";

/* ---------- Query ---------- */
export function isPresentationMode(): boolean {
  return isActive;
}

/* ---------- Enter ---------- */
export async function enterPresentationMode(): Promise<void> {
  if (isActive) return;
  isActive = true;

  // Simpan state untuk restore
  prevScale = state.scale;
  prevFitMode = state.fitMode;

  // Aktifkan CSS presentation mode dulu (UI hidden immediately)
  document.documentElement.classList.add("presentation-mode");

  // Coba masuk fullscreen API (best-effort; Safari iOS tidak support)
  try {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      await el.requestFullscreen();
    } else if ("webkitRequestFullscreen" in el) {
      await (
        el as unknown as { webkitRequestFullscreen: () => Promise<void> }
      ).webkitRequestFullscreen();
    }
  } catch {
    // Fullscreen gagal — tetap dalam presentation CSS mode
    // (bisa terjadi di iframe tanpa allowfullscreen, Safari iOS, dll.)
  }

  // Tunggu layout settle sebelum fit
  requestAnimationFrame(() => {
    requestAnimationFrame(() => fitPage());
  });
}

/* ---------- Exit ---------- */
export async function exitPresentationMode(): Promise<void> {
  if (!isActive) return;
  isActive = false;

  document.documentElement.classList.remove("presentation-mode");

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if ("webkitFullscreenElement" in document) {
      const doc = document as unknown as {
        webkitFullscreenElement: Element | null;
        webkitExitFullscreen: () => Promise<void>;
      };
      if (doc.webkitFullscreenElement) {
        await doc.webkitExitFullscreen();
      }
    }
  } catch {
    // ignore
  }

  restoreView();
}

/* ---------- Toggle ---------- */
export async function togglePresentationMode(): Promise<void> {
  if (isActive) await exitPresentationMode();
  else await enterPresentationMode();
}

/* ---------- Restore scale & fit mode ---------- */
function restoreView(): void {
  // setScale early-returns jika scale tidak berubah —
  // tangani kasus "scale sama tapi fitMode beda" secara eksplisit.
  if (Math.abs(state.scale - prevScale) < 0.0005) {
    state.fitMode = prevFitMode;
    return;
  }
  setScale(prevScale, { fitMode: prevFitMode });
}

/* ---------- Sync saat user keluar fullscreen via browser ---------- */
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && isActive) {
    // User menekan ESC native atau klik "Exit Fullscreen" browser UI
    void exitPresentationMode();
  }
});
