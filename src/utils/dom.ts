/**
 * DOM query & utility helpers.
 * Semua fungsi murni dan type-safe.
 */

/** Query satu elemen — throws jika tidak ditemukan (fail-fast). */
export function $<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el;
}

/** Query satu elemen opsional — return null jika tidak ditemukan. */
export function $opt<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T | null {
  return root.querySelector<T>(selector);
}

/** Query banyak elemen sebagai array (bukan NodeList). */
export function $$<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

/** Clamp nilai ke rentang [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Unique ID generator (cukup untuk local use, bukan kriptografis). */
export function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

/** Debounce function — menunda eksekusi sampai ms berlalu tanpa panggilan baru. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
}

/** Debounce untuk requestAnimationFrame pattern. */
export function rafThrottle<A extends unknown[]>(
  fn: (...args: A) => void,
): (...args: A) => void {
  let pending = false;
  let lastArgs: A | null = null;
  return (...args: A) => {
    lastArgs = args;
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      if (lastArgs) fn(...lastArgs);
    });
  };
}

/** Escape HTML special characters untuk safe innerHTML interpolation. */
export function escapeHtml(text: unknown): string {
  return String(text).replace(
    /[&<>"']/g,
    (ch) =>
      (
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }) as Record<string, string>
      )[ch],
  );
}

/** True jika event target adalah elemen input interaktif (form/text). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    (target as HTMLElement).isContentEditable
  );
}
