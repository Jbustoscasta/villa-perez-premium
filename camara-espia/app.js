(() => {
  'use strict';
  // A visual, pretend camera. No all-night real recording takes place.
  const $ = id => document.getElementById(id);
  const stateKey = 'vp_cam_espia_mission_v1';
  const signalKey = 'vp_cam_espia_capture_changed_v1';
  const dbName = 'villa-perez-sorpresas-v1';
  const storeName = 'items';
  const assetKey = 'captura-magica';
  const base = $('artboard');
  const feed = $('cameraFeed');
  const posterFallback = $('cameraFallback');
  const startBtn = $('missionButton');
  const alertText = $('alertText');
  const viewBtn = $('viewCapture');
  const modal = $('captureModal');
  const savedVideo = $('savedVideo');
  const params = new URLSearchParams(location.search);
  if(params.get('desde')==='lnp') $('returnChildStory').hidden=false;
  const demoMode = params.get('demo'); // ?demo=ready / ?demo=empty — isolated QA only
  let media = null;
  let startedAt = 0;
  let tickHandle = null;
  let wakeLock = null;
  let currentCapture = null;
  let activeUrls = [];
  let toastHandle = null;
  let modalReturnFocus = null;
  const elTime = $('hudTimer');

  const formatElapsed = seconds => {
    seconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [hours, minutes, secs].map(n => String(n).padStart(2, '0')).join(':');
  };
  const toast = message => {
    const target = $('toast');
    target.textContent = message;
    target.hidden = false;
    clearTimeout(toastHandle);
    toastHandle = setTimeout(() => target.hidden = true, 4700);
  };
  const updateTimer = () => {
    if (!startedAt) return;
    elTime.textContent = formatElapsed((Date.now() - startedAt) / 1000);
    // Purely illustrative detector activity, never a claim of real motion analysis.
  };
  function stopFeed() {
    if (media) {
      for (const track of media.getTracks()) track.stop();
      media = null;
    }
    feed.pause();
    feed.srcObject = null;
    feed.hidden = true;
    posterFallback.hidden = false;
    $('liveViewport').classList.remove('has-feed');
  }
  async function beginPreview() {
    stopFeed();
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      return; // keep illustrated fallback while the magical timer continues
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (!startedAt || document.hidden) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      media = stream;
      feed.srcObject = stream;
      feed.hidden = false;
      posterFallback.hidden = true;
      $('liveViewport').classList.add('has-feed');
      try { await feed.play(); } catch (err) {
        console.info('Vista en directo no reproducible; se usa la ilustración.', err);
        stopFeed();
      }
    } catch (err) {
      // Declining a camera permission never interrupts the make-believe mission.
      console.info('Sin permiso para cámara: se mantiene el visor ilustrado.', err?.name || err);
      toast('La misión mágica funciona también sin permiso de cámara.');
    }
  }
  async function requestWakeLock() {
    if (!('wakeLock' in navigator) || document.hidden || !startedAt) return;
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {
      // iOS can dim, lock or suspend any page. We never promise otherwise.
    }
  }
  async function releaseWakeLock() {
    try { if (wakeLock) await wakeLock.release(); } catch (_) {}
    wakeLock = null;
  }
  function applyRunningUI() {
    base.classList.toggle('is-running', !!startedAt);
    $('liveViewport').hidden = !startedAt;
    startBtn.setAttribute('aria-pressed', String(!!startedAt));
    startBtn.setAttribute('aria-label', startedAt ? 'Misión nocturna activada' : 'Comenzar misión nocturna');
    if (startedAt) updateTimer();
  }
  async function startMission() {
    if (startedAt) {
      toast('La misión está activa. ¡Descansa y deja trabajar al radar de Pérez!');
      return;
    }
    startedAt = Date.now();
    try { localStorage.setItem(stateKey, String(startedAt)); } catch (_) {}
    applyRunningUI();
    if (!tickHandle) tickHandle = setInterval(updateTimer, 1000);
    beginPreview();
    requestWakeLock();
    toast('¡Misión activada! Apoya el móvil en un lugar seguro y duerme tranquilamente.');
  }
  async function stopMission() {
    startedAt = 0;
    try { localStorage.removeItem(stateKey); } catch (_) {}
    clearInterval(tickHandle);
    tickHandle = null;
    stopFeed();
    releaseWakeLock();
    applyRunningUI();
  }
  startBtn.addEventListener('click', startMission);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopFeed();
      releaseWakeLock();
    } else {
      if (startedAt) {
        updateTimer();
        beginPreview();
        requestWakeLock();
      }
      refreshCapture();
    }
  });
  window.addEventListener('pagehide', () => {
    stopFeed();releaseWakeLock();
  });
  window.addEventListener('focus', () => refreshCapture());
  window.addEventListener('storage', evt => {
    if (evt.key === signalKey) refreshCapture();
  });
  $('adultInfo').addEventListener('click', () => {
    const note = $('adultNote');
    note.hidden = !note.hidden;
    $('adultInfo').setAttribute('aria-expanded', String(!note.hidden));
  });

  // Shared-origin repository: the parent's editor may publish an actual Blob.
  // Content is stored locally in IndexedDB; no server upload or invented files.
  function openDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB no disponible'));
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('No se puede abrir la biblioteca'));
    });
  }
  async function withStore(mode, operation) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      let value;
      try { value = operation(tx.objectStore(storeName)); } catch (e) { db.close(); reject(e); return; }
      tx.oncomplete = () => { db.close(); resolve(value?.result); };
      tx.onerror = () => { db.close(); reject(tx.error || new Error('Operación no disponible')); };
      tx.onabort = () => { db.close(); reject(tx.error || new Error('Operación cancelada')); };
    });
  }
  async function readCapture(){
    const data=await withStore('readonly', store=>store.get(assetKey));
    if(data?.videoBytes && !data.videoBlob)
      data.videoBlob=new Blob([data.videoBytes],{type:data.videoMime||'video/mp4'});
    if(data?.photoBytes && !data.photoBlob)
      data.photoBlob=new Blob([data.photoBytes],{type:data.photoMime||'image/jpeg'});
    if(data?.letterBytes && !data.letterBlob)
      data.letterBlob=new Blob([data.letterBytes],{type:data.letterMime||'application/pdf'});
    return data;
  }
  const markChanged = () => {
    try { localStorage.setItem(signalKey, String(Date.now())); } catch (_) {}
  };
  async function publishCapture(input = {}) {
    const videoBlob = input.videoBlob instanceof Blob ? input.videoBlob : null;
    const videoUrl = typeof input.videoUrl === 'string' ? input.videoUrl : null;
    if (!videoBlob && !videoUrl) throw new Error('Es necesario un vídeo real preparado por el adulto.');
    const data = {
      id: assetKey,
      createdAt: Date.now(),
      availableAt: Number.isFinite(input.availableAt) ? input.availableAt : Date.now(),
      videoBlob,videoUrl,
      photoBlob:input.photoBlob instanceof Blob?input.photoBlob:null,
      photoUrl:typeof input.photoUrl==='string'?input.photoUrl:null,
      letterBlob:input.letterBlob instanceof Blob?input.letterBlob:null,
      letterUrl:typeof input.letterUrl==='string'?input.letterUrl:null
    };
    try {
      await withStore('readwrite',store=>store.put(data));
    } catch (error) {
      // Safari/WebKit may reject structured-cloning Blob objects into IndexedDB.
      // Store byte arrays instead; IndexedDB supports Uint8Array reliably.
      if (!videoBlob) throw error;
      data.videoBytes = new Uint8Array(await videoBlob.arrayBuffer());
      data.videoMime = videoBlob.type || 'video/mp4';
      data.videoBlob = null;
      if(data.photoBlob){
        data.photoBytes=new Uint8Array(await data.photoBlob.arrayBuffer());
        data.photoMime=data.photoBlob.type||'image/jpeg';
        data.photoBlob=null;
      }
      if(data.letterBlob){
        data.letterBytes=new Uint8Array(await data.letterBlob.arrayBuffer());
        data.letterMime=data.letterBlob.type||'application/pdf';
        data.letterBlob=null;
      }
      await withStore('readwrite',store=>store.put(data));
    }
    markChanged();
    await refreshCapture();
    return {ready:true,availableAt:data.availableAt};
  }
  async function clearCapture() {
    await withStore('readwrite',store=>store.delete(assetKey));
    markChanged();await refreshCapture();
  }
  function captureIsReady(data) {
    return Boolean(data && (data.videoBlob || data.videoUrl) && Date.now() >= (Number(data.availableAt) || 0));
  }
  async function refreshCapture() {
    try {
      if (demoMode === 'empty') currentCapture = null;
      else if (demoMode === 'ready') {
        currentCapture = {demo:true, videoUrl:'assets/demo-captura.mp4',availableAt:0};
      } else currentCapture = await readCapture();
    } catch(err) {console.warn('Biblioteca local de Pérez no disponible',err);currentCapture=null;}
    const ready = captureIsReady(currentCapture);
    alertText.textContent = ready ? 'La cámara ha captado algo...' : 'Aquí se almacenará la grabación.';
    alertText.classList.toggle('ready',ready);
    viewBtn.hidden = !ready;
    return ready;
  }
  function managedURL(blobOrUrl) {
    if (blobOrUrl instanceof Blob) {
      const url = URL.createObjectURL(blobOrUrl);
      activeUrls.push(url);
      return url;
    }
    return typeof blobOrUrl === 'string' ? blobOrUrl : null;
  }
  function releaseUrls() {
    activeUrls.forEach(url => URL.revokeObjectURL(url));
    activeUrls=[];
  }
  function showCapture() {
    if (!captureIsReady(currentCapture)) return;
    modalReturnFocus = document.activeElement;
    releaseUrls();
    const source = managedURL(currentCapture.videoBlob || currentCapture.videoUrl);
    if (!source) return;
    savedVideo.src=source;
    savedVideo.load();
    $('demoNotice').hidden=!currentCapture.demo;
    const photo=managedURL(currentCapture.photoBlob||currentCapture.photoUrl);
    const letter=managedURL(currentCapture.letterBlob||currentCapture.letterUrl);
    $('photoLink').hidden=!photo;
    $('letterLink').hidden=!letter;
    if(photo)$('photoLink').href=photo;
    if(letter)$('letterLink').href=letter;
    $('extras').hidden=!photo&&!letter;
    modal.hidden=false;
    document.body.classList.add('modal-open');
    $('closeCapture').focus({preventScroll:true});
  }
  function closeCapture() {
    savedVideo.pause();savedVideo.removeAttribute('src');savedVideo.load();
    modal.hidden=true;document.body.classList.remove('modal-open');releaseUrls();
    if(modalReturnFocus?.isConnected)modalReturnFocus.focus({preventScroll:true});
    modalReturnFocus=null;
  }
  viewBtn.addEventListener('click',showCapture);
  $('closeCapture').addEventListener('click',closeCapture);
  $('doneCapture').addEventListener('click',closeCapture);
  modal.addEventListener('click',event => {if(event.target===modal)closeCapture();});
  document.addEventListener('keydown',e => {
    if(e.key==='Escape'&&!modal.hidden){e.preventDefault();closeCapture();}
  });
  setInterval(() => { if (document.visibilityState === 'visible') refreshCapture(); }, 30000);

  try {
    const prev = Number(localStorage.getItem(stateKey));
    if (Number.isFinite(prev) && prev>0 && Date.now()-prev < 16*3600*1000) {
      startedAt = prev;
      applyRunningUI();
      tickHandle = setInterval(updateTimer, 1000);
      // Never request a camera on initial page load; only a user gesture may grant it.
    }
  } catch(_) {}
  applyRunningUI();
  refreshCapture();
  window.VillaPerezSpy = Object.freeze({
    publishCapture,clearCapture,refreshCapture,startMission,stopMission,
    getStatus:()=>({missionActive:!!startedAt,startedAt,hasCapturedVideo:captureIsReady(currentCapture)}),
    version:'1.0.0'
  });
})();
