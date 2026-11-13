/**
 * Keyboard shortcuts — dipisah dari App agar mudah dites & dibaca.
 * Semua aksi disuplai lewat object actions; tidak impor App langsung.
 */

import { isTypingTarget } from "@utils/dom";
import type { Tool } from "@core/types";

export interface KeyboardActions {
  openFile(): void;
  save(): void;
  print(): void;
  merge(): void;
  toggleFullscreen(): void;
  openSearch(): void;
  toggleSidebar(): void;
  gotoPageDialog(): void;
  zoomIn(): void;
  zoomOut(): void;
  fitPage(): void;
  undo(): void;
  redo(): void;
  onEscape(): void;

  scrollViewer(deltaY: number): void;
  scrollViewerTop(): void;
  scrollViewerBottom(): void;
  nextPage(): void;
  prevPage(): void;
  gotoPage(n: number): void;

  setTool(tool: Tool): void;
  deleteSelected(): void;

  hasDocument(): boolean;
  getNumPages(): number;
  getSelectedId(): string | null;
}

export function initKeyboard(actions: KeyboardActions): void {
  document.addEventListener("keydown", (e) => {
    const isTyping = isTypingTarget(e.target);
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    /* ---------- Global shortcuts (fire even when typing for Ctrl+S/O/F) ---------- */
    if (ctrl && key === "o") {
      e.preventDefault();
      actions.openFile();
      return;
    }
    if (ctrl && key === "s") {
      e.preventDefault();
      if (actions.hasDocument()) actions.save();
      return;
    }
    if (ctrl && key === "p") {
      e.preventDefault();
      if (actions.hasDocument()) actions.print();
      return;
    }
    if (ctrl && key === "f") {
      e.preventDefault();
      actions.openSearch();
      return;
    }
    if (ctrl && key === "b") {
      e.preventDefault();
      actions.toggleSidebar();
      return;
    }
    if (ctrl && key === "g") {
      e.preventDefault();
      if (actions.hasDocument()) actions.gotoPageDialog();
      return;
    }
    if (ctrl && (e.key === "=" || e.key === "+")) {
      e.preventDefault();
      actions.zoomIn();
      return;
    }
    if (ctrl && e.key === "-") {
      e.preventDefault();
      actions.zoomOut();
      return;
    }
    if (ctrl && e.key === "0") {
      e.preventDefault();
      actions.fitPage();
      return;
    }
    if (ctrl && key === "z" && !isTyping) {
      e.preventDefault();
      if (e.shiftKey) actions.redo();
      else actions.undo();
      return;
    }
    if (ctrl && key === "y" && !isTyping) {
      e.preventDefault();
      actions.redo();
      return;
    }

    if (e.key === "Escape") {
      actions.onEscape();
      return;
    }

    if (isTyping) return;
    if (!actions.hasDocument()) return;

    /* ---------- Navigation ---------- */
    switch (e.key) {
      case "ArrowDown":
        actions.scrollViewer(120);
        e.preventDefault();
        break;
      case "ArrowUp":
        actions.scrollViewer(-120);
        e.preventDefault();
        break;
      case "PageDown":
        if (!ctrl) {
          actions.nextPage();
          e.preventDefault();
        }
        break;
      case "PageUp":
        if (!ctrl) {
          actions.prevPage();
          e.preventDefault();
        }
        break;
      case "Home":
        if (ctrl) actions.gotoPage(1);
        else actions.scrollViewerTop();
        e.preventDefault();
        break;
      case "End":
        if (ctrl) actions.gotoPage(actions.getNumPages());
        else actions.scrollViewerBottom();
        e.preventDefault();
        break;
      case "Delete":
      case "Backspace":
        if (actions.getSelectedId()) {
          e.preventDefault();
          actions.deleteSelected();
        }
        break;
      case "h":
      case "H":
        actions.setTool("highlight");
        break;
      case "u":
      case "U":
        actions.setTool("underline");
        break;
      case "s":
      case "S":
        actions.setTool("strike");
        break;
      case "n":
      case "N":
        actions.setTool("note");
        break;
      case "d":
      case "D":
        actions.setTool("draw");
        break;
      case "t":
      case "T":
        actions.setTool("text");
        break;
      case "v":
      case "V":
        actions.setTool("select");
        break;
      case "e":
      case "E":
        actions.setTool("eraser");
        break;
      case "m":
      case "M":
        actions.merge();
        break;
      case "f":
      case "F":
        actions.toggleFullscreen();
        break;
    }
  });
}
