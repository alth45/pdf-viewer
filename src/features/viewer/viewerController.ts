/**
 * Viewer controller — scale, zoom, rotation, navigation, scroll spy.
 * Mengubah `state` dan memicu `layoutPages` / `renderVisiblePages`.
 * UI updates (page input, badge, thumb highlight) lewat hooks.
 */

import { state } from "@core/state";
import { CONFIG } from "@core/config";
import { clamp } from "@utils/dom";
import { rotatedSize, layoutPages } from "./pageFactory";
import { renderVisiblePages, invalidateAllRendered } from "./pageRenderer";

export interface ViewerControllerHooks {
  onCurrentPageChanged?: (pageNum: number) => void;
  onScaleChanged?: (scale: number) => void;
}

export interface Anchor {
  page: number;
  frac: number;
}

let viewerEl: HTMLElement | null = null;
let hooks: ViewerControllerHooks = {};

/** Wajib dipanggil sekali sebelum fungsi lain. */
export function initViewerController(deps: {
  viewer: HTMLElement;
  hooks?: ViewerControllerHooks;
}): void {
  viewerEl = deps.viewer;
  hooks = deps.hooks ?? {};
  setupWheelZoom();
}

/* ---------- Scroll (spy + lazy render) ---------- */
let scrollPending = false;
export function onViewerScroll(): void {
  if (scrollPending) return;
  scrollPending = true;
  requestAnimationFrame(() => {
    scrollPending = false;
    if (viewerEl) renderVisiblePages(viewerEl);
    updateScrollSpy();
  });
}

/* ---------- Fit scale ---------- */
export function computeFitScale(mode: "width" | "page"): number {
  if (!viewerEl || !state.numPages) return 1;
  const dim = state.pageDims[state.currentPage] ?? state.pageDims[1];
  if (!dim) return 1;
  const { w, h } = rotatedSize(dim, state.rotation, 1);
  const availW = Math.max(120, viewerEl.clientWidth - 64);
  const availH = Math.max(120, viewerEl.clientHeight - 100);
  const s = mode === "width" ? availW / w : Math.min(availW / w, availH / h);
  return clamp(s, CONFIG.ZOOM_MIN, CONFIG.ZOOM_MAX);
}

/* ---------- Anchor preservation (untuk zoom) ---------- */
export function getAnchorAt(clientY?: number): Anchor {
  if (!viewerEl) return { page: state.currentPage, frac: 0.5 };
  const vr = viewerEl.getBoundingClientRect();
  const cy = clientY ?? vr.top + vr.height / 2;

  for (let i = 1; i <= state.numPages; i++) {
    const entry = state.pages[i];
    if (!entry) continue;
    const r = entry.container.getBoundingClientRect();
    if (r.top <= cy && r.bottom >= cy) {
      return { page: i, frac: (cy - r.top) / Math.max(1, r.height) };
    }
  }
  return { page: state.currentPage, frac: 0.5 };
}

export function restoreAnchor(anchor: Anchor): void {
  if (!viewerEl) return;
  const entry = state.pages[anchor.page];
  if (!entry) return;
  const vr = viewerEl.getBoundingClientRect();
  const r = entry.container.getBoundingClientRect();
  const cur = r.top + anchor.frac * r.height;
  const target = vr.top + vr.height / 2;
  viewerEl.scrollTop += cur - target;
}

/* ---------- Scale ---------- */
export interface SetScaleOptions {
  anchor?: Anchor;
  fitMode?: "width" | "page" | "none";
}

export function setScale(newScale: number, opts: SetScaleOptions = {}): void {
  newScale = clamp(newScale, CONFIG.ZOOM_MIN, CONFIG.ZOOM_MAX);
  if (Math.abs(newScale - state.scale) < 0.0005) return;

  const anchor = opts.anchor ?? getAnchorAt();
  state.scale = newScale;
  state.fitMode = opts.fitMode ?? "none";

  layoutPages();
  restoreAnchor(anchor);
  if (viewerEl) renderVisiblePages(viewerEl);
  hooks.onScaleChanged?.(state.scale);
}

export function zoomIn(): void {
  setScale(state.scale * CONFIG.ZOOM_STEP, { fitMode: "none" });
}

export function zoomOut(): void {
  setScale(state.scale / CONFIG.ZOOM_STEP, { fitMode: "none" });
}

export function fitWidth(): void {
  setScale(computeFitScale("width"), { fitMode: "width" });
}

export function fitPage(): void {
  setScale(computeFitScale("page"), { fitMode: "page" });
}

/* ---------- Rotasi ---------- */
export function rotate(delta = 90): void {
  state.rotation = (((state.rotation + delta) % 360) + 360) % 360;

  if (state.fitMode === "width") state.scale = computeFitScale("width");
  else if (state.fitMode === "page") state.scale = computeFitScale("page");

  layoutPages();
  invalidateAllRendered();
  if (viewerEl) renderVisiblePages(viewerEl);
  hooks.onScaleChanged?.(state.scale);
}

/* ---------- Navigasi halaman ---------- */
export function gotoPage(n: number, smooth = true): void {
  if (!viewerEl) return;
  n = clamp(Math.round(n), 1, state.numPages || 1);
  const entry = state.pages[n];
  if (!entry) return;

  const vr = viewerEl.getBoundingClientRect();
  const r = entry.container.getBoundingClientRect();
  const top = viewerEl.scrollTop + (r.top - vr.top) - 16;
  viewerEl.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });

  if (n !== state.currentPage) {
    state.currentPage = n;
    hooks.onCurrentPageChanged?.(n);
  }

  renderVisiblePages(viewerEl);
}

export function nextPage(): void {
  gotoPage(state.currentPage + 1);
}

export function prevPage(): void {
  gotoPage(state.currentPage - 1);
}

/* ---------- Scroll spy ---------- */
export function updateScrollSpy(): void {
  if (!viewerEl || !state.numPages) return;
  const vr = viewerEl.getBoundingClientRect();
  const mid = vr.top + vr.height * 0.4;

  let best = state.currentPage;
  let bestDist = Infinity;

  for (let i = 1; i <= state.numPages; i++) {
    const entry = state.pages[i];
    if (!entry) continue;
    const r = entry.container.getBoundingClientRect();
    if (r.bottom < vr.top - 200) continue;
    if (r.top > vr.bottom + 200) break;
    const d = Math.abs(r.top + r.height / 2 - mid);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }

  if (best !== state.currentPage) {
    state.currentPage = best;
    hooks.onCurrentPageChanged?.(best);
  }
}

/* ---------- Wheel zoom (Ctrl/Cmd) ---------- */
function setupWheelZoom(): void {
  if (!viewerEl) return;
  viewerEl.addEventListener(
    "wheel",
    (e) => {
      if (!state.pdfDoc) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const anchor = getAnchorAt(e.clientY);
      const factor = e.deltaY < 0 ? CONFIG.ZOOM_STEP : 1 / CONFIG.ZOOM_STEP;
      setScale(state.scale * factor, { anchor, fitMode: "none" });
    },
    { passive: false },
  );
}
