/**
 * Page factory — bangun DOM halaman, atur ukuran, bersihkan.
 * Murni DOM manipulation; tidak memicu render canvas.
 */

import { state } from "@core/state";
import type { PageEntry, PageDims } from "@core/types";

/** Ukuran (dalam px) setelah rotation + scale diterapkan. */
export function rotatedSize(
  dim: PageDims,
  rotation: number,
  scale: number,
): { w: number; h: number } {
  const rot = ((rotation % 360) + 360) % 360;
  const w = rot === 90 || rot === 270 ? dim.h : dim.w;
  const h = rot === 90 || rot === 270 ? dim.w : dim.h;
  return { w: w * scale, h: h * scale };
}

export interface PageFactoryHooks {
  onPagePointerDown(pageNum: number, e: PointerEvent): void;
}

/**
 * Bangun seluruh page container di `pagesEl` berdasarkan `state.numPages`
 * dan `state.pageDims`. Mengisi `state.pages` dengan entry baru.
 */
export function buildPages(
  pagesEl: HTMLElement,
  hooks: PageFactoryHooks,
): void {
  pagesEl.innerHTML = "";
  state.pages = {};

  const frag = document.createDocumentFragment();

  for (let i = 1; i <= state.numPages; i++) {
    const dim = state.pageDims[i];
    if (!dim) continue;

    const container = document.createElement("div");
    container.className = "page-container";
    container.dataset.page = String(i);
    container.setAttribute("role", "region");
    container.setAttribute("aria-label", "Halaman " + i);

    container.innerHTML = `
      <div class="page-skeleton"><div class="spin"></div></div>
      <canvas class="page-canvas"></canvas>
      <div class="search-layer"></div>
      <div class="text-layer"></div>
      <div class="anno-layer"></div>
      <div class="form-layer"></div>
    `;

    const entry: PageEntry = {
      container,
      canvas: container.querySelector(".page-canvas") as HTMLCanvasElement,
      textLayer: container.querySelector(".text-layer") as HTMLDivElement,
      annoLayer: container.querySelector(".anno-layer") as HTMLDivElement,
      searchLayer: container.querySelector(".search-layer") as HTMLDivElement,
      formLayer: container.querySelector(".form-layer") as HTMLDivElement,
      viewport: null,
      baseW: dim.w,
      baseH: dim.h,
      renderTask: null,
      renderToken: 0,
      renderedScale: null,
      renderedRotation: null,
      status: "idle",
      formsRendered: false,
    };
    state.pages[i] = entry;

    container.addEventListener("pointerdown", (e) =>
      hooks.onPagePointerDown(i, e),
    );

    frag.appendChild(container);
  }

  pagesEl.appendChild(frag);
  layoutPages();
  pagesEl.dataset.tool = state.tool;
}

/**
 * Terapkan ukuran container sesuai `state.scale` & `state.rotation`.
 * Tidak memicu re-render canvas.
 */
export function layoutPages(): void {
  for (let i = 1; i <= state.numPages; i++) {
    const entry = state.pages[i];
    const dim = state.pageDims[i];
    if (!entry || !dim) continue;
    const { w, h } = rotatedSize(dim, state.rotation, state.scale);
    entry.container.style.width = w + "px";
    entry.container.style.height = h + "px";
  }
}

/** Bersihkan semua page container dari DOM + kosongkan `state.pages`. */
export function clearPages(pagesEl: HTMLElement): void {
  pagesEl.innerHTML = "";
  state.pages = {};
}
