/**
 * Toast notification — elemen root `#toastWrap` harus ada di DOM.
 */

import { $opt } from "./dom";

export type ToastType = "" | "ok" | "error";

const DEFAULT_DURATION = 3200;
const EXIT_DURATION = 260;

let cachedWrap: HTMLElement | null = null;

function getWrap(): HTMLElement | null {
  if (cachedWrap && cachedWrap.isConnected) return cachedWrap;
  cachedWrap = $opt<HTMLElement>("#toastWrap");
  return cachedWrap;
}

export function toast(
  message: string,
  type: ToastType = "",
  ms = DEFAULT_DURATION,
): void {
  const wrap = getWrap();
  if (!wrap) {
    // Fallback saat dev (belum ada markup)
    console.info(`[toast${type ? ":" + type : ""}]`, message);
    return;
  }

  const el = document.createElement("div");
  el.className = type ? `toast ${type}` : "toast";
  el.textContent = message;
  wrap.appendChild(el);

  setTimeout(() => {
    el.style.transition = "opacity .25s, transform .25s";
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => el.remove(), EXIT_DURATION);
  }, ms);
}

export const toastOk = (msg: string, ms?: number) => toast(msg, "ok", ms);
export const toastError = (msg: string, ms = 5000) => toast(msg, "error", ms);
