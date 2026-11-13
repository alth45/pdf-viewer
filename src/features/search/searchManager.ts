/**
 * Search manager — scan text content semua halaman, render highlight overlay,
 * dan kelola navigasi antar hasil.
 *
 * State disimpan di `state.search`. UI (sidebar) menerima update lewat hook.
 */

import * as pdfjsLib from "pdfjs-dist";
import { state } from "@core/state";
import { CONFIG } from "@core/config";
import { clamp, escapeHtml } from "@utils/dom";
import type { SearchResult, TextContent } from "@core/types";

/* ---------- Hooks ---------- */
export interface SearchManagerHooks {
  onResultsChanged?: (results: SearchResult[], currentIndex: number) => void;
  onCountChanged?: (shown: number) => void;
  gotoPage?: (n: number, smooth?: boolean) => void;
}

let hooks: SearchManagerHooks = {};

export function initSearchManager(h: SearchManagerHooks = {}): void {
  hooks = h;
}

/* ---------- Query execution ---------- */
export async function runSearch(
  query: string,
  caseSensitive: boolean,
): Promise<void> {
  state.search.query = query;
  state.search.caseSensitive = caseSensitive;
  state.search.results = [];
  state.search.index = -1;

  if (!state.pdfDoc || !query.trim()) {
    clearSearchHighlights();
    hooks.onResultsChanged?.([], -1);
    hooks.onCountChanged?.(0);
    return;
  }

  hooks.onCountChanged?.(-1); // -1 = "searching…"

  const results: SearchResult[] = [];
  const needle = caseSensitive ? query : query.toLowerCase();

  for (let p = 1; p <= state.numPages; p++) {
    let tc: TextContent | undefined = state.textCache[p];
    if (!tc) {
      try {
        const page = await state.pdfDoc.getPage(p);
        tc = await page.getTextContent();
        state.textCache[p] = tc;
      } catch {
        continue;
      }
    }

    const items = tc.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!("str" in item) || !item.str) continue;
      const hay = caseSensitive ? item.str : item.str.toLowerCase();
      let from = 0;
      for (;;) {
        const idx = hay.indexOf(needle, from);
        if (idx < 0) break;
        results.push({
          pageNum: p,
          itemIndex: i,
          start: idx,
          end: idx + query.length,
          snippet: item.str,
        });
        from = idx + Math.max(1, query.length);
        if (results.length > CONFIG.MAX_SEARCH_RESULTS) break;
      }
      if (results.length > CONFIG.MAX_SEARCH_RESULTS) break;
    }
    if (results.length > CONFIG.MAX_SEARCH_RESULTS) break;
  }

  state.search.results = results;
  state.search.index = results.length ? 0 : -1;

  renderAllSearchHighlights();
  hooks.onResultsChanged?.(results, state.search.index);
  hooks.onCountChanged?.(results.length);

  if (results.length) focusSearchResult(0, true);
}

/* ---------- Navigation ---------- */
let lastFocusPage = 0;

export function focusSearchResult(index: number, noScroll = false): void {
  const { results } = state.search;
  if (!results.length) return;

  const prevPage = lastFocusPage;
  state.search.index = clamp(index, 0, results.length - 1);
  const r = results[state.search.index];

  // Re-render halaman sebelumnya (hapus "current" class) + halaman target
  if (prevPage && prevPage !== r.pageNum) renderSearchHighlights(prevPage);
  renderSearchHighlights(r.pageNum);
  lastFocusPage = r.pageNum;

  hooks.onResultsChanged?.(results, state.search.index);

  if (!noScroll) {
    hooks.gotoPage?.(r.pageNum, true);
  } else {
    state.currentPage = r.pageNum;
  }
}

export function nextSearchResult(): void {
  const total = state.search.results.length;
  if (!total) return;
  focusSearchResult((state.search.index + 1) % total);
}

export function prevSearchResult(): void {
  const total = state.search.results.length;
  if (!total) return;
  focusSearchResult((state.search.index - 1 + total) % total);
}

/* ---------- Highlight rendering ---------- */
export function renderSearchHighlights(pageNum: number): void {
  const entry = state.pages[pageNum];
  if (!entry) return;
  const layer = entry.searchLayer;
  layer.innerHTML = "";
  if (!entry.viewport) return;

  const { results, index } = state.search;
  if (!results.length) return;
  const tc = state.textCache[pageNum];
  if (!tc) return;

  results.forEach((r, i) => {
    if (r.pageNum !== pageNum) return;
    const item = tc.items[r.itemIndex];
    if (!item || !("transform" in item)) return;

    const tx = pdfjsLib.Util.transform(
      entry.viewport!.transform,
      item.transform,
    );
    const fontHeight = Math.hypot(tx[2], tx[3]);
    const totalW = Math.abs(item.width) * entry.viewport!.scale;
    const len = item.str.length || 1;
    const x = tx[4] + (r.start / len) * totalW;
    const y = tx[5] - fontHeight;
    const w = Math.max(2, ((r.end - r.start) / len) * totalW);

    const el = document.createElement("div");
    el.className = "search-hit" + (i === index ? " current" : "");
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.width = w + "px";
    el.style.height = fontHeight + "px";
    layer.appendChild(el);
  });
}

export function renderAllSearchHighlights(): void {
  for (let i = 1; i <= state.numPages; i++) renderSearchHighlights(i);
}

export function clearSearchHighlights(): void {
  for (const key in state.pages) {
    const entry = state.pages[Number(key)];
    if (entry) entry.searchLayer.innerHTML = "";
  }
  lastFocusPage = 0;
}

/* ---------- Reset ---------- */
export function clearSearch(): void {
  state.search = { query: "", results: [], index: -1, caseSensitive: false };
  clearSearchHighlights();
  hooks.onResultsChanged?.([], -1);
  hooks.onCountChanged?.(0);
}

/* ---------- Helper render list (dipakai sidebar) ---------- */
export interface SearchListOptions {
  maxItems?: number;
  onSelect?: (index: number) => void;
}

/**
 * Build daftar hasil pencarian ke `container`. Pure render — tidak
 * menyentuh state global; index aktif disuplai caller.
 */
export function renderSearchResultList(
  results: SearchResult[],
  currentIndex: number,
  container: HTMLElement,
  opts: SearchListOptions = {},
): void {
  container.innerHTML = "";
  if (!results.length) {
    if (state.search.query.trim()) {
      container.innerHTML = '<div class="empty-hint">Tidak ada hasil.</div>';
    }
    return;
  }

  const max = opts.maxItems ?? 400;
  const frag = document.createDocumentFragment();

  results.slice(0, max).forEach((r, i) => {
    const el = document.createElement("div");
    el.className = "result-item" + (i === currentIndex ? " active" : "");
    el.dataset.index = String(i);

    const before = r.snippet.slice(Math.max(0, r.start - 25), r.start);
    const match = r.snippet.slice(r.start, r.end);
    const after = r.snippet.slice(r.end, r.end + 35);

    el.innerHTML =
      `<div class="result-page">Hal. ${r.pageNum}</div>` +
      `<div class="result-snippet">${escapeHtml(before)}<mark>${escapeHtml(match)}</mark>${escapeHtml(after)}</div>`;

    el.addEventListener("click", () => opts.onSelect?.(i));
    frag.appendChild(el);
  });
  container.appendChild(frag);

  if (results.length > max) {
    const note = document.createElement("div");
    note.className = "empty-hint";
    note.textContent = `+${results.length - max} hasil lainnya…`;
    container.appendChild(note);
  }
}
