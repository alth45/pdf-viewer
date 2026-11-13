/**
 * Annotation store — CRUD + undo/redo + selection.
 * Memancarkan event lewat hooks; TIDAK menyentuh DOM atau autosave secara langsung.
 */

import { state } from "@core/state";
import { CONFIG } from "@core/config";
import { uid } from "@utils/dom";
import type { Annotation, NewAnnotation } from "@core/types";

/* ---------- Event & hooks ---------- */
export type AnnotationChangeEvent =
  | { kind: "add"; pageNum: number }
  | { kind: "update"; pageNum: number }
  | { kind: "delete"; pageNum: number }
  | { kind: "select"; pageNums: number[] }
  | { kind: "bulk" }
  | { kind: "reset" };

export interface AnnotationStoreHooks {
  /** Dipanggil setelah setiap mutasi berhasil. */
  onChanged?: (evt: AnnotationChangeEvent) => void;
  /** Dipanggil setiap undo/redo stack berubah (untuk enable/disable tombol). */
  onHistoryChanged?: (canUndo: boolean, canRedo: boolean) => void;
}

let hooks: AnnotationStoreHooks = {};

export function initAnnotationStore(opts: AnnotationStoreHooks = {}): void {
  hooks = opts;
}

function fire(evt: AnnotationChangeEvent): void {
  hooks.onChanged?.(evt);
}

function notifyHistory(): void {
  hooks.onHistoryChanged?.(
    state.undoStack.length > 0,
    state.redoStack.length > 0,
  );
}

/* ---------- Query helpers ---------- */
export function getAnnotationsForPage(pageNum: number): Annotation[] {
  return state.annotations.filter((a) => a.pageNum === pageNum);
}

export function getAnnotationById(id: string): Annotation | undefined {
  return state.annotations.find((a) => a.id === id);
}

/* ---------- History ---------- */
/** Snapshot state anotasi saat ini ke undo stack. Dipanggil SEBELUM mutasi. */
export function pushHistory(): void {
  state.undoStack.push(JSON.stringify(state.annotations));
  if (state.undoStack.length > CONFIG.MAX_HISTORY) state.undoStack.shift();
  state.redoStack.length = 0;
  notifyHistory();
}

export function undo(): void {
  if (!state.undoStack.length) return;
  state.redoStack.push(JSON.stringify(state.annotations));
  state.annotations = JSON.parse(
    state.undoStack.pop() as string,
  ) as Annotation[];
  state.selectedId = null;
  notifyHistory();
  fire({ kind: "bulk" });
}

export function redo(): void {
  if (!state.redoStack.length) return;
  state.undoStack.push(JSON.stringify(state.annotations));
  state.annotations = JSON.parse(
    state.redoStack.pop() as string,
  ) as Annotation[];
  state.selectedId = null;
  notifyHistory();
  fire({ kind: "bulk" });
}

export function resetHistory(): void {
  state.undoStack.length = 0;
  state.redoStack.length = 0;
  notifyHistory();
}

/* ---------- CRUD ---------- */
/**
 * Tambahkan anotasi baru. Push history dilakukan otomatis.
 * Default `opacity` 0.45 (dipakai highlight rendering).
 */
export function addAnnotation(input: NewAnnotation): Annotation {
  pushHistory();
  const a = {
    id: uid(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    opacity: 0.45,
    ...input,
  } as Annotation;
  state.annotations.push(a);
  fire({ kind: "add", pageNum: a.pageNum });
  return a;
}

/**
 * Update anotasi. TIDAK push history (matches original behavior);
 * gunakan `pushHistory()` manual sebelum mengedit jika perlu.
 */
export function updateAnnotation(
  id: string,
  patch: Partial<Annotation>,
  opts: { silent?: boolean } = {},
): void {
  const a = getAnnotationById(id);
  if (!a) return;
  Object.assign(a, patch, { updatedAt: Date.now() });
  if (!opts.silent) fire({ kind: "update", pageNum: a.pageNum });
}

export function deleteAnnotation(id: string): void {
  const idx = state.annotations.findIndex((a) => a.id === id);
  if (idx < 0) return;
  pushHistory();
  const [removed] = state.annotations.splice(idx, 1);
  if (state.selectedId === id) state.selectedId = null;
  fire({ kind: "delete", pageNum: removed.pageNum });
}

/**
 * Hapus tanpa push history — untuk kasus "new note yang dibatalkan"
 * (matches original behavior: tidak menambah undo entry).
 */
export function deleteAnnotationSilent(id: string): void {
  const idx = state.annotations.findIndex((a) => a.id === id);
  if (idx < 0) return;
  const [removed] = state.annotations.splice(idx, 1);
  if (state.selectedId === id) state.selectedId = null;
  fire({ kind: "delete", pageNum: removed.pageNum });
}

/* ---------- Selection ---------- */
export function selectAnnotation(id: string | null): void {
  if (state.selectedId === id) return;
  const prevId = state.selectedId;
  state.selectedId = id;

  const pageNums: number[] = [];
  const prevAnno = prevId ? getAnnotationById(prevId) : null;
  const newAnno = id ? getAnnotationById(id) : null;
  if (prevAnno) pageNums.push(prevAnno.pageNum);
  if (newAnno && !pageNums.includes(newAnno.pageNum)) {
    pageNums.push(newAnno.pageNum);
  }

  if (pageNums.length) fire({ kind: "select", pageNums });
}

/* ---------- Manual notify (untuk drag silent) ---------- */
/** Dipanggil manual setelah serangkaian mutasi silent (mis. drag). */
export function notifyAnnotationChanged(pageNum: number): void {
  fire({ kind: "update", pageNum });
}
