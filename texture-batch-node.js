// Nodo de fondo global: reparte el trabajo entre agentes en paralelo.
// La app no genera nada. Tú marcas qué vistas del canvas cubre —igual que en
// el disparador de separación— y por cada marcada nace un nodo de entrega
// conectado a su vista, donde el agente deja la imagen terminada.
//
// El flujo queda dibujado en el canvas: fondo global → vista → vista terminada.

function textureBatchNode(id, x, y) {
  return {
    id,
    title: "Fondo global · reparto a agentes",
    x,
    y,
    kind: "texture-batch",
    textureData: null,
    textureName: null,
    targets: []
  };
}

// Los cuatro estados reales de una vista. El contador no adivina: lee lo que
// una persona (o un agente juez) dejó escrito en el nodo de entrega.
//   pendiente  → el nodo de entrega no tiene imagen
//   entregada  → tiene imagen, pero nadie la ha verificado
//   careada    → un juez la marcó verificada
//   consumada  → pasó el careo doble final (4K)
const BATCH_ESTADOS = ["pendiente", "entregada", "careada", "consumada"];

function batchEstadoValido(valor) {
  return BATCH_ESTADOS.includes(valor);
}

function batchPlural(n, singular, plural) {
  return `${n} ${n === 1 ? singular : plural}`;
}

// Las cuatro leyes del proyecto. No son consejos: son lo que hizo fallar tres
// careos reales seguidos. Se escriben una sola vez y se reparten a todo el que
// toque una imagen —quien aplica, quien carea y quien edita— para que nadie
// trabaje con una versión distinta de la ley.
const BATCH_LEYES = [
  {
    n: 1,
    titulo: "CARCASA ES SOLO LA SUPERFICIE DE COLOR DEL CASCO",
    texto: `La textura se aplica ÚNICAMENTE sobre la superficie de color de la carcasa.
Franjas de acento, molduras, juntas, piezas grises y rejillas NO son carcasa:
quedan VISIBLES e INTACTAS, con su color original, por encima del patrón. Si
una franja, una moldura, una junta, una pieza gris o una rejilla queda tapada,
teñida o borrada por la textura, la imagen está mal.`
  },
  {
    n: 2,
    titulo: "ILUSTRACIÓN PLANA",
    texto: `La imagen es una ILUSTRACIÓN PLANA de producto: sin volumen, sin sombreado 3D,
sin degradados de iluminación, sin brillos, sin reflejos, sin especulares.
El spoiler es NEGRO MATE. Colores planos y contornos limpios. Si el resultado
parece un render 3D o una fotografía, falló.`
  },
  {
    n: 3,
    titulo: "LOS LETTERINGS SE COPIAN LETRA A LETRA Y DEBEN LEERSE",
    texto: `Toda palabra, logo o lettering que aparezca en el patrón se copia de la TEXTURA
letra a letra, con su misma tipografía, su mismo grosor y su misma ortografía.
Ninguna letra se inventa, se deforma, se recorta ni se sustituye por trazos que
imiten texto. Cada palabra debe LEERSE con nitidez en el resultado: una sola
palabra ilegible arruina la imagen entera.`
  },
  {
    n: 4,
    titulo: "LA ESCALA DEL PATRÓN ES LEY ENTRE VISTAS",
    texto: `La escala del patrón la fija la primera vista consumada y es ley para todas las
demás. Es el MISMO casco visto desde otro ángulo, no un casco distinto: el
tamaño de los motivos y de las letras no crece ni se encoge entre vistas.`
  }
];

function batchLeyesTexto() {
  return BATCH_LEYES.map((l) => `LEY ${l.n} — ${l.titulo}\n${l.texto}`).join("\n\n");
}

function batchPromptText(label, textureName) {
  return `Aplica la textura${textureName ? ` "${textureName}"` : ""} a la ${label} del casco.

REGLA PRINCIPAL: el diseño es material licenciado. Reprodúcelo con fidelidad
absoluta. No lo reinterpretes, no lo rediseñes, no lo "mejores". Sus colores,
sus motivos y sus proporciones se conservan exactamente como están.

LAS CUATRO LEYES (se cumplen todas o la entrega se rechaza):

${batchLeyesTexto()}

Cambia únicamente:
- El color y el patrón de la superficie exterior de la carcasa.

No cambia nada de esto:
- Silueta, contorno y proporción del casco.
- Visor, mentonera, spoiler, rejillas de ventilación, molduras, juntas, piezas
  grises y franjas de acento: intactas y visibles.
- Encuadre, ángulo y tamaño del casco dentro de la imagen.
- El fondo de la ilustración.

Devuelve la imagen a la misma resolución que la recibiste, como ilustración
plana, y colócala en el nodo "✔ terminada" que cuelga de esta misma vista.`;
}

// ─── El iterador ───────────────────────────────────────────────────────────
// Tope de ediciones por vista. La quinta no existe: si a la cuarta el careo
// sigue sucio, el piloto se detiene y declara qué casilla quedó abierta. Una
// deuda declarada es barata; una imagen mala aprobada en silencio, no.
const BATCH_TOPE_DEUDA = 4;

// Vistas con un bucle vivo ahora mismo. Vive en memoria a propósito: es lo
// único que no debe sobrevivir a una recarga, porque un bucle no sobrevive.
const BATCH_EN_CURSO = new Set();

// Nunca aprobamos un careo que no entendimos. Si la respuesta no es JSON, es un
// fallo, no un "limpio".
function batchExtraerJson(texto) {
  const limpio = String(texto).replace(/```json|```/g, "").trim();
  const inicio = limpio.indexOf("{");
  const fin = limpio.lastIndexOf("}");
  if (inicio === -1 || fin === -1) throw new Error("el modelo no devolvió JSON");
  return JSON.parse(limpio.slice(inicio, fin + 1));
}

// Lo que dice un modelo entra a la pantalla como texto, nunca como marcado.
function batchEscapar(texto) {
  return String(texto == null ? "" : texto).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

function batchGastoFrenado() {
  return typeof gastoApiBloqueado === "function" && gastoApiBloqueado();
}

// Un reintento y no más. Si falla dos veces, se declara el fallo tal cual.
async function batchConReintento(etiqueta, fn) {
  try {
    return await fn();
  } catch (primero) {
    if (batchGastoFrenado()) throw primero;
    try {
      return await fn();
    } catch (segundo) {
      throw new Error(`${etiqueta} falló dos veces: ${segundo.message || segundo}`);
    }
  }
}

// (a) CLASIFICAR. Dos imágenes en la misma llamada: si los contornos no se
// superponen, el "entregado" es otro casco y editarlo sería maquillar a un
// extraño. En ese caso se regenera desde el original.
const BATCH_PROMPT_CLASIFICAR = `Imagen 1: la vista ORIGINAL del casco. Imagen 2: la imagen ENTREGADA.

¿El contorno del casco de la imagen 2 se superpone con el contorno del casco de
la imagen 1? Se superpone si es el mismo casco, en el mismo ángulo, con la misma
silueta, la misma proporción y el mismo encuadre. NO se superpone si el ángulo,
la silueta, el modelo o el encuadre son distintos: entonces es otro casco.

Responde SOLO con JSON:
{"superpone":true|false,"motivo":"una frase"}`;

async function batchClasificar(originalUrl, entregadaUrl, origen) {
  const datos = await FlowForgeModels.llamar(
    FlowForgeModels.modelos.juez,
    [
      {
        role: "user",
        content: [
          { type: "text", text: BATCH_PROMPT_CLASIFICAR },
          { type: "image_url", image_url: { url: originalUrl } },
          { type: "image_url", image_url: { url: entregadaUrl } }
        ]
      }
    ],
    { max_tokens: 400, reasoning: { enabled: false } },
    origen
  );
  const juicio = batchExtraerJson(FlowForgeModels.texto(datos));
  if (typeof juicio.superpone !== "boolean") throw new Error("clasificación sin veredicto");
  return juicio;
}

// (b) CAREAR. Una casilla por ley: el careo no opina, marca.
function batchPromptCareo() {
  return `Careas una ilustración de casco contra las cuatro leyes del proyecto. No opinas,
no sugieres, no felicitas: marcas casillas.

${batchLeyesTexto()}

Revisa la imagen ley por ley. Marca falla:true solo cuando la ley se incumple de
verdad, y describe el defecto concreto en "detalle" (qué pieza y qué le pasa).
"limpio" es true únicamente si ninguna ley falla.

Responde SOLO con JSON, sin una palabra más:
{"casillas":[{"ley":1,"falla":true,"detalle":"franjas plateadas tapadas"},{"ley":2,"falla":false,"detalle":""},{"ley":3,"falla":false,"detalle":""},{"ley":4,"falla":false,"detalle":""}],"limpio":false}`;
}

async function batchCarear(imagenUrl, origen) {
  const respuesta = await FlowForgeModels.analizar(imagenUrl, batchPromptCareo(), {
    model: FlowForgeModels.modelos.juez,
    maxTokens: 1200,
    origen
  });
  const careo = batchExtraerJson(respuesta);
  const casillas = (careo.casillas || [])
    .map((c) => ({ ley: Number(c.ley), falla: c.falla === true, detalle: String(c.detalle || "") }))
    .filter((c) => c.ley >= 1 && c.ley <= 4);
  if (!casillas.length) throw new Error("careo sin casillas");
  const fallas = casillas.filter((c) => c.falla);
  // El "limpio" lo decidimos nosotros con las casillas, no la buena voluntad
  // del modelo: si marcó una falla, no está limpio, diga lo que diga.
  return { casillas, limpio: fallas.length === 0 };
}

// El defecto más grave primero: la ley de orden más bajo es la más estructural.
// Se edita UNO por vuelta; dos cambios en una petición es cómo se pierde el
// control de lo que cambió.
function batchPeorDefecto(careo) {
  return careo.casillas
    .filter((c) => c.falla)
    .sort((a, b) => a.ley - b.ley)[0] || null;
}

const BATCH_ZONAS = {
  1: "las franjas de acento, molduras, juntas, piezas grises y rejillas",
  2: "el acabado de ilustración plana",
  3: "los letterings del patrón",
  4: "la escala del patrón"
};

// (c) EDITAR con clausura estricta. Lo no nombrado está prohibido.
function batchPromptEdicion(defecto) {
  const zona = BATCH_ZONAS[defecto.ley] || "la zona señalada";
  const ley = BATCH_LEYES.find((l) => l.n === defecto.ley);
  return `${zona.toUpperCase()}: corrige este defecto — ${defecto.detalle || ley.titulo}.
Resultado exigido: ${ley.texto}

NO TOQUES nada más — todo lo no nombrado está prohibido. Silueta, ángulo,
encuadre, resolución, fondo y el resto del diseño quedan bit a bit como están.
Devuelve la misma imagen con esa única corrección aplicada.`;
}

// (e) CONSUMAR. La final no sale de la textura suelta: sale del ejemplar, con el
// original como base. Cada insumo aporta lo suyo y el modelo no aporta nada.
function batchPromptConsumacion(label) {
  return `Produce la ilustración final de la ${label} del casco a partir de las imágenes de
referencia. Reparto de papeles, sin excepciones:

- La imagen ORIGINAL da la geometría, las piezas, la nitidez y la ILUSTRACIÓN
  PLANA. Silueta, ángulo, encuadre y piezas salen de ahí.
- El EJEMPLAR da el diseño ya aprobado: reprodúcelo EXACTAMENTE, motivo por
  motivo, color por color, en la misma escala y en la misma posición.
- Las palabras se copian de la TEXTURA, letra a letra, y deben leerse.
- Tú no aportas nada propio: ni reinterpretación, ni mejora, ni adorno, ni
  volumen, ni brillos.

El diseño es material licenciado y se reproduce con fidelidad absoluta.

${batchLeyesTexto()}`;
}

// ─── Recorte y pega automático (sin agente, sin generador) ─────────────────
// Puerto directo del Paso 0.7 de la ley multiimagen (v10): máscara de color +
// pegado de píxeles reales de la textura, cero llamadas a un generador de
// imagen. Qwen entra SOLO donde hace falta juicio semántico —identificar el
// rango de color de la carcasa, y verificar que las palabras del resultado
// se lean— igual que ya hace explorer-node.js con sus elementos. El pegado
// en sí es aritmética pura: por construcción, nada fuera de la máscara se
// toca, así que "la carcasa quedó intacta" no se verifica después, es
// imposible que no lo esté.
//
// Esta es una vía ALTERNATIVA a "Iterar hasta limpio" (que genera con IA) y
// a la skill @multiimagen (que reparte a un agente externo). Las tres
// siguen disponibles: cuál usar lo decide quien opera el nodo.

const RP_PROMPT_COLOR = `Esta es la vista de un casco de moto. Necesito el rango RGB exacto de la
CARCASA — la superficie de color principal del casco, EXCLUYENDO: el visor,
el spoiler, las rejillas de ventilación, los tornillos, cualquier pieza gris,
negra o blanca, y cualquier franja de acento de otro color.

Responde SOLO con JSON, sin texto alrededor:
{"rMin":0,"rMax":255,"gMin":0,"gMax":255,"bMin":0,"bMax":255}

Da un rango que cubra las variaciones de sombra/luz de la carcasa en ESTA
imagen, pero que NO incluya los colores de las piezas excluidas arriba.`;

async function rpDetectarRangoColor(imagenUrl, origen) {
  const respuesta = await FlowForgeModels.analizar(imagenUrl, RP_PROMPT_COLOR, { maxTokens: 300, origen });
  const r = batchExtraerJson(respuesta);
  ["rMin", "rMax", "gMin", "gMax", "bMin", "bMax"].forEach((campo) => {
    if (typeof r[campo] !== "number") throw new Error(`rango de color incompleto: falta ${campo}`);
  });
  return r;
}

const RP_PROMPT_LETRAS = `Mira esta imagen de un casco con un patrón aplicado. Si hay alguna palabra o
lettering legible en el patrón, transcríbelo letra por letra tal como se lee.
Si no hay ninguna palabra, dilo así — no inventes una si no la ves.

Responde SOLO con JSON, sin texto alrededor:
{"hayPalabras":true|false,"transcripcion":"texto exacto o vacío","legible":true|false}`;

async function rpVerificarLetras(imagenUrl, origen) {
  const respuesta = await FlowForgeModels.analizar(imagenUrl, RP_PROMPT_LETRAS, { maxTokens: 300, origen });
  return batchExtraerJson(respuesta);
}

function rpCargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("imagen no cargó"));
    img.src = src;
  });
}

// Máscara determinística: cada pixel que caiga en el rango declarado es
// pintable. El visor, el spoiler, las rejillas y los tornillos quedan fuera
// por aritmética, no por criterio de nadie — igual que apply_texture.py.
function rpConstruirMascara(canvas, rango) {
  const ctx = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  const px = ctx.getImageData(0, 0, w, h).data;
  const mascara = new Uint8Array(w * h);
  let minX = w, minY = h, maxX = -1, maxY = -1;
  let pintables = 0;

  for (let p = 0; p < w * h; p += 1) {
    const i = p * 4;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    if (r >= rango.rMin && r <= rango.rMax && g >= rango.gMin && g <= rango.gMax && b >= rango.bMin && b <= rango.bMax) {
      mascara[p] = 1;
      pintables += 1;
      const x = p % w, y = (p / w) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (!pintables) return null;
  return { mascara, w, h, pintables, caja: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } };
}

// GRANDE por defecto (Paso 0.7, punto 3): la escala mínima con la que una
// sola copia de la textura cubre la caja pintable más grande vista hasta
// ahora en este set. max() de los dos ejes: así la textura, a esa escala,
// es al menos tan grande como la caja en ambas dimensiones — una sola
// copia basta, sin mosaico.
function rpEscalaGrande(cajaPintable, texturaW, texturaH) {
  return Math.max(cajaPintable.w / texturaW, cajaPintable.h / texturaH);
}

// Pega la textura real a través de la máscara. Fuera de la máscara, el
// pixel se copia TAL CUAL del original — no hay verificación posterior
// posible de "la carcasa quedó intacta": es imposible que no lo esté, lo
// garantiza el mecanismo, no un careo después.
//
// Si la escala declarada (compartida por todo el set) deja la textura más
// chica que ESTA caja en particular, se repite en rejilla desde un origen
// común — nunca una copia suelta sin alinear (esto fue un fallo real).
function rpPegar(original, textura, mascaraInfo, escala, origen) {
  const c = document.createElement("canvas");
  c.width = original.naturalWidth;
  c.height = original.naturalHeight;
  const ctx = c.getContext("2d");
  ctx.drawImage(original, 0, 0);
  const originalDatos = ctx.getImageData(0, 0, c.width, c.height);

  const tw = Math.max(1, Math.round(textura.naturalWidth * escala));
  const th = Math.max(1, Math.round(textura.naturalHeight * escala));
  const mosaico = tw < mascaraInfo.caja.w || th < mascaraInfo.caja.h;

  const capa = document.createElement("canvas");
  capa.width = c.width;
  capa.height = c.height;
  const capaCtx = capa.getContext("2d");
  const ox = (((origen.x % tw) + tw) % tw) - tw;
  const oy = (((origen.y % th) + th) % th) - th;
  for (let y = oy; y < c.height; y += th) {
    for (let x = ox; x < c.width; x += tw) {
      capaCtx.drawImage(textura, x, y, tw, th);
    }
  }
  const capaDatos = capaCtx.getImageData(0, 0, c.width, c.height);

  const resultado = ctx.createImageData(c.width, c.height);
  const { mascara, w, h } = mascaraInfo;
  for (let p = 0; p < w * h; p += 1) {
    const i = p * 4;
    if (mascara[p]) {
      resultado.data[i] = capaDatos.data[i];
      resultado.data[i + 1] = capaDatos.data[i + 1];
      resultado.data[i + 2] = capaDatos.data[i + 2];
      resultado.data[i + 3] = 255;
    } else {
      resultado.data[i] = originalDatos.data[i];
      resultado.data[i + 1] = originalDatos.data[i + 1];
      resultado.data[i + 2] = originalDatos.data[i + 2];
      resultado.data[i + 3] = originalDatos.data[i + 3];
    }
  }
  ctx.putImageData(resultado, 0, 0);
  return { dataUrl: c.toDataURL("image/png"), mosaico };
}

// El careo de esta vía: carcasa intacta es un hecho de construcción (no una
// casilla que pueda fallar), letras es Qwen mirando el resultado, costura
// es una advertencia declarada si hubo mosaico — no un "no aplica" mudo.
function rpCarearResultado(mosaico, letras) {
  const casillas = [
    {
      ley: "carcasa intacta",
      falla: false,
      detalle: "garantizado por el mecanismo: fuera de la máscara se copió el original pixel a pixel"
    },
    {
      ley: "letras legibles",
      falla: letras.hayPalabras === true && letras.legible !== true,
      detalle: letras.hayPalabras ? `Qwen transcribió: "${letras.transcripcion || ""}"` : "Qwen no encontró palabras"
    }
  ];
  if (mosaico) {
    casillas.push({
      ley: "costura entre copias",
      falla: true,
      detalle: "la textura se repitió para cubrir la zona — revisar la unión a mano, esta vía no la verifica todavía"
    });
  }
  return { casillas, limpio: casillas.every((c) => !c.falla) };
}

function renderTextureBatchNode(element, taskNode, onChange) {
  const seleccion = new Set(taskNode.targets || []);
  const hasTexture = hasBinary(taskNode.textureData);

  element.classList.add("texture-batch-node");
  element.innerHTML = `
    <span>${taskNode.title}</span>

    <label class="drop-zone node-drop${hasTexture ? " has-file" : ""}" data-texture-drop>
      <input type="file" accept="image/png,image/jpeg" data-texture-file />
      <strong data-texture-name>${hasTexture ? taskNode.textureName : "Arrastra el fondo aquí"}</strong>
      <small>Una sola textura para todas las vistas marcadas.</small>
    </label>

    <a class="download-button" data-download-texture download hidden>Descargar textura</a>

    <small class="mode-hint">Marca las vistas que cubre este fondo. Cada marcada crea su nodo de entrega.</small>
    <div class="node-pieces" data-batch-targets></div>

    <div class="batch-header">
      <strong data-batch-count>0 entregadas · 0 careadas · 0 consumadas de 0</strong>
      <button type="button" class="command-copy-chip" data-copy-command="@multiimagen">@multiimagen ⧉</button>
    </div>

    <div class="batch-queue" data-batch-queue></div>
  `;

  const dropZone = element.querySelector("[data-texture-drop]");
  const fileInput = element.querySelector("[data-texture-file]");
  const textureName = element.querySelector("[data-texture-name]");
  const textureLink = element.querySelector("[data-download-texture]");
  const targetsHost = element.querySelector("[data-batch-targets]");
  const countLabel = element.querySelector("[data-batch-count]");
  const queueHost = element.querySelector("[data-batch-queue]");
  const commandChip = element.querySelector("[data-copy-command]");

  // Vistas candidatas: las del canvas con imagen, excluyendo los nodos de
  // entrega — un nodo de entrega nunca es insumo de otro.
  function vistasDelCanvas() {
    return (activeTask?.nodes || []).filter(
      (n) => n.kind === "view-photo" && !n.isResult && hasBinary(n.image)
    );
  }

  function idEntrega(vistaId) {
    return `entrega-${taskNode.id}-${vistaId}`;
  }

  function nodoEntrega(vistaId) {
    return activeTask.nodes.find((n) => n.id === idEntrega(vistaId));
  }

  // Marcar una vista crea su nodo de entrega, conectado vista → entrega.
  // El agente trabaja ahí: es un nodo de vista normal, con carga, arrastre
  // y Ctrl+V, así que cualquiera de las tres vías de un agente funciona.
  function asegurarEntrega(vista) {
    const id = idEntrega(vista.id);
    if (activeTask.nodes.some((n) => n.id === id)) return;
    const nodo = viewPhotoNode(
      id,
      `✔ ${vista.title} · terminada`,
      "Aquí entrega el agente la vista con el fondo aplicado.",
      vista.x + 420,
      vista.y,
      taskNode.id
    );
    nodo.isResult = true;
    nodo.estadoCareo = "pendiente"; // pendiente | entregada | careada | consumada
    activeTask.nodes.push(nodo);
    if (!activeTask.links.some(([a, b]) => a === vista.id && b === id)) {
      activeTask.links.push([vista.id, id]);
    }
  }

  // Desmarcar retira la entrega solo si sigue vacía: una entrega con imagen
  // es trabajo hecho, y el trabajo hecho no se borra por un clic.
  function retirarEntrega(vistaId) {
    const nodo = nodoEntrega(vistaId);
    if (nodo && !hasBinary(nodo.image)) {
      activeTask.nodes = activeTask.nodes.filter((n) => n.id !== nodo.id);
      activeTask.links = activeTask.links.filter(([a, b]) => a !== nodo.id && b !== nodo.id);
    }
  }

  function sincronizarEnlaces() {
    activeTask.links = activeTask.links.filter(
      ([a, b]) => !(a === taskNode.id && !seleccion.has(b))
    );
    seleccion.forEach((vistaId) => {
      if (!activeTask.nodes.some((n) => n.id === vistaId)) return;
      if (!activeTask.links.some(([a, b]) => a === taskNode.id && b === vistaId)) {
        activeTask.links.push([taskNode.id, vistaId]);
      }
    });
  }

  function publishTexture() {
    if (!hasBinary(taskNode.textureData)) return;
    textureLink.href = taskNode.textureData;
    textureLink.download = taskNode.textureName || "textura.png";
    textureLink.hidden = false;
  }

  function vistasMarcadas() {
    return vistasDelCanvas().filter((v) => seleccion.has(v.id));
  }

  // El estado vive en el nodo de entrega (campo estadoCareo), así que sobrevive
  // a recargas y viaja a la nube con el resto del canvas.
  function estadoDeVista(vistaId) {
    const entrega = nodoEntrega(vistaId);
    if (!entrega || !hasBinary(entrega.image)) return "pendiente";
    const guardado = entrega.estadoCareo;
    if (guardado === "careada" || guardado === "consumada") return guardado;
    return "entregada";
  }

  // Marcar a mano: el juicio lo pone una persona o un agente juez. Sin imagen
  // no hay nada que carear, así que se ignora.
  function fijarEstado(vistaId, estado) {
    if (!batchEstadoValido(estado)) return;
    const entrega = nodoEntrega(vistaId);
    if (!entrega || !hasBinary(entrega.image)) return;
    entrega.estadoCareo = estado === "pendiente" ? "entregada" : estado;
    onChange();
    pintarObjetivos();
    renderQueue();
    updateCount();
  }

  // ── El bucle: careo → edición → careo, hasta limpio o hasta la deuda ──
  //
  // Todo lo que el bucle aprende se escribe en el nodo de entrega antes de
  // seguir. Crear vistas re-renderiza el canvas: lo que viviera solo en el DOM
  // se perdería, y una deuda perdida es una deuda que se vuelve a gastar.
  function progreso(vistaId, texto) {
    const entrega = nodoEntrega(vistaId);
    if (entrega) {
      entrega.iterProgreso = texto;
      onChange();
    }
    const linea = queueHost.querySelector(`[data-iter-progreso="${vistaId}"]`);
    if (linea) linea.textContent = texto;
    const estado = queueHost.querySelector(`[data-batch-task="${vistaId}"] .batch-state`);
    if (estado) estado.textContent = texto;
  }

  function anotarVuelta(entrega, registro) {
    entrega.historialCareo = entrega.historialCareo || [];
    entrega.historialCareo.push({ ...registro, t: Date.now() });
    onChange();
  }

  function resumenCareo(careo) {
    if (careo.limpio) return "limpio";
    return careo.casillas
      .filter((c) => c.falla)
      .map((c) => `ley ${c.ley}: ${c.detalle || "falla"}`)
      .join(" · ");
  }

  async function iterarHastaLimpio(vista) {
    const entrega = nodoEntrega(vista.id);
    if (!entrega || !hasBinary(entrega.image)) return;
    if (BATCH_EN_CURSO.has(vista.id)) return;
    if (!hasBinary(taskNode.textureData)) {
      progreso(vista.id, "sin textura cargada: el bucle necesita la textura para las palabras");
      return;
    }

    BATCH_EN_CURSO.add(vista.id);
    entrega.deudaEdiciones = entrega.deudaEdiciones || 0;
    entrega.historialCareo = entrega.historialCareo || [];
    entrega.casillaAbierta = null;
    renderQueue();

    let actual = entrega.image;

    try {
      // (a) CLASIFICAR: ¿editamos lo entregado o regeneramos desde el original?
      if (batchGastoFrenado()) throw new Error("tope de gasto alcanzado: súbelo en el nodo de Gasto de API");
      progreso(vista.id, "clasificando · ¿es el mismo casco?");
      const juicio = await batchConReintento("la clasificación", () =>
        batchClasificar(vista.image, actual, taskNode.id)
      );
      anotarVuelta(entrega, {
        vuelta: 0,
        pedido: "clasificar contorno contra el original",
        careo: juicio.superpone ? "se superpone: se edita" : `no se superpone: se regenera (${juicio.motivo || ""})`
      });

      if (!juicio.superpone) {
        if (batchGastoFrenado()) throw new Error("tope de gasto alcanzado: súbelo en el nodo de Gasto de API");
        progreso(vista.id, "regenerando desde el original · el sujeto era otro casco");
        actual = await batchConReintento("la regeneración", () =>
          FlowForgeModels.generar(
            batchPromptText(vista.title, taskNode.textureName),
            [vista.image, taskNode.textureData],
            { conTexto: true }
          )
        );
        entrega.image = actual;
        entrega.estadoCareo = "entregada";
        onChange();
      }

      // (b/c/d) careo → un solo defecto → edición, mientras quede deuda.
      let vuelta = 0;
      let ejemplar = null;
      let ultimoCareo = null;

      while (true) {
        vuelta += 1;
        if (batchGastoFrenado()) throw new Error("tope de gasto alcanzado: súbelo en el nodo de Gasto de API");
        progreso(vista.id, `vuelta ${vuelta} · careando…`);
        const careo = await batchConReintento("el careo", () => batchCarear(actual, taskNode.id));
        ultimoCareo = careo;
        anotarVuelta(entrega, { vuelta, pedido: "careo contra las cuatro leyes", careo: resumenCareo(careo) });

        if (careo.limpio) {
          ejemplar = actual;
          break;
        }

        // (d) La quinta edición no existe.
        if (entrega.deudaEdiciones >= BATCH_TOPE_DEUDA) break;

        const defecto = batchPeorDefecto(careo);
        if (!defecto) {
          ejemplar = actual;
          break;
        }

        const zona = BATCH_ZONAS[defecto.ley] || "la zona señalada";
        if (batchGastoFrenado()) throw new Error("tope de gasto alcanzado: súbelo en el nodo de Gasto de API");
        progreso(vista.id, `vuelta ${vuelta} · editando ${zona}…`);
        const prompt = batchPromptEdicion(defecto);
        const editada = await batchConReintento("la edición", () =>
          FlowForgeModels.generar(prompt, [actual, taskNode.textureData], { conTexto: defecto.ley === 3 })
        );

        actual = editada;
        entrega.image = editada;
        entrega.deudaEdiciones += 1;
        entrega.estadoCareo = "entregada";
        anotarVuelta(entrega, { vuelta, pedido: prompt, careo: `edición aplicada (deuda ${entrega.deudaEdiciones}/${BATCH_TOPE_DEUDA})` });
        onChange();
      }

      if (!ejemplar) {
        // Deuda agotada con casillas abiertas: se declara, no se disimula.
        const abiertas = (ultimoCareo?.casillas || [])
          .filter((c) => c.falla)
          .map((c) => `ley ${c.ley} (${c.detalle || BATCH_LEYES.find((l) => l.n === c.ley).titulo})`)
          .join(" · ");
        entrega.casillaAbierta = abiertas || "careo sin veredicto";
        entrega.iterEstado = "detenido";
        progreso(
          vista.id,
          `detenido en la deuda ${entrega.deudaEdiciones}/${BATCH_TOPE_DEUDA} · casilla abierta: ${entrega.casillaAbierta}`
        );
        anotarVuelta(entrega, { vuelta, pedido: "detención por tope de deuda", careo: entrega.casillaAbierta });
        return;
      }

      // (e) CONSUMAR: el ejemplar asciende y la final se hace desde él, con el
      // original como base y la textura como fuente de las palabras.
      entrega.ejemplar = ejemplar;
      entrega.estadoCareo = "careada";
      onChange();

      if (batchGastoFrenado()) throw new Error("tope de gasto alcanzado: súbelo en el nodo de Gasto de API");
      progreso(vista.id, `vuelta ${vuelta} · consumando desde el ejemplar…`);
      const final = await batchConReintento("la consumación", () =>
        FlowForgeModels.generar(
          batchPromptConsumacion(vista.title),
          [vista.image, ejemplar, taskNode.textureData],
          { conTexto: true }
        )
      );

      entrega.image = final;
      entrega.estadoCareo = "consumada";
      entrega.iterEstado = "consumada";
      entrega.casillaAbierta = null;
      anotarVuelta(entrega, {
        vuelta,
        pedido: "consumación (original = geometría, ejemplar = diseño, textura = palabras)",
        careo: `careo limpio en la vuelta ${vuelta} con deuda ${entrega.deudaEdiciones}/${BATCH_TOPE_DEUDA}`
      });
      progreso(vista.id, `consumada · deuda usada ${entrega.deudaEdiciones}/${BATCH_TOPE_DEUDA}`);
    } catch (error) {
      // Un fallo declarado. Nunca un careo limpio inventado.
      const detalle = error?.message || String(error);
      entrega.iterEstado = "fallo";
      entrega.casillaAbierta = `fallo: ${detalle}`;
      anotarVuelta(entrega, { vuelta: entrega.historialCareo.length, pedido: "fallo del bucle", careo: detalle });
      progreso(vista.id, `fallo: ${detalle}`);
    } finally {
      BATCH_EN_CURSO.delete(vista.id);
      onChange();
      pintarObjetivos();
      renderQueue();
      updateCount();
      if (typeof renderCanvas === "function") renderCanvas();
    }
  }

  // ── Vía alternativa: recorte-pega automático, sin generar nada ──
  //
  // El rango de color y la escala se declaran UNA vez para todo el set (Paso
  // 0.7 / Ley 4-5 de la ley): la primera vista los fija, las demás los
  // reutilizan tal cual — nunca se recalculan por vista. taskNode.rpCajaMax
  // guarda el área de la caja pintable más grande vista hasta ahora, para
  // saber si la vista actual manda una escala mayor (GRANDE de verdad, no
  // solo la de la primera vista que se procesó).
  async function aplicarRecortePega(vista) {
    if (BATCH_EN_CURSO.has(vista.id)) return;
    if (!hasBinary(taskNode.textureData)) {
      progreso(vista.id, "sin textura cargada: hace falta para recortar y pegar");
      return;
    }
    asegurarEntrega(vista);
    const entrega = nodoEntrega(vista.id);

    BATCH_EN_CURSO.add(vista.id);
    renderQueue();

    try {
      if (batchGastoFrenado()) throw new Error("tope de gasto alcanzado: súbelo en el nodo de Gasto de API");
      progreso(vista.id, "recorte-pega · cargando imágenes…");
      const [original, textura] = await Promise.all([rpCargarImagen(vista.image), rpCargarImagen(taskNode.textureData)]);

      if (!taskNode.rpRango) {
        if (batchGastoFrenado()) throw new Error("tope de gasto alcanzado: súbelo en el nodo de Gasto de API");
        progreso(vista.id, "recorte-pega · Qwen identificando el rango de color de la carcasa…");
        taskNode.rpRango = await rpDetectarRangoColor(vista.image, taskNode.id);
        onChange();
      }

      const cOriginal = document.createElement("canvas");
      cOriginal.width = original.naturalWidth;
      cOriginal.height = original.naturalHeight;
      cOriginal.getContext("2d").drawImage(original, 0, 0);

      progreso(vista.id, "recorte-pega · construyendo máscara de color…");
      const mascaraInfo = rpConstruirMascara(cOriginal, taskNode.rpRango);
      if (!mascaraInfo) {
        throw new Error("ningún pixel de esta vista cayó en el rango de color declarado — revisa el rango o esta vista a mano");
      }

      const areaCaja = mascaraInfo.caja.w * mascaraInfo.caja.h;
      if (!taskNode.rpEscala || areaCaja > (taskNode.rpCajaMax || 0)) {
        taskNode.rpEscala = rpEscalaGrande(mascaraInfo.caja, textura.naturalWidth, textura.naturalHeight);
        taskNode.rpCajaMax = areaCaja;
        if (!taskNode.rpOrigen) taskNode.rpOrigen = { x: mascaraInfo.caja.x, y: mascaraInfo.caja.y };
        onChange();
      }

      progreso(vista.id, "recorte-pega · pegando textura real (sin generar)…");
      const { dataUrl, mosaico } = rpPegar(original, textura, mascaraInfo, taskNode.rpEscala, taskNode.rpOrigen);

      if (batchGastoFrenado()) throw new Error("tope de gasto alcanzado: súbelo en el nodo de Gasto de API");
      progreso(vista.id, "recorte-pega · Qwen verificando que las letras se lean…");
      const letras = await rpVerificarLetras(dataUrl, taskNode.id);

      const careo = rpCarearResultado(mosaico, letras);
      entrega.image = dataUrl;
      entrega.mecanismo = "recorte-pega";
      entrega.rpCareo = careo;
      entrega.estadoCareo = careo.limpio ? "careada" : "entregada";
      entrega.casillaAbierta = careo.limpio
        ? null
        : careo.casillas.filter((c) => c.falla).map((c) => `${c.ley}: ${c.detalle}`).join(" · ");
      anotarVuelta(entrega, {
        vuelta: 1,
        pedido: "recorte-pega automático (Paso 0.7) + careo",
        careo: careo.limpio ? "limpio" : entrega.casillaAbierta
      });
      progreso(
        vista.id,
        careo.limpio
          ? "recorte-pega · limpio, lista para marcar consumada"
          : `recorte-pega · revisar: ${entrega.casillaAbierta}`
      );
    } catch (error) {
      const detalle = error?.message || String(error);
      entrega.iterEstado = "fallo";
      entrega.casillaAbierta = `fallo: ${detalle}`;
      progreso(vista.id, `recorte-pega · fallo: ${detalle}`);
    } finally {
      BATCH_EN_CURSO.delete(vista.id);
      onChange();
      pintarObjetivos();
      renderQueue();
      updateCount();
      if (typeof renderCanvas === "function") renderCanvas();
    }
  }

  function updateCount() {
    const marcadas = vistasMarcadas();
    const conteo = { pendiente: 0, entregada: 0, careada: 0, consumada: 0 };
    marcadas.forEach((v) => {
      conteo[estadoDeVista(v.id)] += 1;
    });

    let texto =
      `${batchPlural(conteo.entregada, "entregada", "entregadas")} · ` +
      `${batchPlural(conteo.careada, "careada", "careadas")} · ` +
      `${batchPlural(conteo.consumada, "consumada", "consumadas")} de ${marcadas.length}`;
    if (conteo.pendiente > 0) {
      texto += ` · ${batchPlural(conteo.pendiente, "pendiente", "pendientes")}`;
    }
    countLabel.textContent = texto;
  }

  function pintarObjetivos() {
    targetsHost.innerHTML = "";
    const vistas = vistasDelCanvas();

    if (!vistas.length) {
      targetsHost.innerHTML = `<small class="pieces-summary">No hay vistas con imagen en este canvas. Sepáralas primero con el disparador.</small>`;
      return;
    }

    vistas.forEach((vista) => {
      const fila = document.createElement("label");
      fila.className = seleccion.has(vista.id) ? "piece-row is-accepted" : "piece-row";

      const casilla = document.createElement("input");
      casilla.type = "checkbox";
      casilla.checked = seleccion.has(vista.id);
      casilla.addEventListener("change", () => {
        if (casilla.checked) {
          seleccion.add(vista.id);
          asegurarEntrega(vista);
        } else {
          seleccion.delete(vista.id);
          retirarEntrega(vista.id);
        }
        taskNode.targets = [...seleccion];
        sincronizarEnlaces();
        onChange();
        renderCanvas();
      });

      const nombre = document.createElement("strong");
      nombre.textContent = vista.title;

      const estado = document.createElement("span");
      estado.className = "piece-confidence";
      estado.textContent = seleccion.has(vista.id) ? estadoDeVista(vista.id) : "";

      fila.append(casilla, nombre, estado);
      targetsHost.appendChild(fila);
    });
  }

  function renderQueue() {
    queueHost.innerHTML = "";

    vistasMarcadas().forEach((vista) => {
      const estado = estadoDeVista(vista.id);
      const entregada = estado !== "pendiente";
      const entrega = nodoEntrega(vista.id);
      const deuda = entrega?.deudaEdiciones || 0;
      const corriendo = BATCH_EN_CURSO.has(vista.id);
      const progresoTexto = corriendo || entrega?.iterProgreso ? entrega.iterProgreso || "iterando…" : "";
      const puedeIterar = entregada && hasBinary(taskNode.textureData) && !corriendo && estado !== "consumada";
      const puedeRecortar = hasBinary(taskNode.textureData) && !corriendo && estado !== "consumada";
      const historial = entrega?.historialCareo || [];

      const row = document.createElement("article");
      row.className = entregada ? "batch-task is-done" : "batch-task";
      row.dataset.batchTask = vista.id;
      row.dataset.batchEstado = estado;
      row.innerHTML = `
        <header>
          <strong>${vista.title}</strong>
          <span class="batch-state">${batchEscapar(progresoTexto || estado)}</span>
        </header>
        <div class="batch-task-actions">
          <a class="download-button" data-download-source="${vista.id}" href="${vista.image}" download="${vista.title}.png">Descargar vista</a>
          <button type="button" class="download-button" data-iterar="${vista.id}"${puedeIterar ? "" : " disabled"}>${corriendo ? "Iterando…" : "Iterar hasta limpio (genera)"}</button>
          <button type="button" class="download-button" data-recorte-pega="${vista.id}"${puedeRecortar ? "" : " disabled"}>${corriendo ? "Procesando…" : "Recorte-pega automático"}</button>
        </div>
        <small class="mode-hint" data-iter-progreso="${vista.id}">${batchEscapar(progresoTexto)}</small>
        <small class="piece-confidence">deuda ${deuda}/${BATCH_TOPE_DEUDA}${entrega?.casillaAbierta ? ` · casilla abierta: ${batchEscapar(entrega.casillaAbierta)}` : ""}${entrega?.mecanismo ? ` · mecanismo: ${batchEscapar(entrega.mecanismo)}` : ""}</small>
        <div class="batch-task-actions">
          <button type="button" class="download-button" data-set-estado="entregada" data-estado-vista="${vista.id}"${entregada && estado !== "entregada" ? "" : " disabled"}>entregada</button>
          <button type="button" class="download-button" data-set-estado="careada" data-estado-vista="${vista.id}"${entregada && estado !== "careada" ? "" : " disabled"}>careada</button>
          <button type="button" class="download-button" data-set-estado="consumada" data-estado-vista="${vista.id}"${entregada && estado !== "consumada" ? "" : " disabled"}>consumada</button>
        </div>
        <small class="mode-hint">${entregada ? "Marca a mano, o pulsa «Iterar hasta limpio»: el piloto clasifica, carea contra las cuatro leyes, edita un solo defecto por vuelta (tope 4) y consuma desde el ejemplar." : "Sin imagen en el nodo de entrega todavía; no hay nada que carear."}</small>
        <details>
          <summary>Prompt de esta vista</summary>
          <textarea readonly rows="7" data-task-prompt="${vista.id}">${batchPromptText(vista.title, taskNode.textureName)}</textarea>
          <button type="button" class="download-button" data-copy-task="${vista.id}">Copiar prompt</button>
        </details>
        ${historial.length
          ? `<details>
          <summary>Historial de vueltas (${historial.length})</summary>
          ${historial
            .map(
              (h) =>
                `<small class="mode-hint">vuelta ${batchEscapar(h.vuelta)} · pedido: ${batchEscapar(
                  String(h.pedido || "").slice(0, 300)
                )} · careo: ${batchEscapar(h.careo)}</small>`
            )
            .join("")}
        </details>`
          : ""}
      `;
      queueHost.appendChild(row);
    });

    queueHost.querySelectorAll("[data-iterar]").forEach((button) => {
      button.addEventListener("click", () => {
        const vista = vistasMarcadas().find((v) => v.id === button.dataset.iterar);
        if (vista) iterarHastaLimpio(vista);
      });
    });

    queueHost.querySelectorAll("[data-recorte-pega]").forEach((button) => {
      button.addEventListener("click", () => {
        const vista = vistasMarcadas().find((v) => v.id === button.dataset.recortePega);
        if (vista) aplicarRecortePega(vista);
      });
    });

    queueHost.querySelectorAll("[data-set-estado]").forEach((button) => {
      button.addEventListener("click", () => {
        fijarEstado(button.dataset.estadoVista, button.dataset.setEstado);
      });
    });

    queueHost.querySelectorAll("[data-copy-task]").forEach((button) => {
      button.addEventListener("click", async () => {
        const box = queueHost.querySelector(`[data-task-prompt="${button.dataset.copyTask}"]`);
        await navigator.clipboard.writeText(box.value);
        button.textContent = "Copiado";
        setTimeout(() => (button.textContent = "Copiar prompt"), 1400);
      });
    });
  }

  function readTexture(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      taskNode.textureData = reader.result;
      taskNode.textureName = file.name;
      textureName.textContent = file.name;
      dropZone.classList.add("has-file");
      publishTexture();
      renderQueue();
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

  commandChip.addEventListener("click", async () => {
    await navigator.clipboard.writeText("@multiimagen");
    commandChip.textContent = "Copiado ⧉";
    setTimeout(() => (commandChip.textContent = "@multiimagen ⧉"), 1400);
  });

  publishTexture();
  pintarObjetivos();
  renderQueue();
  updateCount();
}
