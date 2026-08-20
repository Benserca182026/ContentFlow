// Nodo de aplicación de diseño.
// Expone lo que un agente con Playwright necesita: dos descargas (la vista base
// y la referencia de diseño) y un campo con selector estable donde devolver la
// ilustración. La app no genera nada: solo entrega insumos y recibe resultado.

const DESIGN_VIEWS = {
  frontal: { label: "Frontal", asset: "assets/boston-frontal.png" },
  "lateral-izquierda": { label: "Lateral izquierda", asset: "assets/boston-izquierda.png" },
  "lateral-derecha": { label: "Lateral derecha", asset: "assets/boston-derecha.png" },
  trasera: { label: "Trasera", asset: "assets/boston-trasera.png" },
  superior: { label: "Superior", asset: "assets/boston-superior.png" }
};

const DESIGN_REFERENCE = "assets/halloween-design-page-1.png";

function designViewOptions(selected) {
  return Object.keys(DESIGN_VIEWS)
    .map((key) => `<option value="${key}" ${key === selected ? "selected" : ""}>${DESIGN_VIEWS[key].label}</option>`)
    .join("");
}

function renderDesignNode(element, taskNode, onChange) {
  const view = DESIGN_VIEWS[taskNode.view] ? taskNode.view : "lateral-izquierda";
  taskNode.view = view;

  element.classList.add("design-node");
  element.innerHTML = `
    <span>${taskNode.title}</span>

    <label class="field-label" for="view-${taskNode.id}">Vista base</label>
    <select id="view-${taskNode.id}" data-design-view>${designViewOptions(view)}</select>

    <div class="design-downloads">
      <a class="download-button" data-download-view download>Descargar vista base</a>
      <a class="download-button" data-download-reference href="${DESIGN_REFERENCE}" download>Descargar referencia</a>
    </div>

    <div class="compose-controls">
      <label class="field-label" for="scale-${taskNode.id}">Escala del patrón</label>
      <input id="scale-${taskNode.id}" type="range" min="15" max="90" step="5" value="${Math.round((taskNode.scale || 0.45) * 100)}" data-compose-scale />
      <label class="checkbox-row">
        <input type="checkbox" data-protect-dark ${taskNode.protectDark === false ? "" : "checked"} />
        Proteger visor y zonas oscuras
      </label>
    </div>
    <span class="demo-badge" data-demo-compose>DEMO · composición local, no llama a ningún modelo</span>
    <button type="button" class="run-button" data-compose>Componer textura</button>

    <label class="drop-zone node-drop" data-result-drop>
      <input type="file" accept="image/png,image/jpeg" data-design-result />
      <strong>Colocar ilustración</strong>
      <small>El agente deja aquí el resultado procesado.</small>
    </label>

    <figure class="design-result" data-result hidden>
      <img alt="Ilustración aplicada" data-result-image />
    </figure>

    <small class="design-rules">
      Solo pueden variar color, patrón y textura. Silueta, proporción, visor,
      spoiler y uniones no se tocan.
    </small>
    <output data-design-log>Sin ilustración todavía.</output>
  `;

  const viewSelect = element.querySelector("[data-design-view]");
  const viewLink = element.querySelector("[data-download-view]");
  const resultInput = element.querySelector("[data-design-result]");
  const resultFigure = element.querySelector("[data-result]");
  const resultImage = element.querySelector("[data-result-image]");
  const log = element.querySelector("[data-design-log]");

  function syncViewLink() {
    const current = DESIGN_VIEWS[taskNode.view];
    viewLink.href = current.asset;
    viewLink.download = `boston-${taskNode.view}.png`;
  }

  function showResult(name) {
    if (!hasBinary(taskNode.resultData)) return;
    resultImage.src = taskNode.resultData;
    resultFigure.hidden = false;
    log.textContent = `Ilustración colocada${name ? `: ${name}` : ""}. Revisa contra la referencia antes de aprobar.`;
  }

  syncViewLink();
  showResult(taskNode.resultName);

  const composeButton = element.querySelector("[data-compose]");
  const scaleInput = element.querySelector("[data-compose-scale]");
  const protectInput = element.querySelector("[data-protect-dark]");

  composeButton.addEventListener("click", async () => {
    composeButton.disabled = true;
    log.textContent = "Componiendo textura sobre la carcasa…";

    taskNode.scale = Number(scaleInput.value) / 100;
    taskNode.protectDark = protectInput.checked;

    try {
      const result = await composeTexture(DESIGN_VIEWS[taskNode.view].asset, DESIGN_REFERENCE, {
        scale: taskNode.scale,
        protectDark: taskNode.protectDark
      });
      taskNode.resultData = result.dataUrl;
      taskNode.resultName = `${taskNode.view}-textura.png`;
      showResult(taskNode.resultName);
      log.textContent = `DEMO (composición local en canvas, sin modelo) · textura aplicada sobre ${result.coverage}% del encuadre. Estructura intacta: solo cambió el color.`;
      onChange();
    } catch (error) {
      log.textContent = `No se pudo componer: ${error.message}`;
    }

    composeButton.disabled = false;
  });

  viewSelect.addEventListener("change", () => {
    taskNode.view = viewSelect.value;
    syncViewLink();
    log.textContent = `Vista base: ${DESIGN_VIEWS[taskNode.view].label}.`;
    onChange();
  });

  function readResult(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      taskNode.resultData = reader.result;
      taskNode.resultName = file.name;
      showResult(file.name);
      onChange();
    };
    reader.readAsDataURL(file);
  }

  resultInput.addEventListener("change", () => readResult(resultInput.files?.[0]));

  element.addEventListener("paste", (event) => {
    const item = Array.from(event.clipboardData?.items || []).find((entry) =>
      entry.type.startsWith("image/")
    );
    if (item) readResult(item.getAsFile());
  });
}
