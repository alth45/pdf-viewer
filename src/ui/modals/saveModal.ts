/**
 * Save modal — pilih nama file & opsi flatten. Return Promise<SaveOptions | null>.
 */

import { $opt, escapeHtml } from "@utils/dom";
import { openModal } from "@utils/modal";

export interface SaveOptions {
  filename: string;
  flatten: boolean;
}

export interface SaveInfo {
  defaultFilename: string;
  annotationCount: number;
  fieldCount: number;
}

export function askSaveOptions(info: SaveInfo): Promise<SaveOptions | null> {
  return new Promise((resolve) => {
    const { modal, close } = openModal(`
      <h3>Simpan PDF</h3>
      <div class="row">
        <input type="text" id="saveName" value="${escapeHtml(info.defaultFilename)}">
      </div>
      <label class="search-opt" style="margin-bottom:6px">
        <input type="checkbox" id="flattenForm"> Flatten form (jadikan input statis)
      </label>
      <div style="font-size:11px;color:var(--fg-muted);line-height:1.6">
        ${info.annotationCount > 0 ? `• ${info.annotationCount} anotasi akan digabungkan ke PDF<br>` : ""}
        ${info.fieldCount > 0 ? `• ${info.fieldCount} field form akan diisi<br>` : ""}
        ${info.annotationCount === 0 && info.fieldCount === 0 ? "• Tidak ada perubahan — PDF akan disalin apa adanya" : ""}
      </div>
      <div class="actions">
        <button class="btn" id="saveCancel">Batal</button>
        <button class="btn primary" id="saveGo">Download PDF</button>
      </div>
    `);

    const nameInput = $opt<HTMLInputElement>("#saveName", modal);
    const flattenInput = $opt<HTMLInputElement>("#flattenForm", modal);

    const done = (v: SaveOptions | null): void => {
      close();
      resolve(v);
    };

    $opt<HTMLButtonElement>("#saveCancel", modal)?.addEventListener(
      "click",
      () => done(null),
    );
    $opt<HTMLButtonElement>("#saveGo", modal)?.addEventListener("click", () => {
      let filename = nameInput?.value.trim() || "annotated.pdf";
      if (!/\.pdf$/i.test(filename)) filename += ".pdf";
      done({ filename, flatten: flattenInput?.checked ?? false });
    });
  });
}
