(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = {
    current:"splash",
    history:["splash"],
    destination:"",
    videoFile:null,
    videoPhotoUrl:null,
    proofType:"selfie",
    proofImage:null,
    proofScale:.18,
    proofRotation:0,
    overlayX:.78,
    overlayY:.58,
    memoryUrls:[]
  };
  const DEFAULT_MESSAGE = "¡Gracias por cuidar tan bien tus dientes! Sigue así, estás haciendo un gran trabajo. He venido volando desde Villa Pérez para recoger tu dientecito. ¡Sigue soñando y sonriendo!";
  const proofConfig = {
    selfie:{
      eyebrow:"EL RATÓN HA VENIDO A VERLE",
      title:"Selfie con Pérez",
      description:"Elige una foto real de tu peque dormido. Mueve a Pérez con el dedo y ajusta su tamaño."
    },
    window:{
      eyebrow:"EL GLOBO ESTÁ MUY CERCA",
      title:"Pérez en la ventana.",
      description:"Elige una foto desde la habitación hacia el exterior. Coloca el globo en el cielo o junto a la ventana."
    }
  };

  function toast(message) {
    const node=$("toast");
    node.textContent=message;
    node.classList.add("visible");
    clearTimeout(toast.timer);
    toast.timer=setTimeout(()=>node.classList.remove("visible"),2600);
  }

  function showScreen(name,push=true) {
    const target=$("screen-"+name);
    if(!target)return;
    if(push && state.current!==name)state.history.push(name);
    state.current=name;
    document.querySelectorAll(".screen").forEach(screen=>screen.classList.toggle("active",screen===target));
    document.querySelector(".app-shell").dataset.screen=name;
    $("backButton").hidden=name==="home"||name==="splash";
    $("menuButton").hidden=name!=="home";
    if(name==="library")renderLibrary();
    if(name==="letter")updateLetterPreview();
  }

  function goBack() {
    if(state.history.length>1)state.history.pop();
    showScreen(state.history[state.history.length-1]||"home",false);
  }

  document.querySelectorAll("[data-screen]").forEach(button=>{
    button.addEventListener("click",()=>{
      const dialog=button.closest("dialog");
      if(dialog)dialog.close();
      showScreen(button.dataset.screen);
    });
  });
  $("backButton").addEventListener("click",goBack);
  $("menuButton")?.addEventListener("click",()=>$("menuDialog").showModal());
  $("helpButton").addEventListener("click",()=>$("helpDialog").showModal());
  document.querySelectorAll("[data-close-dialog]").forEach(button=>{
    button.addEventListener("click",()=>$(button.dataset.closeDialog).close());
  });
  document.querySelectorAll("dialog").forEach(dialog=>{
    dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});
  });

  $("addressForm").addEventListener("submit",event=>{
    event.preventDefault();
    const value=$("addressInput").value.trim();
    if(value.length<6){
      $("addressStatus").textContent="Escribe una dirección un poco más completa.";
      $("addressInput").focus();
      return;
    }
    state.destination=value;
    $("addressStatus").textContent="Destino anotado para esta sesión. No se guarda en el Cofre ni se comparte con el modo niño.";
    $("destinationContinue").disabled=false;
    toast("Destino anotado.");
  });
  $("destinationContinue").addEventListener("click",()=>showScreen("video"));
  $("useLocation").addEventListener("click",()=>{
    if(!navigator.geolocation){$("addressStatus").textContent="Este navegador no permite usar tu ubicación. Escribe tu dirección.";return;}
    $("useLocation").disabled=true;$("addressStatus").textContent="Solicitando permiso de ubicación…";
    navigator.geolocation.getCurrentPosition(position=>{
      state.destinationCoordinates={lat:position.coords.latitude,lng:position.coords.longitude};
      $("addressStatus").textContent="Ubicación anotada para esta sesión. El origen del mapa sigue pendiente.";
      $("destinationContinue").disabled=false;$("useLocation").disabled=false;
    },()=>{$("addressStatus").textContent="No se ha podido obtener tu ubicación. Puedes escribir tu dirección.";$("useLocation").disabled=false;},{enableHighAccuracy:false,timeout:10000,maximumAge:0});
  });

  $("videoPhotoInput").addEventListener("change",async event=>{
    const file=event.currentTarget.files?.[0];
    event.currentTarget.value="";
    if(!file)return;
    if(!file.type.startsWith("image/")&&!/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)){
      $("videoPhotoStatus").textContent="Elige una fotografía válida.";
      return;
    }
    try{
      await window.VPPhotoStore.access("put",file);
      state.videoFile=file;
      if(state.videoPhotoUrl)URL.revokeObjectURL(state.videoPhotoUrl);
      state.videoPhotoUrl=URL.createObjectURL(file);
      $("videoPhotoPreview").src=state.videoPhotoUrl;
      $("videoPhotoPreview").hidden=false;
      $("videoPhotoStatus").textContent="Foto guardada en este dispositivo. Ya puedes abrir el editor.";
      toast("Fotografía preparada.");
    }catch(error){
      console.warn(error);
      $("videoPhotoStatus").textContent="No se ha podido guardar la foto. Puedes elegirla directamente en el editor.";
    }
  });

  $("openVideoEditor").addEventListener("click",async()=>{
    try{
      if(state.videoFile)await window.VPPhotoStore.access("put",state.videoFile);
      location.href="../vuelo-magico/?desde=padres";
    }catch(error){
      console.warn(error);
      toast("No se ha podido preparar la foto. Abre el editor y selecciónala allí.");
      setTimeout(()=>location.href="../vuelo-magico/?desde=padres",700);
    }
  });

  function openProofEditor(type) {
    state.proofType=type;
    state.proofImage=null;
    state.proofScale=type==="window"?.22:.35;
    state.proofRotation=0;
    masterImage.src=type==="window"?"../vuelo-magico/assets/perez-globo-iphone.webp":"../perez.png";
    state.overlayX=.78;
    state.overlayY=type==="window"?.34:.58;
    const config=proofConfig[type]||proofConfig.selfie;
    $("proofEditorEyebrow").textContent=config.eyebrow;
    $("proofEditorTitle").textContent=config.title;
    $("proofEditorDescription").textContent=config.description;
    $("proofPhotoInput").value="";
    $("proofCanvas").hidden=true;
    $("proofPlaceholder").hidden=false;
    $("proofScale").value=Math.round(state.proofScale*100);
    $("proofScaleValue").textContent=Math.round(state.proofScale*100)+"%";
    $("proofScale").disabled=true;
    ["proofMove","proofResize","proofRotate"].forEach(id=>$(id).disabled=true);
    $("saveProofButton").disabled=true;
    $("proofStatus").textContent="";
    showScreen("proof-editor");
  }
  document.querySelectorAll("[data-proof]").forEach(button=>{
    button.addEventListener("click",()=>openProofEditor(button.dataset.proof));
  });

  const proofCanvas=$("proofCanvas");
  const proofContext=proofCanvas.getContext("2d");
  const masterImage=new Image();
  masterImage.src="../perez.png";
  masterImage.onload=()=>{if(state.proofImage)drawProof();};

  function drawProof() {
    if(!state.proofImage||!proofContext)return;
    const width=proofCanvas.width,height=proofCanvas.height;
    proofContext.clearRect(0,0,width,height);
    proofContext.drawImage(state.proofImage,0,0,width,height);
    if(masterImage.complete&&masterImage.naturalWidth){
      const overlayWidth=width*state.proofScale;
      const overlayHeight=overlayWidth*(masterImage.naturalHeight/masterImage.naturalWidth);
      const x=state.overlayX*width-overlayWidth/2;
      const y=state.overlayY*height-overlayHeight/2;
      proofContext.save();
      proofContext.shadowColor="rgba(0,0,0,.38)";
      proofContext.shadowBlur=Math.max(5,width*.012);
      proofContext.translate(state.overlayX*width,state.overlayY*height);
      proofContext.rotate(state.proofRotation*Math.PI/180);
      proofContext.drawImage(masterImage,-overlayWidth/2,-overlayHeight/2,overlayWidth,overlayHeight);
      proofContext.restore();
    }
  }

  function loadProofPhoto(file) {
    if(!file)return;
    if(!file.type.startsWith("image/")&&!/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)){
      $("proofStatus").textContent="Elige una fotografía JPG, PNG o WebP.";
      return;
    }
    const url=URL.createObjectURL(file),image=new Image();
    $("proofStatus").textContent="Preparando tu fotografía…";
    image.onload=()=>{
      URL.revokeObjectURL(url);
      const ratio=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
      proofCanvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));
      proofCanvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
      state.proofImage=image;
      $("proofCanvas").hidden=false;
      $("proofPlaceholder").hidden=true;
      $("proofScale").disabled=false;
      ["proofMove","proofResize","proofRotate"].forEach(id=>$(id).disabled=false);
      $("saveProofButton").disabled=false;
      $("proofStatus").textContent="Arrastra el personaje para colocarlo. Puedes cambiar su tamaño y rotarlo.";
      drawProof();
    };
    image.onerror=()=>{
      URL.revokeObjectURL(url);
      $("proofStatus").textContent="No hemos podido abrir esta foto. Prueba con JPG o PNG.";
    };
    image.src=url;
  }

  $("proofPhotoInput").addEventListener("change",event=>{
    const file=event.currentTarget.files?.[0];
    event.currentTarget.value="";
    loadProofPhoto(file);
  });
  $("proofScale").addEventListener("input",event=>{
    state.proofScale=Number(event.target.value)/100;
    $("proofScaleValue").textContent=event.target.value+"%";
    drawProof();
  });

  $("proofMove").addEventListener("click",()=>toast("Arrastra el personaje sobre la fotografía."));
  $("proofResize").addEventListener("click",()=>$("proofScale").focus());
  $("proofRotate").addEventListener("click",()=>{state.proofRotation=(state.proofRotation+15)%360;drawProof();});

  function canvasPoint(event) {
    const rect=proofCanvas.getBoundingClientRect();
    return {
      x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),
      y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))
    };
  }
  proofCanvas.addEventListener("pointerdown",event=>{
    if(!state.proofImage)return;
    event.preventDefault();
    const point=canvasPoint(event);
    state.overlayX=point.x;
    state.overlayY=point.y;
    try{proofCanvas.setPointerCapture(event.pointerId);}catch(_){}
    drawProof();
  });
  proofCanvas.addEventListener("pointermove",event=>{
    if(!state.proofImage||!proofCanvas.hasPointerCapture?.(event.pointerId))return;
    event.preventDefault();
    const point=canvasPoint(event);
    state.overlayX=point.x;
    state.overlayY=point.y;
    drawProof();
  });

  $("saveProofButton").addEventListener("click",async()=>{
    if(!state.proofImage)return;
    if(!masterImage.complete||!masterImage.naturalWidth){
      toast("El personaje todavía se está cargando. Espera un momento.");
      return;
    }
    const button=$("saveProofButton");
    button.disabled=true;
    try{
      const blob=await new Promise((resolve,reject)=>proofCanvas.toBlob(value=>value?resolve(value):reject(new Error("No se pudo crear la imagen.")),"image/png"));
      const type=state.proofType==="selfie"?"perez-selfie":"window-balloon";
      const title=state.proofType==="selfie"?"Foto con Pérez":"Pérez en la ventana";
      await window.LNPMemoryStore.put({
        id:type+"-"+Date.now(),
        type,
        title,
        note:"Composición guardada en este dispositivo",
        status:"draft",
        blob,
        mimeType:"image/png",
        createdAt:Date.now()
      });
      showScreen("library");
      toast("Tu fotografía ya está en el Cofre.");
    }catch(error){
      console.warn(error);
      $("proofStatus").textContent="No se ha podido guardar. Comprueba el espacio disponible e inténtalo de nuevo.";
      button.disabled=false;
    }
  });

  function updateLetterPreview() {
    $("letterPreviewName").textContent=$("childName").value.trim()||"peque";
    const tooth=$("toothName").value.trim();
    let message=$("letterMessage").value.trim()||DEFAULT_MESSAGE;
    if(tooth)message=message.replace(/tu dientecito/gi,tooth);
    $("letterPreviewTooth").textContent=tooth?"He venido a recoger: "+tooth+".":"";
    $("letterPreviewTooth").hidden=!tooth;
    $("letterPreviewMessage").textContent=message;
  }
  ["childName","toothName","letterMessage"].forEach(id=>$(id).addEventListener("input",updateLetterPreview));
  $("letterForm").addEventListener("submit",event=>{event.preventDefault();updateLetterPreview();showScreen("letter-result");});
  $("saveLetterButton").addEventListener("click",async()=>{
    const name=$("childName").value.trim();
    if(!name){$("childName").focus();return;}
    const tooth=$("toothName").value.trim();
    let message=$("letterMessage").value.trim()||DEFAULT_MESSAGE;
    if(tooth)message=message.replace(/tu dientecito/gi,tooth);
    try{
      await window.LNPMemoryStore.put({
        id:"letter-"+Date.now(),
        type:"letter",
        title:"Carta de Pérez para "+name,
        note:tooth?"Diente: "+tooth:"Carta personalizada",
        childName:name,
        toothName:tooth,
        message,
        status:"draft",
        createdAt:Date.now()
      });
      showScreen("library");
      toast("La carta está guardada en el Cofre.");
    }catch(error){
      console.warn(error);
      toast("No se ha podido guardar la carta.");
    }
  });

  const memoryTypeLabel={
    "flight-video":"Vídeo del globo",
    "perez-selfie":"Foto con Pérez",
    "window-balloon":"Pérez en la ventana",
    "footprints":"Huellas de Pérez",
    "letter":"Carta de Pérez"
  };
  const memoryIcon={
    "flight-video":"▶",
    "perez-selfie":"▧",
    "window-balloon":"✧",
    "footprints":"✣",
    "letter":"✉"
  };

  async function renderLibrary() {
    const list=$("memoryList");
    state.memoryUrls.forEach(url=>URL.revokeObjectURL(url));
    state.memoryUrls=[];
    list.replaceChildren();
    let items=[];
    try{items=await window.LNPMemoryStore.list();}
    catch(error){
      console.warn(error);
      $("readyTitle").textContent="No se ha podido abrir el Cofre.";
      $("readyDescription").textContent="Comprueba que el navegador permite guardar datos en este dispositivo.";
      const empty=document.createElement("div");
      empty.className="empty-memory";
      empty.textContent="El almacenamiento local no está disponible.";
      list.append(empty);
      return;
    }
    $("readyTitle").textContent=items.length?"¡Tus recuerdos ya están en el Cofre!":"El cofre está esperando sus tesoros.";
    $("readyDescription").textContent=items.length?"Puedes revisar o eliminar cualquier recuerdo antes de activar la Cámara Mágica.":"Cada vídeo, foto, huella o carta que prepares aparecerá aquí.";
    if(!items.length){
      const empty=document.createElement("div");
      empty.className="empty-memory";
      const star=document.createElement("span");star.textContent="✧";
      const title=document.createElement("strong");title.textContent="El cofre está esperando sus tesoros";
      const note=document.createElement("small");note.textContent="Prepara tu primera sorpresa para verla aquí.";
      empty.append(star,title,note);
      list.append(empty);
      return;
    }
    items.forEach(item=>{
      const row=document.createElement("article");
      row.className="memory-item";row.dataset.type=item.type;
      const thumb=document.createElement("span");
      thumb.className="memory-thumb";thumb.tabIndex=0;thumb.setAttribute("role","button");thumb.setAttribute("aria-label","Ver "+(item.title||"recuerdo"));thumb.dataset.viewMemory=item.id;
      if(item.blob&&item.blob.type.startsWith("image/")){
        const url=URL.createObjectURL(item.blob);
        state.memoryUrls.push(url);
        const img=document.createElement("img");img.src=url;img.alt="";
        thumb.append(img);
      }else if(item.type==="flight-video"&&item.blob instanceof Blob){
        const url=URL.createObjectURL(item.blob);state.memoryUrls.push(url);const video=document.createElement("video");video.src=url;video.muted=true;video.playsInline=true;video.preload="metadata";thumb.append(video);const play=document.createElement("b");play.className="memory-play";play.textContent="▶";thumb.append(play);
      }else{
        const symbol=document.createElement("span");
        symbol.textContent=memoryIcon[item.type]||"✧";
        thumb.append(symbol);
      }
      const copy=document.createElement("span");
      copy.className="memory-copy";
      const title=document.createElement("strong");
      title.textContent=item.title||memoryTypeLabel[item.type]||"Recuerdo de Pérez";
      const note=document.createElement("small");
      note.textContent=item.note||new Date(item.createdAt||Date.now()).toLocaleString("es-ES",{dateStyle:"short",timeStyle:"short"});
      copy.append(title,note);
      const status=document.createElement("span");
      status.className="memory-status";
      status.textContent=item.status==="scheduled"?"PREPARADO":"BORRADOR";
      const remove=document.createElement("button");
      remove.type="button";remove.className="memory-delete";remove.dataset.deleteMemory=item.id;
      remove.setAttribute("aria-label","Eliminar "+(item.title||"recuerdo"));
      remove.textContent="×";
      row.append(thumb,copy,status,remove);
      list.append(row);
    });
  }

  async function viewMemory(id){ const item=await window.LNPMemoryStore.get(id);if(!item)return;const pane=$("memoryPreviewContent");pane.replaceChildren();$("memoryPreviewTitle").textContent=item.title||"Recuerdo de Pérez";if(item.blob instanceof Blob){const url=URL.createObjectURL(item.blob);state.memoryUrls.push(url);const node=document.createElement(item.blob.type.startsWith("video/")?"video":"img");node.src=url;if(node.tagName==="VIDEO"){node.controls=true;node.playsInline=true;}else node.alt=item.title||"Recuerdo";pane.append(node);}else{const p=document.createElement("p");p.textContent="Hola, "+(item.childName||"peque")+". "+(item.message||"");pane.append(p);} $("memoryPreviewDialog").showModal();}
  $("memoryList").addEventListener("keydown",event=>{if((event.key==="Enter"||event.key===" ")&&event.target.dataset.viewMemory){event.preventDefault();viewMemory(event.target.dataset.viewMemory);}});
  $("memoryList").addEventListener("click",async event=>{
    const view=event.target.closest("[data-view-memory]");if(view){await viewMemory(view.dataset.viewMemory);return;}
    const button=event.target.closest("[data-delete-memory]");
    if(!button)return;
    try{
      await window.LNPMemoryStore.remove(button.dataset.deleteMemory);
      renderLibrary();
      toast("Recuerdo eliminado del Cofre.");
    }catch(error){toast("No se ha podido eliminar el recuerdo.");}
  });

  renderLibrary();
  updateLetterPreview();

  const initialScreen=new URLSearchParams(location.search).get("screen");
  if(initialScreen==="cofre"||initialScreen==="library"){
    state.history=["home","library"];
    showScreen("library",false);
  }else if(initialScreen==="home"){state.history=["home"];showScreen("home",false);}
  else{showScreen("splash",false);}

  window.addEventListener("pagehide",()=>{
    if(state.videoPhotoUrl)URL.revokeObjectURL(state.videoPhotoUrl);
    state.memoryUrls.forEach(url=>URL.revokeObjectURL(url));
  });
})();