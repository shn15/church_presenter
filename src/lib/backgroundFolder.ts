/**
 * Unified Background Folder Manager
 * Reads directly from the single dedicated `/public/backgrounds/` folder (via `/backgrounds/manifest.json` & `/api/local-backgrounds`)
 * and stores client-added files as raw binary files inside a dedicated browser OPFS `"backgrounds"` folder + IndexedDB Blob store
 * (never converting images or videos into base64/code).
 */

export interface BackgroundFolderListing {
  images: string[];
  videos: string[];
}

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".ogg", ".mov", ".m4v"]);

export function isVideoExtension(nameOrUrl: string): boolean {
  const clean = (nameOrUrl || "").split("?")[0].toLowerCase();
  for (const ext of VIDEO_EXTENSIONS) {
    if (clean.endsWith(ext)) return true;
  }
  return false;
}

export function isImageExtension(nameOrUrl: string): boolean {
  const clean = (nameOrUrl || "").split("?")[0].toLowerCase();
  for (const ext of IMAGE_EXTENSIONS) {
    if (clean.endsWith(ext)) return true;
  }
  return false;
}

/**
 * Fetches the list of image & video URLs directly from the dedicated `/backgrounds/` folder.
 * Works identically on Vercel static hosting (`/backgrounds/manifest.json`) and local/Node server (`/api/local-backgrounds`).
 */
export async function fetchFolderBackgrounds(): Promise<BackgroundFolderListing> {
  const images = new Set<string>();
  const videos = new Set<string>();

  // 1. Read static manifest generated from `/public/backgrounds/` (works on Vercel & GitHub Pages)
  try {
    const res = await fetch(`/backgrounds/manifest.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    const ct = res.headers.get("content-type") || "";
    if (res.ok && ct.includes("application/json")) {
      const data = await res.json();
      if (Array.isArray(data?.images)) {
        data.images.forEach((u: unknown) => {
          if (typeof u === "string" && u.trim()) images.add(u.trim());
        });
      }
      if (Array.isArray(data?.videos)) {
        data.videos.forEach((u: unknown) => {
          if (typeof u === "string" && u.trim()) videos.add(u.trim());
        });
      }
    }
  } catch {}

  // 2. Also query Express backend directory listing if available
  try {
    const res = await fetch("/api/local-backgrounds");
    const ct = res.headers.get("content-type") || "";
    if (res.ok && ct.includes("application/json")) {
      const data = await res.json();
      if (Array.isArray(data?.images)) {
        data.images.forEach((u: unknown) => {
          if (typeof u === "string" && u.trim()) images.add(u.trim());
        });
      }
      if (Array.isArray(data?.videos)) {
        data.videos.forEach((u: unknown) => {
          if (typeof u === "string" && u.trim()) videos.add(u.trim());
        });
      }
    }
  } catch {}

  return {
    images: Array.from(images),
    videos: Array.from(videos),
  };
}

/**
 * Opens the dedicated browser OPFS `"backgrounds"` folder (`navigator.storage.getDirectory()`)
 */
async function getOpfsBackgroundsDir(create = true): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.getDirectory) {
      return null;
    }
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle("backgrounds", { create });
  } catch {
    return null;
  }
}

function normalizeFolderFileName(pathOrName: string): string {
  const clean = (pathOrName || "").split("?")[0];
  const rawName = clean.substring(clean.lastIndexOf("/") + 1);
  try {
    return decodeURIComponent(rawName).replace(/[\\/]/g, "_");
  } catch {
    return rawName.replace(/[\\/]/g, "_");
  }
}

export async function saveFileToOpfsFolder(fileNameOrPath: string, blob: Blob): Promise<boolean> {
  try {
    const dir = await getOpfsBackgroundsDir(true);
    if (!dir) return false;
    const safeName = normalizeFolderFileName(fileNameOrPath);
    if (!safeName) return false;
    const handle = await dir.getFileHandle(safeName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

export async function readAllFromOpfsFolder(): Promise<
  Array<{ id: string; file: File; name: string; type: string; mediaKind: "image" | "video" }>
> {
  const results: Array<{
    id: string;
    file: File;
    name: string;
    type: string;
    mediaKind: "image" | "video";
  }> = [];

  try {
    const dir = await getOpfsBackgroundsDir(false);
    if (!dir) return results;

    // @ts-ignore - entries() exists on FileSystemDirectoryHandle in modern browsers
    for await (const [entryName, handle] of dir.entries()) {
      if (handle.kind !== "file") continue;
      try {
        const file = await (handle as FileSystemFileHandle).getFile();
        if (file.size === 0) continue;
        const isVid = file.type.startsWith("video/") || isVideoExtension(entryName);
        results.push({
          id: `/local-media/${encodeURIComponent(entryName)}`,
          file,
          name: entryName,
          type: file.type || (isVid ? "video/mp4" : "image/jpeg"),
          mediaKind: isVid ? "video" : "image",
        });
      } catch {}
    }
  } catch {}

  return results;
}

export async function deleteFromOpfsFolder(fileNameOrPath: string): Promise<void> {
  try {
    const dir = await getOpfsBackgroundsDir(false);
    if (!dir) return;
    const safeName = normalizeFolderFileName(fileNameOrPath);
    if (!safeName) return;
    await dir.removeEntry(safeName);
  } catch {}
}
