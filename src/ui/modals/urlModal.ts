/**
 * URL modal — return Promise<string | null>.
 */

import { $opt } from "@utils/dom";
import { openModal } from "@utils/modal";

export function askUrl(): Promise<string | null> {
  return new Promise((resolve) => {
    const { modal, close } = openModal(`
      <h3>Buka PDF dari URL</h3>
      <div class="row"><input type="text" id="urlInput" placeholder="https://contoh.com/file.pdf"></div>
      <p style="font-size:11px;color:var(--fg-muted);margin:0 0 8px;line-height:1.5">
        Server harus mengirim header <code>Access-Control-Allow-Origin</code> (CORS),
        jika tidak, dokumen tidak dapat dimuat.
      </p>
      <div class="actions">
        <button class="btn" id="urlCancel">Batal</button>
        <button class="btn primary" id="urlGo">Buka</button>
      </div>
    `);

    const input = $opt<HTMLInputElement>("#urlInput", modal);
    input?.focus();

    const done = (v: string | null): void => {
      close();
      resolve(v);
    };

    $opt<HTMLButtonElement>("#urlGo", modal)?.addEventListener("click", () => {
      const url = input?.value.trim() ?? "";
      done(url || null);
    });
    $opt<HTMLButtonElement>("#urlCancel", modal)?.addEventListener(
      "click",
      () => done(null),
    );
    input?.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        const url = input.value.trim();
        done(url || null);
      }
    });
  });
}
