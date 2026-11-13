/**
 * PDF merge service — gabungkan beberapa PDF jadi satu via pdf-lib.
 * Input: array { name, bytes }. Output: Uint8Array hasil merge.
 */

import { PDFDocument } from "pdf-lib";

export interface MergeInput {
  name: string;
  bytes: Uint8Array;
}

export interface MergeProgress {
  current: number;
  total: number;
  currentName: string;
}

export interface MergeOptions {
  onProgress?: (p: MergeProgress) => void;
}

export async function mergePDFs(
  inputs: MergeInput[],
  opts: MergeOptions = {},
): Promise<Uint8Array> {
  if (!inputs.length) throw new Error("Tidak ada file untuk digabung.");

  const out = await PDFDocument.create();
  const total = inputs.length;

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    opts.onProgress?.({ current: i + 1, total, currentName: input.name });

    try {
      const src = await PDFDocument.load(input.bytes, {
        ignoreEncryption: true,
      });
      const pages = await out.copyPages(src, src.getPageIndices());
      for (const p of pages) out.addPage(p);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Gagal memuat "${input.name}": ${msg}`);
    }
  }

  return await out.save();
}

/** Nama file hasil merge dengan timestamp agar tidak bentrok. */
export function generateMergeFilename(count: number): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `_${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `merged_${count}files_${stamp}.pdf`;
}
