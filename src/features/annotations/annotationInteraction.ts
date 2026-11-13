/**
 * Interaksi anotasi — pointer events untuk semua tool.
 * Menghubungkan store (mutasi) + renderer (visual) + coords (konversi).
 */

import { state } from "@core/state";
import { clamp } from "@utils/dom";
import { hexA } from "@utils/colors";
import { toast } from "@utils/toast";
import {
  addAnnotation,
  deleteAnnotation,
  deleteAnnotationSilent,
  getAnnotationById,
  notifyAnnotationChanged,
  pushHistory,
  selectAnnotation,
  updateAnnotation,
} from "./annotationStore";
import { renderAnnotations, setRendererHooks } from "./annotationRenderer";
import { normToViewport, viewportPointToNorm } from "./coords";
import type { Annotation, NoteAnnotation, Point, Rect } from "@core/types";

/* ---------- Init: hubungkan renderer ke interaction ---------- */
export function initAnnotationInteraction(): void {
  setRendererHooks({
    onOpenNote: (anno, pageNum, isNew) => openNotePopup(anno, pageNum, isNew),
    onResizeStart: (e, anno, pageNum) => startResize(e, anno, pageNum),
  });
}

/* ---------- Entry point dari page container ---------- */
export function handlePagePointerDown(pageNum: number, e: PointerEvent): void {
  if (!state.pdfDoc) return;
  if (e.button !== 0 && e.pointerType === "mouse") return;

  const entry = state.pages[pageNum];
  if (!entry || !entry.viewport) return;

  const container = entry.container;
  const rc = container.getBoundingClientRect();
  const px = e.clientX - rc.left;
  const py = e.clientY - rc.top;
  const norm = viewportPointToNorm(px, py, entry);
  const tool = state.tool;

  /* ---------- SELECT ---------- */
  if (tool === "select") {
    const target = (e.target as Element | null)?.closest?.(
      ".anno-item",
    ) as HTMLElement | null;
    if (target) {
      e.preventDefault();
      const id = target.dataset.id;
      if (id) {
        selectAnnotation(id);
        startAnnoDrag(pageNum, id, norm);
      }
    } else if (state.selectedId) {
      selectAnnotation(null);
    }
    return;
  }

  /* ---------- ERASER ---------- */
  if (tool === "eraser") {
    const target = (e.target as Element | null)?.closest?.(
      ".anno-item",
    ) as HTMLElement | null;
    if (target?.dataset.id) {
      e.preventDefault();
      deleteAnnotation(target.dataset.id);
      toast("Anotasi dihapus");
    }
    return;
  }

  /* ---------- RECT TOOLS ---------- */
  if (tool === "highlight" || tool === "underline" || tool === "strike") {
    e.preventDefault();
    startRectDrag(e, pageNum, tool);
    return;
  }

  /* ---------- DRAW ---------- */
  if (tool === "draw") {
    e.preventDefault();
    startDraw(e, pageNum);
    return;
  }

  /* ---------- TEXT ---------- */
  if (tool === "text") {
    e.preventDefault();
    startTextEditor(pageNum, norm);
    return;
  }

  /* ---------- NOTE ---------- */
  if (tool === "note") {
    e.preventDefault();
    const a = addAnnotation({
      pageNum,
      type: "note",
      rect: {
        x: clamp(norm.x, 0, 0.97),
        y: clamp(norm.y, 0, 0.97),
        w: 0.02,
        h: 0.02,
      },
      text: "",
      color: state.color,
    });
    openNotePopup(a as NoteAnnotation, pageNum, true);
    return;
  }

  /* ---------- SIGNATURE ---------- */
  if (tool === "signature") {
    if (!state.pendingSignature) {
      toast("Buat tanda tangan terlebih dahulu", "error");
      return;
    }
    e.preventDefault();
    startSignatureDrag(e, pageNum);
    return;
  }
}

/* ---------- Rect drag (highlight / underline / strike) ---------- */
function startRectDrag(
  e: PointerEvent,
  pageNum: number,
  type: "highlight" | "underline" | "strike",
): void {
  const entry = state.pages[pageNum];
  if (!entry) return;
  const container = entry.container;
  const rc = container.getBoundingClientRect();
  const sx = e.clientX;
  const sy = e.clientY;

  const ghost = document.createElement("div");
  ghost.className = "anno-ghost";
  ghost.style.background =
    type === "highlight" ? hexA(state.color, 0.4) : "transparent";
  ghost.style.border =
    type === "highlight" ? "none" : `1.5px dashed ${state.color}`;
  entry.annoLayer.appendChild(ghost);

  const move = (ev: PointerEvent) => {
    ghost.style.left = Math.min(sx, ev.clientX) - rc.left + "px";
    ghost.style.top = Math.min(sy, ev.clientY) - rc.top + "px";
    ghost.style.width = Math.abs(ev.clientX - sx) + "px";
    ghost.style.height = Math.abs(ev.clientY - sy) + "px";
  };

  const up = (ev: PointerEvent) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    ghost.remove();

    const p1 = viewportPointToNorm(sx - rc.left, sy - rc.top, entry);
    const p2 = viewportPointToNorm(
      ev.clientX - rc.left,
      ev.clientY - rc.top,
      entry,
    );
    const rect: Rect = {
      x: clamp(Math.min(p1.x, p2.x), 0, 1),
      y: clamp(Math.min(p1.y, p2.y), 0, 1),
      w: Math.abs(p2.x - p1.x),
      h: Math.abs(p2.y - p1.y),
    };
    if (rect.w < 0.004 || rect.h < 0.004) return;
    rect.w = Math.min(rect.w, 1 - rect.x);
    rect.h = Math.min(rect.h, 1 - rect.y);

    addAnnotation({
      pageNum,
      type,
      rect,
      color: state.color,
      opacity: type === "highlight" ? 0.45 : 1,
    });
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

/* ---------- Freehand draw ---------- */
function startDraw(e: PointerEvent, pageNum: number): void {
  const entry = state.pages[pageNum];
  if (!entry) return;
  const container = entry.container;
  const rc = container.getBoundingClientRect();

  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "anno-svg");
  svg.style.pointerEvents = "none";

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("stroke", state.color);
  path.setAttribute(
    "stroke-width",
    String(Math.max(1, state.lineWidth * state.scale)),
  );
  path.setAttribute("fill", "none");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  entry.annoLayer.appendChild(svg);

  const points: Point[] = [];
  const local = (ev: PointerEvent): Point => ({
    x: ev.clientX - rc.left,
    y: ev.clientY - rc.top,
  });
  const pushPoint = (p: Point) => {
    points.push(p);
    path.setAttribute(
      "d",
      points
        .map(
          (pt, i) =>
            (i === 0 ? "M" : "L") + pt.x.toFixed(2) + " " + pt.y.toFixed(2),
        )
        .join(" "),
    );
  };
  pushPoint(local(e));

  const move = (ev: PointerEvent) => {
    const p = local(ev);
    const last = points[points.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 1.5) return;
    pushPoint(p);
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    svg.remove();
    if (points.length < 2) return;
    const pts = points.map((p) => viewportPointToNorm(p.x, p.y, entry));
    addAnnotation({
      pageNum,
      type: "draw",
      points: pts,
      color: state.color,
      lineWidth: state.lineWidth,
    });
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

/* ---------- Signature drag ---------- */
function startSignatureDrag(e: PointerEvent, pageNum: number): void {
  const entry = state.pages[pageNum];
  if (!entry || !state.pendingSignature) return;
  const container = entry.container;
  const rc = container.getBoundingClientRect();
  const sx = e.clientX;
  const sy = e.clientY;

  const ghost = document.createElement("div");
  ghost.className = "anno-ghost";
  ghost.style.border = "1.5px dashed #3b82f6";
  ghost.style.background = "rgba(59,130,246,.12)";
  entry.annoLayer.appendChild(ghost);

  const move = (ev: PointerEvent) => {
    ghost.style.left = Math.min(sx, ev.clientX) - rc.left + "px";
    ghost.style.top = Math.min(sy, ev.clientY) - rc.top + "px";
    ghost.style.width = Math.abs(ev.clientX - sx) + "px";
    ghost.style.height = Math.abs(ev.clientY - sy) + "px";
  };

  const up = (ev: PointerEvent) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    ghost.remove();

    const p1 = viewportPointToNorm(sx - rc.left, sy - rc.top, entry);
    const p2 = viewportPointToNorm(
      ev.clientX - rc.left,
      ev.clientY - rc.top,
      entry,
    );

    let rect: Rect = {
      x: clamp(Math.min(p1.x, p2.x), 0, 1),
      y: clamp(Math.min(p1.y, p2.y), 0, 1),
      w: Math.abs(p2.x - p1.x),
      h: Math.abs(p2.y - p1.y),
    };
    if (rect.w < 0.02 || rect.h < 0.01) {
      const w = 0.25;
      rect = { x: clamp(p1.x, 0, 1 - w), y: clamp(p1.y, 0, 0.95), w, h: 0.09 };
    }

    addAnnotation({
      pageNum,
      type: "signature",
      rect,
      imageDataUrl: state.pendingSignature as string,
      color: state.color,
    });
    state.pendingSignature = null;
    // Caller (App) akan handle reset tool → biarkan via event bus
    toast("Tanda tangan ditempatkan", "ok");
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

/* ---------- Drag anotasi existing ---------- */
/* ---------- Drag anotasi existing ---------- */
function startAnnoDrag(pageNum: number, id: string, normStart: Point): void {
  const anno = getAnnotationById(id);
  if (!anno) return;
  const entry = state.pages[pageNum];
  if (!entry) return;
  const container = entry.container;
  const orig = JSON.parse(JSON.stringify(anno)) as Annotation;
  let moved = false;

  const move = (ev: PointerEvent) => {
    const rc = container.getBoundingClientRect();
    const n = viewportPointToNorm(
      ev.clientX - rc.left,
      ev.clientY - rc.top,
      entry,
    );
    const dx = n.x - normStart.x;
    const dy = n.y - normStart.y;
    if (!moved && Math.hypot(dx, dy) < 0.0015) return;
    if (!moved) {
      moved = true;
      pushHistory();
    }

    if ("rect" in anno && "rect" in orig) {
      anno.rect = {
        x: clamp(orig.rect.x + dx, 0, 1 - orig.rect.w),
        y: clamp(orig.rect.y + dy, 0, 1 - orig.rect.h),
        w: orig.rect.w,
        h: orig.rect.h,
      };
    }
    if (anno.type === "draw" && orig.type === "draw") {
      anno.points = orig.points.map((p) => ({
        x: clamp(p.x + dx, -0.1, 1.1),
        y: clamp(p.y + dy, -0.1, 1.1),
      }));
    }

    renderAnnotations(pageNum);
  };

  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    if (moved) notifyAnnotationChanged(pageNum);
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

/* ---------- Resize drag (dipanggil dari renderer hook) ---------- */
function startResize(e: PointerEvent, anno: Annotation, pageNum: number): void {
  const entry = state.pages[pageNum];
  if (!entry || !("rect" in anno)) return;

  const container = entry.container;
  const startRect: Rect = { ...anno.rect };
  const rc = container.getBoundingClientRect();
  const n0 = viewportPointToNorm(
    e.clientX - rc.left,
    e.clientY - rc.top,
    entry,
  );
  let pushed = false;

  const move = (ev: PointerEvent) => {
    const n1 = viewportPointToNorm(
      ev.clientX - rc.left,
      ev.clientY - rc.top,
      entry,
    );
    const dw = n1.x - n0.x;
    const dh = n1.y - n0.y;
    if (!pushed) {
      pushHistory();
      pushed = true;
    }
    anno.rect = {
      x: startRect.x,
      y: startRect.y,
      w: clamp(startRect.w + dw, 0.01, 1 - startRect.x),
      h: clamp(startRect.h + dh, 0.01, 1 - startRect.y),
    };
    renderAnnotations(pageNum);
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    if (pushed) notifyAnnotationChanged(pageNum);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

/* ---------- Text box editor ---------- */
export function startTextEditor(
  pageNum: number,
  norm: Point,
  existing: Annotation | null = null,
): void {
  const entry = state.pages[pageNum];
  if (!entry) return;
  const pos = normToViewport(norm.x, norm.y, entry);

  const ta = document.createElement("textarea");
  ta.className = "text-editor";
  ta.style.left = pos.x + "px";
  ta.style.top = pos.y + "px";
  ta.style.fontSize = state.fontSize * state.scale + "px";
  ta.style.color = state.color;
  ta.value = existing && "text" in existing ? existing.text : "";
  ta.rows = 1;
  entry.annoLayer.appendChild(ta);
  setTimeout(() => ta.focus(), 20);

  let finished = false;
  const finish = (commit: boolean) => {
    if (finished) return;
    finished = true;
    const text = ta.value.replace(/\s+$/, "");
    ta.remove();
    if (!commit || !text) return;

    const lines = text.split("\n");
    const maxLen = Math.max(...lines.map((l) => l.length), 1);
    const fontPx = state.fontSize * state.scale;
    const boxW = Math.min(
      maxLen * fontPx * 0.58 + 8,
      entry.container.clientWidth - pos.x,
    );
    const boxH = lines.length * fontPx * 1.3 + 4;

    const rect: Rect = {
      x: clamp(norm.x, 0, 0.98),
      y: clamp(norm.y, 0, 0.98),
      w: boxW / entry.container.clientWidth,
      h: boxH / entry.container.clientHeight,
    };

    if (existing) {
      pushHistory();
      updateAnnotation(existing.id, { text } as Partial<Annotation>);
    } else {
      addAnnotation({
        pageNum,
        type: "text",
        rect,
        text,
        color: state.color,
        fontSize: state.fontSize,
      });
    }
  };

  ta.addEventListener("keydown", (ev) => {
    ev.stopPropagation();
    if (ev.key === "Escape") {
      ev.preventDefault();
      finish(false);
    }
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      finish(true);
    }
  });
  ta.addEventListener("blur", () => finish(true));
}

/* ---------- Note popup ---------- */
export function openNotePopup(
  anno: NoteAnnotation,
  pageNum: number,
  isNew = false,
): void {
  const entry = state.pages[pageNum];
  if (!entry) return;
  entry.annoLayer.querySelectorAll(".note-popup").forEach((el) => el.remove());

  const pos = normToViewport(anno.rect.x, anno.rect.y, entry);
  const popup = document.createElement("div");
  popup.className = "note-popup";
  popup.style.left =
    Math.min(pos.x + 30, entry.container.clientWidth - 240) + "px";
  popup.style.top =
    Math.min(pos.y, Math.max(0, entry.container.clientHeight - 160)) + "px";
  popup.innerHTML = `
    <textarea placeholder="Tulis catatan…">${anno.text ? anno.text.replace(/</g, "&lt;") : ""}</textarea>
    <div class="np-actions">
      <button class="btn" data-act="del" style="height:26px;padding:0 10px;font-size:11px">Hapus</button>
      <button class="btn primary" data-act="save" style="height:26px;padding:0 10px;font-size:11px">Simpan</button>
    </div>`;

  const ta = popup.querySelector("textarea") as HTMLTextAreaElement;
  ta.addEventListener("keydown", (ev) => ev.stopPropagation());
  setTimeout(() => ta.focus(), 30);

  (popup.querySelector('[data-act="save"]') as HTMLButtonElement).onclick =
    () => {
      const text = ta.value.trim();
      if (isNew && !text) {
        deleteAnnotationSilent(anno.id);
      } else if (text !== anno.text) {
        // Edit text → push history once
        pushHistory();
        updateAnnotation(anno.id, { text } as Partial<Annotation>);
      }
      popup.remove();
    };
  (popup.querySelector('[data-act="del"]') as HTMLButtonElement).onclick =
    () => {
      popup.remove();
      deleteAnnotation(anno.id);
      toast("Anotasi dihapus");
    };

  entry.annoLayer.appendChild(popup);
}
