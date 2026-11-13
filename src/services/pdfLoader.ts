/**
 * PDF loading service.
 * Tanggung jawab: fetch bytes, load dokumen, handle password, hitung page dims.
 * TIDAK menyentuh `state` — caller (App) bertanggung jawab set state.
 */

import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
/**
 * Worker setup — WAJIB sebelum `getDocument()` dipanggil.
 * Vite men-resolve `?url` menjadi asset URL yang di-bundle.
 * Ini juga memastikan versi worker = versi library (tidak mismatch).
 */
// Vite resolves the ?url suffix at build time; TypeScript may not have its asset declarations loaded.
// @ts-expect-error Vite asset URL import
import PdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { fileFingerprint } from "@utils/hash";
import type { PDFSource, PageDimsMap } from "@core/types";

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorkerUrl;
/* ---------- Konstanta CDN ---------- */
const CMAP_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/cmaps/";
const STANDARD_FONTS_URL =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/standard_fonts/";

/* ---------- Tipe parameter internal ---------- */
type PDFInitParams = {
  data: Uint8Array;
  cMapUrl: string;
  cMapPacked: boolean;
  standardFontDataUrl: string;
  password?: string;
};

/* ---------- Error terklasifikasi ---------- */
export type PDFLoadErrorKind = "cors" | "invalid" | "cancelled" | "generic";

export class PDFLoadError extends Error {
  constructor(
    public readonly kind: PDFLoadErrorKind,
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PDFLoadError";
  }
}

/* ---------- Tipe hasil & opsi ---------- */
export interface LoadedPDF {
  doc: PDFDocumentProxy;
  bytes: Uint8Array;
  name: string;
  fileHash: string;
  numPages: number;
  pageDims: PageDimsMap;
}

export interface PDFLoadOptions {
  source: PDFSource;
  name: string;
  /** Progress fraction 0..1 (halaman yang telah dibaca dimensinya). */
  onProgress?: (fraction: number) => void;
  /**
   * Dipanggil saat dokumen memerlukan password.
   * @param wasWrong true jika percobaan sebelumnya salah.
   * @returns password string, atau null untuk membatalkan.
   */
  resolvePassword?: (wasWrong: boolean) => Promise<string | null>;
}

/* ---------- Type guards untuk error pdfjs ---------- */
interface PasswordException {
  name: "PasswordException";
  code?: number;
  message?: string;
}

interface InvalidPDFException {
  name: "InvalidPDFException";
  message?: string;
}

function isPasswordException(err: unknown): err is PasswordException {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "PasswordException"
  );
}

function isInvalidPDFException(err: unknown): err is InvalidPDFException {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "InvalidPDFException"
  );
}

/* ---------- Byte resolution ---------- */
async function resolveBytes(source: PDFSource): Promise<Uint8Array> {
  if ("data" in source && source.data) {
    return source.data instanceof Uint8Array
      ? source.data
      : new Uint8Array(source.data);
  }

  if (!("url" in source) || !source.url) {
    throw new PDFLoadError("generic", "Sumber PDF tidak valid.");
  }

  try {
    const res = await fetch(source.url, { mode: "cors" });
    if (!res.ok) {
      throw new PDFLoadError("cors", `HTTP ${res.status}`);
    }
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch (err) {
    if (err instanceof PDFLoadError) throw err;
    throw new PDFLoadError(
      "cors",
      "Gagal memuat URL. Server harus mengirim header Access-Control-Allow-Origin.",
      err,
    );
  }
}

/* ---------- Single attempt ---------- */
function loadDocumentOnce(
  params: PDFInitParams,
  onProgress: (fraction: number) => void,
): Promise<PDFDocumentProxy> {
  return new Promise((resolve, reject) => {
    try {
      const task = pdfjsLib.getDocument(params);
      task.onProgress = ({ loaded, total }: any) => {
        if (total) onProgress(loaded / total);
      };
      task.promise.then(resolve, reject);
    } catch (err) {
      reject(err);
    }
  });
}

/* ---------- Retry loop dengan password ---------- */
async function loadWithPasswordRetry(
  baseParams: PDFInitParams,
  onProgress: (fraction: number) => void,
  resolvePassword: PDFLoadOptions["resolvePassword"],
): Promise<PDFDocumentProxy> {
  let currentParams: PDFInitParams = { ...baseParams };
  let isRetry = false;

  for (;;) {
    try {
      return await loadDocumentOnce(currentParams, onProgress);
    } catch (err) {
      if (isPasswordException(err)) {
        if (!resolvePassword) {
          throw new PDFLoadError("cancelled", "Dokumen dilindungi password.");
        }
        const pw = await resolvePassword(isRetry || err.code === 2);
        if (pw == null) {
          throw new PDFLoadError("cancelled", "Password dibatalkan.");
        }
        currentParams = { ...currentParams, password: pw };
        isRetry = true;
        continue;
      }
      if (isInvalidPDFException(err)) {
        throw new PDFLoadError(
          "invalid",
          "File PDF rusak atau tidak valid.",
          err,
        );
      }
      throw new PDFLoadError(
        "generic",
        err instanceof Error ? err.message : String(err),
        err,
      );
    }
  }
}

/* ---------- Public: loadPDF ---------- */
/**
 * Muat PDF dari bytes atau URL.
 * @throws {PDFLoadError} untuk kegagalan dengan `kind` yang bisa dipetakan ke UI.
 */
export async function loadPDF(opts: PDFLoadOptions): Promise<LoadedPDF> {
  const { source, name, onProgress = () => {}, resolvePassword } = opts;

  const bytes = await resolveBytes(source);

  // Clone karena pdfjs memindahkan ownership buffer ke worker (transferable)
  const bufferForPdf = bytes.slice(0);

  const params: PDFInitParams = {
    data: bufferForPdf,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: STANDARD_FONTS_URL,
  };

  const doc = await loadWithPasswordRetry(params, onProgress, resolvePassword);

  // Baca dimensi semua halaman (scale 1, rotation 0)
  const pageDims: PageDimsMap = {};
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    pageDims[i] = { w: vp.width, h: vp.height };
    if (i % 25 === 0) onProgress(i / doc.numPages);
  }

  const fileHash = fileFingerprint(name, bytes.length);

  return {
    doc,
    bytes,
    name,
    fileHash,
    numPages: doc.numPages,
    pageDims,
  };
}

/** Destroy dokumen dengan aman (menelan error). */
export async function destroyPDF(doc: PDFDocumentProxy | null): Promise<void> {
  if (!doc) return;
  try {
    await doc.destroy();
  } catch {
    // ignore — sudah tidak terpakai
  }
}
