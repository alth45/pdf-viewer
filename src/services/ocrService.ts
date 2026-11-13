/**
 * OCR service — bungkus tesseract.js.
 *
 * Tesseract di-load lazily: bundle hanya ~2MB, tapi language data (~4MB per bahasa)
 * diunduh saat pertama kali OCR dijalankan. Modal sudah memperingatkan user.
 */

import type {
  PDFDocumentProxy,
  OCRWord,
  OCRPageResult,
  ScannedPageInfo,
} from "@core/types";

/* Re-export types agar bisa di-import dari `@services/index` */
export type { OCRWord, OCRPageResult, ScannedPageInfo } from "@core/types";

const OCR_SCALE = 2;
const EMPTY_THRESHOLD = 3;
const SPARSE_THRESHOLD = 20;

/* ============================================================
   Deteksi halaman scan
   ============================================================ */
export async function detectScannedPages(
  pdfDoc: PDFDocumentProxy,
  textCache: Record<number, { items: unknown[] } | undefined>,
): Promise<ScannedPageInfo[]> {
  const out: ScannedPageInfo[] = [];

  for (let p = 1; p <= pdfDoc.numPages; p++) {
    let items = textCache[p]?.items;
    if (!items) {
      try {
        const page = await pdfDoc.getPage(p);
        const tc = await page.getTextContent();
        items = tc.items;
      } catch {
        items = [];
      }
    }

    const count = items.filter((it) => {
      const s = (it as { str?: string }).str;
      return typeof s === "string" && s.trim().length > 0;
    }).length;

    if (count < EMPTY_THRESHOLD) {
      out.push({ pageNum: p, reason: "empty", textItemCount: count });
    } else if (count < SPARSE_THRESHOLD) {
      out.push({ pageNum: p, reason: "sparse", textItemCount: count });
    }
  }
  return out;
}

/* ============================================================
   OCR satu halaman
   ============================================================ */
export interface OCRPageOptions {
  pdfDoc: PDFDocumentProxy;
  pageNum: number;
  language: string;
  /** Progress 0..1 untuk halaman ini saja. */
  onProgress?: (fraction: number) => void;
}

export async function ocrPage(opts: OCRPageOptions): Promise<OCRPageResult> {
  const { pdfDoc, pageNum, language, onProgress } = opts;

  const tesseract = await import("tesseract.js");

  const worker = await tesseract.createWorker(language, 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(m.progress);
      }
    },
  });

  try {
    // Render halaman ke canvas — tanpa rotation, bounding box OCR
    // selalu dalam koordinat unrotated. Rotation di-handle oleh pdfjs
    // saat text layer di-render di viewer.
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: OCR_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas context gagal.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    // Jalankan OCR
    const { data } = await worker.recognize(canvas);
    const words = extractWords(data, canvas.width, canvas.height);

    // Hitung confidence rata-rata tertimbang by word length
    const totalLen = words.reduce((s, w) => s + w.text.length, 0) || 1;
    const avgConfidence =
      words.reduce((s, w) => s + w.confidence * w.text.length, 0) / totalLen;

    page.cleanup();
    canvas.width = canvas.height = 0;

    return {
      pageNum,
      words,
      text: data.text ?? "",
      language,
      confidence: avgConfidence,
      createdAt: Date.now(),
    };
  } finally {
    await worker.terminate();
  }
}

/* ============================================================
   Batch OCR
   ============================================================ */
export interface OCRBatchOptions {
  pdfDoc: PDFDocumentProxy;
  pageNums: number[];
  language: string;
  /** Progress keseluruhan 0..1. */
  onProgress?: (fraction: number) => void;
  /** Abort signal opsional. */
  signal?: AbortSignal;
}

export async function ocrPages(
  opts: OCRBatchOptions,
): Promise<OCRPageResult[]> {
  const { pdfDoc, pageNums, language, onProgress, signal } = opts;
  const results: OCRPageResult[] = [];
  const total = pageNums.length;

  for (let i = 0; i < pageNums.length; i++) {
    if (signal?.aborted) throw new DOMException("OCR dibatalkan", "AbortError");

    const pageNum = pageNums[i];
    onProgress?.(i / total);

    const result = await ocrPage({
      pdfDoc,
      pageNum,
      language,
      onProgress: (p) => onProgress?.((i + p) / total),
    });

    results.push(result);
  }

  onProgress?.(1);
  return results;
}

/* ============================================================
   Helper — ekstrak words dari tesseract result
   ============================================================ */
interface TessWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * Tesseract v5 `Page` punya `words?: Word[]` dan `blocks: Block[] | null`.
 * Kita terima `unknown` lalu narrow sendiri — tahan terhadap variasi versi.
 */
function extractWords(
  raw: unknown,
  canvasW: number,
  canvasH: number,
): OCRWord[] {
  const data = raw as {
    words?: TessWord[] | null;
    blocks?: Array<{
      paragraphs?: Array<{
        lines?: Array<{ words?: TessWord[] | null }> | null;
      }> | null;
    }> | null;
  };

  let words: TessWord[] = data.words ?? [];

  if (!words.length && data.blocks) {
    for (const b of data.blocks) {
      for (const p of b.paragraphs ?? []) {
        for (const l of p.lines ?? []) {
          for (const w of l.words ?? []) words.push(w);
        }
      }
    }
  }

  const out: OCRWord[] = [];
  for (const w of words) {
    const txt = (w.text ?? "").trim();
    if (!txt || w.confidence <= 0) continue;

    const nx = w.bbox.x0 / canvasW;
    const ny = w.bbox.y0 / canvasH;
    const nw = (w.bbox.x1 - w.bbox.x0) / canvasW;
    const nh = (w.bbox.y1 - w.bbox.y0) / canvasH;

    if (nx < 0 || nx > 1 || ny < 0 || ny > 1 || nw < 0.002 || nh < 0.002)
      continue;

    out.push({
      text: txt,
      x: nx,
      y: ny,
      w: Math.min(nw, 1 - nx),
      h: Math.min(nh, 1 - ny),
      confidence: w.confidence,
    });
  }
  return out;
}

/* ============================================================
   Konversi OCRWord → pdfjs TextItem (agar text layer + search bekerja)
   ============================================================ */
export interface PdfTextItemLike {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
  dir: string;
  hasEOL: boolean;
  _isOCR: true;
}

export function ocrWordToTextItem(
  word: OCRWord,
  baseW: number,
  baseH: number,
): PdfTextItemLike {
  // User-space coords (PDF origin bottom-left)
  const fontSize = word.h * baseH;
  const pdfX = word.x * baseW;
  const pdfY = (1 - word.y - word.h) * baseH;
  return {
    str: word.text,
    transform: [fontSize, 0, 0, fontSize, pdfX, pdfY],
    width: word.w * baseW,
    height: word.h * baseH,
    fontName: "OCR",
    dir: "ltr",
    hasEOL: false,
    _isOCR: true,
  };
}
