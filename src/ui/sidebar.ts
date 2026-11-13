/**
 * Sidebar — tab switching, plus namespace-exports untuk area yang
 * di-render oleh fitur (thumbs, outline, search, anno list).
 */

import { $, $$, $opt } from "@utils/dom";
import type { Annotation } from "@core/types";

export type SidebarTab = "thumbs" | "outline" | "search" | "annos";

export interface SidebarHooks {
  onTabChange?: (tab: SidebarTab) => void;
  onAnnoSelect?: (id: string) => void;
}

let currentTab: SidebarTab = "thumbs";
let hookRef: SidebarHooks = {};

export function initSidebar(hooks: SidebarHooks = {}): void {
  hookRef = hooks;

  $$<HTMLButtonElement>("#sidebarTabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab as SidebarTab | undefined;
      if (!tab) return;
      activateTab(tab);
    });
  });
}

export function activateTab(tab: SidebarTab): void {
  currentTab = tab;

  $$<HTMLButtonElement>("#sidebarTabs button").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });

  $$<HTMLElement>(".side-panel").forEach((p) => {
    p.classList.toggle("active", p.id === `panel-${tab}`);
  });

  hookRef.onTabChange?.(tab);

  if (tab === "search") {
    setTimeout(() => $opt<HTMLInputElement>("#searchInput")?.focus(), 50);
  }
}

export function getActiveTab(): SidebarTab {
  return currentTab;
}

export function toggleSidebar(): boolean {
  const sidebar = $opt<HTMLElement>("#sidebar");
  if (!sidebar) return false;
  const willOpen = sidebar.classList.contains("hidden");
  sidebar.classList.toggle("hidden", !willOpen);
  return willOpen;
}

/* ---------- Container accessors (dipakai fitur via App) ---------- */
export function getThumbGrid(): HTMLElement {
  return $("#thumbGrid");
}
export function getOutlineTree(): HTMLElement {
  return $("#outlineTree");
}
export function getSearchResultsBox(): HTMLElement {
  return $("#searchResults");
}
export function getSearchInput(): HTMLInputElement {
  return $<HTMLInputElement>("#searchInput");
}
export function getSearchCaseCheckbox(): HTMLInputElement {
  return $<HTMLInputElement>("#searchCase");
}
export function getSearchCountEl(): HTMLElement {
  return $("#searchCount");
}
export function getAnnoListEl(): HTMLElement {
  return $("#annoList");
}

/* ---------- Render annotation list ---------- */
const TYPE_LABEL: Record<string, string> = {
  highlight: "Highlight",
  underline: "Underline",
  strike: "Strikethrough",
  note: "Catatan",
  draw: "Goresan",
  text: "Teks",
  signature: "Tanda tangan",
  image: "Gambar",
};

function escapeHtml(text: unknown): string {
  return String(text).replace(
    /[&<>"']/g,
    (ch) =>
      (
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }) as Record<string, string>
      )[ch],
  );
}

export function renderAnnotationList(annotations: Annotation[]): void {
  const box = getAnnoListEl();
  box.innerHTML = "";

  if (!annotations.length) {
    box.innerHTML = '<div class="empty-hint">Belum ada anotasi</div>';
    return;
  }

  const sorted = [...annotations].sort(
    (a, b) => a.pageNum - b.pageNum || a.createdAt - b.createdAt,
  );
  const frag = document.createDocumentFragment();

  for (const a of sorted) {
    const row = document.createElement("div");
    row.className = "anno-item-row";
    const label = TYPE_LABEL[a.type] ?? a.type;
    const preview = "text" in a && a.text ? a.text.slice(0, 42) : "";

    row.innerHTML =
      `<span class="sw" style="background:${a.color || "#ffeb3b"}"></span>` +
      `<span style="flex:1;min-width:0">` +
      `<div>${label}${preview ? " — " + escapeHtml(preview) : ""}</div>` +
      `<div class="meta">Halaman ${a.pageNum}</div>` +
      `</span>`;

    row.addEventListener("click", () => hookRef.onAnnoSelect?.(a.id));
    frag.appendChild(row);
  }
  box.appendChild(frag);
}
