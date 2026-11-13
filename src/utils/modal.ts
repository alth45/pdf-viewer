/**
 * Modal factory generik.
 * Return handle: { modal, close }.
 * Menangani: ESC key, backdrop click, cleanup listener.
 */

import { $opt } from "./dom";

export interface ModalHandle {
  modal: HTMLDivElement;
  close: () => void;
}

export interface ModalOptions {
  /** Jika false, klik backdrop tidak menutup modal (default true). */
  backdropClose?: boolean;
}

export function openModal(html: string, opts: ModalOptions = {}): ModalHandle {
  const root = $opt<HTMLElement>("#modalRoot");
  if (!root) throw new Error("#modalRoot tidak ditemukan");

  root.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  root.classList.add("active");

  const modal = root.firstElementChild as HTMLDivElement;

  const onEsc = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  };

  let onBackdropDown: ((e: PointerEvent) => void) | null = null;

  const close = (): void => {
    root.classList.remove("active");
    root.innerHTML = "";
    document.removeEventListener("keydown", onEsc, true);
    if (onBackdropDown) {
      root.removeEventListener("pointerdown", onBackdropDown);
      onBackdropDown = null;
    }
  };

  document.addEventListener("keydown", onEsc, true);

  if (opts.backdropClose !== false) {
    onBackdropDown = (e: PointerEvent): void => {
      if (e.target === root) close();
    };
    root.addEventListener("pointerdown", onBackdropDown);
  }

  return { modal, close };
}
