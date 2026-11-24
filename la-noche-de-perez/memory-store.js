(() => {
  "use strict";
  const DB_NAME = "la-noche-perez-v1";
  const STORE_NAME = "memories";

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("IndexedDB no está disponible en este navegador."));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, {keyPath:"id"});
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("No se pudo abrir el Cofre."));
    });
  }

  function run(mode, operation) {
    return openDB().then(db => new Promise((resolve, reject) => {
      let request;
      let result;
      let transaction;
      try {
        transaction = db.transaction(STORE_NAME, mode);
        request = operation(transaction.objectStore(STORE_NAME));
        if (request) {
          request.onsuccess = () => { result = request.result; };
          request.onerror = () => reject(request.error || new Error("No se pudo completar la operación."));
        }
      } catch (error) {
        db.close();
        reject(error);
        return;
      }
      transaction.oncomplete = () => { db.close(); resolve(result); };
      transaction.onerror = () => { db.close(); reject(transaction.error || new Error("No se pudo guardar el recuerdo.")); };
      transaction.onabort = () => { db.close(); reject(transaction.error || new Error("El guardado se ha cancelado.")); };
    }));
  }

  async function put(item) {
    if (!item || !item.type) throw new Error("Falta el tipo de recuerdo.");
    const record = {
      ...item,
      id: item.id || ("memory-" + Date.now() + "-" + Math.random().toString(36).slice(2,8)),
      createdAt: Number(item.createdAt) || Date.now(),
      status: item.status || "draft"
    };
    try {
      await run("readwrite", store => store.put(record));
    } catch (error) {
      if (!(record.blob instanceof Blob)) throw error;
      const fallback = {
        ...record,
        blob: null,
        blobBytes: new Uint8Array(await record.blob.arrayBuffer()),
        blobMime: record.blob.type || record.mimeType || "application/octet-stream"
      };
      await run("readwrite", store => store.put(fallback));
    }
    return record.id;
  }

  async function normalize(record) {
    if (record && record.blobBytes && !record.blob) {
      record.blob = new Blob([record.blobBytes], {type:record.blobMime || record.mimeType || "application/octet-stream"});
    }
    return record;
  }

  async function get(id) {
    return normalize(await run("readonly", store => store.get(id)));
  }

  async function list() {
    const records = await run("readonly", store => store.getAll());
    const normalized = await Promise.all((records || []).map(normalize));
    return normalized.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  async function remove(id) {
    await run("readwrite", store => store.delete(id));
    return true;
  }

  window.LNPMemoryStore = Object.freeze({put,get,list,remove});
})();