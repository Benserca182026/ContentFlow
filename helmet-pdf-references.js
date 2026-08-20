const pdfInput = document.querySelector('#pdf-input');
const textureInput = document.querySelector('#texture-input');
const pdfName = document.querySelector('#pdf-name');
const textureName = document.querySelector('#texture-name');
const pageNumber = document.querySelector('#page-number');
const captureStatus = document.querySelector('#capture-status');
const captureList = document.querySelector('#capture-list');
const annotationLayer = document.querySelector('#annotation-layer');
const preview = document.querySelector('#pdf-page-preview');
const activeView = document.querySelector('#active-view');
let pdfDoc = null;
let pdfFile = null;
let annotationIndex = 0;
const views = ['Lateral izquierda', 'Frontal', 'Lateral derecha', 'Trasera'];
const captures = Object.fromEntries(views.map(v => [v, []]));

function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
    s.type = 'module';
    s.onload = () => { window.pdfjsLib = window['pdfjs-dist/build/pdf']; resolve(); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

pdfInput.addEventListener('change', async () => {
  pdfFile = pdfInput.files[0]; if (!pdfFile) return;
  pdfName.textContent = `${pdfFile.name} · ${(pdfFile.size / 1024).toFixed(0)} KB · listo en sesión`;
  try {
    await loadPdfJs();
    pdfDoc = await window.pdfjsLib.getDocument({data: await pdfFile.arrayBuffer()}).promise;
    pageNumber.max = pdfDoc.numPages;
    captureStatus.textContent = `PDF cargado: ${pdfDoc.numPages} páginas disponibles.`;
    renderPage();
  } catch (e) { captureStatus.textContent = 'No se pudo cargar el lector PDF local; puedes registrar la referencia manualmente.'; }
});

textureInput.addEventListener('change', () => {
  const file = textureInput.files[0]; if (!file) return;
  textureName.textContent = `${file.name} · textura adjunta en sesión`;
  const url = URL.createObjectURL(file);
  document.querySelector('.helmet-shape').style.backgroundImage = `url(${url})`;
  document.querySelector('.helmet-shape').classList.add('textured');
});

document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-view]').forEach(item => item.classList.remove('active'));
  button.classList.add('active'); activeView.textContent = button.dataset.view;
  renderPage(); renderCaptures();
}));
pageNumber.addEventListener('change', renderPage);

async function renderPage() {
  if (!pdfDoc) return;
  const page = await pdfDoc.getPage(Math.max(1, Number(pageNumber.value) || 1));
  const viewport = page.getViewport({scale: 1.1});
  preview.width = viewport.width; preview.height = viewport.height;
  await page.render({canvasContext: preview.getContext('2d'), viewport}).promise;
}

document.querySelector('#capture-reference').addEventListener('click', async () => {
  const page = Math.max(1, Number(pageNumber.value) || 1);
  if (pdfDoc) await renderPage();
  const image = preview.width ? preview.toDataURL('image/png') : null;
  captures[activeView.textContent].push({page, image, time: new Date().toLocaleTimeString()});
  renderCaptures();
  captureStatus.textContent = `Captura real de página ${page} registrada para ${activeView.textContent}.`;
});

function renderCaptures() {
  const list = captureList; list.innerHTML = '';
  const items = captures[activeView.textContent];
  if (!items.length) { list.innerHTML = '<p class="small-note">No hay capturas para esta vista.</p>'; return; }
  items.forEach((item, i) => {
    const card = document.createElement('article'); card.className = 'capture-card';
    card.innerHTML = `<strong>Página ${item.page}</strong><span>${activeView.textContent} · ${item.time}</span>`;
    if (item.image) { const img = document.createElement('img'); img.src = item.image; img.alt = `Captura PDF página ${item.page}`; card.appendChild(img); const a = document.createElement('a'); a.href = item.image; a.download = `referencia-${activeView.textContent.replaceAll(' ','-')}-pagina-${item.page}.png`; a.textContent = 'Descargar screenshot'; a.className = 'download-link'; card.appendChild(a); }
    list.appendChild(card);
  });
}

function addAnnotation(kind) {
  const prefix = kind === 'directed' ? 'directed' : 'random';
  const label = document.querySelector(`#${prefix}-label`).value.trim() || 'Elemento sin nombre';
  const note = document.querySelector(`#${prefix}-note`).value.trim() || 'Sin instrucciones todavía.';
  const card = document.createElement('article'); card.className = `annotation ${kind}`;
  card.style.top = `${74 + (annotationIndex % 4) * 116}px`; card.style.left = annotationIndex % 2 === 0 ? '8%' : 'calc(92% - 205px)';
  card.innerHTML = `<strong>${kind === 'directed' ? 'Dirigido · ' : 'Aleatorio · '}${label}</strong><small>${note}</small><i class="annotation-arrow" aria-hidden="true"></i>`;
  annotationLayer.appendChild(card); annotationIndex += 1;
}
document.querySelector('#add-directed').addEventListener('click', () => addAnnotation('directed'));
document.querySelector('#add-random').addEventListener('click', () => addAnnotation('random'));
addAnnotation('directed'); addAnnotation('random'); renderCaptures();
