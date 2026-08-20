// Nodo de vista. El agente le deja la captura por cualquiera de tres vias:
// seleccionar archivo, arrastrar, o pegar con Ctrl+V. Si una falla en
// automatizacion, las otras siguen disponibles sin cambiar el flujo.

function viewPhotoNode(id, title, body, x, y, source) {
  return { id, title, body, x, y, kind: "view-photo", image: null, source };
}

function renderViewPhotoNode(element, taskNode, onChange, onImage) {
  element.classList.add("view-photo-node");
  element.innerHTML = `
    <span>${taskNode.title}</span>
    <label class="view-photo-drop${hasBinary(taskNode.image) ? " has-image" : ""}" data-photo-drop>
      <input type="file" accept="image/png,image/jpeg" data-photo-file />
      ${hasBinary(taskNode.image)
        ? `<img src="${taskNode.image}" alt="${taskNode.title}" data-photo-preview />`
        : `<span class="view-photo-hint">${taskNode.image === CLOUD_PLACEHOLDER ? "Captura en otro navegador" : "Captura de esta vista"}</span>`}
    </label>
    <p contenteditable="true" spellcheck="false">${taskNode.body}</p>
  `;

  const dropLabel = element.querySelector("[data-photo-drop]");
  const fileInput = element.querySelector("[data-photo-file]");

  function readImage(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      taskNode.image = reader.result;
      onImage();
      onChange();
    };
    reader.readAsDataURL(file);
  }

  dropLabel.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropLabel.classList.add("is-hovered");
  });

  dropLabel.addEventListener("dragleave", () => dropLabel.classList.remove("is-hovered"));

  dropLabel.addEventListener("drop", (event) => {
    event.preventDefault();
    dropLabel.classList.remove("is-hovered");
    readImage(event.dataTransfer.files?.[0]);
  });

  fileInput.addEventListener("change", () => readImage(fileInput.files?.[0]));

  element.addEventListener("paste", (event) => {
    const item = Array.from(event.clipboardData?.items || []).find((entry) =>
      entry.type.startsWith("image/")
    );
    if (item) readImage(item.getAsFile());
  });
}
