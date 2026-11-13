/**
 * Outline (bookmark) manager — bangun tree rekursif di sidebar.
 * Resolve destination ke nomor halaman via pdfjs API.
 */

import { state } from "@core/state";
import type { PDFDocumentProxy } from "@core/types";

/* ---------- Hooks ---------- */
export interface OutlineHooks {
  gotoPage?: (n: number, smooth?: boolean) => void;
}

let hooks: OutlineHooks = {};

export function initOutlineManager(h: OutlineHooks = {}): void {
  hooks = h;
}

/* ---------- Build ---------- */
export async function buildOutline(container: HTMLElement): Promise<void> {
  container.innerHTML = "";

  if (!state.pdfDoc) {
    container.innerHTML = '<div class="empty-hint">Belum ada dokumen</div>';
    return;
  }

  let outline: Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>;
  try {
    outline = await state.pdfDoc.getOutline();
  } catch {
    container.innerHTML =
      '<div class="empty-hint">Gagal membaca outline.</div>';
    return;
  }

  if (!outline || !outline.length) {
    container.innerHTML =
      '<div class="empty-hint">Dokumen ini tidak memiliki outline.</div>';
    return;
  }

  container.appendChild(renderItems(outline, 0));
}

/* ---------- Recursive renderer ---------- */
type OutlineItem = {
  title?: string;
  dest?: string | unknown[] | null;
  items?: OutlineItem[];
};

function renderItems(items: OutlineItem[], depth: number): DocumentFragment {
  const frag = document.createDocumentFragment();

  for (const item of items) {
    const el = document.createElement("div");
    el.className = "outline-item";
    el.style.paddingLeft = `${8 + depth * 14}px`;
    el.textContent = item.title || "(tanpa judul)";
    el.title = item.title ?? "";

    el.addEventListener("click", async () => {
      const pageNum = await resolveDest(item.dest);
      if (pageNum) hooks.gotoPage?.(pageNum);
    });

    frag.appendChild(el);

    if (item.items && item.items.length) {
      frag.appendChild(renderItems(item.items, depth + 1));
    }
  }

  return frag;
}

/* ---------- Destination resolution ---------- */
export async function resolveDest(
  dest: string | unknown[] | null | undefined,
): Promise<number | null> {
  if (!dest || !state.pdfDoc) return null;
  try {
    let d: unknown = dest;
    if (typeof d === "string") d = await state.pdfDoc.getDestination(d);
    if (!Array.isArray(d) || !d.length) return null;
    const ref = d[0];
    if (typeof ref === "number") return ref + 1;
    const idx = await state.pdfDoc.getPageIndex(ref);
    return idx + 1;
  } catch {
    return null;
  }
}
