// src/pages/music/lib/musicBlobStore.ts
// Local IndexedDB store for Music Hub audio bytes so imports work offline
// without a live worker / Supabase Storage. Metadata stays in unifiedStorage;
// this store holds the Blob keyed by track/blob id.

const DB_NAME = "lifeos_music_blobs";
const DB_VERSION = 1;
const STORE = "blobs";

export const IDB_URL_PREFIX = "idb:music/";

export function isIdbMusicUrl(url: string | null | undefined): boolean {
  return !!url && url.startsWith(IDB_URL_PREFIX);
}

export function idbMusicKey(url: string): string {
  return url.slice(IDB_URL_PREFIX.length);
}

export function toIdbMusicUrl(key: string): string {
  return `${IDB_URL_PREFIX}${key}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
  });
}

export async function putMusicBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("IndexedDB write failed"));
      tx.objectStore(STORE).put(blob, key);
    });
  } finally {
    db.close();
  }
}

export async function getMusicBlob(key: string): Promise<Blob | null> {
  const db = await openDb();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as Blob) ?? null);
      req.onerror = () => reject(req.error || new Error("IndexedDB read failed"));
    });
  } finally {
    db.close();
  }
}

export async function deleteMusicBlob(key: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("IndexedDB delete failed"));
      tx.objectStore(STORE).delete(key);
    });
  } finally {
    db.close();
  }
}

/** Resolve a playable URL. idb:music/* → object URL from IndexedDB; else passthrough. */
const objectUrlCache = new Map<string, string>();

export async function resolvePlayableUrl(url: string): Promise<string> {
  if (!isIdbMusicUrl(url)) return url;
  const cached = objectUrlCache.get(url);
  if (cached) return cached;
  const blob = await getMusicBlob(idbMusicKey(url));
  if (!blob) throw new Error("Audio blob missing from local store");
  const objectUrl = URL.createObjectURL(blob);
  objectUrlCache.set(url, objectUrl);
  return objectUrl;
}