/**
 * Autosave service — persist anotasi & field value ke localStorage.
 * Key unik per file (fileHash). Panggil `createAutosaveScheduler()` untuk
 * scheduler debounced yang membaca state secara lazy.
 */

import { CONFIG } from "@core/config";
import { debounce } from "@utils/dom";
import type { Annotation, FieldMap } from "@core/types";

/* ---------- Tipe payload ---------- */
export interface AutosaveData {
  annotations: Annotation[];
  fields: FieldMap;
}

export interface AutosavePayload extends AutosaveData {
  savedAt: number;
}

/* ---------- Key helper ---------- */
function storageKey(fileHash: string): string {
  return CONFIG.STORAGE_PREFIX + fileHash;
}

/* ---------- Save / load / clear (pure, no debounce) ---------- */
export function saveAutosave(fileHash: string, data: AutosaveData): void {
  if (!fileHash) return;
  try {
    const payload: AutosavePayload = {
      annotations: data.annotations,
      fields: data.fields,
      savedAt: Date.now(),
    };
    localStorage.setItem(storageKey(fileHash), JSON.stringify(payload));
  } catch {
    // QuotaExceededError atau localStorage disabled — abaikan
  }
}

export function loadAutosave(fileHash: string): AutosaveData | null {
  if (!fileHash) return null;
  try {
    const raw = localStorage.getItem(storageKey(fileHash));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AutosavePayload>;
    return {
      annotations: Array.isArray(parsed.annotations) ? parsed.annotations : [],
      fields:
        parsed.fields && typeof parsed.fields === "object" ? parsed.fields : {},
    };
  } catch {
    // JSON rusak / localStorage disabled
    return null;
  }
}

export function clearAutosave(fileHash: string): void {
  if (!fileHash) return;
  try {
    localStorage.removeItem(storageKey(fileHash));
  } catch {
    // ignore
  }
}

/* ---------- Debounced scheduler ---------- */
export interface AutosaveProvider {
  getFileHash(): string;
  getData(): AutosaveData;
}

/**
 * Buat scheduler debounced. Setiap panggilan `schedule()` akan menunggu
 * CONFIG.AUTOSAVE_DELAY_MS lalu menyimpan snapshot terkini dari provider.
 *
 * Provider dibaca secara **lazy** saat debounce fires, jadi aman untuk
 * memutasi `state` di antara panggilan.
 */
export function createAutosaveScheduler(
  provider: AutosaveProvider,
): () => void {
  return debounce(() => {
    const hash = provider.getFileHash();
    if (!hash) return;
    saveAutosave(hash, provider.getData());
  }, CONFIG.AUTOSAVE_DELAY_MS);
}
