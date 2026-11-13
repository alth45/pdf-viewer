/**
 * PDF exporter — gabungkan form field values + semua anotasi ke PDF,
 * lalu trigger download via browser.
 *
 * Konversi koordinat:
 * - Normalized (0..1, origin kiri-atas)  ←  format anotasi
 * - pdf-lib   (points, origin kiri-bawah) ←  format render PDF
 *
 *   toX(nx) = nx * pageWidth
 *   toY(ny) = pageHeight - ny * pageHeight
 */

import {
  PDFDocument,
  rgb,
  StandardFonts,
  LineCapStyle,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
  PDFOptionList,
} from "pdf-lib";
import type { PDFFont, PDFImage, PDFPage } from "pdf-lib";

import { state } from "@core/state";
import { hexToRgb01 } from "@utils/colors";
import { downloadBlob } from "@utils/download";
import { toast } from "@utils/toast";
import { embedImageFromDataUrl } from "./signatureService";
import type { Annotation } from "@core/types";

/* ---------- Public API ---------- */
export interface ExportOptions {
  /** Nama file output. Default: `<basename>_annotated.pdf`. */
  filename?: string;
  /** Flatten form fields (jadikan statis). Default: false. */
  flatten?: boolean;
}

export async function exportPDF(opts: ExportOptions = {}): Promise<void> {
  if (!state.originalBytes) {
    toast("Tidak ada dokumen", "error");
    return;
  }

  try {
    toast("Menyiapkan PDF…");
    const pdfDoc = await PDFDocument.load(state.originalBytes, {
      ignoreEncryption: true,
    });
    const pages = pdfDoc.getPages();

    fillFormFields(pdfDoc, opts.flatten ?? false);
    await renderAnnotationsToPdf(pdfDoc, pages);

    const bytes = await pdfDoc.save();
    const outName = opts.filename ?? autoFilename();
    downloadBlob(bytes, outName);
    toast("PDF berhasil disimpan: " + outName, "ok", 4000);
  } catch (err) {
    console.error("export gagal", err);
    toast(
      "Gagal menyimpan PDF: " +
        (err instanceof Error ? err.message : String(err)),
      "error",
      6000,
    );
  }
}

/** Export halaman saat ini (canvas mentah, tanpa anotasi) sebagai PNG. */
export function exportCurrentPagePNG(): void {
  const entry = state.pages[state.currentPage];
  if (!entry) return;
  try {
    entry.canvas.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, `page-${state.currentPage}.png`, "image/png");
      toast("Halaman diekspor sebagai PNG", "ok");
    }, "image/png");
  } catch {
    toast("Gagal mengekspor PNG", "error");
  }
}

/* ---------- Filename ---------- */
function autoFilename(): string {
  const base = (state.fileName || "document").replace(/\.pdf$/i, "");
  return `${base}_annotated.pdf`;
}

/* ---------- Form filling ---------- */
function fillFormFields(pdfDoc: PDFDocument, flatten: boolean): void {
  let form;
  try {
    form = pdfDoc.getForm();
  } catch {
    return; // tidak ada AcroForm
  }

  for (const name in state.fields) {
    const value = state.fields[name];
    try {
      const field = form.getField(name);
      if (!field) continue;

      if (field instanceof PDFTextField) {
        field.setText(value == null ? "" : String(value));
      } else if (field instanceof PDFCheckBox) {
        if (value) field.check();
        else field.uncheck();
      } else if (field instanceof PDFRadioGroup) {
        if (value) field.select(String(value));
      } else if (
        field instanceof PDFDropdown ||
        field instanceof PDFOptionList
      ) {
        if (value) field.select(String(value));
      }
    } catch (e) {
      console.warn("Field gagal diisi:", name, e);
    }
  }

  if (flatten) {
    try {
      form.flatten();
    } catch (e) {
      console.warn("flatten gagal", e);
    }
  }
}

/* ---------- Annotation rendering ---------- */
type FontGetter = (name: StandardFonts) => Promise<PDFFont>;
type ImageGetter = (dataUrl: string) => Promise<PDFImage>;

async function renderAnnotationsToPdf(
  pdfDoc: PDFDocument,
  pages: PDFPage[],
): Promise<void> {
  const fontCache: Partial<Record<StandardFonts, PDFFont>> = {};
  const imageCache: Record<string, PDFImage> = {};

  const getFont: FontGetter = async (name) => {
    let font = fontCache[name];
    if (!font) {
      font = await pdfDoc.embedFont(name);
      fontCache[name] = font;
    }
    return font;
  };

  const getImage: ImageGetter = async (dataUrl) => {
    let img = imageCache[dataUrl];
    if (!img) {
      img = await embedImageFromDataUrl(pdfDoc, dataUrl);
      imageCache[dataUrl] = img;
    }
    return img;
  };

  // Snapshot — state bisa berubah selama await
  const annotations = [...state.annotations];

  for (const a of annotations) {
    const page = pages[a.pageNum - 1];
    if (!page) continue;
    try {
      await renderOneAnnotation(page, a, getFont, getImage);
    } catch (e) {
      console.warn("annotasi gagal diekspor:", a.type, a.id, e);
    }
  }

  // ---------- OCR text (invisible, searchable) ----------
  await renderOCRText(pdfDoc, pages);
}

async function renderOneAnnotation(
  page: PDFPage,
  a: Annotation,
  getFont: FontGetter,
  getImage: ImageGetter,
): Promise<void> {
  const { width, height } = page.getSize();
  const toX = (nx: number): number => nx * width;
  const toY = (ny: number): number => height - ny * height;
  const c = hexToRgb01(a.color || "#ffeb3b");
  const color = rgb(c.r, c.g, c.b);

  switch (a.type) {
    case "highlight": {
      page.drawRectangle({
        x: toX(a.rect.x),
        y: toY(a.rect.y + a.rect.h),
        width: a.rect.w * width,
        height: a.rect.h * height,
        color,
        opacity: a.opacity ?? 0.45,
      });
      break;
    }

    case "underline": {
      const th = Math.max(1, 2);
      page.drawRectangle({
        x: toX(a.rect.x),
        y: toY(a.rect.y + a.rect.h),
        width: a.rect.w * width,
        height: th,
        color,
        opacity: 0.95,
      });
      break;
    }

    case "strike": {
      const th = Math.max(1, 2);
      page.drawRectangle({
        x: toX(a.rect.x),
        y: toY(a.rect.y + a.rect.h / 2),
        width: a.rect.w * width,
        height: th,
        color,
        opacity: 0.95,
      });
      break;
    }

    case "text": {
      if (!a.text) break;
      const font = await getFont(StandardFonts.Helvetica);
      const size = a.fontSize || 16;
      const lines = a.text.split("\n");
      let y = toY(a.rect.y) - size;
      for (const line of lines) {
        page.drawText(line, { x: toX(a.rect.x), y, size, font, color });
        y -= size * 1.28;
      }
      break;
    }

    case "note": {
      const bx = toX(a.rect.x);
      const by = toY(a.rect.y + 0.035);
      page.drawRectangle({
        x: bx,
        y: by,
        width: 16,
        height: 16,
        color: rgb(1, 0.84, 0.31),
        borderColor: rgb(0.6, 0.5, 0.1),
        borderWidth: 1,
      });
      if (a.text) {
        const font = await getFont(StandardFonts.Helvetica);
        const lines = wrapText(a.text, 60);
        let ty = by - 6;
        for (const line of lines.slice(0, 12)) {
          page.drawText(line, {
            x: bx + 20,
            y: ty,
            size: 8,
            font,
            color: rgb(0.15, 0.15, 0.15),
          });
          ty -= 10;
        }
      }
      break;
    }

    case "draw": {
      if (a.points.length < 2) break;
      const thickness = Math.max(0.6, a.lineWidth);
      for (let i = 1; i < a.points.length; i++) {
        const p0 = a.points[i - 1];
        const p1 = a.points[i];
        page.drawLine({
          start: { x: toX(p0.x), y: toY(p0.y) },
          end: { x: toX(p1.x), y: toY(p1.y) },
          thickness,
          color,
          lineCap: LineCapStyle.Round,
        });
      }
      break;
    }

    case "signature":
    case "image": {
      const img = await getImage(a.imageDataUrl);
      page.drawImage(img, {
        x: toX(a.rect.x),
        y: toY(a.rect.y + a.rect.h),
        width: a.rect.w * width,
        height: a.rect.h * height,
      });
      break;
    }
  }
}

/* ---------- OCR: embed invisible text agar searchable ---------- */
async function renderOCRText(
  pdfDoc: PDFDocument,
  pages: PDFPage[],
): Promise<void> {
  const entries = Object.values(state.ocrResults);
  if (!entries.length) return;

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const entry of entries) {
    const page = pages[entry.pageNum - 1];
    if (!page) continue;

    const { width, height } = page.getSize();
    const toX = (nx: number): number => nx * width;
    const toY = (ny: number): number => height - ny * height;

    for (const word of entry.words) {
      const safe = sanitizeForPdfLib(word.text);
      if (!safe) continue;

      const fontSize = word.h * height;
      if (fontSize < 1) continue;

      try {
        page.drawText(safe, {
          x: toX(word.x),
          y: toY(word.y + word.h),
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
          opacity: 0.01, // nyaris tak terlihat, masih searchable & copyable
        });
      } catch {
        // Glyph tidak didukung Helvetica — skip word ini
      }
    }
  }
}

/** Helvetica hanya mendukung WinAnsi; ganti karakter di luar dengan placeholder. */
function sanitizeForPdfLib(text: string): string {
  return text.replace(/[^\x20-\xFF]/g, "");
}

/* ---------- Text wrapping helper ---------- */
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
