const DB_NAME = "quantum-video-locker";
const STORE_NAME = "videos";
const DB_VERSION = 1;

export function openVideoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function storeVideoBlob(id: string, blob: Blob): Promise<void> {
  const db = await openVideoDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(blob, id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getVideoBlob(id: string): Promise<Blob | null> {
  try {
    const db = await openVideoDB();
    return new Promise<Blob | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  } catch (err) {
    console.error("IndexedDB error:", err);
    return null;
  }
}

export async function deleteVideoBlob(id: string): Promise<void> {
  try {
    const db = await openVideoDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error("IndexedDB delete error:", err);
  }
}
