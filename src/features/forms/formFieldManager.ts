/**
 * Form field manager — render AcroForm widgets sebagai input DOM di atas
 * canvas. Nilai disimpan di `state.fields` (source of truth).
 *
 * Rendering bisa dipanggil ulang (mis. setelah zoom) — nilai dari `state.fields`
 * dipulihkan otomatis.
 */

import { state } from "@core/state";
import type { FieldMap } from "@core/types";

/* ---------- Hooks ---------- */
export interface FormFieldHooks {
  onFieldChanged?: (name: string, value: string | boolean) => void;
}

let hooks: FormFieldHooks = {};

export function initFormFieldManager(h: FormFieldHooks = {}): void {
  hooks = h;
}

function setField(name: string, value: string | boolean): void {
  state.fields[name] = value;
  hooks.onFieldChanged?.(name, value);
}

/* ---------- Render ---------- */
export async function renderFormFields(pageNum: number): Promise<void> {
  const entry = state.pages[pageNum];
  if (!entry || !entry.viewport || !state.pdfDoc) return;

  const layer = entry.formLayer;
  layer.innerHTML = "";

  let annots: Awaited<
    ReturnType<
      Awaited<ReturnType<typeof state.pdfDoc.getPage>>["getAnnotations"]
    >
  >;
  try {
    const page = await state.pdfDoc.getPage(pageNum);
    annots = await page.getAnnotations({ intent: "display" });
  } catch {
    return;
  }

  const widgets = annots.filter((a) => a.subtype === "Widget" && a.fieldName);
  if (!widgets.length) return;

  for (const a of widgets) {
    const rect = a.rect;
    if (!rect || rect.length < 4) continue;

    const p1 = entry.viewport.convertToViewportPoint(rect[0], rect[1]);
    const p2 = entry.viewport.convertToViewportPoint(rect[2], rect[3]);
    const x = Math.min(p1[0], p2[0]);
    const y = Math.min(p1[1], p2[1]);
    const w = Math.abs(p2[0] - p1[0]);
    const h = Math.abs(p2[1] - p1[1]);
    if (w < 3 || h < 3) continue;

    const field = buildInput(a);
    if (!field) continue;

    field.classList.add("form-field");
    field.style.left = x + "px";
    field.style.top = y + "px";
    field.style.width = w + "px";
    field.style.height = h + "px";
    if (field instanceof HTMLTextAreaElement) field.style.resize = "none";
    field.addEventListener("keydown", (ev) => ev.stopPropagation());

    layer.appendChild(field);
  }

  entry.formsRendered = true;
}

/* ---------- Widget → Input ---------- */
type WidgetAnnot = {
  subtype: string;
  fieldName: string;
  fieldType?: string;
  fieldValue?: string | string[] | boolean;
  multiLine?: boolean;
  checkBox?: boolean;
  radioButton?: boolean;
  buttonValue?: string;
  exportValue?: string;
  options?: Array<{ exportValue?: string; displayValue?: string }>;
};

function buildInput(
  a: WidgetAnnot,
): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
  const name = a.fieldName;
  const ft = a.fieldType;
  const stored = state.fields[name];
  const initial = a.fieldValue;

  /* --- TEXT --- */
  if (ft === "Tx") {
    const el = a.multiLine
      ? document.createElement("textarea")
      : document.createElement("input");
    if (el instanceof HTMLInputElement) el.type = "text";
    if (stored !== undefined && typeof stored !== "boolean") {
      el.value = stored;
    } else if (typeof initial === "string") {
      el.value = initial;
    }
    el.addEventListener("input", () => setField(name, el.value));
    return el;
  }

  /* --- BUTTON (checkbox / radio) --- */
  if (ft === "Btn") {
    const isRadio = a.radioButton === true;
    const el = document.createElement("input");
    el.type = isRadio ? "radio" : "checkbox";
    if (isRadio) el.name = `radio_${name}_${state.currentPage}`;

    const exportVal = a.buttonValue ?? a.exportValue ?? "Yes";
    el.value = exportVal;

    if (isRadio) {
      el.checked =
        stored !== undefined && typeof stored !== "boolean"
          ? stored === exportVal
          : initial === exportVal;
      el.addEventListener("change", () => {
        if (el.checked) setField(name, exportVal);
      });
    } else {
      el.checked =
        stored !== undefined && typeof stored === "boolean"
          ? stored
          : Boolean(initial && initial !== "Off");
      el.addEventListener("change", () => setField(name, el.checked));
    }
    return el;
  }

  /* --- CHOICE (dropdown / list) --- */
  if (ft === "Ch") {
    const el = document.createElement("select");
    for (const o of a.options ?? []) {
      const opt = document.createElement("option");
      opt.value = o.exportValue ?? o.displayValue ?? "";
      opt.textContent = o.displayValue ?? o.exportValue ?? "";
      el.appendChild(opt);
    }
    const cur =
      stored !== undefined && typeof stored !== "boolean"
        ? stored
        : typeof initial === "string"
          ? initial
          : "";
    if (cur) el.value = cur;
    el.addEventListener("change", () => setField(name, el.value));
    return el;
  }

  // Signature widget / unsupported — skip
  return null;
}

/* ---------- Helper untuk exporter ---------- */
/** Snapshot fields saat ini (state.fields adalah source of truth). */
export function collectFieldValues(): FieldMap {
  return { ...state.fields };
}
