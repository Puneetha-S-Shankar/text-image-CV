/** Helpers for the data-URL pictures the backend returns. */

export function dataUrlMime(dataUrl: string): string {
  return dataUrl.slice(5, dataUrl.indexOf(";")) || "image/webp";
}

export function extensionFor(mime: string): string {
  if (mime.includes("svg")) return "svg";
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg")) return "jpg";
  return "webp";
}

export async function dataUrlToFile(dataUrl: string, baseName: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  const mime = blob.type || dataUrlMime(dataUrl);
  return new File([blob], `${baseName}.${extensionFor(mime)}`, { type: mime });
}

export function downloadDataUrl(dataUrl: string, baseName: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${baseName}.${extensionFor(dataUrlMime(dataUrl))}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
