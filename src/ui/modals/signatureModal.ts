/**
 * Signature modal — dua tab (gambar / upload). Return Promise<string | null>
 * berisi dataURL PNG dari tanda tangan yang siap ditempel.
 */

import { $opt } from "@utils/dom";
import { openModal } from "@utils/modal";
import { trimCanvas } from "@services/signatureService";
import { toast } from "@utils/toast";

export function askSignature(): Promise<string | null> {
  return new Promise((resolve) => {
    const { modal, close } = openModal(`
      <h3>Tanda Tangan</h3>
      <div class="tabs">
        <button data-tab="draw" class="active">Gambar</button>
        <button data-tab="upload">Upload</button>
      </div>
      <div class="sig-tab active" data-tab="draw">
        <canvas id="sigCanvas" width="460" height="180"></canvas>
        <div class="row" style="margin-top:10px">
          <button class="btn" id="sigClear">Hapus</button>
          <span style="font-size:11px;color:var(--fg-muted)">Gambar tanda tangan Anda di kotak di atas</span>
        </div>
      </div>
      <div class="sig-tab" data-tab="upload">
        <input type="file" id="sigFile" accept="image/png,image/jpeg" style="margin-bottom:8px">
        <div id="sigPreview" style="text-align:center;min-height:80px"></div>
      </div>
      <div class="actions">
        <button class="btn" id="sigCancel">Batal</button>
        <button class="btn primary" id="sigUse">Gunakan</button>
      </div>
    `);

    let uploadedDataUrl: string | null = null;

    /* ---- Tab switching ---- */
    const tabs = modal.querySelectorAll<HTMLButtonElement>(".tabs button");
    tabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        tabs.forEach((b) => b.classList.toggle("active", b === btn));
        modal
          .querySelectorAll<HTMLElement>(".sig-tab")
          .forEach((t) =>
            t.classList.toggle("active", t.dataset.tab === btn.dataset.tab),
          );
      });
    });

    /* ---- Canvas ---- */
    const canvas = $opt<HTMLCanvasElement>("#sigCanvas", modal);
    if (!canvas) {
      close();
      resolve(null);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      close();
      resolve(null);
      return;
    }

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    let drawing = false;
    let hasInk = false;
    let lastPt: { x: number; y: number } | null = null;

    const getPt = (ev: PointerEvent): { x: number; y: number } => {
      const r = canvas.getBoundingClientRect();
      return {
        x: (ev.clientX - r.left) * (canvas.width / r.width),
        y: (ev.clientY - r.top) * (canvas.height / r.height),
      };
    };

    canvas.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      drawing = true;
      hasInk = true;
      lastPt = getPt(ev);
      canvas.setPointerCapture(ev.pointerId);
      ctx.beginPath();
      ctx.moveTo(lastPt.x, lastPt.y);
      ctx.lineTo(lastPt.x + 0.1, lastPt.y + 0.1);
      ctx.stroke();
    });

    canvas.addEventListener("pointermove", (ev) => {
      if (!drawing || !lastPt) return;
      const p = getPt(ev);
      ctx.beginPath();
      ctx.moveTo(lastPt.x, lastPt.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastPt = p;
    });

    const endDraw = (): void => {
      drawing = false;
    };
    canvas.addEventListener("pointerup", endDraw);
    canvas.addEventListener("pointercancel", endDraw);
    canvas.addEventListener("pointerleave", endDraw);

    $opt<HTMLButtonElement>("#sigClear", modal)?.addEventListener(
      "click",
      () => {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        hasInk = false;
      },
    );

    /* ---- Upload ---- */
    const fileInput = $opt<HTMLInputElement>("#sigFile", modal);
    fileInput?.addEventListener("change", () => {
      const f = fileInput.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        uploadedDataUrl =
          typeof reader.result === "string" ? reader.result : null;
        const prev = $opt("#sigPreview", modal);
        if (prev && uploadedDataUrl) {
          prev.innerHTML = `<img src="${uploadedDataUrl}" style="max-width:100%;max-height:140px;border-radius:6px;background:#fff">`;
        }
      };
      reader.readAsDataURL(f);
    });

    /* ---- Actions ---- */
    const done = (v: string | null): void => {
      close();
      resolve(v);
    };

    $opt<HTMLButtonElement>("#sigCancel", modal)?.addEventListener(
      "click",
      () => done(null),
    );

    $opt<HTMLButtonElement>("#sigUse", modal)?.addEventListener("click", () => {
      const activeTab = modal.querySelector<HTMLButtonElement>(
        ".tabs button.active",
      );
      const tab = activeTab?.dataset.tab;

      if (tab === "draw") {
        if (!hasInk) {
          toast("Gambar tanda tangan dulu", "error");
          return;
        }
        const dataUrl = trimCanvas(canvas).toDataURL("image/png");
        done(dataUrl);
      } else {
        if (!uploadedDataUrl) {
          toast("Pilih file gambar dulu", "error");
          return;
        }
        done(uploadedDataUrl);
      }
    });
  });
}
