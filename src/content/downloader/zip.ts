import JSZip from 'jszip';

const FORBIDDEN = /[\/\\:*?"<>|]/g;
const CONTROL = /[\x00-\x1f\x7f]/g;
const MAX_LEN = 200;

export function safeFilename(name: string): string {
  let s = name.replace(CONTROL, '').replace(FORBIDDEN, '_');
  s = s.replace(/[.\s]+$/g, '');
  if (!s) return '_';
  if (s.length > MAX_LEN) {
    const dot = s.lastIndexOf('.');
    if (dot > 0 && s.length - dot <= 10) {
      const ext = s.slice(dot);
      s = s.slice(0, MAX_LEN - ext.length) + ext;
    } else {
      s = s.slice(0, MAX_LEN);
    }
  }
  return s;
}

export function safeFolderName(name: string): string {
  return safeFilename(name);
}

export function joinPath(...segments: string[]): string {
  return segments
    .map((s) => s.replace(/^\/+|\/+$/g, ''))
    .filter((s) => s.length > 0)
    .join('/');
}

export function createZip(): JSZip {
  return new JSZip();
}

export async function generateZipBlob(zip: JSZip, onProgress?: (percent: number) => void): Promise<Blob> {
  return zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (meta) => onProgress?.(meta.percent)
  );
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Download a remote file under the user's chosen filename.
 *
 * Why this exists instead of plain <a href download="...">: the HTML5
 * `download` attribute is silently ignored for cross-origin URLs (it
 * would let any page force-download anything from any other site, so
 * browsers reject it for safety). Canvas's `file.url` is a presigned
 * URL on a different origin (inst-fs-iad-prod.inscloudgate.net or S3),
 * so direct anchor downloads open the file in the tab instead of
 * saving with the right name. Fetching as a blob first and then
 * downloading via an object URL (same-origin) bypasses the restriction.
 */
export async function downloadFileFromUrl(url: string, filename: string): Promise<void> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} fetching ${url}`);
  const blob = await res.blob();
  triggerDownload(blob, filename);
}
