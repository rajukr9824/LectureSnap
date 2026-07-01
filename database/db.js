// database/db.js
// IndexedDB access layer. This module must only be imported by the
// background service worker — never by content scripts or the popup.
// Screenshots are persisted as Blobs (smaller than base64 strings in
// IndexedDB) and converted back to base64 data URLs only when a
// caller actually needs to render/export them.

export const DB_NAME = "LectureSnapDB";
const STORE_NAME = "screenshots";
const DB_VERSION = 1;

let dbInstance = null;

function openDatabase() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("videoId", "videoId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

// ----------------------------------------------------------------
// Blob <-> base64 helpers
// ----------------------------------------------------------------

function dataURLToBlob(dataURL) {
  const [header, base64] = dataURL.split(",");
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function serializeForStorage(screenshot) {
  const { image, ...rest } = screenshot;
  const imageBlob = typeof image === "string" ? dataURLToBlob(image) : image;
  return { ...rest, imageBlob };
}

async function deserializeFromStorage(record) {
  if (!record) return record;
  if (record.imageBlob) {
    const { imageBlob, ...rest } = record;
    const image = await blobToDataURL(imageBlob);
    return { ...rest, image };
  }
  // Legacy records saved before the Blob migration already store a
  // base64 `image` field directly — return as-is for compatibility.
  return record;
}

function sortByOrder(list) {
  return list.sort((a, b) => {
    const orderA = a.order ?? a.createdAt;
    const orderB = b.order ?? b.createdAt;
    return orderA - orderB;
  });
}

// ----------------------------------------------------------------
// CRUD
// ----------------------------------------------------------------

export async function addScreenshot(screenshot) {
  const db = await openDatabase();
  const record = await serializeForStorage(screenshot);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(record);
    tx.oncomplete = () => resolve(screenshot);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllScreenshots() {
  const db = await openDatabase();
  const records = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const screenshots = await Promise.all(records.map(deserializeFromStorage));
  return sortByOrder(screenshots);
}

export async function getScreenshotsByVideo(videoId) {
  const db = await openDatabase();
  const records = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.objectStore(STORE_NAME).index("videoId");
    const request = index.getAll(IDBKeyRange.only(videoId));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const screenshots = await Promise.all(records.map(deserializeFromStorage));
  return sortByOrder(screenshots);
}

export async function getScreenshotById(id) {
  const db = await openDatabase();
  const record = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return deserializeFromStorage(record);
}

// Patches specific fields on a record (e.g. { note } or { order })
// WITHOUT decoding/re-encoding the image Blob. This keeps note
// autosave and drag-and-drop reordering fast even with 100+ records.
export async function patchScreenshot(id, fields) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const record = getRequest.result;
      if (record) {
        Object.assign(record, fields);
        store.put(record);
      }
    };
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// Full replace, kept for API completeness (e.g. if the image itself
// ever needs to change).
export async function updateScreenshot(screenshot) {
  const db = await openDatabase();
  const record = await serializeForStorage(screenshot);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve(screenshot);
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteScreenshot(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteScreenshotsByVideo(videoId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("videoId");
    const request = index.openCursor(IDBKeyRange.only(videoId));
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearScreenshots() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
