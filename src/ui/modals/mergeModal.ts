/**
 * Merge modal — pilih beberapa file PDF, atur urutan, pilih aksi.
 * Return: { files, action } | null.
 */

import { $opt, escapeHtml } from "@utils/dom";
import { openModal } from "@utils/modal";
import { toast } from "@utils/toast";

export type MergeAction = "open" | "download";

export interface MergeSelection {
  files: File[];
  action: MergeAction;
}

export function askMergeFiles(): Promise<MergeSelection | null> {
  return new Promise((resolve) => {
    const { modal, close } = openModal(`
      <h3>Gabung PDF</h3>
      <div class="merge-picker">
        <input type="file" id="mergeFileInput" accept="application/pdf" multiple hidden>
        <button type="button" class="btn primary" id="mergePickBtn" style="width:100%;height:44px;margin-bottom:10px">
          + Pilih file PDF
        </button>
        <div id="mergeDropArea" class="merge-drop">
          Atau drag &amp; drop file PDF ke sini
        </div>
        <div id="mergeList" class="merge-list"></div>
        <div id="mergeEmpty" class="empty-hint">Belum ada file. Pilih minimal 2 file PDF.</div>
      </div>
      <div class="actions">
        <button class="btn" id="mergeCancel">Batal</button>
        <button class="btn" id="mergeDownload" disabled>Gabung &amp; Download</button>
        <button class="btn primary" id="mergeOpen" disabled>Gabung &amp; Buka</button>
      </div>
    `);

    const files: File[] = [];
    const input = $opt<HTMLInputElement>("#mergeFileInput", modal)!;
    const listEl = $opt<HTMLElement>("#mergeList", modal)!;
    const emptyEl = $opt<HTMLElement>("#mergeEmpty", modal)!;
    const dropArea = $opt<HTMLElement>("#mergeDropArea", modal)!;
    const openBtn = $opt<HTMLButtonElement>("#mergeOpen", modal)!;
    const downloadBtn = $opt<HTMLButtonElement>("#mergeDownload", modal)!;

    const refresh = (): void => {
      listEl.innerHTML = "";
      files.forEach((f, i) => {
        const row = document.createElement("div");
        row.className = "merge-item";
        row.innerHTML =
          `<span class="merge-idx">${i + 1}</span>` +
          `<span class="merge-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>` +
          `<span class="merge-size">${formatBytes(f.size)}</span>` +
          `<div class="merge-actions">` +
          `<button type="button" class="merge-up" ${i === 0 ? "disabled" : ""} aria-label="Naik">▲</button>` +
          `<button type="button" class="merge-down" ${i === files.length - 1 ? "disabled" : ""} aria-label="Turun">▼</button>` +
          `<button type="button" class="merge-remove" aria-label="Hapus">✕</button>` +
          `</div>`;

        row.querySelector(".merge-up")?.addEventListener("click", () => {
          if (i === 0) return;
          [files[i - 1], files[i]] = [files[i], files[i - 1]];
          refresh();
        });
        row.querySelector(".merge-down")?.addEventListener("click", () => {
          if (i === files.length - 1) return;
          [files[i + 1], files[i]] = [files[i], files[i + 1]];
          refresh();
        });
        row.querySelector(".merge-remove")?.addEventListener("click", () => {
          files.splice(i, 1);
          refresh();
        });
        listEl.appendChild(row);
      });

      const ready = files.length >= 2;
      emptyEl.style.display = files.length ? "none" : "block";
      openBtn.disabled = !ready;
      downloadBtn.disabled = !ready;
      openBtn.textContent = ready
        ? `Gabung & Buka (${files.length})`
        : "Gabung & Buka";
      downloadBtn.textContent = ready
        ? `Gabung & Download (${files.length})`
        : "Gabung & Download";
    };

    const addFiles = (incoming: File[]): void => {
      let rejected = 0;
      for (const f of incoming) {
        const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
        if (!isPdf) {
          rejected++;
          continue;
        }
        if (files.some((x) => x.name === f.name && x.size === f.size)) continue;
        files.push(f);
      }
      if (rejected > 0)
        toast(`${rejected} file diabaikan (bukan PDF)`, "error");
      refresh();
    };

    $opt<HTMLButtonElement>("#mergePickBtn", modal)!.addEventListener(
      "click",
      () => {
        input.click();
      },
    );
    input.addEventListener("change", () => {
      addFiles(Array.from(input.files ?? []));
      input.value = "";
    });

    // Drop area — stopPropagation agar global dropzone tidak ikut menangkap
    dropArea.addEventListener("dragenter", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    dropArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.classList.add("drag-over");
    });
    dropArea.addEventListener("dragleave", (e) => {
      e.stopPropagation();
      dropArea.classList.remove("drag-over");
    });
    dropArea.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.classList.remove("drag-over");
      addFiles(Array.from(e.dataTransfer?.files ?? []));
    });

    const finish = (action: MergeAction | null): void => {
      if (!action || files.length < 2) {
        close();
        resolve(null);
        return;
      }
      const snapshot = [...files];
      close();
      resolve({ files: snapshot, action });
    };

    $opt<HTMLButtonElement>("#mergeCancel", modal)!.addEventListener(
      "click",
      () => finish(null),
    );
    openBtn.addEventListener("click", () => finish("open"));
    downloadBtn.addEventListener("click", () => finish("download"));

    refresh();
  });
}

function formatBytes(n: number): string {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}
