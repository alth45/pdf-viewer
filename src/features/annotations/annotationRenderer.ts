/**
 * Annotation renderer — visualisasi anotasi ke DOM/SVG.
 * Murni render; tidak memutasi state. Interaksi (note click, resize)
 * didelegasikan ke `RendererHooks`.
 */

import { state } from "@core/state";
import { normToViewport, normRectToViewport } from "./coords";
import type { Annotation, NoteAnnotation, PageEntry, Rect } from "@core/types";

const SVG_NS = "http://www.w3.org/2000/svg";

/* ---------- Hooks untuk elemen interaktif ---------- */
export interface RendererHooks {
  /** Dipanggil saat note 📌 diklik (dalam mode select). */
  onOpenNote?: (anno: NoteAnnotation, pageNum: number, isNew: boolean) => void;
  /** Dipanggil saat pointerdown pada resize handle yang sedang terpilih. */
  onResizeStart?: (e: PointerEvent, anno: Annotation, pageNum: number) => void;
}

let hooks: RendererHooks = {};

export function setRendererHooks(h: RendererHooks): void {
  hooks = h;
}

/* ---------- Public render ---------- */
export function renderAnnotations(pageNum: number): void {
  const entry = state.pages[pageNum];
  if (!entry || !entry.viewport) return;
  const layer = entry.annoLayer;

  // Pertahankan popup/editor yang aktif agar tidak hilang saat re-render
  const keep = Array.from(layer.children).filter(
    (el) =>
      el.classList.contains("note-popup") ||
      el.classList.contains("text-editor"),
  );
  layer.innerHTML = "";
  keep.forEach((el) => layer.appendChild(el));

  const annos = state.annotations.filter((a) => a.pageNum === pageNum);
  if (!annos.length) return;

  let svg: SVGSVGElement | null = null;

  for (const a of annos) {
    const selected = a.id === state.selectedId;

    /* ---------- FREEHAND DRAW ---------- */
    if (a.type === "draw") {
      if (!svg) {
        svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("class", "anno-svg");
        layer.appendChild(svg);
      }
      if (!a.points || a.points.length < 2) continue;

      const d = a.points
        .map((p, i) => {
          const v = normToViewport(p.x, p.y, entry);
          return (i === 0 ? "M" : "L") + v.x.toFixed(2) + " " + v.y.toFixed(2);
        })
        .join(" ");

      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d);
      path.setAttribute("stroke", a.color || "#000");
      path.setAttribute(
        "stroke-width",
        String(Math.max(1, (a.lineWidth || 3) * state.scale)),
      );
      path.setAttribute("fill", "none");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.dataset.id = a.id;
      path.classList.add("anno-item");
      if (selected) path.style.filter = "drop-shadow(0 0 2px #3b82f6)";
      svg.appendChild(path);
      continue;
    }

    /* ---------- RECT-BASED ---------- */
    const r = normRectToViewport(a.rect as Rect, entry);

    if (a.type === "highlight") {
      const el = document.createElement("div");
      el.className = "anno-item anno-rect" + (selected ? " selected" : "");
      el.dataset.id = a.id;
      el.style.cssText =
        `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;` +
        `background:${a.color};opacity:${a.opacity ?? 0.45};mix-blend-mode:multiply;`;
      layer.appendChild(el);
      if (selected) attachResizeHandle(el, a, pageNum);
    } else if (a.type === "underline" || a.type === "strike") {
      const el = document.createElement("div");
      el.className = "anno-item anno-rect" + (selected ? " selected" : "");
      el.dataset.id = a.id;
      el.style.cssText = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;`;
      layer.appendChild(el);

      const thick = Math.max(1.5, 2 * state.scale);
      const line = document.createElement("div");
      line.className =
        a.type === "underline" ? "anno-underline" : "anno-strike";
      line.style.cssText =
        `left:${r.x}px;width:${r.w}px;height:${thick}px;background:${a.color};` +
        (a.type === "underline"
          ? `top:${r.y + r.h - thick}px;`
          : `top:${r.y + r.h / 2 - thick / 2}px;`);
      line.dataset.id = a.id;
      layer.appendChild(line);

      if (selected) attachResizeHandle(el, a, pageNum);
    } else if (a.type === "text") {
      const el = document.createElement("div");
      el.className = "anno-item anno-text" + (selected ? " selected" : "");
      el.dataset.id = a.id;
      el.textContent = a.text || "";
      el.style.cssText =
        `left:${r.x}px;top:${r.y}px;width:${Math.max(r.w, 20)}px;` +
        `font-size:${a.fontSize * state.scale}px;color:${a.color};` +
        `min-height:${r.h}px;`;
      layer.appendChild(el);
      if (selected) attachResizeHandle(el, a, pageNum);
    } else if (a.type === "note") {
      const el = document.createElement("div");
      el.className = "anno-item anno-note" + (selected ? " selected" : "");
      el.dataset.id = a.id;
      el.textContent = "📌";
      el.title = a.text || "Catatan";
      el.style.left = r.x + "px";
      el.style.top = r.y + "px";
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        hooks.onOpenNote?.(a, pageNum, false);
      });
      layer.appendChild(el);
    } else if (a.type === "signature" || a.type === "image") {
      const el = document.createElement("img");
      el.className = "anno-item anno-img" + (selected ? " selected" : "");
      el.dataset.id = a.id;
      el.src = a.imageDataUrl;
      el.draggable = false;
      el.style.cssText = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;`;
      layer.appendChild(el);
      if (selected) attachResizeHandle(el, a, pageNum);
    }
  }
}

/** Render semua halaman (dipakai setelah undo/redo). */
export function renderAllAnnotations(): void {
  for (const key in state.pages) {
    renderAnnotations(Number(key));
  }
}

/* ---------- Helper: resize handle ---------- */
function attachResizeHandle(
  el: HTMLElement,
  anno: Annotation,
  pageNum: number,
): void {
  const handle = document.createElement("div");
  handle.className = "resize-handle";
  el.appendChild(handle);
  handle.addEventListener("pointerdown", (ev) => {
    ev.stopPropagation();
    ev.preventDefault();
    hooks.onResizeStart?.(ev, anno, pageNum);
  });
}

/* ---------- Helper tak-dipakai-langsung (diekspos untuk renderer search) ---------- */
export type { PageEntry, Rect };
