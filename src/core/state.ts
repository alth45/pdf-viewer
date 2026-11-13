import { CONFIG } from "./config";
import type { AppStateShape } from "./types";

/**
 * Global app state — single instance, exported as `state`.
 * Fields are mutated directly (mirrors the original design);
 * higher-level logic lives in features/services.
 */
export const state: AppStateShape = {
  pdfDoc: null,
  originalBytes: null,
  fileName: "",
  fileHash: "",
  numPages: 0,
  pageDims: {},

  scale: 1,
  rotation: 0,
  fitMode: "width",

  currentPage: 1,
  tool: "select",
  color: CONFIG.DEFAULT_COLOR,
  lineWidth: CONFIG.DEFAULT_LINE_WIDTH,
  fontSize: CONFIG.DEFAULT_FONT_SIZE,

  annotations: [],
  fields: {},
  selectedId: null,
  pendingSignature: null,

  pages: {},
  textCache: {},
  thumbCache: {},

  search: { query: "", results: [], index: -1, caseSensitive: false },

  undoStack: [],
  redoStack: [],

  sidebarOpen: true,
  sidebarTab: "thumbs",
  password: null,
  loading: false,

  ocrResults: {},
};

/** Reset semua state viewer (dipanggil sebelum load dokumen baru). */
export function resetViewerState(): void {
  state.pages = {};
  state.textCache = {};
  state.thumbCache = {};
  state.annotations = [];
  state.fields = {};
  state.selectedId = null;
  state.undoStack = [];
  state.redoStack = [];
  state.search = { query: "", results: [], index: -1, caseSensitive: false };
  state.rotation = 0;
  state.currentPage = 1;
  state.pendingSignature = null;
  state.ocrResults = {}; // ← TAMBAH
}
