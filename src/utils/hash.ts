/**
 * Non-kriptografis hash untuk fingerprint file (deterministic storage key).
 */

/** DJB2 string hash → string base36 dengan prefix 'h'. */
export function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return "h" + (hash >>> 0).toString(36);
}

/** Fingerprint file dari nama + ukuran bytes. */
export function fileFingerprint(name: string, byteLength: number): string {
  return hashString(`${name}:${byteLength}`);
}
