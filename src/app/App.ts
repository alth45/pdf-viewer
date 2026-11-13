/**
 * App orchestrator — satu-satunya tempat yang me-wire semua modul.
 *
 * Prinsip:
 * - Feature/service/ui tidak saling impor silang.
 * - Semua wiring terjadi di sini via hook/callback.
 * - `state` diimpor dari @core/state dan dimutasi di sini (single writer).
 */

import { state, resetViewerState } from "@core/state";
import { CONFIG } from "@core/config";
import { $, debounce } from "@utils/dom";
import { toast } from "@utils/toast";

/* ---------- Services ---------- */
import {
  loadPDF,
  destroyPDF,
  PDFLoadError,
  loadAutosave,
  createAutosaveScheduler,
  exportPDF,
  printPDF,
  mergePDFs,
  generateMergeFilename,
  detectScannedPages,
  ocrPages,
  ocrWordToTextItem,
  type OCRPageResult,
} from "@services/index";

/* ---------- Features ---------- */
import {
  initViewerController,
  onViewerScroll,
  renderVisiblePages,
  computeFitScale,
  setScale,
  zoomIn,
  zoomOut,
  fitWidth,
  fitPage,
  rotate,
  gotoPage,
  nextPage,
  prevPage,
  buildPages,
  clearPages,
  setOnPageRendered,
  isPresentationMode,
  togglePresentationMode,
  exitPresentationMode,
  initReadingMode,
  getReadingMode,
  setReadingMode,
  renderPage,
} from "@features/viewer/index";

import {
  initAnnotationStore,
  initAnnotationInteraction,
  handlePagePointerDown,
  renderAnnotations,
  renderAllAnnotations,
} from "@features/annotations/index";

import {
  initSearchManager,
  runSearch,
  focusSearchResult,
  nextSearchResult,
  prevSearchResult,
  renderSearchHighlights,
  clearSearchHighlights,
  renderSearchResultList,
} from "@features/search/searchManager";

import {
  initFormFieldManager,
  renderFormFields,
} from "@features/forms/formFieldManager";

import {
  initOutlineManager,
  buildOutline,
} from "@features/outline/outlineManager";

import {
  initThumbnailManager,
  buildThumbnails,
  highlightThumb,
  clearThumbCache,
} from "@features/thumbnails/thumbnailManager";

import {
  selectAnnotation,
  deleteAnnotation,
  updateAnnotation,
  pushHistory,
  undo,
  redo,
  getAnnotationById,
} from "@features/annotations/annotationStore";

/* ---------- UI ---------- */
import {
  setProgress,
  updatePageBadge,
  initFileInput,
  openFilePicker,
  initDropzone,
  initToolbar,
  setTool as toolbarSetTool,
  setColor as toolbarSetColor,
  initSidebar,
  activateTab,
  getActiveTab,
  toggleSidebar,
  getThumbGrid,
  getOutlineTree,
  getSearchResultsBox,
  getSearchInput,
  getSearchCaseCheckbox,
  getSearchCountEl,
  renderAnnotationList,
  initTopbar,
  setFileInfo,
  setPageInfo,
  setZoomPreset,
  setUndoRedo,
  setSaveEnabled,
  showEmptyState,
  askPassword,
  askUrl,
  askSaveOptions,
  askSignature,
  initReadingModeMenu,
  updateReadingModeUI,
  askMergeFiles,
  askOCRPages,
} from "@ui/index";

import { initKeyboard } from "./keyboard";
import type { PDFSource, Tool } from "@core/types";
import { downloadBlob } from "@utils/download";
/* ============================================================
   App class
   ============================================================ */
export class App {
  private autosave: () => void;
  private initialized = false;

  constructor() {
    this.autosave = createAutosaveScheduler({
      getFileHash: () => state.fileHash,
      getData: () => ({
        annotations: state.annotations,
        fields: state.fields,
      }),
    });
  }

  /* ------------------------------------------------------------
     INIT
     ------------------------------------------------------------ */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.initTheme();
    this.initReadingMode();
    this.initViewer();
    this.initAnnotations();
    this.initSearch();
    this.initForms();
    this.initOutline();
    this.initThumbnails();
    this.initTopbar();
    this.initToolbar();
    this.initSidebar();
    this.initFilePicker();
    this.initKeyboard();
    this.initPresentationExitButton();
    // Render initial state
    renderAnnotationList(state.annotations);

    // ?file= query param
    const params = new URLSearchParams(location.search);
    const fileUrl = params.get("file");
    if (fileUrl) void this.loadFromUrl(fileUrl);
  }

  private initTheme(): void {
    const saved = localStorage.getItem(CONFIG.THEME_KEY);
    const html = document.documentElement;
    if (saved) html.dataset.theme = saved;
    else if (!html.dataset.theme) html.dataset.theme = "dark";
  }
  private initReadingMode(): void {
    initReadingMode();
    initReadingModeMenu({
      getMode: () => getReadingMode(),
      onSelect: (mode) => {
        setReadingMode(mode);
        updateReadingModeUI(mode);
      },
    });
  }

  private initPresentationExitButton(): void {
    document
      .getElementById("btnExitPresentation")
      ?.addEventListener("click", () => void exitPresentationMode());
  }

  private initViewer(): void {
    const viewerEl = $("#viewer");

    initViewerController({
      viewer: viewerEl,
      hooks: {
        onCurrentPageChanged: (n) => {
          setPageInfo(n, state.numPages);
          updatePageBadge(n, state.numPages);
          highlightThumb(n, getThumbGrid());
        },
        onScaleChanged: (scale) => {
          setZoomPreset(scale);
        },
      },
    });

    setOnPageRendered((n) => {
      renderAnnotations(n);
      renderSearchHighlights(n);
      void renderFormFields(n);
    });

    viewerEl.addEventListener("scroll", onViewerScroll, { passive: true });

    window.addEventListener(
      "resize",
      debounce(() => {
        if (!state.pdfDoc) return;
        if (state.fitMode === "width") fitWidth();
        else if (state.fitMode === "page") fitPage();
        else renderVisiblePages(viewerEl);
      }, 200),
    );
  }

  private initAnnotations(): void {
    initAnnotationStore({
      onChanged: (evt) => {
        switch (evt.kind) {
          case "bulk":
          case "reset":
            renderAllAnnotations();
            break;
          case "select":
            for (const p of evt.pageNums) renderAnnotations(p);
            break;
          case "add":
          case "update":
          case "delete":
            renderAnnotations(evt.pageNum);
            break;
        }
        renderAnnotationList(state.annotations);
        this.autosave();
      },
      onHistoryChanged: (canUndo, canRedo) => {
        setUndoRedo(canUndo, canRedo);
      },
    });

    initAnnotationInteraction();
  }

  private initSearch(): void {
    initSearchManager({
      onResultsChanged: (results, index) => {
        renderSearchResultList(results, index, getSearchResultsBox(), {
          onSelect: (i) => focusSearchResult(i),
        });
        // Sync page UI untuk no-scroll case (search baru mulai)
        if (index >= 0 && results[index]) {
          const p = results[index].pageNum;
          setPageInfo(p, state.numPages);
          updatePageBadge(p, state.numPages);
          highlightThumb(p, getThumbGrid());
        }
      },
      onCountChanged: (count) => {
        const el = getSearchCountEl();
        if (count < 0) el.textContent = "Mencari…";
        else if (count === 0) {
          el.textContent = state.search.query.trim() ? "0 hasil" : "";
        } else el.textContent = `${count} hasil`;
      },
      gotoPage: (n, smooth) => gotoPage(n, smooth),
    });

    const searchInput = getSearchInput();
    let searchTimer: number | null = null;
    searchInput.addEventListener("input", () => {
      if (searchTimer) window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        void this.executeSearch(searchInput.value);
      }, 260);
    });

    getSearchCaseCheckbox().addEventListener("change", () => {
      void this.executeSearch(searchInput.value);
    });

    $("#searchNext").addEventListener("click", () => nextSearchResult());
    $("#searchPrev").addEventListener("click", () => prevSearchResult());
  }

  private initForms(): void {
    initFormFieldManager({
      onFieldChanged: () => this.autosave(),
    });
  }

  private initOutline(): void {
    initOutlineManager({
      gotoPage: (n) => gotoPage(n),
    });
  }

  private initThumbnails(): void {
    initThumbnailManager({
      gotoPage: (n) => gotoPage(n),
      getActivePage: () => state.currentPage,
    });
  }

  private initTopbar(): void {
    initTopbar({
      onToggleSidebar: () => this.toggleSidebar(),
      onOpen: () => openFilePicker(),
      onOpenUrl: () => void this.openUrlFlow(),
      onOpenEmpty: () => openFilePicker(),
      onPrev: prevPage,
      onNext: nextPage,
      onGotoPage: (n: any) => gotoPage(n),
      onZoomIn: zoomIn,
      onZoomOut: zoomOut,
      onZoomPreset: (s: any) => setScale(s, { fitMode: "none" }),
      onFitWidth: fitWidth,
      onFitPage: fitPage,
      onRotate: () => rotate(90),
      onUndo: undo,
      onRedo: redo,
      onSearch: () => this.openSearchPanel(),
      onThemeToggle: () => this.toggleTheme(),
      onFullscreen: () => void this.toggleFullscreen(),
      onPrint: () => void this.print(),
      onMerge: () => void this.mergeFlow(),
      onOCR: () => void this.ocrFlow(),
      onSave: () => void this.save(),
    });
  }

  private initToolbar(): void {
    initToolbar({
      onToolChange: (t: any) => this.setTool(t),
      onColorChange: (c: any) => {
        state.color = c;
        toolbarSetColor(c);
        if (state.selectedId) {
          const a = getAnnotationById(state.selectedId);
          if (a) {
            pushHistory();
            updateAnnotation(state.selectedId, { color: c });
          }
        }
      },
      onSizeChange: (size: any) => {
        state.lineWidth = size;
        state.fontSize = Math.max(8, size * 5);
      },
      onSignatureClick: () => void this.openSignatureFlow(),
    });
  }

  private initSidebar(): void {
    initSidebar({
      onTabChange: (tab: any) => {
        if (tab === "search") {
          setTimeout(() => getSearchInput().focus(), 50);
        }
      },
      onAnnoSelect: (id: any) => {
        const a = getAnnotationById(id);
        if (!a) return;
        gotoPage(a.pageNum);
        selectAnnotation(id);
      },
    });
  }

  private initFilePicker(): void {
    initFileInput((file: any) => void this.loadFromFile(file));
    initDropzone();
  }

  private initKeyboard(): void {
    initKeyboard({
      openFile: () => openFilePicker(),
      save: () => void this.save(),
      openSearch: () => this.openSearchPanel(),
      toggleSidebar: () => this.toggleSidebar(),
      gotoPageDialog: () => this.gotoPageDialog(),
      zoomIn,
      zoomOut,
      fitPage,
      undo,
      redo,
      print: () => void this.print(),
      merge: () => void this.mergeFlow(),
      toggleFullscreen: () => void this.toggleFullscreen(),
      onEscape: () => this.onEscape(),

      scrollViewer: (d) => $("#viewer").scrollBy({ top: d }),
      scrollViewerTop: () =>
        $("#viewer").scrollTo({ top: 0, behavior: "smooth" }),
      scrollViewerBottom: () =>
        $("#viewer").scrollTo({
          top: $("#viewer").scrollHeight,
          behavior: "smooth",
        }),
      nextPage,
      prevPage,
      gotoPage: (n) => gotoPage(n),

      setTool: (t) => this.setTool(t),
      deleteSelected: () => {
        if (state.selectedId) {
          deleteAnnotation(state.selectedId);
          toast("Anotasi dihapus");
        }
      },

      hasDocument: () => !!state.pdfDoc,
      getNumPages: () => state.numPages,
      getSelectedId: () => state.selectedId,
    });
  }

  /* ------------------------------------------------------------
     PUBLIC METHODS
     ------------------------------------------------------------ */
  setTool(tool: Tool): void {
    state.tool = tool;
    toolbarSetTool(tool);
    if (tool !== "select" && state.selectedId) {
      selectAnnotation(null);
    }
  }

  toggleSidebar(): void {
    toggleSidebar();
    setTimeout(() => {
      if (state.fitMode === "width") fitWidth();
      else if (state.fitMode === "page") fitPage();
      else renderVisiblePages($("#viewer"));
    }, 220);
  }

  toggleTheme(): void {
    const html = document.documentElement;
    html.dataset.theme = html.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem(CONFIG.THEME_KEY, html.dataset.theme);
  }

  gotoPageDialog(): void {
    const v = window.prompt("Pergi ke halaman:", String(state.currentPage));
    if (v && !isNaN(+v)) gotoPage(+v);
  }

  onEscape(): void {
    // Presentation mode → exit dulu, apapun state tool/selection
    if (isPresentationMode()) {
      void exitPresentationMode();
      return;
    }
    if (state.tool !== "select") {
      this.setTool("select");
      return;
    }
    if (state.selectedId) {
      selectAnnotation(null);
      return;
    }
    if (!this.isModalOpen() && getActiveTab() === "search") {
      getSearchInput().value = "";
      void this.executeSearch("");
    }
  }

  openSearchPanel(): void {
    const sidebar = $("#sidebar");
    if (sidebar.classList.contains("hidden")) toggleSidebar();
    activateTab("search");
    setTimeout(() => {
      const input = getSearchInput();
      input.focus();
      input.select();
    }, 60);
  }

  async executeSearch(query: string): Promise<void> {
    const caseSensitive = getSearchCaseCheckbox().checked;
    await runSearch(query, caseSensitive);
  }

  async openSignatureFlow(): Promise<void> {
    const dataUrl = await askSignature();
    if (!dataUrl) return;
    state.pendingSignature = dataUrl;
    this.setTool("signature");
    toast(
      "Klik & drag pada halaman untuk menempatkan tanda tangan",
      "ok",
      4500,
    );
  }

  async openUrlFlow(): Promise<void> {
    const url = await askUrl();
    if (!url) return;
    await this.loadFromUrl(url);
  }

  async ocrFlow(): Promise<void> {
    if (!state.pdfDoc) {
      toast("Tidak ada dokumen", "error");
      return;
    }

    // Pastikan textCache terisi (untuk deteksi scan)
    setProgress(0);
    const scanned = await detectScannedPages(state.pdfDoc, state.textCache);
    setProgress(null);

    const selection = await askOCRPages(state.numPages, scanned);
    if (!selection) return;

    await this.performOCR(selection.pageNums, selection.language);
  }

  private async performOCR(
    pageNums: number[],
    language: string,
  ): Promise<void> {
    if (!state.pdfDoc) return;

    try {
      setProgress(0);
      toast(`Menjalankan OCR pada ${pageNums.length} halaman…`, "", 4000);

      const results = await ocrPages({
        pdfDoc: state.pdfDoc,
        pageNums,
        language,
        onProgress: (p) => setProgress(p),
      });

      for (const r of results) {
        this.applyOCRResultToTextCache(r);
      }

      // Re-render halaman yang di-OCR agar text layer & search highlight update
      for (const r of results) {
        await renderPage(r.pageNum);
      }

      // Re-run search aktif jika ada
      if (state.search.query) {
        await this.executeSearch(state.search.query);
      }

      toast(`OCR selesai: ${results.length} halaman diproses`, "ok", 4500);
    } catch (err) {
      console.error("ocr gagal", err);
      if ((err as Error).name === "AbortError") {
        toast("OCR dibatalkan", "", 3000);
      } else {
        toast(
          "OCR gagal: " + (err instanceof Error ? err.message : String(err)),
          "error",
          7000,
        );
      }
    } finally {
      setProgress(null);
    }
  }

  private applyOCRResultToTextCache(r: OCRPageResult): void {
    state.ocrResults[r.pageNum] = r;

    const dim = state.pageDims[r.pageNum];
    if (!dim) return;

    const newItems = r.words.map((w) => ocrWordToTextItem(w, dim.w, dim.h));

    const existing = state.textCache[r.pageNum];
    if (existing) {
      // Buang item OCR lama, pertahankan original
      const nonOCR = existing.items.filter(
        (it) => !(it as { _isOCR?: boolean })._isOCR,
      );
      existing.items = [...nonOCR, ...newItems] as typeof existing.items;
    } else {
      state.textCache[r.pageNum] = {
        items: newItems as unknown as (typeof state.textCache)[number]["items"],
        styles: {},
      } as (typeof state.textCache)[number];
    }
  }

  async save(): Promise<void> {
    if (!state.pdfDoc) return;
    const baseName = (state.fileName || "document").replace(/\.pdf$/i, "");
    const opts = await askSaveOptions({
      defaultFilename: `${baseName}_annotated.pdf`,
      annotationCount: state.annotations.length,
      fieldCount: Object.keys(state.fields).length,
    });
    if (!opts) return;
    await exportPDF({ filename: opts.filename, flatten: opts.flatten });
  }

  async print(): Promise<void> {
    if (!state.pdfDoc) {
      toast("Tidak ada dokumen", "error");
      return;
    }
    try {
      setProgress(0);
      await printPDF({ onProgress: (p) => setProgress(p) });
    } catch (err) {
      console.error("print gagal", err);
      toast(
        "Gagal print: " + (err instanceof Error ? err.message : String(err)),
        "error",
        5000,
      );
    } finally {
      setProgress(null);
    }
  }

  async mergeFlow(): Promise<void> {
    const selection = await askMergeFiles();
    if (!selection) return;
    await this.performMerge(selection.files, selection.action);
  }

  private async performMerge(
    files: File[],
    action: "open" | "download",
  ): Promise<void> {
    try {
      setProgress(0);
      toast(`Menggabungkan ${files.length} file…`);

      const inputs = await Promise.all(
        files.map(async (f) => ({
          name: f.name,
          bytes: new Uint8Array(await f.arrayBuffer()),
        })),
      );

      const merged = await mergePDFs(inputs, {
        onProgress: ({ current, total }) => setProgress(current / total),
      });

      const filename = generateMergeFilename(files.length);

      if (action === "download") {
        downloadBlob(merged, filename);
        toast(
          `Merge selesai: ${files.length} file digabung & diunduh`,
          "ok",
          4000,
        );
        return;
      }

      // action === 'open'
      await this.loadFromSource({ data: merged }, filename);
      if (state.pdfDoc) {
        toast(`Merge selesai: ${files.length} file digabung`, "ok", 4000);
      }
    } catch (err) {
      console.error("merge gagal", err);
      toast(
        "Gagal merge: " + (err instanceof Error ? err.message : String(err)),
        "error",
        6000,
      );
    } finally {
      setProgress(null);
    }
  }

  async toggleFullscreen(): Promise<void> {
    if (isPresentationMode()) {
      await exitPresentationMode();
    } else {
      await togglePresentationMode();
    }
  }

  async loadFromFile(file: File): Promise<void> {
    const buf = await file.arrayBuffer();
    await this.loadFromSource({ data: new Uint8Array(buf) }, file.name);
  }

  async loadFromUrl(url: string): Promise<void> {
    const name = url.split("/").pop()?.split("?")[0] || "document.pdf";
    await this.loadFromSource({ url }, name);
  }

  /* ------------------------------------------------------------
     PRIVATE
     ------------------------------------------------------------ */
  private isModalOpen(): boolean {
    return $("#modalRoot").classList.contains("active");
  }

  private async loadFromSource(source: PDFSource, name: string): Promise<void> {
    if (state.loading) return;
    state.loading = true;
    setProgress(0);

    try {
      // Destroy old
      await destroyPDF(state.pdfDoc);
      state.pdfDoc = null;

      // Reset state & DOM
      resetViewerState();
      clearSearchHighlights();
      clearThumbCache();
      clearPages($("#pages"));
      setUndoRedo(false, false);

      // Load
      const loaded = await loadPDF({
        source,
        name,
        onProgress: (f) => setProgress(f),
        resolvePassword: (wrong) => askPassword(wrong),
      });

      // Assign state
      state.pdfDoc = loaded.doc;
      state.originalBytes = loaded.bytes;
      state.fileName = loaded.name;
      state.fileHash = loaded.fileHash;
      state.numPages = loaded.numPages;
      state.pageDims = loaded.pageDims;

      // Restore autosave
      const saved = loadAutosave(state.fileHash);
      if (saved) {
        state.annotations = saved.annotations;
        state.fields = saved.fields;
        if (saved.annotations.length) {
          toast(
            `Memulihkan ${saved.annotations.length} anotasi tersimpan`,
            "ok",
          );
        }
      }

      // Header UI
      setFileInfo(state.fileName, `${state.numPages} halaman`);
      setPageInfo(1, state.numPages);
      setSaveEnabled(true);
      showEmptyState(false);
      document.title = `${state.fileName} — PDF Viewer`;
      updatePageBadge(1, state.numPages);

      // Initial layout
      state.currentPage = 1;
      state.scale = computeFitScale("width");
      state.fitMode = "width";

      // Build
      buildPages($("#pages"), {
        onPagePointerDown: handlePagePointerDown,
      });
      buildThumbnails(getThumbGrid());
      await buildOutline(getOutlineTree());

      // Initial render
      renderVisiblePages($("#viewer"));
      setZoomPreset(state.scale);
      renderAnnotationList(state.annotations);

      toast(`Dokumen dimuat: ${state.fileName}`, "ok");
    } catch (err) {
      if (err instanceof PDFLoadError) {
        switch (err.kind) {
          case "cancelled":
            // user batal password — silent
            break;
          case "invalid":
            toast("File PDF rusak atau tidak valid.", "error", 5000);
            break;
          case "cors":
            toast(err.message, "error", 6000);
            break;
          default:
            toast("Gagal membuka PDF: " + err.message, "error", 5000);
        }
      } else {
        console.error(err);
        toast(
          "Gagal membuka PDF: " +
            (err instanceof Error ? err.message : String(err)),
          "error",
          5000,
        );
      }
    } finally {
      state.loading = false;
      setProgress(null);
      if (!state.pdfDoc) {
        showEmptyState(true);
        setSaveEnabled(false);
      }
    }
  }
}
