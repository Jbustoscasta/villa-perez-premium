/* Same-origin, device-only photo handoff between parent screens and editors.
   Store bytes rather than File objects: this avoids Safari/WebKit DataCloneError. */
window.VPPhotoStore = {
  async access(mode, value) {
    const db = await new Promise((resolve,reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB no está disponible.'));
      const request = indexedDB.open('vp-parents-photo',1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('photo')) request.result.createObjectStore('photo');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('No se pudo abrir el almacén de fotos.'));
    });

    try {
      if (mode === 'put') {
        if (!(value instanceof Blob)) throw new Error('El archivo seleccionado no es una imagen válida.');
        const record = {
          bytes: new Uint8Array(await value.arrayBuffer()),
          name: value.name || 'fotografia',
          type: value.type || 'image/jpeg',
          lastModified: Number(value.lastModified) || Date.now()
        };
        await new Promise((resolve,reject) => {
          const transaction = db.transaction('photo','readwrite');
          const request = transaction.objectStore('photo').put(record,'current');
          request.onerror = () => reject(request.error || new Error('No se pudo guardar la fotografía.'));
          transaction.oncomplete = resolve;
          transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error('No se pudo guardar la fotografía.'));
        });
        return true;
      }

      if (mode === 'delete') {
        await new Promise((resolve,reject) => {
          const transaction = db.transaction('photo','readwrite');
          const request = transaction.objectStore('photo').delete('current');
          request.onerror = () => reject(request.error || new Error('No se pudo eliminar la fotografía.'));
          transaction.oncomplete = resolve;
          transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error('No se pudo eliminar la fotografía.'));
        });
        return true;
      }

      const record = await new Promise((resolve,reject) => {
        const transaction = db.transaction('photo','readonly');
        const request = transaction.objectStore('photo').get('current');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('No se pudo recuperar la fotografía.'));
        transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error('No se pudo recuperar la fotografía.'));
      });
      if (!record) return null;

      // Backwards compatibility with the earlier version that stored a File directly.
      if (record instanceof Blob) {
        return new File([record], record.name || 'fotografia', {
          type:record.type || 'image/jpeg',
          lastModified:Number(record.lastModified) || Date.now()
        });
      }
      if (record.blob instanceof Blob) {
        return new File([record.blob], record.name || 'fotografia', {
          type:record.type || record.blob.type || 'image/jpeg',
          lastModified:Number(record.lastModified) || Date.now()
        });
      }
      if (record.bytes) {
        return new File([record.bytes], record.name || 'fotografia', {
          type:record.type || 'image/jpeg',
          lastModified:Number(record.lastModified) || Date.now()
        });
      }
      return null;
    } finally {
      db.close();
    }
  }
};