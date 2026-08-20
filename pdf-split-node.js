function pdfSplitOptionsMarkup(selected) {
  return Object.keys(MODEL_LABELS)
    .map((key) => `<option value="${key}" ${key === selected ? "selected" : ""}>${MODEL_LABELS[key]}</option>`)
    .join("");
}

function renderPdfSplitNode(element, taskNode, onChange) {
  const mode = taskNode.mode || "vistas";
  const model = taskNode.model || "haiku";
  const hasFile = Boolean(taskNode.fileName);

  element.classList.add("pdf-split-node");
  element.innerHTML = `
    <span>${taskNode.title}</span>
    <label class="drop-zone node-drop${hasFile ? " has-file" : ""}" data-drop>
      <input type="file" accept="application/pdf,image/png,image/jpeg" data-file />
      <strong data-drop-title>${hasFile ? taskNode.fileName : "Arrastra el PDF aquí"}</strong>
      <small data-drop-hint>${hasFile ? "Clic para cambiarlo." : "o haz clic para elegirlo. Acepta PNG/JPG."}</small>
    </label>
    <div class="segmented" data-modes role="group" aria-label="Tipo de separación">
      <button type="button" data-mode="vistas"${mode === "vistas" ? ' class="is-active"' : ""}>Vistas</button>
      <button type="button" data-mode="secciones"${mode === "secciones" ? ' class="is-active"' : ""}>Secciones</button>
    </div>
    <small class="mode-hint" data-mode-hint>${MODE_HINTS[mode]}</small>
    <span class="demo-badge" data-demo-model>DEMO · modelo y coste decorativos: no se contrata ni se cobra nada</span>
    <select data-model aria-label="Modelo de separación (decorativo, demo)">${pdfSplitOptionsMarkup(model)}</select>
    <small class="cost-hint" data-cost>${MODEL_COSTS[model]} (estimación de demo, no real)</small>
    <span class="demo-badge" data-demo-run>DEMO · simulación: no llama a ningún modelo. Usa el Disparador de separación para separar de verdad.</span>
    <button type="button" class="run-button" data-run${hasFile ? "" : " disabled"}>Separar (simulado)</button>
    <a class="download-button" data-download-pdf download hidden>Descargar PDF</a>
    <output data-log>${hasFile ? "Archivo cargado. Pulsa separar." : "Esperando archivo."}</output>
    <div class="node-pieces" data-pieces></div>
  `;

  const dropZone = element.querySelector("[data-drop]");
  const fileInput = element.querySelector("[data-file]");
  const dropTitle = element.querySelector("[data-drop-title]");
  const dropHint = element.querySelector("[data-drop-hint]");
  const modeHint = element.querySelector("[data-mode-hint]");
  const modelSelect = element.querySelector("[data-model]");
  const costHint = element.querySelector("[data-cost]");
  const runButton = element.querySelector("[data-run]");
  const log = element.querySelector("[data-log]");
  const piecesHost = element.querySelector("[data-pieces]");
  const downloadLink = element.querySelector("[data-download-pdf]");

  let running = false;

  // El PDF viaja como data URL dentro del nodo, no en el navegador local:
  // Playwright abre perfiles limpios, y asi el archivo esta ahi igualmente.
  function publishDownload() {
    if (!hasBinary(taskNode.fileData)) return;
    downloadLink.href = taskNode.fileData;
    downloadLink.download = taskNode.fileName;
    downloadLink.textContent = `⬇ Descargar PDF real (${taskNode.fileName})`;
    downloadLink.hidden = false;
  }

  publishDownload();

  function renderPieces() {
    piecesHost.innerHTML = "";
    const pieces = taskNode.pieces || [];

    pieces.forEach((piece) => {
      const row = document.createElement("div");
      row.className = piece.accepted ? "piece-row is-accepted" : "piece-row";

      const name = document.createElement("strong");
      name.contentEditable = "true";
      name.spellcheck = false;
      name.textContent = piece.label;
      name.addEventListener("input", () => {
        piece.label = name.textContent.trim();
        onChange();
      });

      const badge = document.createElement("span");
      badge.className = "piece-confidence";
      badge.textContent = `${Math.round(piece.confidence * 100)}%`;
      badge.title = "Confianza de demo: valor fijo de plantilla, no medido por ningún modelo.";

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "piece-toggle";
      toggle.textContent = piece.accepted ? "Aceptada" : "Aceptar";
      toggle.addEventListener("click", () => {
        piece.accepted = !piece.accepted;
        renderPieces();
        onChange();
        // Solo aquí se sincronizan las vistas: si esto colgara de onChange,
        // cada renombrado o cambio de modelo volveria a crearlas.
        if (typeof syncViewNodes === "function") syncViewNodes(taskNode);
      });

      row.append(name, badge, toggle);
      piecesHost.appendChild(row);
    });

    if (pieces.length > 0) {
      const accepted = pieces.filter((piece) => piece.accepted).length;
      const summary = document.createElement("small");
      summary.className = "pieces-summary";
      summary.textContent = `${accepted} de ${pieces.length} aceptadas. Cada aceptada tiene su nodo de vista en el canvas.`;
      piecesHost.appendChild(summary);
    }
  }

  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("is-hovered");
  });

  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("is-hovered"));

  function setFile(file) {
    if (!file) return;
    taskNode.fileName = file.name;
    taskNode.fileSize = Math.max(1, Math.round(file.size / 1024));
    dropTitle.textContent = file.name;
    dropHint.textContent = `${taskNode.fileSize} KB · clic para cambiarlo.`;
    dropZone.classList.add("has-file");
    runButton.disabled = false;
    log.textContent = "Archivo cargado. Pulsa separar.";

    const reader = new FileReader();
    reader.onload = () => {
      taskNode.fileData = reader.result;
      publishDownload();
      onChange();
    };
    reader.readAsDataURL(file);
  }

  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-hovered");
    setFile(event.dataTransfer.files?.[0]);
  });

  fileInput.addEventListener("change", () => setFile(fileInput.files?.[0]));

  element.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      taskNode.mode = button.dataset.mode;
      element.querySelectorAll("[data-mode]").forEach((other) => {
        other.classList.toggle("is-active", other === button);
      });
      modeHint.textContent = MODE_HINTS[taskNode.mode];
      onChange();
    });
  });

  modelSelect.addEventListener("change", () => {
    taskNode.model = modelSelect.value;
    costHint.textContent = `${MODEL_COSTS[taskNode.model]} (estimación de demo, no real)`;
    onChange();
  });

  runButton.addEventListener("click", async () => {
    if (running || !taskNode.fileName) return;
    running = true;
    runButton.disabled = true;
    taskNode.pieces = [];
    renderPieces();

    // OJO: esto es una maqueta. Las esperas son falsas (pdfSplitWait) y las
    // piezas salen de una plantilla fija con porcentajes inventados. Ningún
    // modelo se llama aquí. Se conserva como maqueta, pero no debe fingir.
    const steps = MODEL_STEPS[taskNode.model || "haiku"];
    for (let index = 0; index < steps.length; index += 1) {
      log.textContent = `DEMO ${index + 1}/${steps.length} · ${steps[index]}… (espera simulada)`;
      await pdfSplitWait(650);
    }

    taskNode.pieces = PIECES[taskNode.mode || "vistas"].map((piece) => ({ ...piece, accepted: false }));
    renderPieces();
    log.textContent = `DEMO · plantilla fija de ${taskNode.pieces.length} piezas con confianzas inventadas. No se llamó a ${MODEL_LABELS[taskNode.model || "haiku"]} ni a ningún modelo: nada salió de tu equipo. Usa el Disparador de separación para separar de verdad.`;

    running = false;
    runButton.disabled = false;
    onChange();
  });

  renderPieces();
}
