/**
 * Trigger file picker + validasi ukuran file.
 */

import { CONFIG } from "@core/config";
import { $opt } from "@utils/dom";
import { toast } from "@utils/toast";

export type FilePickedCallback = (file: File) => void;

let inputEl: HTMLInputElement | null = null;
let onFile: FilePickedCallback = () => {};

function ensure(): HTMLInputElement | null {
  if (!inputEl || !inputEl.isConnected) {
    inputEl = $opt<HTMLInputElement>("#fileInput");
  }
  return inputEl;
}

export function initFileInput(onFilePicked: FilePickedCallback): void {
  onFile = onFilePicked;
  const el = ensure();
  if (!el) return;

  el.addEventListener("change", () => {
    const f = el.files?.[0];
    el.value = "";
    if (!f) return;
    validateAndDispatch(f);
  });
}

export function openFilePicker(): void {
  ensure()?.click();
}

/** Validasi + dispatch file ke callback. Dipakai juga oleh dropzone. */
export function validateAndDispatch(file: File): void {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) {
    toast("File harus berformat PDF", "error");
    return;
  }

  if (file.size > CONFIG.MAX_FILE_SIZE) {
    const ok = window.confirm(
      "File lebih besar dari 100MB. Proses mungkin lambat. Lanjutkan?",
    );
    if (!ok) return;
  }

  onFile(file);
}
