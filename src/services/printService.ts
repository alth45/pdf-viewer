/**
 * Print service — render semua halaman ke canvas + composite annotations,
 * lalu panggil window.print() dengan print CSS.
 *
 * Kenapa rasterize ke <img> daripada print DOM langsung?
 * - Lazy render: hanya halaman visible yang punya canvas
 * - Konsistensi: positioning CSS antar browser saat print tidak reliable
 * - Annotations: DOM overlays perlu di-composite manual agar ikut tercetak
 */

import { state } from "@core/state";
import type { PageViewport } from "@core/types";

/** Resolution multiplier. 2 = ~144 DPI saat A4. */
const PRINT_SCALE = 2;

export interface PrintOptions {
  /** Progress 0..1 — dipanggil per halaman. */
  onProgress?: (fraction: number) => void;
}

/* --------------------------------------------------------------
   Public entry
   -------------------------------------------------------------- */
export async function printPDF(opts: PrintOptions = {}): Promise<void> {
  if (!state.pdfDoc) throw new Error("Tidak ada dokumen untuk di-print.");

  const container = ensurePrintContainer();
  container.innerHTML = "";

  try {
    const total = state.numPages;

    for (let i = 1; i <= total; i++) {
      opts.onProgress?.((i - 1) / total);
      const img = await renderPageForPrint(i);
      container.appendChild(img);
    }
    opts.onProgress?.(1);

    // Tunggu semua image benar-benar ter-decode
    const imgs = Array.from(
      container.querySelectorAll<HTMLImageElement>("img"),
    );
    await Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((r) => {
              img.onload = () => r();
              img.onerror = () => r();
            }),
      ),
    );

    // Beri waktu layout settle sebelum print dialog terbuka
    await new Promise((r) => setTimeout(r, 100));

    // Print blocking; cleanup setelah dialog ditutup
    await triggerPrint(container);
  } catch (err) {
    container.innerHTML = "";
    throw err;
  }
}

/* --------------------------------------------------------------
   Container management
   -------------------------------------------------------------- */
function ensurePrintContainer(): HTMLElement {
  let el = document.getElementById("printContainer");
  if (!el) {
    el = document.createElement("div");
    el.id = "printContainer";
    document.body.appendChild(el);
  }
  return el;
}

function triggerPrint(container: HTMLElement): Promise<void> {
  return new Promise<void>((resolve) => {
    const cleanup = (): void => {
      window.removeEventListener("afterprint", cleanup);
      container.innerHTML = "";
      resolve();
    };
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    // Fallback jika afterprint tidak fire (jarang, tapi aman)
    setTimeout(cleanup, 120_000);
  });
}

/* --------------------------------------------------------------
   Render satu halaman ke <img>
   -------------------------------------------------------------- */
async function renderPageForPrint(pageNum: number): Promise<HTMLImageElement> {
  if (!state.pdfDoc) throw new Error("PDF doc tidak tersedia.");

  const page = await state.pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({
    scale: PRINT_SCALE,
    rotation: state.rotation,
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas context tidak tersedia.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  // Composite annotations di atas canvas
  const dim = state.pageDims[pageNum];
  if (dim) {
    await drawAnnotations(ctx, pageNum, viewport, dim.w, dim.h);
  }

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  page.cleanup(); // release page resources

  const img = document.createElement("img");
  img.src = dataUrl;
  img.alt = `Halaman ${pageNum}`;
  return img;
}

/* --------------------------------------------------------------
   Annotation compositor
   -------------------------------------------------------------- */
async function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  pageNum: number,
  viewport: PageViewport,
  baseW: number,
  baseH: number,
): Promise<void> {
  const annos = state.annotations.filter((a) => a.pageNum === pageNum);
  if (!annos.length) return;

  // Preload semua image annotation paralel (jauh lebih cepat)
  const imagePromises = new Map<string, Promise<HTMLImageElement>>();
  for (const a of annos) {
    if ((a.type === "signature" || a.type === "image") && a.imageDataUrl) {
      imagePromises.set(a.id, loadImage(a.imageDataUrl));
    }
  }
  await Promise.all(imagePromises.values());

  /** Normalized (0..1, origin kiri-atas) → viewport px pada PRINT_SCALE. */
  const toVp = (nx: number, ny: number): [number, number] => {
    const ux = nx * baseW;
    const uy = baseH * (1 - ny);
    const [vx, vy] = viewport.convertToViewportPoint(ux, uy);
    return [vx, vy];
  };

  /** Rect ternormalisasi → rect viewport (bounding box aman rotasi). */
  const vpRect = (rect: {
    x: number;
    y: number;
    w: number;
    h: number;
  }): { x: number; y: number; w: number; h: number } => {
    const p1 = toVp(rect.x, rect.y);
    const p2 = toVp(rect.x + rect.w, rect.y + rect.h);
    return {
      x: Math.min(p1[0], p2[0]),
      y: Math.min(p1[1], p2[1]),
      w: Math.abs(p2[0] - p1[0]),
      h: Math.abs(p2[1] - p1[1]),
    };
  };

  for (const a of annos) {
    ctx.save();
    switch (a.type) {
      case "highlight": {
        const r = vpRect(a.rect);
        ctx.globalAlpha = a.opacity ?? 0.45;
        ctx.fillStyle = a.color;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        break;
      }

      case "underline": {
        const r = vpRect(a.rect);
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = a.color;
        const th = Math.max(2, 2 * PRINT_SCALE);
        ctx.fillRect(r.x, r.y + r.h - th, r.w, th);
        break;
      }

      case "strike": {
        const r = vpRect(a.rect);
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = a.color;
        const th = Math.max(2, 2 * PRINT_SCALE);
        ctx.fillRect(r.x, r.y + r.h / 2 - th / 2, r.w, th);
        break;
      }

      case "text": {
        const r = vpRect(a.rect);
        ctx.fillStyle = a.color;
        const fontSize = a.fontSize * PRINT_SCALE;
        ctx.font = `${fontSize}px Helvetica, Arial, sans-serif`;
        ctx.textBaseline = "top";
        const lines = a.text.split("\n");
        let y = r.y;
        for (const line of lines) {
          ctx.fillText(line, r.x, y);
          y += fontSize * 1.28;
        }
        break;
      }

      case "note": {
        const r = vpRect(a.rect);
        const size = 16 * PRINT_SCALE;
        ctx.fillStyle = "#ffd54f";
        ctx.strokeStyle = "#c9a227";
        ctx.lineWidth = PRINT_SCALE;
        ctx.fillRect(r.x, r.y, size, size);
        ctx.strokeRect(r.x, r.y, size, size);
        if (a.text) {
          ctx.fillStyle = "#1a1a1a";
          ctx.font = `${8 * PRINT_SCALE}px Helvetica, Arial, sans-serif`;
          ctx.textBaseline = "top";
          const lines = wrapText(a.text, 60).slice(0, 12);
          let y = r.y + size + 4 * PRINT_SCALE;
          for (const line of lines) {
            ctx.fillText(line, r.x + size + 4 * PRINT_SCALE, y);
            y += 10 * PRINT_SCALE;
          }
        }
        break;
      }

      case "draw": {
        if (a.points.length < 2) break;
        ctx.strokeStyle = a.color;
        ctx.lineWidth = Math.max(1, a.lineWidth * PRINT_SCALE);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        const first = toVp(a.points[0].x, a.points[0].y);
        ctx.moveTo(first[0], first[1]);
        for (let i = 1; i < a.points.length; i++) {
          const p = toVp(a.points[i].x, a.points[i].y);
          ctx.lineTo(p[0], p[1]);
        }
        ctx.stroke();
        break;
      }

      case "signature":
      case "image": {
        const r = vpRect(a.rect);
        const p = imagePromises.get(a.id);
        if (p) {
          const img = await p;
          ctx.drawImage(img, r.x, r.y, r.w, r.h);
        }
        break;
      }
    }
    ctx.restore();
  }
}

/* --------------------------------------------------------------
   Helpers
   -------------------------------------------------------------- */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
