import type { PDFDocumentProxy } from "pdfjs-dist";

export type { PDFDocumentProxy };
export type PDFPageProxy = Awaited<ReturnType<PDFDocumentProxy["getPage"]>>;
export type PageViewport = ReturnType<PDFPageProxy["getViewport"]>;
export type RenderTask = ReturnType<PDFPageProxy["render"]>;

export type TextContent = Awaited<ReturnType<PDFPageProxy["getTextContent"]>>;

/* ========== Annotation Model ========== */
export type Tool =
  | "select"
  | "highlight"
  | "underline"
  | "strike"
  | "note"
  | "draw"
  | "text"
  | "signature"
  | "eraser";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Point {
  x: number;
  y: number;
}

interface BaseAnnotation {
  id: string;
  pageNum: number;
  createdAt: number;
  updatedAt: number;
  color: string;
  opacity?: number;
}

export interface HighlightAnnotation extends BaseAnnotation {
  type: "highlight";
  rect: Rect;
}
export interface UnderlineAnnotation extends BaseAnnotation {
  type: "underline";
  rect: Rect;
}
export interface StrikeAnnotation extends BaseAnnotation {
  type: "strike";
  rect: Rect;
}
export interface TextAnnotation extends BaseAnnotation {
  type: "text";
  rect: Rect;
  text: string;
  fontSize: number;
}
export interface NoteAnnotation extends BaseAnnotation {
  type: "note";
  rect: Rect;
  text: string;
}
export interface DrawAnnotation extends BaseAnnotation {
  type: "draw";
  points: Point[];
  lineWidth: number;
}
export interface SignatureAnnotation extends BaseAnnotation {
  type: "signature" | "image";
  rect: Rect;
  imageDataUrl: string;
}

export type Annotation =
  | HighlightAnnotation
  | UnderlineAnnotation
  | StrikeAnnotation
  | TextAnnotation
  | NoteAnnotation
  | DrawAnnotation
  | SignatureAnnotation;

export type AnnotationType = Annotation["type"];

/* ========== Search ========== */
export interface SearchResult {
  pageNum: number;
  itemIndex: number;
  start: number;
  end: number;
  snippet: string;
}

export interface SearchState {
  query: string;
  results: SearchResult[];
  index: number;
  caseSensitive: boolean;
}

/* ========== Page ========== */
export interface PageEntry {
  container: HTMLDivElement;
  canvas: HTMLCanvasElement;
  textLayer: HTMLDivElement;
  annoLayer: HTMLDivElement;
  searchLayer: HTMLDivElement;
  formLayer: HTMLDivElement;
  viewport: PageViewport | null;
  baseW: number;
  baseH: number;
  renderTask: RenderTask | null;
  renderToken: number;
  renderedScale: number | null;
  renderedRotation: number | null;
  status: "idle" | "rendering" | "done";
  formsRendered: boolean;
}

export interface PageDims {
  w: number;
  h: number;
}
export type PageDimsMap = Record<number, PageDims>;
export type PageEntryMap = Record<number, PageEntry>;
export type TextContentMap = Record<number, TextContent>;
export type ThumbCacheMap = Record<number, string>;

/* ========== Field & Form ========== */
export type FieldValue = string | boolean;
export type FieldMap = Record<string, FieldValue>;

/* ========== Fit mode ========== */
export type FitMode = "width" | "page" | "none";

/* ========== OCR ========== */
export interface OCRWord {
  /** Text hasil OCR. */
  text: string;
  /** Bounding box ternormalisasi (0..1, origin kiri-atas, unrotated). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Confidence 0..100. */
  confidence: number;
}

export interface OCRPageResult {
  pageNum: number;
  words: OCRWord[];
  /** Full text dalam reading order. */
  text: string;
  language: string;
  confidence: number;
  createdAt: number;
}

export type OCRResultsMap = Record<number, OCRPageResult>;

/** Scanned page detection result. */
export interface ScannedPageInfo {
  pageNum: number;
  reason: "empty" | "sparse";
  textItemCount: number;
}

/* ========== App state ========== */
export interface AppStateShape {
  pdfDoc: PDFDocumentProxy | null;
  originalBytes: Uint8Array | null;
  fileName: string;
  fileHash: string;
  numPages: number;
  pageDims: PageDimsMap;

  scale: number;
  rotation: number;
  fitMode: FitMode;

  currentPage: number;
  tool: Tool;
  color: string;
  lineWidth: number;
  fontSize: number;

  annotations: Annotation[];
  fields: FieldMap;
  selectedId: string | null;
  pendingSignature: string | null;

  pages: PageEntryMap;
  textCache: TextContentMap;
  thumbCache: ThumbCacheMap;

  search: SearchState;

  undoStack: string[];
  redoStack: string[];

  sidebarOpen: boolean;
  sidebarTab: "thumbs" | "outline" | "search" | "annos";
  password: string | null;
  loading: boolean;

  ocrResults: OCRResultsMap;
}

/* ========== Loader ========== */
export type PDFSource =
  | { data: Uint8Array; url?: never }
  | { url: string; data?: never };

/** Omit yang terdistribusi atas union — mempertahankan discriminant. */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/** Bentuk input untuk `addAnnotation` — tanpa id/timestamps. */
export type NewAnnotation = DistributiveOmit<
  Annotation,
  "id" | "createdAt" | "updatedAt"
>;
