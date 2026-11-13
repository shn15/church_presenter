import {
  deleteFromOpfsFolder,
  readAllFromOpfsFolder,
  saveFileToOpfsFolder,
} from "./backgroundFolder";

export interface SavedMedia {
  id: string; // e.g., "/backgrounds/video.mp4" or "/local-media/video.mp4"
  file: Blob | File;
  name: string;
  type: string;
  mediaKind?: "image" | "video";
  timestamp: number;
}

const DB_NAME = "bible_presenter_media";
const STORE_NAME = "media";

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Converts a File/Blob into an independent in-memory Blob backed by ArrayBuffer
 * so the browser never loses access to the file bytes after restarts or weeks.
 */
export const toPersistentBlob = async (
  file: Blob | File,
  fallbackType = "application/octet-stream"
): Promise<Blob> => {
  try {
    const buffer = await file.arrayBuffer();
    return new Blob([buffer], { type: file.type || fallbackType });
  } catch {
    return file;
  }
};

export const extractMediaPath = (url: string): string => {
  if (!url) return "";
  if (url.includes("/backgrounds/")) return url.substring(url.indexOf("/backgrounds/"));
  if (url.includes("/local-media/")) return url.substring(url.indexOf("/local-media/"));
  if (url.includes("/uploads/")) return url.substring(url.indexOf("/uploads/"));
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }
  return url;
};

export const saveMedia = async (
  id: string,
  file: Blob | File,
  name: string,
  type: string,
  options?: { mediaKind?: "image" | "video" }
): Promise<void> => {
  try {
    const persistentBlob = await toPersistentBlob(file, type);
    const mediaKind =
      options?.mediaKind ||
      (type.startsWith("video/") || /\.(mp4|webm|ogg|mov|m4v)$/i.test(name)
        ? "video"
        : "image");

    // 1. Save raw binary file into the dedicated browser OPFS "backgrounds" folder
    await saveFileToOpfsFolder(id, persistentBlob);

    // 2. Mirror raw binary Blob into IndexedDB
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({
        id,
        file: persistentBlob,
        name,
        type: type || persistentBlob.type,
        mediaKind,
        timestamp: Date.now(),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("Media save failed:", e);
  }
};

export const getAllMedia = async (): Promise<SavedMedia[]> => {
  const byId = new Map<string, SavedMedia>();

  // 1. Read from dedicated OPFS "backgrounds" folder first
  try {
    const opfsList = await readAllFromOpfsFolder();
    opfsList.forEach((item) => {
      byId.set(item.id, {
        ...item,
        timestamp: item.file.lastModified || Date.now(),
      });
    });
  } catch {}

  // 2. Merge from IndexedDB store
  try {
    const db = await openDB();
    const idbList = await new Promise<SavedMedia[]>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    idbList.forEach((item) => {
      if (item && item.id && !byId.has(item.id)) {
        byId.set(item.id, item);
      }
    });
  } catch (e) {
    console.error("IndexedDB get all failed:", e);
  }

  return Array.from(byId.values());
};

export const findMediaByUrl = async (url: string): Promise<SavedMedia | null> => {
  if (!url) return null;
  const all = await getAllMedia();
  const cleanPath = extractMediaPath(url);
  const filename = cleanPath.split("/").pop() || "";
  return (
    all.find((m) => m.id === url) ||
    all.find((m) => m.id === cleanPath) ||
    all.find((m) => filename && (m.id.endsWith("/" + filename) || m.id === filename)) ||
    null
  );
};

export const deleteMedia = async (id: string): Promise<void> => {
  await deleteFromOpfsFolder(id);
  try {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("IndexedDB delete failed:", e);
  }
};
