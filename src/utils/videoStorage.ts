import { openMediaDB, LocalVideo } from "./localMediaStorage";

export function openVideoDB(): Promise<IDBDatabase> {
  return openMediaDB();
}

export async function storeVideoBlob(id: string, blob: Blob): Promise<void> {
  const db = await openMediaDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("videos", "readwrite");
    const store = transaction.objectStore("videos");
    
    // In videoStorage.ts, this was historically used to just store the raw blob.
    // We can store it as a LocalVideo object or a raw Blob.
    // To maintain compatibility with VideoView.tsx which might put/get raw blob,
    // let's check if the store has a keyPath. In localMediaStorage.ts, we used { keyPath: "id" }.
    // Let's make sure we put an object with the ID.
    const record: Partial<LocalVideo> = {
      id: id,
      blob: blob,
      name: id.startsWith("offline-") ? "Offline Video" : "Local Video",
      duration: "Local File",
      creator: "Personal Stream",
      category: "Personal Video",
      thumbnail: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80",
      createdAt: new Date().toISOString()
    };
    
    const request = store.put(record);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getVideoBlob(id: string): Promise<Blob | null> {
  try {
    const db = await openMediaDB();
    return new Promise<Blob | null>((resolve, reject) => {
      const transaction = db.transaction("videos", "readonly");
      const store = transaction.objectStore("videos");
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        if (result && result.blob) {
          resolve(result.blob);
        } else if (result instanceof Blob) {
          resolve(result);
        } else {
          resolve(null);
        }
      };
    });
  } catch (err) {
    console.error("IndexedDB videoStorage error:", err);
    return null;
  }
}

export async function deleteVideoBlob(id: string): Promise<void> {
  try {
    const db = await openMediaDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("videos", "readwrite");
      const store = transaction.objectStore("videos");
      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error("IndexedDB delete videoStorage error:", err);
  }
}
