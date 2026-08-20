const dropZone = document.querySelector("#drop-zone");
const fileInput = document.querySelector("#file-input");
const dropTitle = document.querySelector("#drop-title");
const dropHint = document.querySelector("#drop-hint");
const modeButtons = document.querySelectorAll("[data-mode]");
const modeHint = document.querySelector("#mode-hint");
const modelSelect = document.querySelector("#model-select");
const costHint = document.querySelector("#cost-hint");
const runButton = document.querySelector("#run-button");
const runLog = document.querySelector("#run-log");
const resultTitle = document.querySelector("#result-title");
const resultDescription = document.querySelector("#result-description");
const resultGrid = document.querySelector("#result-grid");
const emptyState = document.querySelector("#empty-state");
const acceptedCount = document.querySelector("#accepted-count");
const approveButton = document.querySelector("#approve-button");

let currentFile = null;
let previewUrl = null;
let mode = "vistas";
let pieces = [];
let running = false;

function setFile(file) {
  if (!file) return;
  currentFile = file;

  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;

  const sizeKb = Math.max(1, Math.round(file.size / 1024));
  dropTitle.textContent = file.name;
  dropHint.textContent = `${sizeKb} KB · listo para separar. Clic para cambiarlo.`;
  dropZone.classList.add("has-file");
  runButton.disabled = false;
  runLog.textContent = "Archivo cargado. Elige modo y modelo, luego pulsa separar.";
}

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-hovered");
});

dropZone.addEventListener("dragleave", () => dropZone.classList.remove("is-hovered"));

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-hovered");
  setFile(event.dataTransfer.files?.[0]);
});

fileInput.addEventListener("change", () => setFile(fileInput.files?.[0]));

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    mode = button.dataset.mode;
    modeButtons.forEach((other) => other.classList.toggle("is-active", other === button));
    modeHint.textContent = MODE_HINTS[mode];
  });
});

modelSelect.addEventListener("change", () => {
  costHint.textContent = modelSelect.selectedOptions[0].dataset.cost;
});

function renderPieces() {
  resultGrid.innerHTML = "";
  emptyState.hidden = pieces.length > 0;

  pieces.forEach((piece, index) => {
    const card = document.createElement("article");
    card.className = piece.accepted ? "piece-card is-accepted" : "piece-card";

    const preview = document.createElement("div");
    preview.className = "piece-preview";
    if (previewUrl) {
      preview.style.backgroundImage = `url('${previewUrl}')`;
      preview.classList.add("has-image");
    } else {
      preview.textContent = `Pieza ${index + 1}`;
    }

    const badge = document.createElement("span");
    badge.className = "confidence-badge";
    badge.textContent = `${Math.round(piece.confidence * 100)}% confianza`;
    preview.appendChild(badge);

    const name = document.createElement("strong");
    name.contentEditable = "true";
    name.spellcheck = false;
    name.className = "piece-name";
    name.textContent = piece.label;
    name.addEventListener("input", () => {
      piece.label = name.textContent.trim();
    });

    const note = document.createElement("small");
    note.textContent = piece.note;

    const actions = document.createElement("div");
    actions.className = "piece-actions";

    const accept = document.createElement("button");
    accept.type = "button";
    accept.className = "accept-button";
    accept.textContent = piece.accepted ? "Aceptada" : "Aceptar";
    accept.addEventListener("click", () => {
      piece.accepted = !piece.accepted;
      renderPieces();
    });

    const discard = document.createElement("button");
    discard.type = "button";
    discard.className = "discard-button";
    discard.textContent = "Descartar";
    discard.addEventListener("click", () => {
      pieces = pieces.filter((item) => item !== piece);
      renderPieces();
    });

    actions.append(accept, discard);
    card.append(preview, name, note, actions);
    resultGrid.appendChild(card);
  });

  const accepted = pieces.filter((piece) => piece.accepted).length;
  acceptedCount.textContent = `${accepted} aceptadas`;
  approveButton.disabled = accepted === 0;
}

async function runSeparation() {
  if (running || !currentFile) return;
  running = true;
  runButton.disabled = true;
  pieces = [];
  renderPieces();

  const steps = MODEL_STEPS[modelSelect.value];
  resultTitle.textContent = "Procesando…";
  resultDescription.textContent = "Simulando el tiempo real que tardaría un modelo de bajo costo.";

  for (let index = 0; index < steps.length; index += 1) {
    runLog.textContent = `${index + 1}/${steps.length} · ${steps[index]}…`;
    await pdfSplitWait(700);
  }

  pieces = PIECES[mode].map((piece) => ({ ...piece, accepted: false }));
  renderPieces();

  const modelLabel = modelSelect.selectedOptions[0].textContent.split("—")[0].trim();
  resultTitle.textContent = `${pieces.length} piezas propuestas`;
  resultDescription.textContent = `${modelLabel} separó "${currentFile.name}" en ${mode}. Revisa, renombra y acepta las que sirvan.`;
  runLog.textContent = "Listo. Nada salió de tu equipo: esto es una maqueta.";

  running = false;
  runButton.disabled = false;
}

runButton.addEventListener("click", runSeparation);

approveButton.addEventListener("click", () => {
  const accepted = pieces.filter((piece) => piece.accepted).map((piece) => piece.label);
  runLog.textContent = `Aprobadas ${accepted.length}: ${accepted.join(", ")}. En el flujo real, estas piezas entrarían al canvas como nodos.`;
});

renderPieces();
