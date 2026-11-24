(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const screens = Array.from(document.querySelectorAll(".screen"));
  const state = {current:"home",history:["home"],proofType:"selfie",proofUrl:null,address:""};
  const STORAGE_KEY = "lnp-memories-v2";
  const DEFAULT_MESSAGE = "¡Gracias por cuidar tan bien tus dientes! Sigue así, estás haciendo un gran trabajo. He venido volando desde Villa Pérez para recoger tu dientecito. ¡Sigue soñando y sonriendo!";

  function memories() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  }
  function saveMemories(items) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); return true; }
    catch (_) { toast("No se ha podido guardar. Prueba con una foto más pequeña."); return false; }
  }
  function toast(message) {
    const node = $("toast");
    node.textContent = message;
    node.classList.add("visible");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => node.classList.remove("visible"), 2600);
  }
  function showScreen(name, push) {
    const target = $("screen-" + name);
    if (!target) return;
    if (push !== false && state.current !== name) state.history.push(name);
    state.current = name;
    screens.forEach(screen => screen.classList.toggle("active", screen === target));
    if (name === "library") renderLibrary();
    if (name === "letter") updateLetterPreview();
    document.querySelectorAll(".menu-list [data-screen]").forEach(button => {
      button.setAttribute("aria-current", button.dataset.screen === name ? "page" : "false");
    });
  }
  function goBack() {
    if (state.history.length > 1) state.history.pop();
    showScreen(state.history[state.history.length - 1] || "home", false);
  }

  document.querySelectorAll("[data-screen]").forEach(button => {
    button.addEventListener("click", () => {
      const dialog = button.closest("dialog");
      if (dialog) dialog.close();
      showScreen(button.dataset.screen);
    });
  });
  $("menuButton").addEventListener("click", () => $("menuDialog").showModal());
  $("helpButton").addEventListener("click", () => $("helpDialog").showModal());
  document.querySelectorAll("[data-close-dialog]").forEach(button => {
    button.addEventListener("click", () => $(button.dataset.closeDialog).close());
  });
  document.querySelectorAll("dialog").forEach(dialog => {
    dialog.addEventListener("click", event => {
      if (event.target === dialog) dialog.close();
    });
  });

  const proofConfig = {
    selfie: {
      eyebrow:"EL RATÓN HA VENIDO A VERLE",
      title:"Una foto con Pérez.",
      description:"Elige una foto real de tu peque dormido. Después prepararemos el recuerdo con Pérez."
    },
    window: {
      eyebrow:"EL GLOBO ESTÁ MUY CERCA",
      title:"Pérez en la ventana.",
      description:"Haz una foto desde la habitación hacia el exterior. Dejaremos el espacio para el globo."
    }
  };
  function openProofEditor(type) {
    state.proofType = type;
    if (state.proofUrl) URL.revokeObjectURL(state.proofUrl);
    state.proofUrl = null;
    const config = proofConfig[type] || proofConfig.selfie;
    $("proofEditorEyebrow").textContent = config.eyebrow;
    $("proofEditorTitle").textContent = config.title;
    $("proofEditorDescription").textContent = config.description;
    $("proofPhoto").value = "";
    $("photoUser").hidden = true;
    $("photoUser").removeAttribute("src");
    $("photoPlaceholder").hidden = false;
    $("photoHint").hidden = false;
    $("saveProofButton").disabled = true;
    showScreen("proof-editor");
  }
  document.querySelectorAll("[data-proof]").forEach(button => {
    button.addEventListener("click", () => openProofEditor(button.dataset.proof));
  });

  $("proofPhoto").addEventListener("change", event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type || file.type.indexOf("image/") !== 0) {
      toast("Elige una imagen para continuar.");
      return;
    }
    if (state.proofUrl) URL.revokeObjectURL(state.proofUrl);
    state.proofUrl = URL.createObjectURL(file);
    $("photoUser").src = state.proofUrl;
    $("photoUser").hidden = false;
    $("photoPlaceholder").hidden = true;
    $("photoHint").hidden = true;
    $("saveProofButton").disabled = false;
  });

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        const maxSide = 1150;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.76));
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("No se pudo leer la foto"));
      };
      image.src = url;
    });
  }
  $("saveProofButton").addEventListener("click", async () => {
    const file = $("proofPhoto").files && $("proofPhoto").files[0];
    if (!file) return;
    const button = $("saveProofButton");
    button.disabled = true;
    const label = button.querySelector("span:nth-child(2)");
    label.textContent = "Guardando…";
    try {
      const data = await compressImage(file);
      const item = {
        id:"memory-" + Date.now(),
        type:"photo-draft",
        title:state.proofType === "selfie" ? "Foto con Pérez · borrador" : "Pérez en la ventana · borrador",
        note:"Foto de referencia guardada en este dispositivo",
        icon:"photo",
        image:data,
        createdAt:Date.now()
      };
      const items = memories();
      items.unshift(item);
      if (saveMemories(items)) {
        if (state.proofUrl) URL.revokeObjectURL(state.proofUrl);
        state.proofUrl = null;
        showScreen("library");
        toast("Tu foto ya está en el cofre.");
      }
    } catch (_) {
      toast("No hemos podido preparar esa foto. Prueba con otra.");
    } finally {
      button.disabled = false;
      label.textContent = "Guardar borrador en el cofre";
    }
  });

  $("addressForm").addEventListener("submit", event => {
    event.preventDefault();
    const value = $("addressInput").value.trim();
    if (value.length < 6) {
      $("addressStatus").textContent = "Escribe una dirección un poco más completa.";
      $("addressInput").focus();
      return;
    }
    state.address = value;
    $("addressStatus").textContent = "Destino anotado para esta visita. La dirección no se guarda en el cofre.";
    toast("¡Pérez ya sabe dónde tiene que ir!");
  });

  function updateLetterPreview() {
    const name = $("childName").value.trim() || "peque";
    const message = $("letterMessage").value.trim() || DEFAULT_MESSAGE;
    $("letterPreviewName").textContent = name;
    $("letterPreviewMessage").textContent = message;
  }
  $("childName").addEventListener("input", updateLetterPreview);
  $("letterMessage").addEventListener("input", updateLetterPreview);
  $("letterForm").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("childName").value.trim();
    if (!name) { $("childName").focus(); return; }
    const item = {
      id:"letter-" + Date.now(),
      type:"letter",
      title:"Carta de Pérez para " + name,
      note:"Carta personalizada guardada en el cofre",
      icon:"letter",
      childName:name,
      message:$("letterMessage").value.trim() || DEFAULT_MESSAGE,
      createdAt:Date.now()
    };
    const items = memories().filter(memory => memory.type !== "letter");
    items.unshift(item);
    if (saveMemories(items)) {
      showScreen("library");
      toast("La carta de Pérez está guardada.");
    }
  });

  function iconFor(type) {
    const symbols = {letter:"✉",photo:"▧",video:"◉",footprints:"✣",route:"⌖"};
    return symbols[type] || "✧";
  }
  function renderLibrary() {
    const list = $("memoryList");
    list.replaceChildren();
    const items = memories();
    const ready = items.length > 0;
    $("readyTitle").textContent = ready ? "¡Tus recuerdos ya están en el cofre!" : "¡Tu magia está tomando forma!";
    $("readyDescription").textContent = ready ? "Todo lo que has preparado esta noche está reunido aquí." : "Cada vídeo, foto, huella o carta que prepares aparecerá aquí.";
    if (!ready) {
      const empty = document.createElement("div");
      empty.className = "empty-memory";
      const star = document.createElement("span");
      star.textContent = "✧";
      const title = document.createElement("strong");
      title.textContent = "El cofre está esperando sus tesoros";
      const note = document.createElement("small");
      note.textContent = "Prepara tu primera sorpresa para verla aquí.";
      empty.append(star,title,note);
      list.append(empty);
      return;
    }
    items.forEach(item => {
      const row = document.createElement("article");
      row.className = "memory-item";
      const thumb = document.createElement("span");
      thumb.className = "memory-thumb";
      if (item.image) {
        const image = document.createElement("img");
        image.src = item.image;
        image.alt = "";
        thumb.append(image);
      } else {
        const icon = document.createElement("span");
        icon.textContent = iconFor(item.icon || item.type);
        thumb.append(icon);
      }
      const copy = document.createElement("span");
      copy.className = "memory-copy";
      const title = document.createElement("strong");
      title.textContent = item.title || "Recuerdo de Pérez";
      const note = document.createElement("small");
      note.textContent = item.note || "Guardado en este dispositivo";
      copy.append(title,note);
      const status = document.createElement("span");
      status.className = "memory-status";
      status.textContent = "BORRADOR";
      row.append(thumb,copy,status);
      list.append(row);
    });
  }

  renderLibrary();
  updateLetterPreview();
  window.addEventListener("pagehide", () => {
    if (state.proofUrl) URL.revokeObjectURL(state.proofUrl);
  });
})();