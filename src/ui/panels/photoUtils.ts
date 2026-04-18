/**
 * Pure utilities for photo mode: filename generation and download trigger.
 * Logic-only — no React, no JSX.
 */

function padTwo(n: number): string {
  return String(n).padStart(2, '0');
}

export function buildFilename(): string {
  const d = new Date();
  const YYYY = d.getFullYear();
  const MM = padTwo(d.getMonth() + 1);
  const DD = padTwo(d.getDate());
  const hh = padTwo(d.getHours());
  const mm = padTwo(d.getMinutes());
  const ss = padTwo(d.getSeconds());
  return `midway-mayhem-${YYYY}${MM}${DD}-${hh}${mm}${ss}.png`;
}

export function triggerDownload(dataUrl: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = buildFilename();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
