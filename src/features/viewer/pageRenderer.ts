/**
 * Page renderer — render canvas + text layer per halaman.
 * Token-based cancellation untuk mencegah race saat zoom/rotate cepat.
 * Komunikasi ke layer lain (annotations/search/forms) via `onPageRendered` hook.
 */

import * as pdfjsLib from "pdfjs-dist";
import { state } from "@core/state";
import { CONFIG } from "@core/config";
import type {
  PageEntry,
  PDFPageProxy,
  PageViewport,
  TextContent,
} from "@core/types";

type RenderedCallback = (pageNum: number) => void;

let onPageRendered: RenderedCallback | null = null;

/**
 * Hook yang dipanggil setiap canvas + text layer selesai di-render untuk
 * satu halaman. App me-wire ini untuk memicu render annotation/search/forms.
 */
export function setOnPageRendered(cb: RenderedCallback | null): void {
  onPageRendered = cb;
}

/**
 * Render satu halaman — cancel render sebelumnya jika ada.
 * Aman dipanggil berulang; token memastikan hanya render terbaru yang menang.
 */
export async function renderPage(n: number): Promise<void> {
  const entry = state.pages[n];
  if (!entry || !state.pdfDoc) return;

  const token = ++entry.renderToken;

  // Batalkan render sebelumnya pada canvas yang sama
  if (entry.renderTask) {
    try {
      entry.renderTask.cancel();
      await entry.renderTask.promise;
    } catch {
      /* cancellation → abaikan */
    }
    entry.renderTask = null;
    if (token !== entry.renderToken) return;
  }

  entry.status = "rendering";

  try {
    const page = await state.pdfDoc.getPage(n);
    if (token !== entry.renderToken) return;

    const viewport = page.getViewport({
      scale: state.scale,
      rotation: state.rotation,
    });
    const dpr = CONFIG.DPR;
    const renderViewport = page.getViewport({
      scale: state.scale * dpr,
      rotation: state.rotation,
    });

    const canvas = entry.canvas;
    canvas.width = Math.max(1, Math.floor(renderViewport.width));
    canvas.height = Math.max(1, Math.floor(renderViewport.height));
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const task = page.render({ canvasContext: ctx, viewport: renderViewport });
    entry.renderTask = task;
    await task.promise;
    if (token !== entry.renderToken) return;
    entry.renderTask = null;

    entry.viewport = viewport;
    entry.renderedScale = state.scale;
    entry.renderedRotation = state.rotation;
    entry.status = "done";

    await renderTextLayer(page, entry, viewport, token);
    if (token !== entry.renderToken) return;

    entry.container.classList.add("rendered");
    onPageRendered?.(n);
  } catch (err) {
    const name = (err as { name?: string } | null)?.name;
    if (name === "RenderingCancelledException" || name === "AbortException")
      return;
    console.error("renderPage gagal", n, err);
    entry.status = "done";
    entry.container.classList.add("rendered");
  }
}

/**
 * Bangun text layer manual dari `getTextContent()`, lengkap dengan
 * penyesuaian `scaleX` untuk teks horizontal agar seleksi akurat.
 */
async function renderTextLayer(
  page: PDFPageProxy,
  entry: PageEntry,
  viewport: PageViewport,
  token: number,
): Promise<void> {
  let tc: TextContent | undefined = state.textCache[page.pageNumber];
  if (!tc) {
    tc = await page.getTextContent();
    state.textCache[page.pageNumber] = tc;
  }
  if (token !== entry.renderToken) return;

  const layer = entry.textLayer;
  layer.innerHTML = "";

  const spans: HTMLSpanElement[] = [];
  const targets: number[] = [];
  const rots: number[] = [];

  for (const item of tc.items) {
    if (!("str" in item) || !item.str) continue;

    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const angle = Math.atan2(tx[1], tx[0]);
    const fontHeight = Math.hypot(tx[2], tx[3]);
    if (!isFinite(fontHeight) || fontHeight <= 0.5) continue;

    const span = document.createElement("span");
    span.textContent = item.str;

    const style = tc.styles[item.fontName];
    span.style.fontFamily = style?.fontFamily ?? "sans-serif";
    span.style.fontSize = fontHeight + "px";
    span.style.left = tx[4] + "px";
    span.style.top = tx[5] - fontHeight + "px";

    const rot = angle ? `rotate(${angle}rad)` : "";
    span.style.transform = rot || "none";
    span.style.transformOrigin = "0 0";

    layer.appendChild(span);
    spans.push(span);
    targets.push(Math.abs(item.width) * viewport.scale);
    rots.push(angle);
  }

  // Penyesuaian lebar horizontal — 2 pass untuk hindari layout thrash
  if (spans.length) {
    const widths = spans.map((s) => s.getBoundingClientRect().width);
    for (let i = 0; i < spans.length; i++) {
      if (Math.abs(rots[i]) > 0.01) continue;
      const natural = widths[i];
      const target = targets[i];
      if (natural > 0.5 && target > 0.5 && Math.abs(target - natural) > 1) {
        spans[i].style.transform = `scaleX(${(target / natural).toFixed(3)})`;
      }
    }
  }
}

/**
 * Pindai halaman yang terlihat di viewport (termasuk buffer) dan render
 * yang scale/rotation-nya sudah usang.
 */
export function renderVisiblePages(viewer: HTMLElement): void {
  if (!state.pdfDoc) return;
  const vr = viewer.getBoundingClientRect();
  const buf = CONFIG.PAGE_BUFFER_PX;

  for (let i = 1; i <= state.numPages; i++) {
    const entry = state.pages[i];
    if (!entry) continue;
    const r = entry.container.getBoundingClientRect();
    if (r.top > vr.bottom + buf) break;
    if (r.bottom < vr.top - buf) continue;
    if (
      entry.renderedScale !== state.scale ||
      entry.renderedRotation !== state.rotation
    ) {
      void renderPage(i);
    }
  }
}

/** Tandai semua halaman sebagai "butuh re-render" (mis. setelah rotate). */
export function invalidateAllRendered(): void {
  for (const key in state.pages) {
    const entry = state.pages[Number(key)];
    if (entry) entry.renderedScale = null;
  }
}
