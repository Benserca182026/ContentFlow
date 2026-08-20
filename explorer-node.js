// Nodo Explorador de PDF: la lupa. Es el órgano de la aprehensión del
// sistema — inventaría los elementos del catálogo y los deja disponibles.
// No genera, no integra, no aprueba: mira, recorta y propone.
//
// Regla que gobierna la extracción: Qwen pone los ojos (devuelve el contorno)
// y el navegador pone las tijeras (recorta los píxeles reales). El elemento
// que llega al canvas ES el del catálogo, no un parecido regenerado — con
// material licenciado esa diferencia lo es todo.

const EXPLORER_MODELO = "qwen/qwen3.7-flash";

// Las páginas de un catálogo son independientes entre sí: ninguna necesita el
// resultado de otra para ser inventariada. Esperarlas en fila era una demora
// sin razón en la cosa misma. El tope existe porque la API sí tiene límite.
//
// El número es 4 por medida, no por corazonada. Mismo catálogo de 14 páginas,
// de punta a punta, con el pico de peticiones simultáneas contado en el fetch:
//
//   tope 4 → pico 4 · 129 s de reloj · 416 s sumando las llamadas sueltas
//   tope 6 → pico 6 · 187 s de reloj · 944 s sumando las llamadas sueltas
//
// Subirlo hasta el semáforo global de models.js (6) empeoró el reloj en 57 s.
// La razón está en la tercera columna: con 6 en vuelo el proveedor tarda el
// doble por página (67 s de media contra 30 s). El trabajo no se reparte, se
// encola río arriba, y pedir más plazas solo alarga cada una. Cuatro es donde
// la espera de red se aprovecha sin que el proveedor empiece a frenar.
const EXPLORER_CONCURRENCIA = 4;

// Un nodo "está corriendo" AHORA: es un hecho del momento, no una propiedad
// del nodo. Guardarlo en taskNode.corriendo lo mandaba a Supabase, y una
// corrida interrumpida (pestaña cerrada a mitad) dejaba el nodo congelado para
// siempre: al recargar volvía con corriendo=true, el botón salía deshabilitado
// y el manejador se iba en la primera línea. Ocurrió de verdad: el explorador
// de qwen-codex quedó bloqueado con el log "Inventariando pág 8/14…".
// Vive en memoria, indexado por id, como ya hace texture-batch-node.js.
const EXPLORER_EN_CURSO = new Set();

// Cola con tope: N obreros toman el siguiente índice libre hasta agotar la
// lista. El resultado se deposita en su posición original, así el orden de
// salida es el de entrada aunque las respuestas lleguen desordenadas.
async function enParalelo(items, tope, tarea) {
  const salida = new Array(items.length);
  let siguiente = 0;
  const obreros = [];
  for (let k = 0; k < Math.min(tope, items.length); k += 1) {
    obreros.push((async () => {
      for (;;) {
        const i = siguiente;
        siguiente += 1;
        if (i >= items.length) return;
        salida[i] = await tarea(items[i], i);
      }
    })());
  }
  await Promise.all(obreros);
  return salida;
}

// Mismo formato que el disparador. Se usa el suyo si está cargado —es la misma
// función y no vale duplicar el criterio— y solo si no lo está se cae aquí.
function explorerDuracionLegible(ms) {
  if (typeof duracionLegible === "function") return duracionLegible(ms);
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} m ${s % 60} s`;
}

// Devolver el hilo al navegador. componerVariante dibuja y llama a toDataURL,
// que es síncrono y caro: veinte seguidas congelan la pestaña y el progreso
// que anotamos no se llega a pintar nunca. Ceder entre variantes no acelera el
// cómputo, hace que se vea ocurrir — y que el usuario pueda seguir usando la
// interfaz mientras ocurre.
function cederHilo() {
  return new Promise((r) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => r());
    else setTimeout(r, 0);
  });
}

// Copia liviana de la página SOLO para preguntarle a Qwen dónde están los
// elementos. Detectar cajas normalizadas (0-1000) no necesita resolución
// completa ni PNG sin pérdida — eso encarece la subida y alarga la respuesta
// del modelo sin mejorar la detección. El recorte real nunca usa esta copia:
// sigue saliendo de `pagina`, el canvas rasterizado a resolución completa, así
// que la calidad del elemento final no se toca. Medir esto es el próximo
// paso: comparar duracionMs de antes y después con el mismo catálogo.
function copiaParaDeteccion(canvas, anchoMax = 1400) {
  if (canvas.width <= anchoMax) return canvas.toDataURL("image/jpeg", 0.85);
  const escala = anchoMax / canvas.width;
  const c = document.createElement("canvas");
  c.width = anchoMax;
  c.height = Math.max(1, Math.round(canvas.height * escala));
  c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

// Identidad estable de un elemento del catálogo. Los extractos no llevan id
// propio, así que la identidad se compone de lo que no cambia sin que cambie
// el elemento: nombre, tipo y el porcentaje de identidad verificada.
function idDeElemento(e) {
  if (e && e.id) return String(e.id);
  const ident = Number.isFinite(e?.identidad) ? e.identidad.toFixed(1) : "?";
  return `${e?.nombre || "?"}|${e?.tipo || "otro"}|${ident}`;
}

// Huella de una propuesta: qué elementos, sobre qué vistas, cuántas variantes.
// Si los tres coinciden con la propuesta anterior, la pregunta a Qwen por las
// zonas ya está contestada y repetirla es gasto sin conocimiento nuevo. Las
// vistas van con su id Y su imagen: cambiar el fondo de una vista cambia dónde
// se puede pintar, aunque el id sea el mismo.
function huellaDePropuesta(usables, vistas, n) {
  const els = usables.map(idDeElemento).sort().join(",");
  const vs = vistas.map((v) => `${v.id}:${(v.image || "").length}`).sort().join(",");
  return `${n}||${els}||${vs}`;
}

const EXPLORER_PROMPT = `Esta es una página de un catálogo de elementos de diseño. Devuelve UNA caja por cada elemento GRÁFICO independiente que veas (personajes, figuras, ilustraciones), ni una más.

NO incluyas nada que sea principalmente texto: títulos, letterings, palabras sueltas, letras, códigos de referencia. Tampoco números de página, cotas, tablas ni la rejilla de fondo. Si un elemento es un personaje que lleva algo de texto dentro, sí cuenta; si es solo texto, no.

Responde SOLO con JSON, sin texto alrededor:
{"vistas":[{"nombre":"nombre corto del elemento","tipo":"personaje|logotipo|texto|trama|otro","box":[x1,y1,x2,y2],"confianza":0.0}]}

Las coordenadas van NORMALIZADAS de 0 a 1000 sobre el ancho y el alto de la imagen. Deja un pequeño margen alrededor de cada elemento para no cortarlo.`;

function explorerNode(id, x, y) {
  return {
    id,
    title: "Explorador de PDF",
    x,
    y,
    kind: "pdf-explorer",
    fileName: null,
    fileData: null,
    elementos: [],
    targets: [],
    variantes: 3,
    // Zonas de carcasa ya resueltas, por id de vista, y la huella de la
    // propuesta que las produjo. Guardadas en el nodo para que volver a pulsar
    // "Proponer variantes" sin cambiar nada no vuelva a preguntarle a Qwen.
    zonasPorVista: {},
    huellaPropuesta: null,
    log: ""
  };
}

// Quita el fondo conectado al borde exterior, y SOLO ese. Las zonas del mismo
// color encerradas dentro del contorno se conservan: borrar por color en toda
// la imagen abre agujeros en el dibujo. El fondo plano es el papel donde el
// elemento está impreso, no parte del elemento.
function quitarFondoBorde(canvas, tolerancia = 30) {
  const ctx = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  const datos = ctx.getImageData(0, 0, w, h);
  const px = datos.data;

  // El color del papel se estima por las esquinas, no se supone blanco.
  const esquinas = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4];
  const fondo = [0, 1, 2].map((c) => esquinas.reduce((s, i) => s + px[i + c], 0) / 4);

  const esFondo = (i) =>
    Math.abs(px[i] - fondo[0]) + Math.abs(px[i + 1] - fondo[1]) + Math.abs(px[i + 2] - fondo[2]) <= tolerancia * 3;

  const visitado = new Uint8Array(w * h);
  const cola = [];
  for (let x = 0; x < w; x += 1) { cola.push(x, x + (h - 1) * w); }
  for (let y = 0; y < h; y += 1) { cola.push(y * w, y * w + w - 1); }

  while (cola.length) {
    const p = cola.pop();
    if (visitado[p]) continue;
    visitado[p] = 1;
    if (!esFondo(p * 4)) continue;
    px[p * 4 + 3] = 0;
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0) cola.push(p - 1);
    if (x < w - 1) cola.push(p + 1);
    if (y > 0) cola.push(p - w);
    if (y < h - 1) cola.push(p + w);
  }

  ctx.putImageData(datos, 0, 0);
  return canvas;
}

// El extracto ES el del catálogo, no un parecido: eso hay que comprobarlo, no
// suponerlo. Se compara el recorte contra la MISMA región de la página, y solo
// donde el extracto quedó opaco — los píxeles que el flood-fill volvió
// transparentes son papel, no elemento, y compararlos mediría el fondo.
// Si algo transformó los píxeles en el camino (reescalado, recompresión, una
// caja corrida), la coincidencia cae y el elemento no se declara idéntico.
function identidadDelExtracto(tile, pagina, sx, sy, tolerancia = 12) {
  const w = tile.width;
  const h = tile.height;
  if (!w || !h) return 0;

  const ref = document.createElement("canvas");
  ref.width = w;
  ref.height = h;
  ref.getContext("2d").drawImage(pagina, sx, sy, w, h, 0, 0, w, h);

  const a = tile.getContext("2d").getImageData(0, 0, w, h).data;
  const b = ref.getContext("2d").getImageData(0, 0, w, h).data;

  let opacos = 0;
  let iguales = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] === 0) continue;
    opacos += 1;
    const dif = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    if (dif <= tolerancia) iguales += 1;
  }
  if (!opacos) return 0;
  return (iguales / opacos) * 100;
}

// Máscara de la vista: el casco es lo que NO es fondo. El color del fondo se
// estima por las esquinas, igual que en quitarFondoBorde — suponerlo blanco
// falla en cuanto la vista trae fondo puesto.
function mascaraDeVista(canvas, tolerancia = 30) {
  const { width: w, height: h } = canvas;
  const px = canvas.getContext("2d").getImageData(0, 0, w, h).data;
  const esquinas = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4];
  const fondo = [0, 1, 2].map((c) => esquinas.reduce((s, i) => s + px[i + c], 0) / 4);

  const mascara = new Uint8Array(w * h);
  const brillo = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p += 1) {
    const i = p * 4;
    const dist =
      Math.abs(px[i] - fondo[0]) + Math.abs(px[i + 1] - fondo[1]) + Math.abs(px[i + 2] - fondo[2]);
    mascara[p] = dist > tolerancia * 3 ? 1 : 0;
    brillo[p] = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
  }
  return { mascara, brillo, w, h };
}

// Qwen propone las zonas; aquí se comprueban contra el casco real. Dos
// rechazos: la zona que se sale de la carcasa (más del 10% de su área fuera de
// la máscara) y la zona predominantemente oscura, que en un casco casi siempre
// es visor o hueco de ventilación, no superficie pintable.
function validarZonas(vistaCanvas, zonas, fueraMax = 0.1, brilloMin = 55) {
  const { mascara, brillo, w, h } = mascaraDeVista(vistaCanvas);
  const validas = [];
  const motivos = [];
  const paso = Math.max(1, Math.floor(Math.min(w, h) / 400));

  zonas.forEach((zona, idx) => {
    const caja = aPixeles(zona, w, h);
    const x1 = Math.max(0, Math.floor(Math.min(caja[0], caja[2])));
    const y1 = Math.max(0, Math.floor(Math.min(caja[1], caja[3])));
    const x2 = Math.min(w, Math.ceil(Math.max(caja[0], caja[2])));
    const y2 = Math.min(h, Math.ceil(Math.max(caja[1], caja[3])));
    if (x2 - x1 < 2 || y2 - y1 < 2) {
      motivos.push(`zona ${idx + 1}: vacía`);
      return;
    }

    let total = 0;
    let fuera = 0;
    let sumaBrillo = 0;
    for (let y = y1; y < y2; y += paso) {
      for (let x = x1; x < x2; x += paso) {
        const p = y * w + x;
        total += 1;
        if (!mascara[p]) fuera += 1;
        sumaBrillo += brillo[p];
      }
    }
    if (!total) {
      motivos.push(`zona ${idx + 1}: vacía`);
      return;
    }

    const fueraPct = fuera / total;
    const brilloMedio = sumaBrillo / total;
    if (fueraPct > fueraMax) {
      motivos.push(`zona ${idx + 1}: ${Math.round(fueraPct * 100)}% fuera de la carcasa`);
      return;
    }
    if (brilloMedio < brilloMin) {
      motivos.push(`zona ${idx + 1}: demasiado oscura (brillo ${Math.round(brilloMedio)}), probable visor`);
      return;
    }
    validas.push(zona);
  });

  return { validas, motivos };
}

// Le pregunta a Qwen DÓNDE puede ir un elemento sobre esta vista: zonas de
// carcasa pintable, nunca el visor, las rejillas ni el fondo. Este es el
// criterio visual de la colocación — antes los elementos caían en posiciones
// fijas y terminaban sobre el visor, que comercialmente es un despropósito.
const ZONAS_PROMPT = `Esta es la vista de un casco de moto. Devuelve entre 2 y 4 zonas RECTANGULARES donde se podría colocar un sticker o gráfico decorativo SOBRE LA CARCASA pintable del casco.

Reglas estrictas:
- NUNCA sobre el visor ni tocándolo.
- NUNCA sobre rejillas de ventilación, tornillos o mecanismos.
- NUNCA sobre el fondo de la imagen: solo superficie del casco.
- La primera zona es la protagonista: la más grande y despejada.

Responde SOLO con JSON:
{"zonas":[{"box":[x1,y1,x2,y2],"papel":"principal|secundario"}]}

Coordenadas NORMALIZADAS de 0 a 1000 sobre esta imagen.`;

// Reparto conservador: laterales y barbilla, evitando el centro donde suele
// estar el visor. Es la caída cuando ni Qwen ni la validación dejan zonas
// suficientes — no es lo mejor, es lo que no rompe nada.
const ZONAS_CONSERVADORAS = [[60, 340, 340, 700], [660, 340, 940, 700], [380, 700, 620, 900]];

async function zonasDeColocacion(vistaDataUrl, origen) {
  // El tope puede alcanzarse a mitad del lote: se comprueba en cada llamada,
  // no solo al empezar.
  if (typeof gastoApiBloqueado === "function" && gastoApiBloqueado()) {
    throw new Error("tope de gasto alcanzado");
  }
  const respuesta = await FlowForgeModels.analizar(vistaDataUrl, ZONAS_PROMPT, {
    model: EXPLORER_MODELO,
    maxTokens: 800,
    origen
  });
  const zonas = (extraerJson(respuesta).zonas || [])
    .map((z) => (z.box || []).map(Number))
    .filter((b) => b.length === 4 && b.every(Number.isFinite));
  if (!zonas.length) throw new Error("sin zonas");
  return zonas;
}

function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("imagen no cargó"));
    img.src = src;
  });
}

// Propuesta de composición: la vista con el fondo YA puesto, más los elementos
// pegados tal cual salen — sin fundir, sin sombra, sin integrar. El borde duro
// declara lo que esto es: una deliberación, no un producto terminado.
// Compone dentro de las zonas que Qwen señaló sobre la carcasa. Cada elemento
// se ajusta a su zona sin deformarse (se conserva la proporción: los
// accidentes autorizados son lugar y tamaño, nunca la forma).
function componerVariante(baseImg, imagenesElementos, zonas, indice) {
  const c = document.createElement("canvas");
  c.width = baseImg.naturalWidth;
  c.height = baseImg.naturalHeight;
  const ctx = c.getContext("2d");
  ctx.drawImage(baseImg, 0, 0);

  imagenesElementos.forEach((img, j) => {
    const z = zonas[j % zonas.length];
    const zx = (z[0] / 1000) * c.width;
    const zy = (z[1] / 1000) * c.height;
    const zw = ((z[2] - z[0]) / 1000) * c.width;
    const zh = ((z[3] - z[1]) / 1000) * c.height;
    if (zw <= 0 || zh <= 0) return;

    // El elemento cabe entero en la zona, conservando su proporción.
    const escala = Math.min(zw / img.naturalWidth, zh / img.naturalHeight);
    const ancho = img.naturalWidth * escala;
    const alto = img.naturalHeight * escala;
    // Centrado en la zona, con un leve corrimiento por variante para que dos
    // variantes con zonas iguales no queden idénticas de layout.
    const desvio = ((indice % 3) - 1) * 0.06;
    ctx.drawImage(img, zx + (zw - ancho) / 2 + desvio * zw, zy + (zh - alto) / 2, ancho, alto);
  });

  return c.toDataURL("image/png");
}

function renderExplorerNode(element, taskNode, onChange) {
  const seleccion = new Set(taskNode.targets || []);
  const hasFile = hasBinary(taskNode.fileData);
  // Restos de la época en que "corriendo" se guardaba: se tira el campo para
  // que no viaje más a la nube. Quien manda ahora es EXPLORER_EN_CURSO.
  delete taskNode.corriendo;

  element.classList.add("explorer-node");
  element.innerHTML = `
    <div class="explorer-lupa" aria-hidden="true">🔍</div>
    <span>${taskNode.title}</span>

    <label class="drop-zone node-drop${hasFile ? " has-file" : ""}" data-explorer-drop>
      <input type="file" accept="application/pdf" data-explorer-file />
      <strong data-explorer-name>${hasFile ? (taskNode.fileName || "catálogo cargado") : "Arrastra el catálogo PDF"}</strong>
      <small>Qwen inventaría sus elementos y los recorta con fondo transparente.</small>
    </label>

    <button type="button" class="run-button" data-analizar${hasFile ? "" : " disabled"}>Analizar catálogo</button>

    <div class="element-grid" data-elementos></div>

    <small class="mode-hint">Marca las vistas (ya con fondo) donde repartir los elementos.</small>
    <div class="node-pieces" data-explorer-targets></div>

    <label class="explorer-variantes">Variantes por vista
      <select data-variantes>
        ${[2, 3, 4].map((n) => `<option value="${n}"${n === (taskNode.variantes || 3) ? " selected" : ""}>${n}</option>`).join("")}
      </select>
    </label>

    <button type="button" class="run-button" data-proponer disabled>Proponer variantes</button>
    <output data-log>${taskNode.log || "Sin analizar."}</output>
  `;

  const dropZone = element.querySelector("[data-explorer-drop]");
  const fileInput = element.querySelector("[data-explorer-file]");
  const nameLabel = element.querySelector("[data-explorer-name]");
  const analizarBtn = element.querySelector("[data-analizar]");
  const elementosHost = element.querySelector("[data-elementos]");
  const targetsHost = element.querySelector("[data-explorer-targets]");
  const variantesSel = element.querySelector("[data-variantes]");
  const proponerBtn = element.querySelector("[data-proponer]");

  function anotar(texto) {
    taskNode.log = texto;
    const salida = element.querySelector("[data-log]");
    if (salida) salida.textContent = texto;
  }

  // Solo figuras: el texto no se compone. Un lettering pegado como adorno es
  // exactamente el error que el documento maestro prohíbe.
  function elementosListos() {
    return (taskNode.elementos || []).filter((e) => hasBinary(e.imagen) && e.tipo !== "texto");
  }

  // Candidatas: vistas con imagen, incluidas las entregas "✔ terminada"
  // (que son las que ya llevan el fondo). Se excluyen las variantes propias:
  // una propuesta nunca es insumo de otra propuesta.
  function vistasCandidatas() {
    return (activeTask?.nodes || []).filter(
      (n) => n.kind === "view-photo" && !n.isVariant && hasBinary(n.image)
    );
  }

  function actualizarBotones() {
    const ocupado = EXPLORER_EN_CURSO.has(taskNode.id);
    proponerBtn.disabled = !(elementosListos().length >= 2 && seleccion.size > 0) || ocupado;
    // El archivo se comprueba por los bytes, no por el nombre: un nodo
    // recuperado de la nube puede traer el PDF y no traer fileName.
    analizarBtn.disabled = !hasBinary(taskNode.fileData) || ocupado;
  }

  // Se pintan TODOS los extractos, también los de texto: excluirlos del
  // compositing sin mostrarlos dejaba invisible el motivo. Cada celda declara
  // su tipo y su identidad — así se ve de un golpe qué entra a composición y
  // por qué lo que hay es el elemento del catálogo y no un parecido.
  function pintarElementos() {
    elementosHost.innerHTML = "";
    const todos = (taskNode.elementos || []).filter((e) => hasBinary(e.imagen));
    todos.forEach((e) => {
      const tipo = e.tipo || "otro";
      const bloque = document.createElement("div");
      bloque.className = "element-item";
      const celda = document.createElement("figure");
      celda.className = "element-cell";
      celda.title =
        `${e.nombre} · tipo: ${tipo}` +
        (Number.isFinite(e.identidad) ? ` · identidad ${e.identidad.toFixed(1)}%` : "") +
        (tipo === "texto" ? " · no entra a composición" : "");
      const img = document.createElement("img");
      img.src = e.imagen;
      img.alt = e.nombre;
      celda.appendChild(img);

      const pie = document.createElement("small");
      pie.className = "pieces-summary";
      const linea1 = document.createElement("span");
      linea1.textContent = tipo === "texto" ? "texto ⊘" : tipo;
      const linea2 = document.createElement("span");
      linea2.textContent = Number.isFinite(e.identidad) ? `${e.identidad.toFixed(1)}%` : "—";
      pie.append(linea1, document.createElement("br"), linea2);

      bloque.append(celda, pie);
      elementosHost.appendChild(bloque);
    });

    if (todos.length) {
      const listos = elementosListos().length;
      const textos = todos.filter((e) => (e.tipo || "otro") === "texto").length;
      const resumen = document.createElement("small");
      resumen.className = "pieces-summary";
      resumen.textContent =
        `${todos.length} elementos extraídos · ${listos} componibles` +
        (textos ? ` · ${textos} de texto excluidos (⊘)` : "") +
        ". El % es la identidad verificada contra la página del catálogo.";
      elementosHost.appendChild(resumen);
    }
  }

  function sincronizarEnlaces() {
    activeTask.links = activeTask.links.filter(([a, b]) => !(a === taskNode.id && !seleccion.has(b)));
    seleccion.forEach((id) => {
      if (!activeTask.nodes.some((n) => n.id === id)) return;
      if (!activeTask.links.some(([a, b]) => a === taskNode.id && b === id)) {
        activeTask.links.push([taskNode.id, id]);
      }
    });
  }

  function pintarObjetivos() {
    targetsHost.innerHTML = "";
    const vistas = vistasCandidatas();
    if (!vistas.length) {
      targetsHost.innerHTML = `<small class="pieces-summary">No hay vistas con imagen en este canvas.</small>`;
      return;
    }
    vistas.forEach((vista) => {
      const fila = document.createElement("label");
      fila.className = seleccion.has(vista.id) ? "piece-row is-accepted" : "piece-row";
      const casilla = document.createElement("input");
      casilla.type = "checkbox";
      casilla.checked = seleccion.has(vista.id);
      casilla.addEventListener("change", () => {
        if (casilla.checked) seleccion.add(vista.id);
        else seleccion.delete(vista.id);
        taskNode.targets = [...seleccion];
        sincronizarEnlaces();
        actualizarBotones();
        onChange();
        renderCanvas();
      });
      const nombre = document.createElement("strong");
      nombre.textContent = vista.title;
      fila.append(casilla, nombre);
      targetsHost.appendChild(fila);
    });
  }

  function setFile(file) {
    if (!file || file.type !== "application/pdf") return;
    const reader = new FileReader();
    reader.onload = () => {
      taskNode.fileData = reader.result;
      taskNode.fileName = file.name;
      nameLabel.textContent = file.name;
      dropZone.classList.add("has-file");
      anotar("Catálogo cargado. Pulsa analizar.");
      actualizarBotones();
      onChange();
    };
    reader.readAsDataURL(file);
  }

  dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("is-hovered"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("is-hovered"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("is-hovered");
    setFile(e.dataTransfer.files?.[0]);
  });
  fileInput.addEventListener("change", () => setFile(fileInput.files?.[0]));

  variantesSel.addEventListener("change", () => {
    taskNode.variantes = Number(variantesSel.value);
    onChange();
  });

  analizarBtn.addEventListener("click", async () => {
    if (EXPLORER_EN_CURSO.has(taskNode.id) || !hasBinary(taskNode.fileData)) return;
    EXPLORER_EN_CURSO.add(taskNode.id);
    actualizarBotones();
    taskNode.elementos = [];
    // Sin medida no se puede probar que la paralelización sirvió.
    const inicio = Date.now();

    try {
      // El tope de gasto manda: se comprueba antes de abrir el PDF para no
      // rasterizar páginas que nadie va a poder inventariar.
      if (typeof gastoApiBloqueado === "function" && gastoApiBloqueado()) {
        throw new Error("tope de gasto alcanzado: no se inventaría el catálogo");
      }
      anotar("Abriendo catálogo…");
      const paginas = await rasterizarPdf(taskNode.fileData, 2);
      const descartes = [];

      // Las páginas se preguntan en paralelo con tope: el orden de llegada da
      // igual porque cada respuesta vuelve a su índice, y el inventario se
      // arma después recorriendo las páginas en orden. Mismo PDF, mismo
      // resultado, sin depender de qué respuesta llegó primero.
      let hechas = 0;
      anotar(`Inventariando 0/${paginas.length} páginas…`);
      const respuestas = await enParalelo(paginas, EXPLORER_CONCURRENCIA, async (pagina, i) => {
        try {
          const respuesta = await FlowForgeModels.analizar(copiaParaDeteccion(pagina), EXPLORER_PROMPT, {
            model: EXPLORER_MODELO,
            maxTokens: 2500,
            origen: taskNode.id
          });
          return { vistas: extraerJson(respuesta).vistas || [] };
        } catch (error) {
          // Una página que falla se declara y se deja atrás: las demás no
          // dependen de ella.
          return { error: error.message || String(error) };
        } finally {
          hechas += 1;
          anotar(`Inventariando ${hechas}/${paginas.length} páginas…`);
        }
      });

      anotar("Recortando y verificando identidad…");
      for (let i = 0; i < paginas.length; i += 1) {
        const pagina = paginas[i];
        const resultado = respuestas[i] || { error: "sin respuesta" };
        if (resultado.error) {
          descartes.push(`pág ${i + 1}: ${resultado.error}`);
          continue;
        }

        // Umbrales de elemento, no de vista: un logo legítimo puede ocupar
        // el 0.3% de la página.
        const { aceptadas, descartadas } = validarCajas(resultado.vistas, pagina.width, pagina.height, 0.002, 0.8);
        descartadas.forEach((d) => descartes.push(`pág ${i + 1} · ${d}`));

        aceptadas.forEach((caja) => {
          // Coordenadas enteras: recortar en fracciones de píxel interpola y
          // el extracto deja de ser copia exacta de la página.
          const sx = Math.round(caja.x1);
          const sy = Math.round(caja.y1);
          const tile = document.createElement("canvas");
          tile.width = Math.round(caja.x2 - caja.x1);
          tile.height = Math.round(caja.y2 - caja.y1);
          tile.getContext("2d").drawImage(pagina, sx, sy, tile.width, tile.height, 0, 0, tile.width, tile.height);
          quitarFondoBorde(tile);

          const identidad = identidadDelExtracto(tile, pagina, sx, sy);
          if (identidad < 99) {
            descartes.push(`pág ${i + 1} · ${caja.nombre}: identidad ${identidad.toFixed(1)}% (< 99%)`);
            return;
          }

          taskNode.elementos.push({
            nombre: caja.nombre,
            tipo: caja.tipo || "otro",
            confianza: caja.confianza,
            identidad,
            imagen: tile.toDataURL("image/png")
          });
        });
      }

      pintarElementos();
      // El tiempo se guarda en el nodo, no solo en el log: sobrevive al
      // redibujo y permite comparar una corrida con la siguiente.
      taskNode.duracionMs = Date.now() - inicio;
      anotar(
        [
          `${taskNode.elementos.length} elementos extraídos con fondo transparente`,
          `de ${paginas.length} páginas en ${explorerDuracionLegible(taskNode.duracionMs)}`,
          `(hasta ${EXPLORER_CONCURRENCIA} páginas a la vez).`,
          // El conteo solo no dice POR QUÉ se descartó nada — y "por qué" es
          // justo lo que hace falta para diagnosticar sin adivinar. Se
          // muestran las primeras razones tal cual, no un número solo.
          descartes.length ? `${descartes.length} descartados: ${descartes.slice(0, 6).join("; ")}${descartes.length > 6 ? "…" : ""}` : ""
        ].filter(Boolean).join(" ")
      );
    } catch (error) {
      anotar(`Falló el análisis: ${error.message}`);
    }

    EXPLORER_EN_CURSO.delete(taskNode.id);
    actualizarBotones();
    onChange();
  });

  proponerBtn.addEventListener("click", async () => {
    if (EXPLORER_EN_CURSO.has(taskNode.id)) return;
    EXPLORER_EN_CURSO.add(taskNode.id);
    actualizarBotones();

    const usables = elementosListos();
    const vistas = vistasCandidatas().filter((v) => seleccion.has(v.id));
    const n = taskNode.variantes || 3;
    const total = vistas.length * n;
    let creadas = 0;
    const notasZonas = [];

    try {
      // 1) Las bases. Cada vista necesita su imagen decodificada una sola vez:
      // sirve para preguntar las zonas y para TODAS sus composiciones.
      anotar(`Preparando ${vistas.length} vista(s) y ${usables.length} elemento(s)…`);
      const [bases, imagenesUsables] = await Promise.all([
        enParalelo(vistas, EXPLORER_CONCURRENCIA, (v) => cargarImagen(v.image)),
        // 2) Los elementos. Antes se decodificaba el mismo extracto una vez por
        // variante; el objeto Image no cambia entre composiciones, así que se
        // carga una vez y se reutiliza. Puro ahorro: el dibujo es idéntico.
        Promise.all(usables.map((e) => cargarImagen(e.imagen)))
      ]);
      const imagenPorElemento = new Map(usables.map((e, i) => [e, imagenesUsables[i]]));

      // Lienzo por vista: la máscara de validación y el dataUrl que va a Qwen
      // salen de aquí, y se calculan una sola vez por vista.
      const lienzos = vistas.map((vista, i) => {
        const c = document.createElement("canvas");
        c.width = bases[i].naturalWidth;
        c.height = bases[i].naturalHeight;
        c.getContext("2d").drawImage(bases[i], 0, 0);
        return c;
      });

      // 3) Las zonas. Las zonas de una vista no dependen de las de otra: son
      // independientes y se preguntan en paralelo con el mismo tope de 4. El
      // orden de salida lo garantiza enParalelo, así zonas[i] es de vistas[i]
      // aunque las respuestas lleguen desordenadas.
      const huella = huellaDePropuesta(usables, vistas, n);
      const guardadas = taskNode.zonasPorVista || {};
      const puedeReutilizar =
        taskNode.huellaPropuesta === huella &&
        vistas.every((v) => Array.isArray(guardadas[v.id]?.zonas) && guardadas[v.id].zonas.length);

      let resueltas;
      if (puedeReutilizar) {
        // 4) Mismos elementos, mismas vistas, mismas variantes: la pregunta ya
        // está contestada. Se recomponen las variantes con las zonas guardadas
        // y no se gasta ni una llamada.
        anotar(
          `Sin cambios desde la última propuesta: reutilizando zonas guardadas de ${vistas.length} vista(s), sin llamadas a la API.`
        );
        resueltas = vistas.map((v) => ({
          zonas: guardadas[v.id].zonas,
          nota: [guardadas[v.id].nota, "zonas reutilizadas"].filter(Boolean).join(" · ")
        }));
      } else {
        // 5) El tope de gasto manda: si está bloqueado no se pregunta nada, y
        // se dice por qué en lugar de fallar callando.
        if (typeof gastoApiBloqueado === "function" && gastoApiBloqueado()) {
          throw new Error("tope de gasto alcanzado: no se piden zonas nuevas");
        }

        let hechas = 0;
        let topeEnMedio = false;
        anotar(`Buscando zonas de carcasa 0/${vistas.length} vistas…`);
        resueltas = await enParalelo(vistas, EXPLORER_CONCURRENCIA, async (vista, i) => {
          const c = lienzos[i];
          let zonas = [];
          let nota = "";
          try {
            zonas = await zonasDeColocacion(c.toDataURL("image/png"), taskNode.id);
          } catch (e) {
            // Una vista sin zonas no impide a las demás: se declara y cae al
            // reparto conservador. Si lo que faltó fue presupuesto y no
            // respuesta, se dice tal cual: son fallos distintos.
            zonas = [];
            if (String(e.message || "").includes("tope de gasto")) {
              topeEnMedio = true;
              nota = "tope de gasto alcanzado: sin zonas de Qwen";
            } else {
              nota = "Qwen no devolvió zonas";
            }
          }

          // El juicio de Qwen sobre la carcasa se comprueba localmente contra
          // la vista: lo que se sale del casco o cae sobre superficie oscura
          // (visor) no es zona pintable, lo diga el modelo o no.
          if (zonas.length) {
            try {
              const { validas, motivos } = validarZonas(c, zonas);
              if (motivos.length) nota = `descartadas: ${motivos.join("; ")}`;
              zonas = validas;
            } catch (e) {
              // Sin acceso a los píxeles (imagen de otro origen) no hay máscara
              // posible: se dice y se sigue con lo que dio el modelo.
              nota = `sin máscara verificable (${e.message})`;
            }
          }

          if (zonas.length < 2) {
            zonas = ZONAS_CONSERVADORAS;
            nota = [nota, "reparto conservador aplicado"].filter(Boolean).join(" · ");
          }

          hechas += 1;
          anotar(`Buscando zonas de carcasa ${hechas}/${vistas.length} vistas…`);
          return { zonas, nota };
        });

        // Se guardan en el nodo: la próxima propuesta idéntica las reutiliza.
        // Si el tope cortó el lote a medias, NO se sella la huella: esas zonas
        // conservadoras no son la respuesta, son la caída, y cachearlas
        // impediría preguntar bien cuando haya presupuesto.
        const nuevas = {};
        vistas.forEach((v, i) => { nuevas[v.id] = { zonas: resueltas[i].zonas, nota: resueltas[i].nota }; });
        taskNode.zonasPorVista = nuevas;
        taskNode.huellaPropuesta = topeEnMedio ? null : huella;
      }

      resueltas.forEach((r, i) => {
        if (r.nota) notasZonas.push(`${vistas[i].title}: ${r.nota}`);
      });

      // 6) Composición. El dibujo sigue siendo secuencial (un solo canvas y un
      // solo hilo), pero cede el hilo entre variantes: así el progreso se pinta
      // y la pestaña responde en vez de congelarse veinte veces seguidas.
      for (let v = 0; v < vistas.length; v += 1) {
        const vista = vistas[v];
        const base = bases[v];
        const zonas = resueltas[v].zonas;

        // Propuestas anteriores de este explorador sobre esta vista se
        // reemplazan: una deliberación nueva sustituye a la vieja.
        activeTask.nodes = activeTask.nodes.filter(
          (x) => !(x.isVariant && x.source === taskNode.id && x.parentVista === vista.id)
        );

        for (let i = 0; i < n; i += 1) {
          anotar(`Componiendo ${creadas + 1}/${total} variantes… (${vista.title}, ${zonas.length} zona(s))`);
          await cederHilo();

          // Diferencia específica, no numérica: cada variante lleva OTRO
          // conjunto de elementos, no los mismos movidos de sitio.
          const cuantos = Math.min(3, usables.length);
          const set = [];
          for (let j = 0; j < cuantos; j += 1) set.push(usables[(i * cuantos + j) % usables.length]);
          const imgs = set.map((e) => imagenPorElemento.get(e));

          const id = `variante-${taskNode.id}-${vista.id}-${i + 1}`;
          const nodo = viewPhotoNode(
            id,
            `Variante ${i + 1} · ${vista.title}`,
            `Elementos: ${set.map((e) => e.nombre).join(" · ")}. Es un borrador de ubicación (por eso se ve pegado): si te gusta, pasa a integración; si no, bórralo.`,
            vista.x + 420,
            vista.y + i * 320,
            taskNode.id
          );
          nodo.isVariant = true;
          nodo.parentVista = vista.id;
          nodo.image = componerVariante(base, imgs, zonas, i);
          activeTask.nodes.push(nodo);
          if (!activeTask.links.some(([a, b]) => a === vista.id && b === id)) {
            activeTask.links.push([vista.id, id]);
          }
          creadas += 1;
        }
      }
      anotar(
        [
          `${creadas} variantes propuestas en ${vistas.length} vista(s). Pegadas sin integrar: el juicio es tuyo.`,
          puedeReutilizar ? "Zonas reutilizadas: 0 llamadas a la API." : "",
          notasZonas.length ? `Zonas — ${notasZonas.join(" | ")}` : ""
        ].filter(Boolean).join(" ")
      );
    } catch (error) {
      anotar(`Falló la composición: ${error.message}`);
    }

    EXPLORER_EN_CURSO.delete(taskNode.id);
    actualizarBotones();
    renderCanvas();
    onChange();
  });

  pintarElementos();
  pintarObjetivos();
  actualizarBotones();
}
