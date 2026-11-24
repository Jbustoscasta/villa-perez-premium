(() => {
  const $ = id => document.getElementById(id);
  const state = { history:["home"], proof:"selfie", proofUrl:null, proofItems:[], letter:null, address:"" };
  const screens = [...document.querySelectorAll(".screen")];

  function show(name, push=true) {
    const target = $("screen-"+name);
    if (!target) return;
    if (push && state.history[state.history.length-1] !== name) state.history.push(name);
    screens.forEach(screen => screen.classList.toggle("active", screen === target));
    $("backButton").hidden = name === "home";
    if (name === "library") renderLibrary();
    if (name === "letter") renderLetter();
  }
  function back() {
    if (state.history.length > 1) state.history.pop();
    show(state.history[state.history.length-1] || "home", false);
  }
  document.querySelectorAll("[data-screen]").forEach(button => {
    button.addEventListener("click", () => show(button.dataset.screen));
  });
  $("backButton").addEventListener("click", back);

  const proofConfig = {
    selfie: {title:"Una foto con Pérez.",kicker:"EL RATÓN HA VENIDO A VERLE",description:"Elige una foto real del peque dormido. Después colocaremos a Pérez en la escena."},
    window: {title:"Pérez en la ventana.",kicker:"EL GLOBO ESTÁ MUY CERCA",description:"Haz una foto desde la habitación hacia el exterior. Dejaremos el espacio adecuado para superponer el globo."}
  };
  document.querySelectorAll("[data-proof]").forEach(button => {
    button.addEventListener("click", () => {
      state.proof = button.dataset.proof;
      const config = proofConfig[state.proof];
      $("proofDetailTitle").textContent = config.title;
      $("proofKicker").textContent = config.kicker;
      $("proofDescription").textContent = config.description;
      $("proofPhoto").value = "";
      $("proofImage").hidden = true;
      $("proofImage").removeAttribute("src");
      $("proofPlaceholder").hidden = false;
      $("saveProofButton").disabled = true;
      if (state.proofUrl) URL.revokeObjectURL(state.proofUrl);
      state.proofUrl = null;
      show("proof-detail");
    });
  });

  $("proofPhoto").addEventListener("change", event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (state.proofUrl) URL.revokeObjectURL(state.proofUrl);
    state.proofUrl = URL.createObjectURL(file);
    $("proofImage").src = state.proofUrl;
    $("proofImage").hidden = false;
    $("proofPlaceholder").hidden = true;
    $("saveProofButton").disabled = false;
  });
  $("saveProofButton").addEventListener("click", () => {
    if (!state.proofUrl) return;
    state.proofItems.push({
      title: state.proof === "selfie" ? "Foto de referencia · Pérez con el peque" : "Foto de referencia · Pérez en la ventana",
      icon: state.proof === "selfie" ? "✦" : "☾",
      note: "Imagen seleccionada en esta maqueta; montaje final pendiente."
    });
    state.proofUrl = null;
    show("library");
  });

  $("addressForm").addEventListener("submit", event => {
    event.preventDefault();
    const value = $("addressInput").value.trim();
    if (value.length < 6) {
      $("addressStatus").textContent = "Escribe una dirección un poco más completa.";
      $("addressInput").focus();
      return;
    }
    state.address = value; // memoria temporal únicamente; no se guarda en localStorage ni en el Cofre
    $("addressStatus").textContent = "Destino introducido en esta maqueta. La dirección no se añadirá a los recuerdos.";
    $("mapNote").textContent = "Destino introducido. La ruta real se conectará al definir el origen definitivo de Villa Pérez.";
    $("mapPreview").classList.add("has-destination");
    window.setTimeout(() => show("video"), 550);
  });

  const defaultMessage = "¡Hola! Gracias por cuidar tan bien de tu sonrisa. He venido volando desde muy lejos para recoger tu dientecito. ¡Sigue soñando y sonriendo!";
  function renderLetter() {
    const name = $("childName").value.trim() || "peque";
    const message = $("letterMessage").value.trim() || defaultMessage;
    $("letterPreviewName").textContent = name;
    $("letterPreviewMessage").textContent = message;
  }
  $("childName").addEventListener("input", renderLetter);
  $("letterMessage").addEventListener("input", renderLetter);
  $("letterForm").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("childName").value.trim();
    if (!name) { $("childName").focus(); return; }
    state.letter = {name, message:$("letterMessage").value.trim() || defaultMessage, createdAt:Date.now()};
    try { localStorage.setItem("lnp-prototype-letter", JSON.stringify(state.letter)); } catch (_) {}
    show("library");
  });

  function renderLibrary() {
    const list = $("memoryList");
    list.replaceChildren();
    const items = state.proofItems.slice();
    let savedLetter = state.letter;
    if (!savedLetter) {
      try { savedLetter = JSON.parse(localStorage.getItem("lnp-prototype-letter") || "null"); } catch (_) {}
    }
    if (savedLetter) items.push({title:"Carta de Pérez para "+savedLetter.name, icon:"✉", note:"Carta de prueba guardada en este navegador."});
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "empty-library";
      const symbol = document.createElement("span"); symbol.textContent = "✧";
      const title = document.createElement("strong"); title.textContent = "Aún no hay recuerdos guardados";
      const note = document.createElement("small"); note.textContent = "Cuando prepares una sorpresa, aparecerá aquí.";
      empty.append(symbol,title,note); list.append(empty); return;
    }
    items.forEach(item => {
      const row = document.createElement("div"); row.className = "memory-item";
      const icon = document.createElement("span"); icon.className = "memory-icon"; icon.textContent = item.icon;
      const copy = document.createElement("span"); copy.className = "memory-copy";
      const title = document.createElement("b"); title.textContent = item.title;
      const note = document.createElement("small"); note.textContent = item.note;
      copy.append(title,note); row.append(icon,copy); list.append(row);
    });
  }

  $("helpButton").addEventListener("click", () => $("helpDialog").showModal());
  $("closeHelp").addEventListener("click", () => $("helpDialog").close());
  $("helpDone").addEventListener("click", () => $("helpDialog").close());
  $("helpDialog").addEventListener("click", event => {
    if (event.target === $("helpDialog")) $("helpDialog").close();
  });
  renderLibrary();
})();