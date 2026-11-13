export interface SavedMedia {
  id: string; // e.g., "/local-media/17205423012-video.mp4" or "/uploads/..."
  file: Blob | File;
  name: string;
  type: string;
  mediaKind?: "image" | "video";
  dataUrl?: string; // Compressed image dataUrl fallback for instant sync & ultra-resilience
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
 * so the browser never loses access to the bytes even after weeks or restarts.
 */
export const toPersistentBlob = async (file: Blob | File, fallbackType = "application/octet-stream"): Promise<Blob> => {
  try {
    const buffer = await file.arrayBuffer();
    return new Blob([buffer], { type: file.type || fallbackType });
  } catch {
    return file;
  }
};

/**
 * Generates a compressed JPEG/WebP Data URL for an image (max 1280px)
 * so Mobile Share & Vercel static hosting can receive background images without any server.
 */
export const createCompressedImageDataUrl = (file: Blob | File, maxDim = 1280, quality = 0.8): Promise<string | undefined> => {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      resolve(undefined);
      return;
    }
    const objUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objUrl);
          resolve(undefined);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        URL.revokeObjectURL(objUrl);
        resolve(dataUrl);
      } catch {
        URL.revokeObjectURL(objUrl);
        resolve(undefined);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      resolve(undefined);
    };
    img.src = objUrl;
  });
};

export const extractMediaPath = (url: string): string => {
  if (!url) return "";
  if (url.includes("/local-media/")) return url.substring(url.indexOf("/local-media/"));
  if (url.includes("/uploads/")) return url.substring(url.indexOf("/uploads/"));
  if (url.includes("/backgrounds/")) return url.substring(url.indexOf("/backgrounds/"));
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
  options?: { mediaKind?: "image" | "video"; dataUrl?: string }
): Promise<void> => {
  try {
    const db = await openDB();
    const persistentBlob = await toPersistentBlob(file, type);
    const mediaKind =
      options?.mediaKind ||
      (type.startsWith("video/") || /\.(mp4|webm|ogg)$/i.test(name) ? "video" : "image");
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({
        id,
        file: persistentBlob,
        name,
        type: type || persistentBlob.type,
        mediaKind,
        dataUrl: options?.dataUrl,
        timestamp: Date.now(),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("IndexedDB save failed:", e);
  }
};

export const getAllMedia = async (): Promise<SavedMedia[]> => {
  try {
    const db = await openDB();
    return new Promise<SavedMedia[]>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("IndexedDB get all failed:", e);
    return [];
  }
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
