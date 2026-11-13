/**
 * Bottom toolbar — tool buttons, color swatches, size range.
 * Murni DOM wiring; state aktif dikelola App lewat `setTool` / `setColor`.
 */

import { $$, $opt } from "@utils/dom";
import { CONFIG } from "@core/config";
import type { Tool } from "@core/types";

export interface ToolbarHooks {
  onToolChange: (tool: Tool) => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
  onSignatureClick: () => void;
}

let currentTool: Tool = "select";
let currentColor: string = CONFIG.DEFAULT_COLOR;

export function initToolbar(hooks: ToolbarHooks): void {
  // Tool buttons
  $$<HTMLButtonElement>("#toolbar .tool-btn").forEach((btn) => {
    const tool = btn.dataset.tool as Tool | undefined;
    if (!tool) return;
    btn.addEventListener("click", () => {
      if (tool === "signature") {
        hooks.onSignatureClick();
        return;
      }
      hooks.onToolChange(tool);
    });
  });

  // Color swatches
  const colorRow = $opt<HTMLElement>("#colorRow");
  if (colorRow) {
    colorRow.innerHTML = "";
    for (const c of CONFIG.COLORS) {
      const b = document.createElement("button");
      b.className = "swatch" + (c === CONFIG.DEFAULT_COLOR ? " active" : "");
      b.style.background = c;
      b.dataset.color = c;
      b.title = c;
      b.setAttribute("aria-label", `Warna ${c}`);
      b.addEventListener("click", () => hooks.onColorChange(c));
      colorRow.appendChild(b);
    }
  }

  // Size range
  const sizeRange = $opt<HTMLInputElement>("#sizeRange");
  sizeRange?.addEventListener("input", () => {
    hooks.onSizeChange(Number(sizeRange.value));
  });

  setTool("select");
}

/** Update state aktif DOM (highlight tombol + tampil toolbar warna/size). */
export function setTool(tool: Tool): void {
  currentTool = tool;

  $$<HTMLButtonElement>("#toolbar .tool-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tool === tool);
  });

  const usesColor =
    tool === "highlight" ||
    tool === "underline" ||
    tool === "strike" ||
    tool === "draw" ||
    tool === "text" ||
    tool === "note";
  const colorRow = $opt<HTMLElement>("#colorRow");
  if (colorRow) colorRow.style.display = usesColor ? "flex" : "none";

  const sizeWrap = $opt<HTMLElement>("#sizeWrap");
  if (sizeWrap) sizeWrap.style.display = tool === "draw" ? "flex" : "none";

  document.body.dataset.tool = tool;
  const pages = $opt<HTMLElement>("#pages");
  if (pages) pages.dataset.tool = tool;
}

export function setColor(color: string): void {
  currentColor = color;
  $$<HTMLButtonElement>("#colorRow .swatch").forEach((s) => {
    s.classList.toggle("active", s.dataset.color === color);
  });
}

/** Untuk resize handler / drag — akses nilai aktif. */
export function getCurrentTool(): Tool {
  return currentTool;
}
export function getCurrentColor(): string {
  return currentColor;
}
