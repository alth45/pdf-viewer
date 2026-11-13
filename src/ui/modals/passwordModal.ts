/**
 * Password modal — return Promise<string | null>.
 */

import { $opt } from "@utils/dom";
import { openModal } from "@utils/modal";

export function askPassword(wasWrong: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    const { modal, close } = openModal(
      `
      <h3>🔒 PDF Terkunci</h3>
      <p style="margin:0 0 12px;color:var(--fg-muted);font-size:12px">
        ${wasWrong ? "Password salah. Coba lagi." : "Dokumen ini dilindungi password."}
      </p>
      <div class="row"><input type="password" id="pwInput" placeholder="Password" autofocus></div>
      <div class="actions">
        <button class="btn" id="pwCancel">Batal</button>
        <button class="btn primary" id="pwOk">Buka</button>
      </div>`,
      { backdropClose: false },
    );

    const input = $opt<HTMLInputElement>("#pwInput", modal);
    input?.focus();

    const done = (v: string | null): void => {
      close();
      resolve(v);
    };

    $opt<HTMLButtonElement>("#pwOk", modal)?.addEventListener("click", () =>
      done(input?.value ?? null),
    );
    $opt<HTMLButtonElement>("#pwCancel", modal)?.addEventListener("click", () =>
      done(null),
    );
    input?.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") done(input.value);
      if (e.key === "Escape") done(null);
    });
  });
}
