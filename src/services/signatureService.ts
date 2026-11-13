/**
 * Signature utilities — pure helpers untuk trim canvas, konversi
 * dataURL → bytes, dan embed image ke PDFDocument.
 *
 * Modal signature (Batch 8) memakai `trimCanvas()`; exporter (file ini
 * dipakai dari pdfExporter) memakai `embedImageFromDataUrl()`.
 */

import type { PDFDocument, PDFImage } from "pdf-lib";

const INK_THRESHOLD = 200; // channel RGB < 200 dianggap tinta
const TRIM_PADDING = 8;

/**
 * Crop area putih kosong dari canvas tanda tangan.
 * Mengembalikan canvas baru; jika tidak ada tinta, kembalikan input apa adanya.
 */
export function trimCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (
        data[i] < INK_THRESHOLD ||
        data[i + 1] < INK_THRESHOLD ||
        data[i + 2] < INK_THRESHOLD
      ) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!found) return canvas;

  minX = Math.max(0, minX - TRIM_PADDING);
  minY = Math.max(0, minY - TRIM_PADDING);
  maxX = Math.min(width, maxX + TRIM_PADDING);
  maxY = Math.min(height, maxY + TRIM_PADDING);

  const out = document.createElement("canvas");
  out.width = maxX - minX;
  out.height = maxY - minY;

  const octx = out.getContext("2d");
  if (!octx) return canvas;
  octx.drawImage(
    canvas,
    minX,
    minY,
    out.width,
    out.height,
    0,
    0,
    out.width,
    out.height,
  );
  return out;
}

/** Decode base64 dataURL → Uint8Array (raw bytes). */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  const base64 = dataUrl.slice(comma + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Embed dataURL image (PNG atau JPG) ke PDFDocument.
 * @throws jika format tidak didukung (bukan PNG/JPG).
 */
export async function embedImageFromDataUrl(
  pdfDoc: PDFDocument,
  dataUrl: string,
): Promise<PDFImage> {
  const header = dataUrl.slice(0, dataUrl.indexOf(","));
  const bytes = dataUrlToBytes(dataUrl);
  if (/png/i.test(header)) return pdfDoc.embedPng(bytes);
  if (/jpe?g/i.test(header)) return pdfDoc.embedJpg(bytes);
  throw new Error("Format gambar tidak didukung (hanya PNG/JPG).");
}
