/* Villa Pérez Premium – Pantallas de experiencia, QR de tarjeta y reseñas */
(function(){
'use strict';
function init(){
 if(window.__villaPremiumUI)return;
 window.__villaPremiumUI=true;
 var $=function(id){return document.getElementById(id);};
 var params=new URLSearchParams(location.search);
 var clinic=(params.get('clinica')||params.get('clinic')||'Clínica del Doctor Abreu').trim().slice(0,75);
 var city=(params.get('ciudad')||params.get('city')||'').trim().slice(0,55);
 var chosen=(params.get('modo')==='hombro'||params.get('mode')==='shoulder')?'shoulder':'palm';
 var screen='welcome';
 var rawReview=params.get('review')||params.get('resena')||params.get('review_url');
 var placeId=(params.get('placeid')||params.get('place_id')||'').trim();
 var directReview=null;
 function safeGoogle(value){
  if(!value)return null;
  try{
   var u=new URL(value);
   var host=u.hostname.toLowerCase();
   return u.protocol==='https:'&&(host==='g.page'||host==='maps.app.goo.gl'||host==='google.com'||host.endsWith('.google.com'))?u.href:null;
  }catch(e){return null;}
 }
 if(placeId&&/^[a-zA-Z0-9_-]{10,200}$/.test(placeId)){
  directReview='https://search.google.com/local/writereview?placeid='+encodeURIComponent(placeId);
 }else directReview=safeGoogle(rawReview);
 var searchMaps='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(clinic+(city?', '+city:''));
 var mapsUrl=safeGoogle(params.get('maps'))||searchMaps;
 var root=document.createElement('div');
 root.id='vpShell';
 root.innerHTML=[
 '<div id="vpWelcome" class="vp-page" aria-label="Bienvenida Villa Pérez">',
   '<div class="vp-world vp-world-welcome"><div class="vp-glimmer"></div></div>',
   '<div class="vp-welcome-inner">',
    '<div class="vp-clinic-head"><span class="vp-tooth" aria-hidden="true">✧</span><span class="vp-clinic-name"></span></div>',
    '<div class="vp-ribbon vp-welcome-ribbon"><small>TE DA LA BIENVENIDA A</small><strong>Villa Pérez</strong></div>',
    '<div class="vp-hero-art"><img src="./perez.png" alt="Ratón Pérez oficial" class="vp-master"/></div>',
    '<div class="vp-parchment vp-welcome-copy"><span class="vp-sparkle">✦ ✧ ✦</span><h1>¡Una experiencia mágica!</h1><p>Has abierto la puerta del Ratón Pérez.<br/>Llévate un recuerdo único de tu visita.</p></div>',
    '<button type="button" class="vp-button vp-gold vp-main-cta" id="vpBegin"><span class="vp-camera-symbol" aria-hidden="true"></span> Comenzar <span aria-hidden="true">›</span></button>',
    '',
   '</div>',
 '</div>',
 '<div id="vpGuide" class="vp-page" aria-label="Cómo funciona">',
   '<div class="vp-world"></div>',
   '<header class="vp-page-header"><button class="vp-circle vp-back" type="button" data-to="welcome" aria-label="Atrás">‹</button><div class="vp-headbrand"><span class="vp-clinic-name"></span></div><button class="vp-circle" type="button" data-to="welcome" aria-label="Inicio">⌂</button></header>',
   '<div class="vp-page-scroll vp-guide-scroll">',
    '<div class="vp-ribbon vp-title-ribbon"><strong>¡Comienza la magia!</strong><small>Tu tarjeta ya ha abierto Villa Pérez</small></div>',
    '<div class="vp-card-scene"><img src="./villa-tarjeta.webp" alt="Tarjeta física con forma de puerta de Villa Pérez" /><div class="vp-card-caption"><b>La puerta es tu entrada</b><span>El QR de la tarjeta te ha traído aquí. No hace falta escanearlo otra vez.</span></div></div>',
    '<div class="vp-parchment vp-steps"><div class="vp-step"><span class="vp-number">1</span><span><b>Elige palma u hombro</b><small>Decide dónde quieres que aparezca Pérez.</small></span></div><div class="vp-step"><span class="vp-number">2</span><span><b>Haz una foto</b><small>Sonríe y coloca a Pérez con un dedo.</small></span></div><div class="vp-step"><span class="vp-number">3</span><span><b>Guarda la magia</b><small>Descarga o comparte tu recuerdo.</small></span></div></div>',
    '<button type="button" class="vp-button vp-gold" id="vpGuideNext">Continuar <span aria-hidden="true">›</span></button>',
   '</div>',
 '</div>',
 '<div id="vpChoose" class="vp-page" aria-label="Elegir foto">',
   '<div class="vp-world"></div>',
   '<header class="vp-page-header"><button class="vp-circle" data-to="guide" type="button" aria-label="Atrás">‹</button><div class="vp-headbrand"><span class="vp-clinic-name"></span></div><button class="vp-circle" data-to="welcome" type="button" aria-label="Inicio">⌂</button></header>',
   '<div class="vp-page-scroll vp-choice-scroll">',
    '<div class="vp-ribbon vp-title-ribbon"><strong>¿Dónde aparecerá Pérez?</strong><small>¡Tú decides dónde sucede la magia!</small></div>',
    '<div class="vp-parchment vp-choose-card"><p class="vp-card-lead">Elige dónde quieres que aparezca el Ratón Pérez.</p>',
      '<div class="vp-locations"><button type="button" class="vp-location vp-active" data-placement="palm" aria-pressed="true"><span class="vp-location-icon vp-icon-palm" aria-hidden="true"><svg viewBox="0 0 110 110" fill="none"><path d="M34 68 21 52c-5-7-14 0-9 8l22 32c5 7 13 10 24 10h20c13 0 22-10 22-25V44c0-8-12-8-12 0V30c0-8-12-8-12 0V20c0-8-12-8-12 0v8c0-8-12-8-12 0v27c0-8-12-8-12 0v13Z" fill="#f9cfa3" stroke="#0c424b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M52 33v24M64 26v31M76 33v24M88 47v10" stroke="#bc8148" stroke-width="2.5"/><path d="M17 14v8M7 23l7 4M28 10l-3 8M95 15l-4 8" stroke="#e9b750" stroke-width="3" stroke-linecap="round"/></svg></span><b>En la palma</b><small>Como un ratoncito de verdad</small></button>',
      '<button type="button" class="vp-location" data-placement="shoulder" aria-pressed="false"><span class="vp-location-icon vp-icon-shoulder" aria-hidden="true"><svg viewBox="0 0 110 110" fill="none"><path d="M17 102V79c0-11 10-19 25-23l8-3h11l8 3c15 4 24 12 24 23v23Z" fill="#e7c6a4" stroke="#0c424b" stroke-width="4" stroke-linejoin="round"/><path d="M40 55 55 72l15-17M55 72v30" stroke="#b98149" stroke-width="3" stroke-linecap="round"/><path d="M39 29c0-14 8-23 20-23 12 0 21 10 21 23 0 14-8 24-21 24-12 0-20-10-20-24Z" fill="#f4caa0" stroke="#0c424b" stroke-width="4"/><path d="M38 24c1-22 33-28 42-9l3 11c-13-1-18-8-25-8-7 10-14 12-20 11Z" fill="#6a4536" stroke="#0c424b" stroke-width="3"/><path d="M77 56c6-7 13-8 20-4" stroke="#f5d481" stroke-width="5" stroke-linecap="round"/><path d="M85 46c5-7 13-9 18-4M95 57l9 3" stroke="#eec56d" stroke-width="3" stroke-linecap="round"/></svg><img src="./perez.png" alt="" class="vp-shoulder-master"/></span><b>En el hombro</b><small>Un amigo muy especial</small></button></div>',
      '<div class="vp-sample"><img src="./perez.png" alt="Ratón Pérez oficial"/><span>Después podrás moverlo, girarlo y cambiar su tamaño.</span></div>',
    '</div>',
    '<p class="vp-choice-status" id="vpChoiceStatus" role="status"></p>',
    '<button type="button" class="vp-button vp-gold" id="vpOpenCamera"><span class="vp-camera-symbol" aria-hidden="true"></span> Abrir cámara</button>',
    '<button type="button" class="vp-button vp-ivory" id="vpChooseFile">▧ Elegir foto del móvil</button>',
    '<p class="vp-microline">La fotografía se prepara en tu dispositivo.</p>',
   '</div>',
 '</div>',
 '<div id="vpReview" class="vp-page" aria-label="Reseña de Google">',
   '<div class="vp-world vp-world-review"></div>',
   '<header class="vp-page-header"><button class="vp-circle" type="button" data-to="result" aria-label="Atrás">‹</button><div class="vp-headbrand"><span class="vp-clinic-name"></span></div><button class="vp-circle" type="button" data-to="welcome" aria-label="Inicio">⌂</button></header>',
   '<div class="vp-page-scroll vp-review-scroll">',
    '<div class="vp-review-hero"><img src="./perez.png" alt="Ratón Pérez oficial sonriente" /><span class="vp-review-sparkles" aria-hidden="true">✦ ✧ ✦</span></div>',
    '<div class="vp-parchment vp-review-paper"><span class="vp-tooth-mark">♡</span><h2>¿Nos ayudas con tu reseña?</h2><p>Comparte tu experiencia en <b class="vp-clinic-name"></b> a través de Google.</p><div class="vp-stars" aria-label="Puedes valorar libremente tu experiencia en Google">✦ ✦ ✦ ✦ ✦</div>',
    '<button type="button" class="vp-button vp-teal" id="vpReviewOpen"><span class="vp-google-g" aria-hidden="true">G</span> <span id="vpReviewLabel">Dejar reseña en Google</span> <span>›</span></button>',
    '<p class="vp-review-hint" id="vpReviewHint"></p></div>',
    '<button type="button" class="vp-text-action" data-to="result">Volver a mi recuerdo</button>',
   '</div>',
 '</div>',
 '<div id="vpResult" class="vp-page" aria-label="Foto terminada">',
   '<div class="vp-world vp-world-result"></div>',
   '<header class="vp-page-header"><button class="vp-circle" type="button" id="vpResultEdit" aria-label="Volver a editar">‹</button><div class="vp-headbrand"><span class="vp-clinic-name"></span></div><button class="vp-circle" type="button" id="vpResultHome" aria-label="Inicio">⌂</button></header>',
   '<div class="vp-page-scroll vp-result-scroll">',
    '<div class="vp-ribbon vp-title-ribbon"><strong>¡Foto lista!</strong><small>Un recuerdo mágico para toda la familia</small></div>',
    '<div class="vp-photo-holder"><img id="vpPhotoResult" alt="Tu fotografía en el marco mágico de Villa Pérez"/><div class="vp-photo-loading" id="vpPhotoLoading">✦ Preparando tu recuerdo…</div></div>',
    '<div class="vp-result-actions"><button class="vp-button vp-ivory" id="vpSave">↓ Guardar en mi móvil</button><button class="vp-button vp-teal" id="vpShare">↗ Compartir</button></div>',
    '<div class="vp-social-heading">Compartir mi experiencia</div>',
    '<div class="vp-social-row"><button type="button" data-share="whatsapp"><b>◉</b><small>WhatsApp</small></button><button type="button" data-share="instagram"><b>◎</b><small>Instagram</small></button><button type="button" data-share="facebook"><b>f</b><small>Facebook</small></button><button type="button" id="vpMapsShare"><b>⌖</b><small>Google Maps</small></button><button type="button" data-share="more"><b>↗</b><small>Más opciones</small></button></div>',
    '<button class="vp-review-invite" id="vpInviteReview"><span class="vp-google-g">G</span><span><span class="vp-review-stars" aria-hidden="true">✦ ✦ ✦ ✦ ✦</span><b>¿Nos ayudas con una reseña?</b><small>Comparte tu experiencia en Google</small></span><span>›</span></button>',
    '<button class="vp-text-action" id="vpRestart" type="button">↻ Volver a empezar</button>',
   '</div>',
 '</div>',
 '<div id="vpFloatHeader" class="vp-floating-header" aria-label="Fotografía mágica">',
  '<button type="button" class="vp-circle" id="vpCameraBack" aria-label="Volver">‹</button>',
  '<div class="vp-floating-copy"><span class="vp-clinic-name"></span><strong id="vpCameraTitle">Sonríe, Pérez está cerca</strong></div>',
  '<button type="button" class="vp-circle" id="vpCameraHelp" aria-label="Ayuda">?</button>',
 '</div>',
 '<div class="vp-help hidden" id="vpHelp" role="dialog" aria-modal="true" aria-label="Ayuda para colocar al Ratón Pérez"><div class="vp-help-inner vp-parchment"><h2>Coloca a Pérez a tu gusto</h2><p>Arrástralo con un dedo. Usa el recuadro para girarlo o cambiar su tamaño. Con dos dedos puedes moverlo y ampliarlo a la vez.</p><button type="button" class="vp-button vp-teal" id="vpHelpClose">Entendido</button></div></div>',
 '<div id="vpToast" class="vp-ui-toast" role="status" aria-live="polite"></div>'
 ].join('');
 document.body.appendChild(root);
 document.querySelectorAll('.vp-clinic-name').forEach(function(el){el.textContent=clinic;});
 if(!directReview){
  $('vpReviewLabel').textContent='Buscar clínica en Google';
  $('vpReviewHint').textContent='Busca la ficha de la clínica y abre el apartado «Reseñas». El acceso directo se configurará con el QR de cada clínica.';
 } else {
  $('vpReviewHint').textContent='Google abrirá la ficha de la clínica para que publiques tu opinión libremente.';
 }
 var floating=$('vpFloatHeader'), toastTimeout=0;
 function toast(message){
  var el=$('vpToast');el.textContent=message;el.classList.add('show');
  clearTimeout(toastTimeout);toastTimeout=setTimeout(function(){el.classList.remove('show');},4200);
 }
 function updatePhoto(){
  var native=$('finalImage'),result=$('vpPhotoResult');
  if(!native||!result)return;
  var src=native.currentSrc||native.src;
  if(src&&result.src!==src){result.src=src;result.classList.remove('vp-loaded');$('vpPhotoLoading').hidden=false;}
 }
 $('vpPhotoResult').addEventListener('load',function(){this.classList.add('vp-loaded');$('vpPhotoLoading').hidden=true;});
 if($('finalImage'))new MutationObserver(updatePhoto).observe($('finalImage'),{attributes:true,attributeFilter:['src']});
 function setScreen(target){
  screen=target;document.body.setAttribute('data-vp-screen',target);
  document.querySelectorAll('.vp-page').forEach(function(el){el.classList.remove('vp-current');});
  var page={welcome:'vpWelcome',guide:'vpGuide',choose:'vpChoose',review:'vpReview',result:'vpResult'}[target];
  if(page){$(page).classList.add('vp-current');$(page).scrollTop=0;}
  floating.classList.toggle('vp-visible',target==='live'||target==='edit');
  if(target==='live')$('vpCameraTitle').textContent=chosen==='shoulder'?'Enfoca rostro y hombros':'Muestra una palma abierta';
  if(target==='edit'){$('vpCameraTitle').textContent='Coloca a Pérez donde más te guste';}
  if(target==='result')updatePhoto();
 }
 function goHome(){
  if(document.body.classList.contains('stage-result'))$('retry').click();
  else if(document.body.classList.contains('editing'))$('retry').click();
  else if(document.body.classList.contains('has-camera'))$('backToChoice').click();
  setScreen('welcome');
 }
 document.querySelectorAll('[data-to]').forEach(function(btn){
  btn.addEventListener('click',function(){var goal=btn.getAttribute('data-to');if(goal==='welcome')goHome();else setScreen(goal);});
 });
 $('vpBegin').addEventListener('click',function(){setScreen('guide');});
 $('vpGuideNext').addEventListener('click',function(){setScreen('choose');});
 document.querySelectorAll('[data-placement]').forEach(function(btn){
  btn.addEventListener('click',function(){
   chosen=btn.dataset.placement;
   $(chosen==='shoulder'?'placeShoulder':'placePalm').click();
   document.querySelectorAll('[data-placement]').forEach(function(b){var yes=b.dataset.placement===chosen;b.classList.toggle('vp-active',yes);b.setAttribute('aria-pressed',String(yes));});
  });
 });
 $('vpOpenCamera').addEventListener('click',function(){
  $(chosen==='shoulder'?'placeShoulder':'placePalm').click();
  $('startCamera').click();
  setScreen('live');
 });
 $('vpChooseFile').addEventListener('click',function(){
  $(chosen==='shoulder'?'placeShoulder':'placePalm').click();
  $('file').click();
 });
 $('file').addEventListener('change',function(){if(this.files&&this.files.length)setScreen('edit');});
 function backFromCamera(){
  if(document.body.classList.contains('editing')){$('retry').click();setScreen('choose');}
  else if(document.body.classList.contains('has-camera')){$('backToChoice').click();setScreen('choose');}
  else setScreen('choose');
 }
 $('vpCameraBack').addEventListener('click',backFromCamera);
 $('vpCameraHelp').addEventListener('click',function(){$('vpHelp').classList.remove('hidden');});
 $('vpHelpClose').addEventListener('click',function(){$('vpHelp').classList.add('hidden');});
 $('vpResultEdit').addEventListener('click',function(){$('editPhoto').click();setScreen('edit');});
 $('vpResultHome').addEventListener('click',goHome);
 $('vpSave').addEventListener('click',function(){$('download').click();});
 $('vpShare').addEventListener('click',function(){$('share').click();});
 document.querySelectorAll('[data-share]').forEach(function(btn){
  btn.addEventListener('click',function(){
   var name=btn.dataset.share;
   if(name!=='more')toast('En el menú de compartir, elige '+({whatsapp:'WhatsApp',instagram:'Instagram',facebook:'Facebook'}[name]||'tu aplicación favorita')+'.');
   $('share').click();
  });
 });
 $('vpMapsShare').addEventListener('click',function(){
  toast('Guarda primero la imagen; en Google Maps podrás añadirla a las fotos de la clínica.');
  window.open(mapsUrl,'_blank','noopener,noreferrer');
 });
 $('vpInviteReview').addEventListener('click',function(){setScreen('review');});
 $('vpReviewOpen').addEventListener('click',function(){
  try{window.open(directReview||searchMaps,'_blank','noopener,noreferrer');}
  catch(e){location.href=directReview||searchMaps;}
 });
 $('vpRestart').addEventListener('click',goHome);
 function syncCore(){
  var body=document.body;
  if(body.classList.contains('stage-result')){if(screen!=='review'&&screen!=='result')setScreen('result');return;}
  if(body.classList.contains('editing')){if(screen!=='edit')setScreen('edit');return;}
  if(body.classList.contains('has-camera')){if(screen==='choose'||screen==='live')setScreen('live');return;}
  if(screen==='live'||screen==='edit')setScreen('choose');
  if(screen==='choose'&&$('status')){
   var text=$('status').textContent||'';
   if(/denegad|no disponible|no pudo|ocupada|encontrado una cámara/i.test(text))$('vpChoiceStatus').textContent=text;
  }
 }
 new MutationObserver(syncCore).observe(document.body,{attributes:true,attributeFilter:['class']});
 if($('status'))new MutationObserver(function(){
  if(screen==='choose'){
   var text=$('status').textContent||'';
   $('vpChoiceStatus').textContent=/denegad|no disponible|no pudo|ocupada|encontrado una cámara/i.test(text)?text:'';
  }
 }).observe($('status'),{childList:true,subtree:true});
 var initPlacement=document.querySelector('[data-placement="'+chosen+'"]');
 if(initPlacement)initPlacement.click();
 setScreen('welcome');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
