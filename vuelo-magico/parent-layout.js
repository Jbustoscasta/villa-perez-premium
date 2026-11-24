/* Visual navigation only; flight state and camera remain in app.js. */
(() => {
  const panels = [...document.querySelectorAll('.sidebar[id^="vp"]')];
  const triggers = [...document.querySelectorAll('[data-vp-panel]')];
  const mobile = matchMedia('(max-width:830px) and (orientation:portrait)');
  let previous = null;
  function close(restore=true) {
    panels.forEach(p => p.classList.remove('vp-panel-open'));
    triggers.forEach(b => b.setAttribute('aria-expanded','false'));
    if (restore && previous) previous.focus({preventScroll:true});
    previous=null;
  }
  triggers.forEach(b => {
    b.setAttribute('aria-controls', b.dataset.vpPanel);
    b.addEventListener('click', () => {
      const panel=document.getElementById(b.dataset.vpPanel);
      if (!panel || !mobile.matches) return;
      close(false); previous=b;
      panel.classList.add('vp-panel-open');
      b.setAttribute('aria-expanded','true');
      panel.querySelector('[data-vp-close]').focus({preventScroll:true});
    });
  });
  document.querySelectorAll('[data-vp-close]').forEach(b=>b.addEventListener('click',()=>close()));
  document.addEventListener('keydown',e=>{if(e.key==='Escape' && previous)close()});
  const camera=document.getElementById('magicCamera');
  const empty=document.getElementById('emptyOverlay');
  const observer=new MutationObserver(()=>{
    if(!camera.hidden || empty.hidden)close(false);
  });
  observer.observe(camera,{attributes:true,attributeFilter:['hidden']});
  observer.observe(empty,{attributes:true,attributeFilter:['hidden']});
  if(mobile.addEventListener)mobile.addEventListener('change',()=>close(false));
  else mobile.addListener(()=>close(false));
})();

/* Apply the choices made in the illustrated parents panel. */
(() => {
  const params=new URLSearchParams(location.search);
  const sound=document.getElementById('soundToggle');
  if(params.has('sonido')) {
    sound.checked=params.get('sonido')!=='sin';
    sound.dispatchEvent(new Event('change'));
  }
  if(params.get('salida')==='foto') {
    for(const id of ['exportBtn','quickExportBtn','mobileExportBtn']) {
      const button=document.getElementById(id);
      button.textContent='Guardar foto mágica';
      button.addEventListener('click',event=>{
        event.preventDefault();event.stopImmediatePropagation();
        document.getElementById('snapshotBtn').click();
      },true);
    }
  }
})();
