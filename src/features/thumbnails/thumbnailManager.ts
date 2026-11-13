/**
 * Thumbnail manager — render preview halaman di sidebar dengan
 * IntersectionObserver (lazy) + cache dataURL.
 *
 * Cache disimpan di `state.thumbCache`. Direset saat load dokumen baru.
 */

import { state } from "@core/state";
import { CONFIG } from "@core/config";

/* ---------- Hooks ---------- */
export interface ThumbnailHooks {
  gotoPage?: (n: number, smooth?: boolean) => void;
  getActivePage?: () => number;
}

let hooks: ThumbnailHooks = {};

export function initThumbnailManager(h: ThumbnailHooks = {}): void {
  hooks = h;
}

/* ---------- Build grid ---------- */
export function buildThumbnails(grid: HTMLElement): void {
  grid.innerHTML = "";

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        const n = Number(el.dataset.page);
        observer.unobserve(el);
        void renderThumb(n, el);
      }
    },
    { root: grid.parentElement, rootMargin: "200px" },
  );

  const active = hooks.getActivePage?.() ?? state.currentPage;

  for (let i = 1; i <= state.numPages; i++) {
    const dim = state.pageDims[i];
    if (!dim) continue;

    const el = document.createElement("div");
    el.className = "thumb" + (i === active ? " active" : "");
    el.dataset.page = String(i);
    el.style.aspectRatio = (dim.w / dim.h).toFixed(4);
    el.innerHTML = `<span class="thumb-skel">${i}</span><span class="thumb-num">${i}</span>`;
    el.addEventListener("click", () => hooks.gotoPage?.(i));

    grid.appendChild(el);
    observer.observe(el);
  }
}

/* ---------- Render satu thumbnail ---------- */
export async function renderThumb(n: number, el: HTMLElement): Promise<void> {
  try {
    if (state.thumbCache[n]) {
      paintThumb(el, n, state.thumbCache[n]);
      return;
    }
    if (!state.pdfDoc) return;

    const page = await state.pdfDoc.getPage(n);
    const v1 = page.getViewport({ scale: 1 });
    const scale = CONFIG.THUMB_WIDTH / v1.width;
    const vp = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp })
      .promise;

    const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
    state.thumbCache[n] = dataUrl;

    if (el.isConnected) paintThumb(el, n, dataUrl);
  } catch (err) {
    console.warn("thumbnail render gagal", n, err);
  }
}

function paintThumb(el: HTMLElement, n: number, dataUrl: string): void {
  el.innerHTML = "";
  const img = document.createElement("img");
  img.src = dataUrl;
  img.style.cssText = "width:100%;height:100%;object-fit:contain;display:block";
  el.appendChild(img);

  const num = document.createElement("span");
  num.className = "thumb-num";
  num.textContent = String(n);
  el.appendChild(num);
}

/* ---------- Highlight aktif ---------- */
export function highlightThumb(
  n: number,
  grid: HTMLElement,
  scrollIntoView = true,
): void {
  const thumbs = grid.querySelectorAll<HTMLElement>(".thumb");
  let active: HTMLElement | null = null;

  for (const t of thumbs) {
    const isActive = Number(t.dataset.page) === n;
    t.classList.toggle("active", isActive);
    if (isActive) active = t;
  }

  if (active && scrollIntoView && state.sidebarTab === "thumbs") {
    active.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

/* ---------- Cache reset (dipanggil saat load dokumen baru) ---------- */
export function clearThumbCache(): void {
  state.thumbCache = {};
}
