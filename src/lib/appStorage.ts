/**
 * Unified Resilient Storage Manager for Church Presenter
 * Combines IndexedDB (unlimited quota, offline resilience) and LocalStorage (instant hydration)
 * to ensure that all user data (songs, presentations, schedules, custom bibles) is never lost.
 */

import { Song, ScheduleItem, CustomBible } from "../types";
import { getItemAccount, setItemAccount } from "./accountManager";

const DB_NAME = "church_presenter_data_v2";
const STORE_SONGS = "songs";
const STORE_BIBLES = "bibles";
const STORE_SCHEDULES = "schedules";
const STORE_PRESENTATIONS = "presentations";
const STORE_BACKGROUNDS = "backgrounds";

function openStorageDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not supported in this environment"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_SONGS)) {
        db.createObjectStore(STORE_SONGS, { keyPath: "accountId" });
      }
      if (!db.objectStoreNames.contains(STORE_BIBLES)) {
        db.createObjectStore(STORE_BIBLES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_SCHEDULES)) {
        db.createObjectStore(STORE_SCHEDULES, { keyPath: "accountId" });
      }
      if (!db.objectStoreNames.contains(STORE_PRESENTATIONS)) {
        db.createObjectStore(STORE_PRESENTATIONS, { keyPath: "accountId" });
      }
      if (!db.objectStoreNames.contains(STORE_BACKGROUNDS)) {
        db.createObjectStore(STORE_BACKGROUNDS, { keyPath: "accountId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Bibles persistence
export async function savePersistentBibles(bibles: CustomBible[]): Promise<void> {
  try {
    const db = await openStorageDB();
    const tx = db.transaction(STORE_BIBLES, "readwrite");
    const store = tx.objectStore(STORE_BIBLES);
    for (const b of bibles) {
      store.put(b);
    }
    // Also save light metadata in localStorage
    try {
      const minimal = bibles.map((b) => ({ id: b.id, name: b.name }));
      localStorage.setItem("cp_custom_bibles", JSON.stringify(minimal));
    } catch {}
  } catch (err) {
    console.warn("Failed saving bibles to IndexedDB:", err);
  }
}

export async function getPersistentBibles(): Promise<CustomBible[]> {
  try {
    const db = await openStorageDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_BIBLES, "readonly");
      const store = tx.objectStore(STORE_BIBLES);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function deletePersistentBible(id: string): Promise<void> {
  try {
    const db = await openStorageDB();
    const tx = db.transaction(STORE_BIBLES, "readwrite");
    const store = tx.objectStore(STORE_BIBLES);
    store.delete(id);
  } catch {}
}

// Songs per account persistence
export async function savePersistentSongs(accountId: string, songs: Song[]): Promise<void> {
  // 1. Save to LocalStorage if quota permits
  try {
    setItemAccount("cp_library_songs", JSON.stringify(songs), accountId);
  } catch (err) {
    console.warn("LocalStorage quota reached for songs, saved securely in IndexedDB:", err);
  }

  // 2. Save complete data to IndexedDB
  try {
    const db = await openStorageDB();
    const tx = db.transaction(STORE_SONGS, "readwrite");
    const store = tx.objectStore(STORE_SONGS);
    store.put({ accountId, data: songs, updatedAt: Date.now() });
  } catch (err) {
    console.warn("IndexedDB songs save error:", err);
  }
}

export async function getPersistentSongs(accountId: string): Promise<Song[]> {
  try {
    const db = await openStorageDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_SONGS, "readonly");
      const store = tx.objectStore(STORE_SONGS);
      const req = store.get(accountId);
      req.onsuccess = () => {
        if (req.result && Array.isArray(req.result.data) && req.result.data.length > 0) {
          resolve(req.result.data);
        } else {
          const saved = getItemAccount("cp_library_songs", accountId);
          if (saved) {
            try {
              resolve(JSON.parse(saved));
              return;
            } catch {}
          }
          resolve([]);
        }
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    const saved = getItemAccount("cp_library_songs", accountId);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  }
}

// Presentations per account persistence
export async function savePersistentPresentations(accountId: string, presentations: Song[]): Promise<void> {
  try {
    setItemAccount("cp_library_presentations", JSON.stringify(presentations), accountId);
  } catch (err) {
    console.warn("LocalStorage quota reached for presentations:", err);
  }

  try {
    const db = await openStorageDB();
    const tx = db.transaction(STORE_PRESENTATIONS, "readwrite");
    const store = tx.objectStore(STORE_PRESENTATIONS);
    store.put({ accountId, data: presentations, updatedAt: Date.now() });
  } catch {}
}

export async function getPersistentPresentations(accountId: string): Promise<Song[]> {
  try {
    const db = await openStorageDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PRESENTATIONS, "readonly");
      const store = tx.objectStore(STORE_PRESENTATIONS);
      const req = store.get(accountId);
      req.onsuccess = () => {
        if (req.result && Array.isArray(req.result.data)) {
          resolve(req.result.data);
        } else {
          const saved = getItemAccount("cp_library_presentations", accountId);
          if (saved) {
            try {
              resolve(JSON.parse(saved));
              return;
            } catch {}
          }
          resolve([]);
        }
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

// Schedule per account persistence
export async function savePersistentSchedule(accountId: string, schedule: ScheduleItem[]): Promise<void> {
  try {
    setItemAccount("cp_last_schedule", JSON.stringify(schedule), accountId);
    localStorage.setItem("cp_last_schedule", JSON.stringify(schedule));
  } catch {}

  try {
    const db = await openStorageDB();
    const tx = db.transaction(STORE_SCHEDULES, "readwrite");
    const store = tx.objectStore(STORE_SCHEDULES);
    store.put({ accountId, data: schedule, updatedAt: Date.now() });
  } catch {}
}

export async function getPersistentSchedule(accountId: string): Promise<ScheduleItem[]> {
  try {
    const db = await openStorageDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_SCHEDULES, "readonly");
      const store = tx.objectStore(STORE_SCHEDULES);
      const req = store.get(accountId);
      req.onsuccess = () => {
        if (req.result && Array.isArray(req.result.data)) {
          resolve(req.result.data);
        } else {
          const saved = getItemAccount("cp_last_schedule", accountId) || localStorage.getItem("cp_last_schedule");
          if (saved) {
            try {
              resolve(JSON.parse(saved));
              return;
            } catch {}
          }
          resolve([]);
        }
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    const saved = getItemAccount("cp_last_schedule", accountId) || localStorage.getItem("cp_last_schedule");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  }
}

// Background URLs per account persistence
export async function savePersistentBackgrounds(
  accountId: string,
  images: string[],
  videos: string[]
): Promise<void> {
  try {
    localStorage.setItem("cp_custom_bgs", JSON.stringify(images));
    localStorage.setItem("cp_custom_video_bgs", JSON.stringify(videos));
    setItemAccount("cp_custom_bgs", JSON.stringify(images), accountId);
    setItemAccount("cp_custom_video_bgs", JSON.stringify(videos), accountId);
  } catch {}

  try {
    const db = await openStorageDB();
    const tx = db.transaction(STORE_BACKGROUNDS, "readwrite");
    const store = tx.objectStore(STORE_BACKGROUNDS);
    store.put({ accountId, images, videos, updatedAt: Date.now() });
  } catch (err) {
    console.warn("IndexedDB backgrounds save error:", err);
  }
}

export async function getPersistentBackgrounds(
  accountId: string
): Promise<{ images: string[]; videos: string[] }> {
  const readLocal = () => {
    let images: string[] = [];
    let videos: string[] = [];
    try {
      const rawImgs = getItemAccount("cp_custom_bgs", accountId) || localStorage.getItem("cp_custom_bgs");
      if (rawImgs) {
        const parsed = JSON.parse(rawImgs);
        if (Array.isArray(parsed)) images = parsed.filter((u) => typeof u === "string");
      }
    } catch {}
    try {
      const rawVids = getItemAccount("cp_custom_video_bgs", accountId) || localStorage.getItem("cp_custom_video_bgs");
      if (rawVids) {
        const parsed = JSON.parse(rawVids);
        if (Array.isArray(parsed)) videos = parsed.filter((u) => typeof u === "string");
      }
    } catch {}
    return { images, videos };
  };

  try {
    const db = await openStorageDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_BACKGROUNDS, "readonly");
      const store = tx.objectStore(STORE_BACKGROUNDS);
      const req = store.get(accountId);
      req.onsuccess = () => {
        const local = readLocal();
        if (req.result) {
          const dbImgs = Array.isArray(req.result.images) ? req.result.images : [];
          const dbVids = Array.isArray(req.result.videos) ? req.result.videos : [];
          resolve({
            images: Array.from(new Set([...dbImgs, ...local.images])),
            videos: Array.from(new Set([...dbVids, ...local.videos])),
          });
        } else {
          resolve(local);
        }
      };
      req.onerror = () => resolve(readLocal());
    });
  } catch {
    return readLocal();
  }
}

