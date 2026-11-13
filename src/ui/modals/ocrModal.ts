/**
 * OCR modal — pilih halaman + bahasa, jalankan OCR.
 */

import { $opt } from "@utils/dom";
import { openModal } from "@utils/modal";
import type { ScannedPageInfo } from "@core/types";

export type OCRLanguage = "ind+eng" | "eng" | "ind";

export interface OCRSelection {
  pageNums: number[];
  language: OCRLanguage;
}

const LANG_LABELS: Record<OCRLanguage, string> = {
  "ind+eng": "Indonesia + English",
  eng: "English only",
  ind: "Indonesia only",
};

export function askOCRPages(
  numPages: number,
  scanned: ScannedPageInfo[],
): Promise<OCRSelection | null> {
  return new Promise((resolve) => {
    const scannedMap = new Map(scanned.map((s) => [s.pageNum, s]));
    const selected = new Set(scanned.map((s) => s.pageNum));

    const rowsHtml = Array.from({ length: numPages }, (_, i) => {
      const n = i + 1;
      const info = scannedMap.get(n);
      const badge = info
        ? info.reason === "empty"
          ? '<span class="ocr-badge ocr-badge-scan">🟡 Scan</span>'
          : '<span class="ocr-badge ocr-badge-sparse">⚠ Sedikit teks</span>'
        : '<span class="ocr-badge ocr-badge-text">🟢 Ada teks</span>';
      return `
        <label class="ocr-page-row">
          <input type="checkbox" data-page="${n}" ${info ? "checked" : ""}>
          <span class="ocr-page-num">Hal. ${n}</span>
          ${badge}
        </label>`;
    }).join("");

    const { modal, close } = openModal(`
      <h3>OCR — Ekstrak Teks dari Gambar</h3>
      <p style="margin:0 0 10px;color:var(--fg-muted);font-size:12px">
        Menggunakan tesseract.js. Halaman dengan 🟡 atau ⚠ disarankan untuk di-OCR.
        Halaman 🟢 sudah punya text layer (search sudah bekerja).
      </p>

      <div class="ocr-controls">
        <button type="button" class="btn" data-act="all">Pilih semua</button>
        <button type="button" class="btn" data-act="scanned">Pilih yang scan</button>
        <button type="button" class="btn" data-act="none">Kosongkan</button>
      </div>

      <div class="ocr-pages-list">${rowsHtml}</div>

      <label class="ocr-lang-row">
        <span>Bahasa:</span>
        <select id="ocrLanguage">
          <option value="ind+eng" selected>${LANG_LABELS["ind+eng"]}</option>
          <option value="eng">${LANG_LABELS.eng}</option>
          <option value="ind">${LANG_LABELS.ind}</option>
        </select>
      </label>

      <p class="ocr-note">
        ⚠ Pertama kali dijalankan, ~4–8 MB data bahasa akan diunduh.
        Proses OCR berjalan di background — 1–5 detik per halaman.
      </p>

      <div class="actions">
        <button class="btn" id="ocrCancel">Batal</button>
        <button class="btn primary" id="ocrRun" disabled>Jalankan OCR</button>
      </div>
    `);

    const list = $opt<HTMLElement>(".ocr-pages-list", modal)!;
    const runBtn = $opt<HTMLButtonElement>("#ocrRun", modal)!;
    const langSel = $opt<HTMLSelectElement>("#ocrLanguage", modal)!;

    const refresh = (): void => {
      list
        .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
        .forEach((cb) => {
          const n = Number(cb.dataset.page);
          cb.checked = selected.has(n);
        });
      const count = selected.size;
      runBtn.disabled = count === 0;
      runBtn.textContent =
        count === 0 ? "Jalankan OCR" : `Jalankan OCR (${count} halaman)`;
    };

    list.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      if (target.type !== "checkbox") return;
      const n = Number(target.dataset.page);
      if (target.checked) selected.add(n);
      else selected.delete(n);
      refresh();
    });

    modal
      .querySelectorAll<HTMLButtonElement>(".ocr-controls button")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const act = btn.dataset.act;
          if (act === "all") {
            for (let n = 1; n <= numPages; n++) selected.add(n);
          } else if (act === "scanned") {
            selected.clear();
            for (const s of scanned) selected.add(s.pageNum);
          } else {
            selected.clear();
          }
          refresh();
        });
      });

    const finish = (result: OCRSelection | null): void => {
      close();
      resolve(result);
    };

    $opt<HTMLButtonElement>("#ocrCancel", modal)!.onclick = () => finish(null);
    runBtn.addEventListener("click", () => {
      const pageNums = Array.from(selected).sort((a, b) => a - b);
      if (!pageNums.length) return;
      const language = langSel.value as OCRLanguage;
      finish({ pageNums, language });
    });

    refresh();
  });
}
