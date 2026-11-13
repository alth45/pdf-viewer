
# PDF Viewer & Tools

> Viewer PDF modern berbasis browser dengan anotasi, OCR, merge, print, dan presentation mode — semuanya berjalan **100% client-side**, tanpa upload ke server.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![pdf.js](https://img.shields.io/badge/pdf.js-4.4-orange)](https://mozilla.github.io/pdf.js/)
[![pdf-lib](https://img.shields.io/badge/pdf--lib-1.17-ff6b6b)](https://pdf-lib.js.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](#license)

---

## ✨ Fitur

### Viewer

- 🖼️ **Rendering** PDF via `pdf.js` dengan zoom (10%–500%), rotate 90°, fit-width & fit-page
- 🎯 **Lazy render** — hanya halaman yang terlihat di viewport yang di-render
- 📑 **Sidebar** — thumbnails, outline, search, dan daftar anotasi
- 🔍 **Search** dalam dokumen dengan highlight overlay & case-sensitive toggle
- 🔗 **Buka dari URL** (dengan CORS) atau upload lokal
- 🔒 **Dukungan PDF berpassword**
- 🌓 **Dark / Light theme**
- 📖 **Reading mode** — Normal, Sepia, Invert, Dark (filter hanya di canvas, anotasi tetap berwarna)
- 🎬 **Presentation mode** — fullscreen + hide UI + fit-page (shortcut `F`)
- 🖨️ **Print** semua halaman dengan anotasi tergabung (Ctrl+P)

### Anotasi

- ✏️ **Highlight**, **Underline**, **Strikethrough**
- 📝 **Text box**, **Sticky note** (popup editor)
- ✍️ **Freehand draw** dengan line width customizable
- 🖋️ **Signature** — gambar langsung atau upload PNG/JPG
- 🎨 **8 warna preset**, opacity otomatis untuk highlight
- ↩️ **Undo / Redo** (50 langkah)
- 💾 **Autosave** — anotasi per-file dipulihkan otomatis via localStorage

### Form & OCR

- 📋 **Form fields** (AcroForm) — text, checkbox, radio, dropdown, list
- 👁️ **OCR** via `tesseract.js` — deteksi otomatis halaman scan, konversi ke text layer searchable
  - Bahasa: Indonesia, English, atau keduanya
  - Hasil OCR di-embed ke PDF saat export (`opacity: 0.01` invisible text)

### File Operations

- 💾 **Save as PDF** — annotations + form values + OCR text di-merge ke PDF baru
- 🔀 **Merge** multiple PDFs dengan reorder via ▲▼
- 🖼️ **Export current page** sebagai PNG
- 📄 **Download** hasil merge tanpa harus membuka di viewer

### Keyboard Shortcuts

| Shortcut                  | Aksi                                                                 |
| ------------------------- | -------------------------------------------------------------------- |
| `Ctrl+O`                  | Buka file                                                            |
| `Ctrl+S`                  | Save PDF                                                             |
| `Ctrl+P`                  | Print                                                                |
| `Ctrl+F`                  | Search                                                               |
| `Ctrl+B`                  | Toggle sidebar                                                       |
| `Ctrl+G`                  | Go to page                                                           |
| `Ctrl+±`                  | Zoom in/out                                                          |
| `Ctrl+0`                  | Fit page                                                             |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / Redo                                                          |
| `V H U S N D T E`         | Tool: Select, Highlight, Underline, Strike, Note, Draw, Text, Eraser |
| `M`                       | Merge PDF                                                            |
| `F`                       | Presentation mode                                                    |
| `Esc`                     | Reset tool / close modal / exit presentation                         |
| `← → ↑ ↓` / `PageUp/Down` | Navigate                                                             |
| `Delete`                  | Hapus anotasi terpilih                                               |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9 (atau `pnpm`/`yarn`)

### Installation

```bash
git clone <repository-url>
cd pdf-viewer-tools
npm install
```

### Development

```bash
npm run dev
```

Buka http://localhost:5173

### Build

```bash
npm run build       # build production ke dist/
npm run preview     # preview hasil build
npm run typecheck   # validasi TypeScript
```

### Buka PDF via URL

```
http://localhost:5173/?file=https://example.com/document.pdf
```

Server harus mengirim header `Access-Control-Allow-Origin` — jika tidak, fetch akan gagal.

---

## 🏗️ Arsitektur

Project ini mengikuti **layered architecture** dengan pemisahan tanggung jawab yang tegas:

```
┌─────────────────────────────────────────────────┐
│  app/          Orchestrator (App class)         │  ← Wiring semua modul
├─────────────────────────────────────────────────┤
│  ui/           Thin DOM wrappers                │  ← Tidak menyentuh state
├─────────────────────────────────────────────────┤
│  features/     Domain logic per fitur           │  ← Tidak menyentuh DOM lain
├─────────────────────────────────────────────────┤
│  services/     Pure business logic              │  ← Tanpa DOM, mudah dites
├─────────────────────────────────────────────────┤
│  core/         Types, config, global state      │  ← Fondasi semua layer
│  utils/        Pure helpers                     │
└─────────────────────────────────────────────────┘
```

### Prinsip

1. **Satu arah dependensi** — `app → ui → features → services → core/utils`. Layer bawah tidak pernah impor layer atas.
2. **Hooks over imports** — Komunikasi antar layer via callback injection, bukan import silang.
3. **Single writer** — Hanya `app/App.ts` yang memutasi `state` global.
4. **Pure services** — `services/*` tidak menyentuh DOM; bisa dipanggil dari mana saja.
5. **UI thin wrappers** — `ui/*` hanya wire event ke hook; tidak ada logika domain.

### Data Flow

```
User Action → UI Event → App Method → Service Call → State Mutation
                                            ↓
                         Feature Hook ← App Orchestration
                              ↓
                         UI Setter (DOM update)
```

---

## 📁 Struktur Project

```
pdf-viewer-tools/
├── index.html                    # Shell HTML (tanpa inline CSS/JS)
├── package.json
├── tsconfig.json
├── vite.config.ts
│
├── src/
│   ├── main.ts                   # Bootstrap
│   │
│   ├── styles/
│   │   ├── main.css              # Entry (import semua)
│   │   ├── variables.css         # CSS custom properties
│   │   ├── layout.css            # Layout grid + struktur
│   │   └── components.css        # Komponen UI + print + reading mode
│   │
│   ├── core/
│   │   ├── types.ts              # Semua TypeScript types (union, interface)
│   │   ├── config.ts             # Konstanta global (CONFIG)
│   │   └── state.ts              # Global state singleton + reset
│   │
│   ├── utils/
│   │   ├── dom.ts                # $, $opt, $$, clamp, debounce, escapeHtml
│   │   ├── colors.ts             # hexToRgb01, hexA
│   │   ├── hash.ts               # fileFingerprint (DJB2)
│   │   ├── download.ts           # downloadBlob
│   │   ├── toast.ts              # toast notifications
│   │   ├── modal.ts              # openModal factory
│   │   └── index.ts
│   │
│   ├── services/
│   │   ├── pdfLoader.ts          # loadPDF + password handling
│   │   ├── pdfExporter.ts        # exportPDF (via pdf-lib)
│   │   ├── pdfMergeService.ts    # mergePDFs
│   │   ├── printService.ts       # Rasterize + composite annotations + print
│   │   ├── ocrService.ts         # detectScanned + ocrPages (tesseract.js)
│   │   ├── signatureService.ts   # trimCanvas + embedImage
│   │   ├── autosaveService.ts    # localStorage persistence
│   │   └── index.ts
│   │
│   ├── features/
│   │   ├── viewer/
│   │   │   ├── pageFactory.ts          # Build page DOM
│   │   │   ├── pageRenderer.ts         # Canvas + text layer rendering
│   │   │   ├── viewerController.ts     # Zoom, rotate, navigation, scroll spy
│   │   │   ├── presentationController.ts
│   │   │   ├── readingMode.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── annotations/
│   │   │   ├── annotationStore.ts      # CRUD + undo/redo
│   │   │   ├── annotationRenderer.ts   # DOM/SVG rendering
│   │   │   ├── annotationInteraction.ts# Pointer events per tool
│   │   │   ├── coords.ts               # Normalized ↔ Viewport conversion
│   │   │   └── index.ts
│   │   │
│   │   ├── search/searchManager.ts
│   │   ├── forms/formFieldManager.ts
│   │   ├── outline/outlineManager.ts
│   │   ├── thumbnails/thumbnailManager.ts
│   │   └── index.ts
│   │
│   ├── ui/
│   │   ├── topbar.ts             # Tombol buka, nav, zoom, save, print, dsb.
│   │   ├── toolbar.ts            # Tool buttons + color swatch + size
│   │   ├── sidebar.ts            # Tab switching + anno list renderer
│   │   ├── progress.ts           # Progress bar
│   │   ├── pageBadge.ts          # Badge halaman
│   │   ├── fileInput.ts          # File picker + validasi
│   │   ├── dropzone.ts           # Global drag & drop
│   │   ├── readingModeMenu.ts    # Popover menu mode baca
│   │   ├── modals/
│   │   │   ├── passwordModal.ts
│   │   │   ├── urlModal.ts
│   │   │   ├── saveModal.ts
│   │   │   ├── signatureModal.ts
│   │   │   ├── mergeModal.ts
│   │   │   └── ocrModal.ts
│   │   └── index.ts
│   │
│   └── app/
│       ├── App.ts                # Orchestrator utama
│       ├── keyboard.ts           # Semua keyboard shortcuts
│       └── index.ts
│
└── public/                       # Static assets (jika ada)
```

---

## 🔧 Tech Stack

| Layer              | Library                                                   | Alasan                                          |
| ------------------ | --------------------------------------------------------- | ----------------------------------------------- |
| **Rendering**      | [`pdfjs-dist`](https://mozilla.github.io/pdf.js/) v4.4    | Standar industri, handal, text layer akurat     |
| **Manipulasi PDF** | [`pdf-lib`](https://pdf-lib.js.org/) v1.17                | Zero-dependency, bisa embed form/image/text     |
| **OCR**            | [`tesseract.js`](https://tesseract.projectnaptha.com/) v5 | Pure JS/WASM, jalan di browser, multi-bahasa    |
| **Build**          | [Vite](https://vitejs.dev/) v5                            | Fast HMR, native ESM, asset handling `?url`     |
| **Language**       | TypeScript 5.4                                            | Strict mode, path aliases, discriminated unions |

**Zero backend** — semua berjalan client-side. Tidak ada data yang dikirim ke server.

---

## 🎨 Fitur Detail

### Reading Mode

Filter CSS hanya di `.page-canvas`, bukan container. Ini memastikan:

- ✅ Signature & note tetap berwarna asli (tidak ter-invert)
- ✅ Highlight `mix-blend-mode: multiply` di-override ke `screen` di mode gelap
- ✅ Search hit tetap terlihat kontras

| Mode   | CSS Filter                                         | Use Case                   |
| ------ | -------------------------------------------------- | -------------------------- |
| Normal | none                                               | Dokumen standar            |
| Sepia  | `sepia(0.85) contrast(0.95)`                       | Reading malam yang nyaman  |
| Invert | `invert(1) hue-rotate(180deg)`                     | Dokumen teks di malam hari |
| Dark   | `invert(0.92) hue-rotate(180deg) brightness(0.95)` | Dark mode lembut           |

### OCR Pipeline

```
PDF page → render @ 144 DPI → tesseract.js → OCRWord[]
                                                    ↓
                              Konversi ke pdfjs TextItem
                                                    ↓
                          Append ke state.textCache[pageNum]
                                                    ↓
                    Text layer + Search highlight bekerja normal
                                                    ↓
                        Export: embed invisible text (opacity 0.01)
```

**Deteksi otomatis halaman scan:**

- 🟡 **Scan** — < 3 text items (kemungkinan besar gambar murni)
- ⚠️ **Sparse** — 3–20 items (mungkin header/footer saja)
- 🟢 **Punya teks** — > 20 items (search sudah bekerja, OCR opsional)

### Merge Pipeline

```
File[] → PDFDocument.load() per file
              ↓
         copyPages() → addPage() ke output doc
              ↓
         save() → Uint8Array
              ↓
    [Buka di viewer] atau [Download langsung]
```

---

## 🧪 Testing (Manual Smoke Test)

### Viewer

- [ ] Buka PDF kecil (<10 hal) — render dalam < 1 detik
- [ ] Buka PDF besar (>100 hal) — lazy render bekerja, tidak freeze
- [ ] Zoom via preset, Ctrl+wheel, pinch (mobile)
- [ ] Rotate 90° — annotations ikut berputar
- [ ] Fit-width ↔ fit-page — transition smooth
- [ ] Navigation: prev/next, page input, thumbnail click, outline click
- [ ] Search dengan next/prev, case-sensitive toggle

### Anotasi

- [ ] Semua tool: highlight, underline, strike, note, draw, text, signature
- [ ] Undo/redo setelah 3 operasi berbeda
- [ ] Drag & resize annotation
- [ ] Delete via `Delete` key
- [ ] Autosave — refresh browser, annotations kembali

### Form

- [ ] Isi text field, checkbox, radio, dropdown
- [ ] Save → buka PDF di Acrobat → field terisi
- [ ] Flatten option — field statis setelah save

### OCR

- [ ] Buka PDF scan → modal deteksi halaman kuning
- [ ] Jalankan OCR 1 halaman → search kata dari gambar berhasil
- [ ] Save → buka PDF di Chrome → Ctrl+F temukan teks

### File Operations

- [ ] Merge 3 file → download → buka, 3 dokumen tergabung
- [ ] Merge → buka di viewer → annotations per-file tetap tersimpan

### Print & Presentation

- [ ] Print 1 halaman dengan 5 anotasi → semua tercetak
- [ ] Print 10 halaman → progress smooth, tidak freeze
- [ ] Presentation mode → fullscreen, hide UI, fit-page
- [ ] Esc → restore zoom & fit-mode sebelumnya

### Reading Mode

- [ ] Setiap mode visual berbeda & konsisten
- [ ] Reload → mode terakhir dipulihkan
- [ ] Mode Invert → highlight kuning masih terlihat

---

## ⚠️ Known Limitations (V1)

| Area             | Limitasi                                          | Roadmap                         |
| ---------------- | ------------------------------------------------- | ------------------------------- |
| **OCR**          | Hasil hilang saat reload (tidak autosave)         | V2: IndexedDB                   |
| **OCR**          | Worker dibuat per halaman — lambat untuk >10 hal  | V2: shared worker               |
| **OCR**          | Font Latin-1 saja saat export                     | V2: embed TTF Noto Sans         |
| **OCR**          | Belum ada tombol cancel di tengah proses          | V2: AbortSignal + UI            |
| **Print**        | Form values tidak ikut tercetak                   | V2: render form value ke canvas |
| **Print**        | Text layer jadi raster (tidak searchable)         | V2: alternate print path        |
| **Merge**        | Encrypted PDF tidak bisa di-merge                 | V2: modal password per file     |
| **Reading mode** | Filter hanya di canvas — toolbar/popup tidak ikut | By design                       |
| **Annotations**  | Tidak autosave untuk file > 5MB annotations       | V2: IndexedDB                   |

---

## 🗺️ Roadmap

### Sudah (v0.1 – v0.3)

- [x] Core viewer (zoom, rotate, lazy render, thumbnails, outline)
- [x] Search + highlight
- [x] Anotasi lengkap (8 tipe) + undo/redo + autosave
- [x] Form fields (AcroForm)
- [x] Save PDF dengan annotations & form values
- [x] Print dengan composite annotations
- [x] Presentation mode (fullscreen)
- [x] Reading mode (sepia/invert/dark)
- [x] Merge PDFs
- [x] OCR (tesseract.js)

### Planned (v0.4+)

- [ ] Split / extract pages
- [ ] Reorder pages via drag-drop
- [ ] Redaction (permanent black bar + text removal)
- [ ] Shapes annotation (line, arrow, rect, ellipse)
- [ ] IndexedDB persistence untuk OCR & annotations besar
- [ ] Custom bookmark (user-defined, bukan outline PDF)
- [ ] Compare two PDFs side-by-side
- [ ] Export range ke PNG/JPEG
- [ ] i18n (ID/EN)
- [ ] Unit + E2E test coverage

### Considered (v1.0+)

- [ ] Digital signature PKI (butuh backend)
- [ ] Real-time collaboration (butuh backend)
- [ ] PDF compression / optimization
- [ ] Text-to-speech reading (Web Speech API)

---

## 🤝 Contributing

Kontribusi welcome! Sebelum submit PR:

1. **Ikuti layer boundaries** — baca bagian [Arsitektur](#-arsitektur) dan pastikan perubahan tidak melanggar prinsip satu arah dependensi.
2. **TypeScript strict** — `npm run typecheck` harus bersih.
3. **Test manual** — jalankan smoke test yang relevan dengan area yang diubah.
4. **Update README** — jika menambah fitur atau mengubah limitasi.
5. **Commit style** — `feat:`, `fix:`, `refactor:`, `docs:`, `style:`, `chore:`

### Menambah Fitur Baru

Checklist cepat:

- [ ] Buat service (jika ada logic bisnis) di `src/services/`
- [ ] Buat feature (jika ada state/DOM complex) di `src/features/<name>/`
- [ ] Buat UI wrapper (jika perlu tombol/menu) di `src/ui/`
- [ ] Tambahkan type di `src/core/types.ts`
- [ ] Wire hook di `src/app/App.ts`
- [ ] Tambahkan shortcut (jika perlu) di `src/app/keyboard.ts`
- [ ] Update `index.html` (jika perlu tombol baru)
- [ ] Update `styles/components.css` (jika perlu style baru)

---

## 🔒 Privacy & Security

- **Zero upload** — semua pemrosesan di browser, tidak ada telemetry, tidak ada analytics.
- **No backend** — tidak ada server yang menyimpan data Anda.
- **localStorage** — hanya untuk autosave anotasi + theme preference. Tidak ada data yang keluar.
- **CDN** — `pdfjs-dist` worker di-load dari jsDelivr pada first load (bisa diganti dengan bundle lokal jika butuh full offline).

Untuk deployment di lingkungan kritis (government, healthcare), disarankan bundle semua dependency secara lokal (lihat bagian [Offline Setup](#offline-setup) di bawah).

---

## 📴 Offline Setup

Untuk full offline:

1. **Bundle pdfjs worker secara lokal** — file `src/services/pdfLoader.ts` sudah menggunakan pola `import PdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'` (Vite akan bundle ke `dist/assets/`).

2. **Tesseract language data** — download manual dan set `langPath` di `createWorker`:

   ```typescript
   const worker = await tesseract.createWorker(language, 1, {
     langPath: "/tesseract-lang/", // letakkan di public/
     // ...
   });
   ```

   Download dari https://github.com/naptha/tessdata

3. **Standard fonts** — `pdfjs-dist/standard_fonts/` perlu di-bundle untuk PDF dengan font builtin yang tidak di-embed. Copy ke `public/standard_fonts/` dan set `standardFontDataUrl: '/standard_fonts/'` di `pdfLoader.ts`.

4. **CMaps** — `pdfjs-dist/cmaps/` untuk PDF dengan CJK. Copy ke `public/cmaps/`.

---

## 📄 License

MIT License — bebas dipakai untuk personal & komersial. Lihat [LICENSE](LICENSE) untuk detail.

**Third-party licenses:**

- `pdfjs-dist` — Apache 2.0
- `pdf-lib` — MIT
- `tesseract.js` — Apache 2.0
- `vite` — MIT

---

## 🙏 Acknowledgments

- [Mozilla](https://mozilla.org/) untuk `pdf.js` — engine rendering PDF open-source terbaik.
- [Andrew Dillon](https://github.com/Hopding) untuk `pdf-lib` — library manipulasi PDF yang clean & well-documented.
- [Naptha AI](https://github.com/naptha) untuk `tesseract.js` — membawa OCR ke browser tanpa server.

---

## 📞 Kontak

Punya pertanyaan, saran, atau menemukan bug? Buka [issue](../../issues) atau diskusi di [discussions](../../discussions).

---

<div align="center">

**[⬆ Kembali ke atas](#pdf-viewer--tools)**

Dibuat dengan ❤️ menggunakan TypeScript + Vite

</div>

