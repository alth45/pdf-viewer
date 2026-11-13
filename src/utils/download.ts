/**
 * Trigger browser download dari Blob/BufferSource.
 */

export function downloadBlob(
  data: Blob | Uint8Array | ArrayBuffer,
  filename: string,
  mime = "application/pdf",
): void {
  const blob =
    data instanceof Blob ? data : new Blob([data as BlobPart], { type: mime });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Revoke setelah browser sempat memulai download
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}
