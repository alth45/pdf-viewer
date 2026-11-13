/**
 * Reading mode menu — tombol topbar + popover menu.
 * Murni DOM wiring; state (mode aktif) dikelola `readingMode` feature.
 */

import { $opt } from "@utils/dom";
import type { ReadingMode } from "@features/viewer/readingMode";

export interface ReadingModeMenuHooks {
  getMode: () => ReadingMode;
  onSelect: (mode: ReadingMode) => void;
}

const LABELS: Record<ReadingMode, string> = {
  normal: "Normal",
  sepia: "Sepia",
  invert: "Invert",
  dark: "Gelap",
};

const ICONS: Record<ReadingMode, string> = {
  normal:
    '<circle cx="12" cy="12" r="4"/>' +
    '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  sepia:
    '<path d="M4 19.5V6a2 2 0 012-2h10a2 2 0 012 2v13.5"/>' +
    '<path d="M4 19.5a2 2 0 012-2h14"/>' +
    '<path d="M8 4v15"/>',
  invert: '<circle cx="12" cy="12" r="9"/>' + '<path d="M12 3v18"/>',
  dark: '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" fill="currentColor"/>',
};

let hooks: ReadingModeMenuHooks | null = null;
let btnEl: HTMLButtonElement | null = null;
let menuEl: HTMLElement | null = null;

export function initReadingModeMenu(h: ReadingModeMenuHooks): void {
  hooks = h;
  btnEl = $opt<HTMLButtonElement>("#btnReadingMode");
  menuEl = $opt<HTMLElement>("#readingModeMenu");
  if (!btnEl || !menuEl) return;

  buildMenu();

  btnEl.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  document.addEventListener("pointerdown", (e) => {
    if (!menuEl?.classList.contains("active")) return;
    const target = e.target as Node;
    if (menuEl.contains(target)) return;
    if (btnEl?.contains(target)) return;
    closeMenu();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menuEl?.classList.contains("active")) {
      e.stopPropagation();
      closeMenu();
    }
  });

  updateReadingModeUI(h.getMode());
}

/* ---------- Build ---------- */
function buildMenu(): void {
  if (!menuEl) return;
  menuEl.innerHTML = "";
  const modes: ReadingMode[] = ["normal", "sepia", "invert", "dark"];

  for (const m of modes) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "reading-menu-item";
    item.dataset.mode = m;
    item.setAttribute("aria-label", `Mode ${LABELS[m]}`);
    item.innerHTML =
      `<svg viewBox="0 0 24 24">${ICONS[m]}</svg>` +
      `<span>${LABELS[m]}</span>`;

    item.addEventListener("click", () => {
      hooks?.onSelect(m);
      closeMenu();
    });

    menuEl.appendChild(item);
  }
}

/* ---------- Sync UI ---------- */
export function updateReadingModeUI(mode: ReadingMode): void {
  if (btnEl) {
    const svg = btnEl.querySelector("svg");
    if (svg) svg.innerHTML = ICONS[mode];
    btnEl.title = `Mode baca: ${LABELS[mode]}`;
  }
  if (menuEl) {
    menuEl.querySelectorAll<HTMLElement>(".reading-menu-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.mode === mode);
    });
  }
}

/* ---------- Toggle menu ---------- */
function toggleMenu(): void {
  if (!menuEl) return;
  if (menuEl.classList.contains("active")) closeMenu();
  else openMenu();
}

function openMenu(): void {
  if (!menuEl || !btnEl) return;

  const btnRect = btnEl.getBoundingClientRect();
  const MENU_WIDTH = 170;
  const MENU_HEIGHT = 200;

  let top = btnRect.bottom + 6;
  let left = btnRect.right - MENU_WIDTH;

  // Flip ke atas kalau keluar layar bawah
  if (top + MENU_HEIGHT > window.innerHeight - 8) {
    top = btnRect.top - MENU_HEIGHT - 6;
  }
  // Clamp horizontal
  if (left < 8) left = 8;
  if (left + MENU_WIDTH > window.innerWidth - 8) {
    left = window.innerWidth - MENU_WIDTH - 8;
  }

  menuEl.style.position = "fixed";
  menuEl.style.top = top + "px";
  menuEl.style.left = left + "px";
  menuEl.style.right = "auto";
  menuEl.classList.add("active");
}

function closeMenu(): void {
  menuEl?.classList.remove("active");
}
