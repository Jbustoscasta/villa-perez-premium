(() => {
  const $ = id => document.getElementById(id);
  let photoUrl;
  function preview(file) {
    if(photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl=URL.createObjectURL(file);
    $('photoPreview').src=photoUrl;
    $('photoWindow').hidden=false;
    $('photoCaption').textContent='Tu fotografía está preparada para la visita de Pérez';
    $('forget').hidden=false;
  }
  function updateLinks() {
    const query=new URLSearchParams({desde:'padres',sonido:$('music').value,salida:$('videoEnabled').checked?'video':'foto'});
    for(const id of ['create','flightLink','journeyFlight','journeyReady']) $(id).href='../vuelo-magico/?'+query;
    const video=$('videoEnabled').checked;
    $('create').setAttribute('aria-label',video?'Crear mi vídeo mágico':'Preparar mi foto mágica');
    document.querySelector('.photo-action').hidden=video;
  }
  $('videoEnabled').addEventListener('change',()=>{
    updateLinks();
    $('status').textContent=$('videoEnabled').checked?'Crearás un vídeo con el vuelo de Pérez.':'Prepararás una fotografía con Pérez, sin grabar vídeo.';
  });
  $('music').addEventListener('change',()=>{
    updateLinks();
    $('status').textContent=$('music').value==='sin'?'El vuelo se preparará sin sonido.':'El vuelo usará el sonido original de Pérez.';
  });
  for(const [id,style] of [['magicPrints','magic'],['normalPrints','normal']]) $(id).addEventListener('click',()=>{
    for(const name of ['magicPrints','normalPrints']) {
      $(name).classList.toggle('selected',name===id);
      $(name).setAttribute('aria-pressed',String(name===id));
    }
    $('footprintsLink').href='../huellas-perez/?estilo='+style;
    $('status').textContent=style==='magic'?'Huellas mágicas seleccionadas. Pulsa «Huellas mágicas» para crearlas.':'Huellas normales seleccionadas. Pulsa «Huellas mágicas» para crearlas.';
  });
  $('photo').addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    $('status').textContent='Preparando tu fotografía…';
    try { await VPPhotoStore.access('put',file);preview(file);$('status').textContent='Foto lista. Pulsa «Crear mi vídeo mágico» para preparar el vuelo.'; }
    catch { $('status').textContent='No se ha podido guardar la foto. Usa el asistente de foto para elegirla directamente en el editor.'; }
    e.target.value='';
  });
  $('forget').addEventListener('click',async()=>{
    try { await VPPhotoStore.access('delete');if(photoUrl)URL.revokeObjectURL(photoUrl);$('photoPreview').removeAttribute('src');$('photoWindow').hidden=true;$('forget').hidden=true;$('photoCaption').textContent='Foto de ejemplo del niño dormido';$('status').textContent='Tu fotografía se ha eliminado de este dispositivo.'; }
    catch { $('status').textContent='No se ha podido eliminar. Vuelve a intentarlo.'; }
  });
  VPPhotoStore.access('get').then(file=>{if(file)preview(file)}).catch(()=>{});
  $('help').addEventListener('click',()=>$('guide').showModal());
  for(const id of ['closeGuide','guideDone']) $(id).addEventListener('click',()=>$('guide').close());
  updateLinks();
})();
