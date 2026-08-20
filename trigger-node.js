// Nodo disparador. Se conecta a los nodos "Separar PDF" que tú elijas y los
// ejecuta de verdad: rasteriza cada página, le pregunta a Qwen dónde están las
// vistas, valida las cajas, recorta y crea un nodo por vista.
//
// La diferencia con el botón "Separar automáticamente" del propio nodo de PDF
// es que aquel es una simulación con plantilla fija de cinco piezas. Aquí el
// número de vistas lo decide el PDF, no una plantilla: si tiene tres, salen
// tres; si tiene siete, siete.

const TRIGGER_MODELO = "qwen/qwen3.7-flash";

// Dos topes distintos porque protegen dos cosas distintas, y confundirlos era
// la causa de que todo fuese en fila:
//
// · TRIGGER_CONCURRENCIA_PDF (2) protege la MEMORIA del navegador. Rasterizar
//   un PDF pinta cada página en un canvas a escala 2 o 3; varios PDFs
//   rasterizando a la vez tienen muchos canvas grandes vivos al mismo tiempo y
//   la pestaña se cae. El límite es material: pocos a la vez.
//
// · TRIGGER_CONCURRENCIA_VISION (4) protege la API, no la memoria. Las páginas
//   ya están rasterizadas y ninguna necesita el resultado de otra: la espera es
//   de red. Cuatro a la vez aprovecha esa espera sin saturar al proveedor.
//
// Medido de punta a punta con un PDF real de 14 páginas: pico observado de 4
// peticiones simultáneas a /api/model, 153 s de reloj frente a 513 s de suma
// de las llamadas sueltas (3.35x). El tope se queda en 4 y no en 6 porque aquí
// pueden correr dos PDFs a la vez: 2 × 4 = 8 ya rebasa el semáforo global de
// models.js, así que subirlo solo alargaría la cola, no la ganancia.
const TRIGGER_CONCURRENCIA_PDF = 2;
const TRIGGER_CONCURRENCIA_VISION = 4;

// "Está corriendo" es un hecho del momento, no una propiedad del nodo.
// Guardado en taskNode viajaba a Supabase, y una corrida interrumpida dejaba
// el disparador congelado al recargar: botón deshabilitado y el manejador
// saliendo en su primera línea, sin manera de desatascarlo desde la interfaz.
// En memoria, indexado por id, como ya hace texture-batch-node.js.
const TRIGGER_EN_CURSO = new Set();

const TRIGGER_AVISO_GASTO = "tope de gasto alcanzado";

// Cola con tope: N obreros toman el siguiente índice libre hasta agotar la
// lista, y cada resultado se deposita en su posición original, así el orden de
// salida es el de entrada aunque las respuestas lleguen desordenadas.
// Tiene nombre propio (no `enParalelo`) porque el orden de carga de los scripts
// no garantiza que el helper de explorer-node.js exista aquí, y dos funciones
// con el mismo nombre en el ámbito global se pisan.
async function enParaleloTrigger(items, tope, tarea) {
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

// El tope de gasto manda: se consulta ANTES de cada llamada, no después.
// models.js también lo comprueba, pero preguntar aquí permite parar el lote
// entero en vez de coleccionar el mismo error una vez por página.
function triggerGastoBloqueado() {
  return typeof gastoApiBloqueado === "function" && gastoApiBloqueado();
}

function duracionLegible(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} m ${s % 60} s`;
}

const TRIGGER_PROMPT = `Esta es una página de un catálogo técnico de cascos. Devuelve UNA caja por cada vista del casco que veas, ni una más. No supongas un número fijo de vistas: si hay tres, devuelve tres; si hay siete, siete.

Responde SOLO con JSON, sin texto alrededor:
{"vistas":[{"nombre":"frontal|lateral-izquierda|lateral-derecha|trasera|superior|otra","box":[x1,y1,x2,y2],"confianza":0.0}]}

Las coordenadas van NORMALIZADAS de 0 a 1000 sobre el ancho y el alto de la imagen, donde [0,0] es la esquina superior izquierda y [1000,1000] la inferior derecha. Deja un pequeño margen alrededor de cada casco para no cortarlo.

Lateralidad, para no confundir izquierda con derecha: la vista es lateral-izquierda si el casco muestra su lado izquierdo, es decir el visor apunta hacia la izquierda del observador; es lateral-derecha si muestra su lado derecho, con el visor apuntando hacia la derecha del observador. Decide por hacia dónde mira el casco en la imagen, no por dónde está colocada la vista en la página.

Si una zona no es una vista del casco (texto, cotas, logotipo del catálogo, tabla), no la incluyas.`;

// pdf.js se carga bajo demanda: solo hace falta cuando se dispara.
function cargarPdfJs() {
  if (window.pdfjsLib) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.type = "module";
    s.textContent = `
      import * as pdfjs from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs";
      pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
      window.pdfjsLib = pdfjs;
      window.dispatchEvent(new Event("pdfjs-listo"));
    `;
    window.addEventListener("pdfjs-listo", () => resolve(), { once: true });
    s.onerror = () => reject(new Error("No se pudo cargar pdf.js"));
    document.head.appendChild(s);
    setTimeout(() => (window.pdfjsLib ? resolve() : reject(new Error("pdf.js tardó demasiado"))), 15000);
  });
}

// Cada página a canvas. La escala sube la resolución: a tamaño nativo el
// modelo no distingue los detalles del casco.
// El archivo puede venir como data URL (recién cargado) o como URL firmada
// de Storage (recuperado de la nube). Ambos son el mismo PDF.
async function bytesDeArchivo(valor) {
  if (valor.startsWith("data:")) {
    return Uint8Array.from(atob(valor.split(",")[1]), (c) => c.charCodeAt(0));
  }
  const res = await fetch(valor);
  if (!res.ok) throw new Error(`descarga del PDF falló: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function rasterizarPdf(dataUrl, escala = 2, maxPaginas = Infinity) {
  await cargarPdfJs();
  const bytes = await bytesDeArchivo(dataUrl);
  const doc = await window.pdfjsLib.getDocument({ data: bytes }).promise;
  const paginas = [];
  for (let n = 1; n <= Math.min(doc.numPages, maxPaginas); n += 1) {
    const pagina = await doc.getPage(n);
    const viewport = pagina.getViewport({ scale: escala });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await pagina.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    paginas.push(canvas);
  }
  return paginas;
}

// El modelo alucina cajas de vez en cuando. Una caja mala mete un recorte de
// fondo blanco en el canvas y ensucia todo lo que venga después: es barato
// comprobarlo y caro no hacerlo.
// Qwen devuelve las cajas normalizadas de 0 a 1000, no en píxeles: es su
// formato nativo de grounding. Interpretarlas como píxeles daba recortes
// corridos hacia la esquina superior izquierda.
function aPixeles(caja, ancho, alto) {
  return [
    (caja[0] / 1000) * ancho,
    (caja[1] / 1000) * alto,
    (caja[2] / 1000) * ancho,
    (caja[3] / 1000) * alto
  ];
}

// minArea y maxSolape son parámetros porque una vista de casco ocupa media
// página, pero un elemento de catálogo puede ocupar el 0.3%: el umbral
// correcto depende de qué clase de ente se busca.
function validarCajas(vistas, ancho, alto, minArea = 0.02, maxSolape = 0.7) {
  const areaPagina = ancho * alto;
  const aceptadas = [];
  const descartadas = [];

  [...vistas]
    .sort((a, b) => (b.confianza || 0) - (a.confianza || 0))
    .forEach((vista) => {
      const cruda = (vista.box || []).map(Number);
      if (cruda.length !== 4 || cruda.some((n) => !Number.isFinite(n))) {
        return descartadas.push(`${vista.nombre || "?"}: coordenadas inválidas`);
      }
      const caja = aPixeles(cruda, ancho, alto);
      const [x1, y1, x2, y2] = [
        Math.max(0, Math.min(caja[0], caja[2])),
        Math.max(0, Math.min(caja[1], caja[3])),
        Math.min(ancho, Math.max(caja[0], caja[2])),
        Math.min(alto, Math.max(caja[1], caja[3]))
      ];
      const w = x2 - x1;
      const h = y2 - y1;
      if (w <= 0 || h <= 0) return descartadas.push(`${vista.nombre}: caja vacía`);
      if ((w * h) / areaPagina < minArea) return descartadas.push(`${vista.nombre}: demasiado pequeña`);

      const solapa = aceptadas.some((otra) => {
        const ix = Math.max(0, Math.min(x2, otra.x2) - Math.max(x1, otra.x1));
        const iy = Math.max(0, Math.min(y2, otra.y2) - Math.max(y1, otra.y1));
        return (ix * iy) / (w * h) > maxSolape;
      });
      if (solapa) return descartadas.push(`${vista.nombre}: solapada con otra`);

      aceptadas.push({ nombre: vista.nombre || "otra", tipo: vista.tipo || null, confianza: vista.confianza || 0, x1, y1, x2, y2 });
    });

  return { aceptadas, descartadas };
}

// La segunda pasada rasteriza a escala mayor, así que los píxeles de una
// caja no son comparables entre pasadas. Guardar la caja como fracción de
// la página la vuelve independiente de la escala: la misma vista superior
// cae en el mismo sitio relativo aunque el canvas mida 1.5 veces más.
function cajaRelativa(caja, ancho, alto) {
  return {
    x1: caja.x1 / ancho,
    y1: caja.y1 / alto,
    x2: caja.x2 / ancho,
    y2: caja.y2 / alto
  };
}

// Mismo criterio de solape que validarCajas, pero sobre la menor de las dos
// áreas: en la segunda pasada la caja nueva puede ser más ajustada o más
// holgada que la vieja y aun así ser la misma vista.
function solapeRelativo(a, b) {
  const ix = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const iy = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const inter = ix * iy;
  const areaA = Math.max(1e-9, (a.x2 - a.x1) * (a.y2 - a.y1));
  const areaB = Math.max(1e-9, (b.x2 - b.x1) * (b.y2 - b.y1));
  return inter / Math.min(areaA, areaB);
}

// Una vista nueva solo entra si no repite nada de lo que ya tiene ese PDF:
// ni el nombre (una segunda "frontal" no aporta), ni el lugar de la página
// (el mismo casco recortado dos veces tampoco).
function esVistaRepetida(nueva, existentes, maxSolape = 0.7) {
  return existentes.some((vieja) => {
    if (vieja.nombre && nueva.nombre && vieja.nombre === nueva.nombre) return true;
    return vieja.pagina === nueva.pagina && solapeRelativo(vieja.rel, nueva.rel) > maxSolape;
  });
}

function recortar(canvasPagina, caja) {
  const salida = document.createElement("canvas");
  salida.width = Math.round(caja.x2 - caja.x1);
  salida.height = Math.round(caja.y2 - caja.y1);
  salida
    .getContext("2d")
    .drawImage(canvasPagina, caja.x1, caja.y1, salida.width, salida.height, 0, 0, salida.width, salida.height);
  return salida.toDataURL("image/png");
}

// Miniatura para comparar cascos: para agrupar no hace falta resolución,
// y siete páginas a tamaño completo inflarían la petición sin ganar nada.
function miniaturaDe(canvas, ancho = 640) {
  const s = document.createElement("canvas");
  const escala = ancho / canvas.width;
  s.width = ancho;
  s.height = Math.max(1, Math.round(canvas.height * escala));
  s.getContext("2d").drawImage(canvas, 0, 0, s.width, s.height);
  return s.toDataURL("image/jpeg", 0.85);
}

function promptAgrupar(n) {
  return `Te paso ${n} imágenes numeradas del 1 al ${n}, en ese orden. Cada una es la página de un catálogo de cascos.

Agrupa las que muestren EL MISMO casco con EL MISMO diseño y los MISMOS colores. Regla importante: la misma forma de casco con diseño o colorway distinto son grupos DISTINTOS — solo van juntas si casco y diseño coinciden.

Responde SOLO con JSON, sin texto alrededor:
{"grupos":[[1,2],[3],[4,5,6]]}

Cada número debe aparecer exactamente una vez.`;
}

// Pregunta a Qwen qué PDFs son el mismo casco. Devuelve grupos de índices
// (base 0). Si algo falla, quien llama trata todos como únicos: la
// inteligencia ahorra trabajo, pero nunca puede bloquear la separación.
async function agruparPdfs(miniaturas, origen) {
  const contenido = [{ type: "text", text: promptAgrupar(miniaturas.length) }];
  miniaturas.forEach((m) => contenido.push({ type: "image_url", image_url: { url: m } }));
  const datos = await FlowForgeModels.llamar(
    TRIGGER_MODELO,
    [{ role: "user", content: contenido }],
    { max_tokens: 600, reasoning: { enabled: false } },
    origen
  );
  const grupos = extraerJson(FlowForgeModels.texto(datos)).grupos;

  // Validación estricta: cada índice exactamente una vez. Un agrupado
  // inventado haría saltarse PDFs reales, que es peor que no agrupar.
  const planos = grupos.flat().map((n) => Number(n) - 1);
  const esperados = miniaturas.map((_, i) => i);
  if (JSON.stringify([...planos].sort((a, b) => a - b)) !== JSON.stringify(esperados)) {
    throw new Error("agrupado inválido");
  }
  return grupos.map((g) => g.map((n) => Number(n) - 1));
}

function extraerJson(texto) {
  const limpio = String(texto).replace(/```json|```/g, "").trim();
  const inicio = limpio.indexOf("{");
  const fin = limpio.lastIndexOf("}");
  if (inicio === -1 || fin === -1) throw new Error("El modelo no devolvió JSON");
  return JSON.parse(limpio.slice(inicio, fin + 1));
}

function renderTriggerNode(element, taskNode, onChange) {
  const seleccion = new Set(taskNode.targets || []);

  // Resto de la época en que "corriendo" se guardaba: se tira el campo para que
  // no viaje más a la nube. Quien manda ahora es TRIGGER_EN_CURSO.
  delete taskNode.corriendo;

  // Se levanta en cuanto una rama descubre que el tope de gasto está alcanzado.
  // Las demás ramas lo ven y no gastan más: el freno vale para todo el lote.
  let gastoCortado = false;

  element.classList.add("trigger-node");
  element.innerHTML = `
    <span>${taskNode.title}</span>
    <small class="mode-hint">Marca los nodos de PDF que quieres separar. Solo esos se ejecutan.</small>
    <div class="node-pieces" data-targets></div>
    <button type="button" class="run-button" data-launch>Lanzar separación</button>
    <output data-log>${taskNode.log || "Sin ejecutar."}</output>
  `;

  const host = element.querySelector("[data-targets]");
  const boton = element.querySelector("[data-launch]");
  const log = element.querySelector("[data-log]");

  function pdfsDelCanvas() {
    return activeTask.nodes.filter((n) => n.kind === "pdf-split");
  }

  // Marcar es conectar: el enlace se dibuja en el canvas para que se vea de
  // dónde a dónde va el disparo.
  function sincronizarEnlaces() {
    activeTask.links = activeTask.links.filter(([from]) => from !== taskNode.id);
    seleccion.forEach((id) => {
      if (activeTask.nodes.some((n) => n.id === id)) activeTask.links.push([taskNode.id, id]);
    });
  }

  function pintarObjetivos() {
    host.innerHTML = "";
    const pdfs = pdfsDelCanvas();

    if (!pdfs.length) {
      host.innerHTML = `<small class="pieces-summary">No hay nodos de PDF en este canvas.</small>`;
      boton.disabled = true;
      return;
    }

    // Dos nodos con el mismo nombre de archivo y el mismo tamaño son el mismo
    // PDF cargado dos veces. Avisar antes de marcar cuesta menos que separar
    // dos veces el mismo casco y luego preguntarse por qué salió doble.
    const huellas = new Map();
    pdfs.forEach((pdf) => {
      if (!pdf.fileName || !pdf.fileSize) return;
      const huella = `${pdf.fileName}|${pdf.fileSize}`;
      huellas.set(huella, (huellas.get(huella) || 0) + 1);
    });

    pdfs.forEach((pdf) => {
      const fila = document.createElement("label");
      fila.className = seleccion.has(pdf.id) ? "piece-row is-accepted" : "piece-row";

      const casilla = document.createElement("input");
      casilla.type = "checkbox";
      casilla.checked = seleccion.has(pdf.id);
      casilla.dataset.target = pdf.id;
      casilla.addEventListener("change", () => {
        if (casilla.checked) seleccion.add(pdf.id);
        else seleccion.delete(pdf.id);
        taskNode.targets = [...seleccion];
        sincronizarEnlaces();
        pintarObjetivos();
        onChange();
        renderCanvas();
      });

      const nombre = document.createElement("strong");
      nombre.textContent = pdf.fileName || "(sin archivo)";

      const estado = document.createElement("span");
      estado.className = "piece-confidence";
      estado.dataset.state = pdf.id;
      estado.textContent = taskNode.estado?.[pdf.id] || (hasBinary(pdf.fileData) ? "listo" : "sin PDF");

      fila.append(casilla, nombre, estado);

      const huella = pdf.fileName && pdf.fileSize ? `${pdf.fileName}|${pdf.fileSize}` : null;
      if (huella && huellas.get(huella) > 1) {
        const aviso = document.createElement("span");
        aviso.className = "piece-confidence";
        aviso.dataset.duplicate = pdf.id;
        aviso.textContent = `posible duplicado · mismo nombre y ${pdf.fileSize} KB`;
        fila.appendChild(aviso);
      }

      host.appendChild(fila);
    });

    boton.disabled = seleccion.size === 0 || TRIGGER_EN_CURSO.has(taskNode.id);
  }

  // El estado se guarda en el nodo, no solo en el DOM: al crear vistas se
  // vuelve a dibujar el canvas, y con él este mismo nodo. Lo que viviera solo
  // en pantalla se perdería justo cuando más falta hace verlo.
  function marcar(pdfId, texto) {
    taskNode.estado = { ...(taskNode.estado || {}), [pdfId]: texto };
    const badge = document.querySelector(`.trigger-node [data-state="${pdfId}"]`);
    if (badge) badge.textContent = texto;
  }

  function anotar(texto) {
    taskNode.log = texto;
    const salida = document.querySelector(".trigger-node [data-log]");
    if (salida) salida.textContent = texto;
  }

  // Cuenta lo que hay, no lo que se intentó. El log antiguo sumaba recortes
  // y decía "5 vistas" con tres nodos en el canvas: un signo que afirma lo
  // que la cosa no tiene.
  function contarVistasDe(pdfId) {
    return activeTask.nodes.filter((n) => n.kind === "view-photo" && n.source === pdfId).length;
  }

  // Rasteriza y pregunta, sin tocar el canvas: así la primera pasada y la
  // segunda usan exactamente el mismo análisis, solo cambia la escala.
  //
  // Tres fases, y cada una va a su propio ritmo por una razón distinta:
  //
  // 1 · Rasterizado — SECUENCIAL. Página por página, como siempre. Es el
  //     límite material: canvas a escala 2 o 3 y todos vivos a la vez agotan
  //     la memoria del navegador.
  // 2 · Visión — PARALELA con tope TRIGGER_CONCURRENCIA_VISION. Las páginas ya
  //     están en memoria y ninguna necesita el resultado de otra; esperar en
  //     fila era demora sin causa en la cosa misma. Si una página falla, se
  //     anota en descartes y las demás siguen.
  // 3 · Validación y recorte — SECUENCIAL y en orden de página, para que el
  //     orden de las vistas no dependa de quién contestó primero.
  async function analizarPdf(pdf, escala, etiqueta = "") {
    marcar(pdf.id, `${etiqueta}rasterizando…`);
    const paginas = await rasterizarPdf(pdf.fileData, escala);
    const recortes = [];
    const descartes = [];

    // Progreso honesto: con trabajo concurrente "pág 3/14" ya no es una
    // posición en una fila. Lo que sí es verdad es cuántas han vuelto.
    let completadas = 0;

    const respuestas = await enParaleloTrigger(paginas, TRIGGER_CONCURRENCIA_VISION, async (pagina) => {
      if (gastoCortado || triggerGastoBloqueado()) {
        gastoCortado = true;
        completadas += 1;
        return { error: TRIGGER_AVISO_GASTO };
      }
      let salida;
      try {
        const respuesta = await FlowForgeModels.analizar(pagina.toDataURL("image/png"), TRIGGER_PROMPT, {
          model: TRIGGER_MODELO,
          maxTokens: 2000,
          origen: pdf.id
        });
        try {
          salida = { vistas: extraerJson(respuesta).vistas || [] };
        } catch (error) {
          salida = { error: "respuesta no era JSON" };
        }
      } catch (error) {
        salida = { error: error.message };
      }
      completadas += 1;
      marcar(pdf.id, `${etiqueta}visión ${completadas}/${paginas.length} páginas…`);
      return salida;
    });

    respuestas.forEach((resultado, i) => {
      if (!resultado || resultado.error) {
        descartes.push(`pág ${i + 1}: ${resultado ? resultado.error : "sin respuesta"}`);
        return;
      }
      const pagina = paginas[i];
      const { aceptadas, descartadas } = validarCajas(resultado.vistas, pagina.width, pagina.height);
      descartadas.forEach((d) => descartes.push(`pág ${i + 1} · ${d}`));
      aceptadas.forEach((caja) =>
        recortes.push({
          ...caja,
          pagina: i,
          rel: cajaRelativa(caja, pagina.width, pagina.height),
          imagen: recortar(pagina, caja)
        })
      );
    });

    return { recortes, descartes };
  }

  // Crea un nodo de vista por recorte. El sufijo distingue las pasadas para
  // que la segunda no pise los identificadores de la primera.
  function crearNodosDeVista(pdf, recortes, sufijo, desplazamiento) {
    recortes.forEach((r, indice) => {
      const id = `vista-${pdf.id}-${sufijo}${indice}`;
      const fila = desplazamiento + indice;
      const nodo = viewPhotoNode(id, r.nombre, "Recortada automáticamente.", pdf.x + 420, pdf.y + fila * 300, pdf.id);
      nodo.image = r.imagen;
      activeTask.nodes.push(nodo);
      if (!activeTask.links.some(([from, to]) => from === pdf.id && to === id)) {
        activeTask.links.push([pdf.id, id]);
      }
    });
    pdf.pieces = [
      ...(pdf.pieces || []),
      ...recortes.map((r) => ({ label: r.nombre, note: "", confidence: r.confianza, accepted: true }))
    ];
  }

  // Mitad que SÍ puede correr en paralelo: solo lee el PDF y pregunta. No
  // toca activeTask ni crea nodos, así que dos de estas a la vez no se pisan.
  async function analizarParaSeparar(pdf) {
    if (!hasBinary(pdf.fileData)) {
      marcar(pdf.id, "sin PDF");
      return { id: pdf.id, error: "no tiene archivo cargado" };
    }
    marcar(pdf.id, "abriendo…");
    try {
      const { recortes, descartes } = await analizarPdf(pdf, 2);
      return { id: pdf.id, pdf, recortes, descartes };
    } catch (error) {
      marcar(pdf.id, "error");
      return { id: pdf.id, error: error.message };
    }
  }

  // Mitad que NO puede correr en paralelo: escribe en activeTask.nodes y
  // activeTask.links. Dos ramas empujando al mismo array a la vez es el bug de
  // escritores que ya nos costó trabajo perdido. Se recoge en paralelo, se
  // escribe en serie.
  function volcarSeparacion(analisis) {
    if (!analisis) return { id: "?", error: "sin análisis" };
    if (analisis.error) return { id: analisis.id, error: analisis.error };

    const { pdf, recortes, descartes } = analisis;
    if (!recortes.length) {
      marcar(pdf.id, "0 vistas");
      return { id: pdf.id, intentadas: 0, cajas: [], descartes };
    }

    // Los nodos de vista se crean con la imagen ya puesta: nada de aceptar a
    // mano ni de desplegar piezas.
    activeTask.nodes = activeTask.nodes.filter((n) => !(n.kind === "view-photo" && n.source === pdf.id));
    pdf.pieces = [];
    crearNodosDeVista(pdf, recortes, "", 0);

    const reales = contarVistasDe(pdf.id);
    marcar(pdf.id, reales === recortes.length ? `${reales} vistas` : `${reales} de ${recortes.length} vistas`);
    return {
      id: pdf.id,
      intentadas: recortes.length,
      cajas: recortes.map((r) => ({ nombre: r.nombre, pagina: r.pagina, rel: r.rel })),
      descartes
    };
  }

  // Segunda pasada: los PDFs que sacaron menos vistas que el mejor del lote
  // se vuelven a mirar a escala 3. Una vista pequeña (la superior, casi
  // siempre) puede ser invisible a escala 2 y evidente a escala 3.
  // Igual que arriba: analizar puede ir en paralelo, volcar no.
  async function analizarSegundaPasada(pdf, informe) {
    try {
      const { recortes, descartes } = await analizarPdf(pdf, 3, "2ª · ");
      return { pdf, informe, recortes, descartes };
    } catch (error) {
      return { pdf, informe, error: error.message };
    }
  }

  function volcarSegundaPasada({ pdf, informe, recortes, descartes, error }) {
    if (error) {
      informe.descartes = [...(informe.descartes || []), `2ª pasada: ${error}`];
      marcar(pdf.id, `${contarVistasDe(pdf.id)} vistas (2ª pasada falló)`);
      return 0;
    }

    // Se lee el conteo aquí, ya en serie, para que no dependa de lo que otra
    // rama haya escrito mientras tanto.
    const yaHabia = contarVistasDe(pdf.id);
    const existentes = [...(informe.cajas || [])];
    const nuevas = [];
    recortes.forEach((r) => {
      const candidata = { nombre: r.nombre, pagina: r.pagina, rel: r.rel };
      if (esVistaRepetida(candidata, existentes)) {
        descartes.push(`2ª pasada · ${r.nombre}: repetida`);
        return;
      }
      existentes.push(candidata);
      nuevas.push(r);
    });

    if (nuevas.length) crearNodosDeVista(pdf, nuevas, "r2-", yaHabia);

    informe.cajas = existentes;
    informe.intentadas = (informe.intentadas || 0) + nuevas.length;
    informe.descartes = [...(informe.descartes || []), ...descartes];
    informe.recuperadas = nuevas.length;

    const reales = contarVistasDe(pdf.id);
    marcar(pdf.id, nuevas.length ? `${reales} vistas (+${nuevas.length} en 2ª)` : `${reales} vistas`);
    return nuevas.length;
  }

  boton.addEventListener("click", async () => {
    if (TRIGGER_EN_CURSO.has(taskNode.id)) return;

    // El tope de gasto manda: si ya está alcanzado no se empieza siquiera.
    if (triggerGastoBloqueado()) {
      anotar("Tope de gasto alcanzado: no se llamó a la API. Súbelo en el nodo de Gasto de API para continuar.");
      onChange();
      return;
    }

    TRIGGER_EN_CURSO.add(taskNode.id);
    gastoCortado = false;
    boton.disabled = true;
    // Sin medida no se puede probar que la paralelización sirvió.
    const inicio = Date.now();

    const objetivos = pdfsDelCanvas().filter((p) => seleccion.has(p.id) && hasBinary(p.fileData));

    // ANTES de separar: Qwen mira los PDFs y agrupa los que son el mismo
    // casco con el mismo diseño. Solo se separa un representante por grupo;
    // los demás quedan etiquetados, no procesados. Si el agrupado falla,
    // todos cuentan como únicos — la inteligencia ahorra, nunca bloquea.
    let grupos = objetivos.map((_, i) => [i]);
    if (objetivos.length > 1) {
      anotar(`Comparando ${objetivos.length} PDF para detectar cascos repetidos…`);
      try {
        // Aquí se rasteriza una sola página a escala 1.2: son canvas pequeños,
        // así que caben dos a la vez sin riesgo de memoria.
        const miniaturas = await enParaleloTrigger(objetivos, TRIGGER_CONCURRENCIA_PDF, async (pdf) => {
          marcar(pdf.id, "leyendo…");
          const paginas = await rasterizarPdf(pdf.fileData, 1.2, 1);
          return miniaturaDe(paginas[0]);
        });
        if (triggerGastoBloqueado()) {
          gastoCortado = true;
          throw new Error(TRIGGER_AVISO_GASTO);
        }
        grupos = await agruparPdfs(miniaturas, taskNode.id);
      } catch (error) {
        grupos = objetivos.map((_, i) => [i]);
        anotar("No pude comparar los cascos; proceso todos como únicos.");
      }
    }

    const duplicados = [];
    const representantes = [];
    grupos.forEach((grupo) => {
      const rep = objetivos[grupo[0]];
      representantes.push(rep);
      grupo.slice(1).forEach((indice) => {
        const dup = objetivos[indice];
        marcar(dup.id, `duplicado de ${rep.fileName}`);
        duplicados.push(dup.fileName);
      });
    });

    anotar(`${representantes.length} casco(s) únicos de ${objetivos.length} PDF. Separando…`);

    // Los PDFs son independientes: se analizan de dos en dos (memoria), y
    // dentro de cada uno las páginas se preguntan de cuatro en cuatro (API).
    // El progreso cuenta los que ya volvieron, no una posición en una fila.
    let analizados = 0;
    const analisis = await enParaleloTrigger(representantes, TRIGGER_CONCURRENCIA_PDF, async (pdf) => {
      const resultado = await analizarParaSeparar(pdf);
      analizados += 1;
      anotar(`Separando… ${analizados}/${representantes.length} PDF analizados.`);
      return resultado;
    });

    // Y aquí, en serie, se escribe el canvas: un volcado detrás de otro, nunca
    // desde las ramas concurrentes de arriba.
    const informes = analisis.map(volcarSeparacion);
    renderCanvas();
    onChange();

    // Segunda pasada. El máximo del lote es la medida: si un PDF sacó cinco
    // vistas y otro tres, lo probable es que al de tres le falten dos, no que
    // el casco tenga menos lados.
    const conteoPorPdf = new Map(
      informes.filter((i) => !i.error).map((i) => [i.id, contarVistasDe(i.id)])
    );
    const maximo = Math.max(0, ...conteoPorPdf.values());
    const rezagados = informes.filter((i) => !i.error && conteoPorPdf.get(i.id) < maximo);
    let recuperadas = 0;

    // Si el tope de gasto ya cortó, la segunda pasada solo gastaría errores.
    if (maximo > 0 && rezagados.length && !gastoCortado) {
      anotar(`Máximo del lote: ${maximo} vistas. Reviso ${rezagados.length} PDF con menos, a escala 3…`);

      const pendientes = rezagados
        .map((informe) => ({ informe, pdf: representantes.find((p) => p.id === informe.id) }))
        .filter((par) => par.pdf);

      let revisados = 0;
      const segundos = await enParaleloTrigger(pendientes, TRIGGER_CONCURRENCIA_PDF, async ({ pdf, informe }) => {
        const resultado = await analizarSegundaPasada(pdf, informe);
        revisados += 1;
        anotar(`2ª pasada… ${revisados}/${pendientes.length} PDF revisados.`);
        return resultado;
      });

      // Volcado en serie, otra vez: la creación de nodos nunca sale de aquí.
      segundos.forEach((resultado) => {
        recuperadas += volcarSegundaPasada(resultado);
      });
      renderCanvas();
      onChange();
    }

    // El conteo real se hace sobre el canvas, no sobre la intención: cuántos
    // nodos view-photo existen con source igual a cada PDF procesado.
    const intentadas = informes.reduce((suma, i) => suma + (i.intentadas || 0), 0);
    // Los que fallaron no cuentan: pueden conservar nodos de una ejecución
    // anterior y sumarlos daría crédito a un trabajo que no se hizo ahora.
    const creadas = informes.reduce((suma, i) => suma + (i.error ? 0 : contarVistasDe(i.id)), 0);
    const perdidas = informes.flatMap((i) => i.descartes || []);
    const fallos = informes.filter((i) => i.error);
    const sinLlegar = intentadas - creadas;

    // El tiempo se guarda en el nodo, no solo en el log: sobrevive al redibujo
    // y permite comparar una corrida con la siguiente.
    taskNode.duracionMs = Date.now() - inicio;
    const tiempo = duracionLegible(taskNode.duracionMs);

    // Lo descartado y lo omitido se declara: un recorte que desaparece en
    // silencio parece que nunca existió.
    anotar([
      sinLlegar > 0
        ? `${creadas} vistas creadas, ${sinLlegar} no llegó al canvas (${intentadas} recortes intentados) en ${informes.length} PDF único(s) · ${tiempo}.`
        : `${creadas} vistas creadas en ${informes.length} PDF único(s) · ${tiempo}.`,
      gastoCortado ? "Tope de gasto alcanzado: el proceso se detuvo antes de terminar." : "",
      recuperadas ? `${recuperadas} recuperada(s) en la segunda pasada.` : "",
      maximo > 0 && rezagados.length && !recuperadas && !gastoCortado
        ? "La segunda pasada no recuperó ninguna vista."
        : "",
      duplicados.length ? `${duplicados.length} duplicado(s) omitido(s).` : "",
      perdidas.length ? `${perdidas.length} descartadas: ${perdidas.slice(0, 3).join("; ")}` : "",
      fallos.length ? `Fallaron: ${fallos.map((f) => f.id).join(", ")}` : ""
    ]
      .filter(Boolean)
      .join(" "));

    TRIGGER_EN_CURSO.delete(taskNode.id);
    boton.disabled = false;
    renderCanvas();
    onChange();
  });

  pintarObjetivos();
}
