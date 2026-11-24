/* Same-origin, device-only photo handoff between the parents hub and editor. */
window.VPPhotoStore = {
  async access(mode, value) {
    const db = await new Promise((resolve,reject) => {
      const r = indexedDB.open('vp-parents-photo',1);
      r.onupgradeneeded = () => r.result.createObjectStore('photo');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    try {
      return await new Promise((resolve,reject) => {
        const tx = db.transaction('photo',mode==='get'?'readonly':'readwrite');
        const store = tx.objectStore('photo');
        const r = mode==='get'?store.get('current'):mode==='delete'?store.delete('current'):store.put(value,'current');
        let result;
        r.onsuccess = () => { result=r.result; };
        tx.oncomplete = () => resolve(result);
        tx.onabort = tx.onerror = () => reject(tx.error || Error('No se pudo guardar la foto'));
      });
    } finally { db.close(); }
  }
};
