(() => {
  const $ = id => document.getElementById(id);
  let photoUrl;
  function preview(file) {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl=URL.createObjectURL(file);
    $('photoPreview').src=photoUrl;
    $('photoPreview').alt='Tu fotografía para preparar la visita de Pérez';
    $('photoCaption').textContent='Su habitación ya está preparada';
    $('sample').hidden=true;
    $('forget').hidden=false;
  }
  $('photo').addEventListener('change',async e => {
    const file=e.target.files?.[0];
    if(!file) return;
    $('status').textContent='Preparando tu fotografía…';
    try {
      await VPPhotoStore.access('put',file);
      preview(file);
      $('status').textContent='Foto lista. Continúa con «Crear mi vídeo mágico» para dibujar el vuelo.';
    } catch {
      $('status').textContent='No se ha podido guardar la foto aquí. Abre el asistente de foto para elegirla directamente en el editor.';
    }
    e.target.value='';
  });
  $('forget').addEventListener('click',async()=>{
    try {
      await VPPhotoStore.access('delete');
      if(photoUrl) URL.revokeObjectURL(photoUrl);
      $('photoPreview').src='assets/habitacion-ejemplo.webp';
      $('photoPreview').alt='Ejemplo de una habitación infantil de noche';
      $('photoCaption').textContent='La habitación de tu peque';
      $('sample').hidden=false;$('forget').hidden=true;
      $('status').textContent='Tu fotografía se ha eliminado de este dispositivo.';
    } catch { $('status').textContent='No se ha podido eliminar la foto. Vuelve a intentarlo.'; }
  });
  VPPhotoStore.access('get').then(file=>{if(file)preview(file)}).catch(()=>{});
  $('help').addEventListener('click',()=>$('guide').showModal());
  for(const id of ['closeGuide','guideDone']) $(id).addEventListener('click',()=>$('guide').close());
})();
