import type { Tool } from "./types";

export const CONFIG = {
  DPR: Math.min(window.devicePixelRatio || 1, 2),
  ZOOM_MIN: 0.1,
  ZOOM_MAX: 5.0,
  ZOOM_STEP: 1.2,
  ZOOM_PRESETS: [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as readonly number[],
  COLORS: [
    "#ffeb3b",
    "#a5d6a7",
    "#90caf9",
    "#f48fb1",
    "#ffcc80",
    "#ce93d8",
    "#ef5350",
    "#1e1e1e",
  ] as readonly string[],
  DEFAULT_COLOR: "#ffeb3b",
  DEFAULT_LINE_WIDTH: 3,
  DEFAULT_FONT_SIZE: 16,
  MAX_HISTORY: 50,
  PAGE_BUFFER_PX: 900,
  STORAGE_PREFIX: "pdfviewer-tools:",
  THEME_KEY: "pdfviewer-theme",
  THUMB_WIDTH: 130,
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_SEARCH_RESULTS: 3000,
  AUTOSAVE_DELAY_MS: 700,
} as const;

export const CURSORS: Record<Tool, string> = {
  select: "default",
  highlight: "crosshair",
  underline: "crosshair",
  strike: "crosshair",
  note: "copy",
  draw: "crosshair",
  text: "text",
  signature: "crosshair",
  eraser: "not-allowed",
};

export const COLOR_TOOLS: Tool[] = [
  "highlight",
  "underline",
  "strike",
  "draw",
  "text",
  "note",
];
export const SIZE_TOOLS: Tool[] = ["draw"];
