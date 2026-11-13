/**
 * Drag & drop overlay. Menerima file via window events,
 * memvalidasi lewat `validateAndDispatch` dari fileInput.
 *
 * Skip saat modal terbuka — modal punya drop zone sendiri.
 */

import { $opt } from "@utils/dom";
import { validateAndDispatch } from "./fileInput";

let dzEl: HTMLElement | null = null;
let dragCounter = 0;

function ensure(): HTMLElement | null {
  if (!dzEl || !dzEl.isConnected) dzEl = $opt("#dropzone");
  return dzEl;
}

function isModalOpen(): boolean {
  return $opt("#modalRoot")?.classList.contains("active") ?? false;
}

function show(): void {
  ensure()?.classList.add("active");
}
function hide(): void {
  ensure()?.classList.remove("active");
}

export function initDropzone(): void {
  window.addEventListener("dragenter", (e) => {
    if (isModalOpen()) return;
    if (!e.dataTransfer) return;
    const types = Array.from(e.dataTransfer.types || []);
    if (!types.includes("Files")) return;
    dragCounter++;
    show();
  });

  // Selalu preventDefault — cegah browser membuka file secara native
  window.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  window.addEventListener("dragleave", () => {
    if (isModalOpen()) return;
    dragCounter = Math.max(0, dragCounter - 1);
    if (dragCounter === 0) hide();
  });

  window.addEventListener("drop", (e) => {
    e.preventDefault();
    if (isModalOpen()) return;
    dragCounter = 0;
    hide();
    const f = e.dataTransfer?.files?.[0];
    if (f) validateAndDispatch(f);
  });
}
