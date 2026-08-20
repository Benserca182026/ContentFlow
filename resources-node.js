// Nodo de recursos compartidos: la textura del fondo y el PDF de catálogo.
// Es el "ejemplar" del flujo — el material a cuya semejanza obran todos los
// agentes. Vive en un solo nodo para que no haya dos versiones circulando.
// El PDF no se vuelve a subir: se lee del nodo "Separar PDF" si ya está ahí.

function resourcesNode(id, x, y) {
  return {
    id,
    title: "Recursos compartidos",
    x,
    y,
    kind: "resources",
    textureData: null,
    textureName: null
  };
}

function findCatalogPdf() {
  const pdfNode = (activeTask?.nodes || []).find(
    (item) => item.kind === "pdf-split" && hasBinary(item.fileData)
  );
  return pdfNode ? { data: pdfNode.fileData, name: pdfNode.fileName || "catalogo.pdf" } : null;
}

function renderResourcesNode(element, taskNode, onChange) {
  const hasTexture = hasBinary(taskNode.textureData);
  const catalog = findCatalogPdf();

  element.classList.add("resources-node");
  element.innerHTML = `
    <span>${taskNode.title}</span>

    <label class="drop-zone node-drop${hasTexture ? " has-file" : ""}" data-texture-drop>
      <input type="file" accept="image/png,image/jpeg" data-texture-file />
      <strong data-texture-name>${hasTexture ? taskNode.textureName : "Arrastra la textura aquí"}</strong>
      <small>El fondo compartido para todas las vistas.</small>
    </label>

    <a class="download-button" data-download-texture ${hasTexture ? `href="${taskNode.textureData}" download="${taskNode.textureName}"` : "hidden"}>⬇ Descargar textura (${taskNode.textureName || ""})</a>

    <a class="download-button" data-download-catalog ${catalog ? `href="${catalog.data}" download="${catalog.name}"` : "hidden"}>⬇ Descargar catálogo (${catalog ? catalog.name : ""})</a>

    <output data-resources-log>${resourcesStatusText(hasTexture, catalog)}</output>
  `;

  const dropZone = element.querySelector("[data-texture-drop]");
  const fileInput = element.querySelector("[data-texture-file]");
  const textureName = element.querySelector("[data-texture-name]");
  const textureLink = element.querySelector("[data-download-texture]");
  const log = element.querySelector("[data-resources-log]");

  function readTexture(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      taskNode.textureData = reader.result;
      taskNode.textureName = file.name;
      textureName.textContent = file.name;
      dropZone.classList.add("has-file");
      textureLink.href = taskNode.textureData;
      textureLink.download = file.name;
      textureLink.textContent = `⬇ Descargar textura (${file.name})`;
      textureLink.hidden = false;
      log.textContent = resourcesStatusText(true, findCatalogPdf());
      onChange();
    };
    reader.readAsDataURL(file);
  }

  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("is-hovered");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("is-hovered"));
  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-hovered");
    readTexture(event.dataTransfer.files?.[0]);
  });
  fileInput.addEventListener("change", () => readTexture(fileInput.files?.[0]));
  element.addEventListener("paste", (event) => {
    const item = Array.from(event.clipboardData?.items || []).find((entry) =>
      entry.type.startsWith("image/")
    );
    if (item) readTexture(item.getAsFile());
  });
}

function resourcesStatusText(hasTexture, catalog) {
  if (hasTexture && catalog) return "Listo: textura y catálogo disponibles para los agentes.";
  if (hasTexture && !catalog) return "Textura lista. Falta el catálogo: carga el PDF en el nodo \"Separar PDF\".";
  if (!hasTexture && catalog) return "Catálogo detectado en \"Separar PDF\". Falta la textura.";
  return "Faltan ambos: sube la textura aquí y el PDF en el nodo \"Separar PDF\".";
}
