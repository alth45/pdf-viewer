/**
 * Topbar — wire semua tombol dan kontrol. Murni DOM wiring.
 * Setter untuk update visual state dipanggil dari App.
 */

import { $opt } from "@utils/dom";
import { CONFIG } from "@core/config";

export interface TopbarHooks {
  onToggleSidebar: () => void;
  onOpen: () => void;
  onOpenUrl: () => void;
  onPrev: () => void;
  onNext: () => void;
  onGotoPage: (n: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomPreset: (scale: number) => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  onRotate: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSearch: () => void;
  onThemeToggle: () => void;
  onFullscreen: () => void;
  onPrint: () => void;
  onMerge: () => void;
  onOCR: () => void;
  onSave: () => void;
  onOpenEmpty: () => void;
}

export function initTopbar(hooks: TopbarHooks): void {
  const bind = (id: string, fn: (() => void) | undefined): void => {
    $opt<HTMLButtonElement>(id)?.addEventListener("click", () => fn?.());
  };

  bind("#btnSidebar", () => hooks.onToggleSidebar());
  bind("#btnOpen", () => hooks.onOpen());
  bind("#btnUrl", () => hooks.onOpenUrl());
  bind("#btnPrev", () => hooks.onPrev());
  bind("#btnNext", () => hooks.onNext());
  bind("#btnZoomIn", () => hooks.onZoomIn());
  bind("#btnZoomOut", () => hooks.onZoomOut());
  bind("#btnFitWidth", () => hooks.onFitWidth());
  bind("#btnFitPage", () => hooks.onFitPage());
  bind("#btnRotate", () => hooks.onRotate());
  bind("#btnUndo", () => hooks.onUndo());
  bind("#btnRedo", () => hooks.onRedo());
  bind("#btnSearch", () => hooks.onSearch());
  bind("#btnTheme", () => hooks.onThemeToggle());
  bind("#btnFullscreen", () => hooks.onFullscreen());
  bind("#btnPrint", () => hooks.onPrint());
  bind("#btnMerge", () => hooks.onMerge());
  bind("#btnOCR", () => hooks.onOCR()); 
  bind("#btnSave", () => hooks.onSave());
  bind("#btnOpenEmpty", () => hooks.onOpenEmpty());

  // Page input
  const pageInput = $opt<HTMLInputElement>("#pageInput");
  pageInput?.addEventListener("change", () => {
    const n = Number(pageInput.value);
    if (!isNaN(n)) hooks.onGotoPage(n);
  });
  pageInput?.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      const n = Number(pageInput.value);
      if (!isNaN(n)) hooks.onGotoPage(n);
      pageInput.blur();
    }
  });

  // Zoom preset select
  const zoomSelect = $opt<HTMLSelectElement>("#zoomSelect");
  zoomSelect?.addEventListener("change", () => {
    const v = parseFloat(zoomSelect.value);
    if (v) hooks.onZoomPreset(v);
  });
}

/* ---------- Setters ---------- */
export function setFileInfo(name: string, meta: string): void {
  const nameEl = $opt("#fileName");
  const metaEl = $opt("#fileMeta");
  if (nameEl) {
    nameEl.textContent = name || "Belum ada file";
    (nameEl as HTMLElement).title = name;
  }
  if (metaEl) metaEl.textContent = meta || "Buka PDF untuk mulai";
}

export function setPageInfo(current: number, total: number): void {
  const input = $opt<HTMLInputElement>("#pageInput");
  const count = $opt("#pageCount");
  if (input) {
    input.max = String(total || 1);
    if (document.activeElement !== input) input.value = String(current);
  }
  if (count) count.textContent = "/ " + total;
}

export function setZoomPreset(scale: number): void {
  const zoomSelect = $opt<HTMLSelectElement>("#zoomSelect");
  if (!zoomSelect) return;

  const matching = CONFIG.ZOOM_PRESETS.find((p) => Math.abs(p - scale) < 0.01);

  if (matching !== undefined) {
    zoomSelect.value = String(matching);
    zoomSelect.querySelector("option[data-tmp]")?.remove();
    return;
  }

  let tmp = zoomSelect.querySelector<HTMLOptionElement>("option[data-tmp]");
  if (!tmp) {
    tmp = document.createElement("option");
    tmp.dataset.tmp = "1";
    zoomSelect.appendChild(tmp);
  }
  tmp.value = String(scale);
  tmp.textContent = Math.round(scale * 100) + "%";
  zoomSelect.value = String(scale);
}

export function setUndoRedo(canUndo: boolean, canRedo: boolean): void {
  const undo = $opt<HTMLButtonElement>("#btnUndo");
  const redo = $opt<HTMLButtonElement>("#btnRedo");
  if (undo) undo.disabled = !canUndo;
  if (redo) redo.disabled = !canRedo;
}

export function setSaveEnabled(enabled: boolean): void {
  const btn = $opt<HTMLButtonElement>("#btnSave");
  if (btn) btn.disabled = !enabled;
}

export function showEmptyState(show: boolean): void {
  const el = $opt<HTMLElement>("#emptyState");
  if (el) el.classList.toggle("hidden", !show);
}

/** Trigger klik search button dari shortcut Ctrl+F. */
export function triggerSearchButton(): void {
  $opt<HTMLButtonElement>("#btnSearch")?.click();
}
