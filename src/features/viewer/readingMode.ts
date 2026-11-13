/**
 * Reading mode controller — Normal / Sepia / Invert / Dark.
 *
 * Implementasi: CSS attribute selector pada `<html data-reading="...">`.
 * Filter hanya di `.page-canvas`, BUKAN di seluruh container —
 * agar anotasi & tanda tangan tidak ter-invert dan tetap terbaca.
 */

export type ReadingMode = "normal" | "sepia" | "invert" | "dark";

const STORAGE_KEY = "pdfviewer-reading-mode";
const MODES: readonly ReadingMode[] = ["normal", "sepia", "invert", "dark"];

let currentMode: ReadingMode = "normal";

export function getReadingMode(): ReadingMode {
  return currentMode;
}

export function getReadingModes(): readonly ReadingMode[] {
  return MODES;
}

export function initReadingMode(): void {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* localStorage disabled */
  }

  const mode: ReadingMode =
    saved && (MODES as readonly string[]).includes(saved)
      ? (saved as ReadingMode)
      : "normal";

  applyMode(mode);
}

export function setReadingMode(mode: ReadingMode): void {
  if (mode === currentMode) return;
  applyMode(mode);
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

function applyMode(mode: ReadingMode): void {
  currentMode = mode;
  document.documentElement.dataset.reading = mode;
}
