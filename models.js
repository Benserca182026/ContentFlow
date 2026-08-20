// Cliente de modelos. No conoce ninguna clave: habla con /api/model, que es
// quien la tiene. Separa a propósito las dos operaciones, porque son distintas:
// razonar sobre una imagen y crear una imagen no son la misma potencia.

const MODELOS = {
  // Ve el casco, razona sobre él, escribe la estrategia y el prompt.
  vision: "qwen/qwen3.7-flash",
  // Juez: modelo distinto del que ejecutó, para que nadie apruebe su obra.
  juez: "google/gemini-2.5-flash",
  // Genera. Pro solo donde hay texto o logo, que es donde los demás se rompen.
  imagen: "google/gemini-3.1-flash-image",
  imagenTexto: "google/gemini-3-pro-image"
};

// Semáforo compartido. Cada nodo trae su propio tope —cuatro el explorador,
// cuatro el disparador, cuatro el fondo— y si tres corren a la vez el proveedor
// vería doce peticiones simultáneas. Pero el límite verdadero no es de cada
// nodo: es del proveedor, uno solo para todos. Así que se cuenta aquí, que es
// el único punto por donde pasan todas.
const LIMITE_GLOBAL_LLAMADAS = 6;
let llamadasEnVuelo = 0;
const llamadasEsperando = [];

function tomarTurnoLlamada() {
  if (llamadasEnVuelo < LIMITE_GLOBAL_LLAMADAS) {
    llamadasEnVuelo += 1;
    return Promise.resolve();
  }
  return new Promise((seguir) => llamadasEsperando.push(seguir));
}

// El turno se cede al siguiente en la cola sin bajar el contador: la plaza no
// queda libre, cambia de ocupante. Solo cuando no hay nadie esperando se
// devuelve la plaza al pozo.
function soltarTurnoLlamada() {
  const siguiente = llamadasEsperando.shift();
  if (siguiente) siguiente();
  else llamadasEnVuelo = Math.max(0, llamadasEnVuelo - 1);
}

// Vercel rechaza cuerpos de más de 4.5 MB, y lo hace ANTES de llegar a
// nuestra función: devuelve texto plano, no JSON. Por eso las páginas más
// pesadas fallaban siempre con un error incomprensible, y se perdían en
// silencio 3 de cada 14 páginas de un catálogo.
//
// La imagen se encoge antes de viajar. Y esto no rompe nada aguas abajo
// precisamente porque las cajas van NORMALIZADAS de 0 a 1000: al ser
// proporciones y no píxeles, sobreviven a cualquier reescalado. Una
// decisión vieja pagando dividendos hoy.
const MAX_IMAGEN_ENVIO = 2600000;

function cargarImagenDataUrl(dataUrl) {
  return new Promise((ok, fallo) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fallo(new Error("la imagen no se pudo leer para encogerla"));
    img.src = dataUrl;
  });
}

async function encogerSiPesa(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:") || dataUrl.length <= MAX_IMAGEN_ENVIO) {
    return dataUrl;
  }
  const img = await cargarImagenDataUrl(dataUrl);
  let escala = Math.sqrt(MAX_IMAGEN_ENVIO / dataUrl.length);
  for (let intento = 0; intento < 5; intento += 1) {
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.max(1, Math.round(img.naturalWidth * escala));
    lienzo.height = Math.max(1, Math.round(img.naturalHeight * escala));
    lienzo.getContext("2d").drawImage(img, 0, 0, lienzo.width, lienzo.height);
    const salida = lienzo.toDataURL("image/jpeg", 0.85);
    if (salida.length <= MAX_IMAGEN_ENVIO) return salida;
    escala *= 0.8;
  }
  throw new Error("la imagen sigue siendo demasiado grande tras cinco reducciones");
}

const FlowForgeModels = {
  modelos: MODELOS,

  // Estado del semáforo, para que un nodo pueda mostrar si está esperando turno.
  enVuelo() {
    return { activas: llamadasEnVuelo, enCola: llamadasEsperando.length, limite: LIMITE_GLOBAL_LLAMADAS };
  },

  async llamar(model, messages, extra = {}, origen = null) {
    // El tope de gasto solo protege si alguien lo consulta antes de gastar.
    // Un freno que nadie pisa es adorno, no freno.
    if (typeof gastoApiBloqueado === "function" && gastoApiBloqueado()) {
      throw new Error("Tope de gasto alcanzado en esta tarea: súbelo en el nodo de Gasto de API para continuar.");
    }

    await tomarTurnoLlamada();
    let datos;
    try {
      const res = await fetch("/api/model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, ...extra })
      });
      // El cuerpo puede no ser JSON: cuando la plataforma rechaza la petición
      // antes de llegar a la función, devuelve texto plano. Leerlo como JSON
      // convertía un "cuerpo demasiado grande" en un críptico "Unexpected
      // token R". El error debe decir qué pasó, no dónde se rompió el parser.
      const crudo = await res.text();
      try {
        datos = JSON.parse(crudo);
      } catch (noEsJson) {
        const pista = res.status === 413 || /too large/i.test(crudo)
          ? "la petición pesaba demasiado para el servidor"
          : crudo.slice(0, 120);
        throw new Error(`Respuesta no válida (HTTP ${res.status}): ${pista}`);
      }
      if (!res.ok) throw new Error(datos?.error?.message || datos?.error || `HTTP ${res.status}`);
    } finally {
      // En finally a propósito: si la llamada revienta, la plaza se libera
      // igual. Un semáforo que solo se suelta al triunfar se atasca al primer
      // fallo y bloquea todo el sistema.
      soltarTurnoLlamada();
    }

    // Cada llamada declara su coste en el dashboard, atribuido a su nodo.
    if (typeof registrarGastoApi === "function" && datos?.usage?.cost) {
      registrarGastoApi(origen, datos.usage.cost, model);
    }
    return datos;
  },

  // Texto plano de la respuesta.
  texto(datos) {
    return datos?.choices?.[0]?.message?.content || "";
  },

  // Las imágenes generadas vuelven como data URL dentro del mensaje.
  imagenes(datos) {
    const mensaje = datos?.choices?.[0]?.message || {};
    const directas = (mensaje.images || []).map((i) => i?.image_url?.url || i?.url).filter(Boolean);
    if (directas.length) return directas;
    const contenido = Array.isArray(mensaje.content) ? mensaje.content : [];
    return contenido.map((p) => p?.image_url?.url).filter(Boolean);
  },

  // Analiza una imagen y devuelve la respuesta.
  //
  // `pensar` apagado por defecto: los híbridos de Qwen razonan hasta agotar el
  // presupuesto y devuelven la respuesta vacía. Se enciende solo donde el
  // razonamiento vale lo que cuesta, como el juicio de una entrega.
  async analizar(dataUrl, instruccion, { model = MODELOS.vision, pensar = false, maxTokens = 2000, origen = null } = {}) {
    const datos = await this.llamar(
      model,
      [
        {
          role: "user",
          content: [
            { type: "text", text: instruccion },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }
      ],
      { max_tokens: maxTokens, reasoning: { enabled: pensar } },
      origen
    );
    return this.texto(datos);
  },

  // Genera a partir de un prompt, con referencias opcionales.
  //
  // `origen` importa aquí más que en ninguna parte: generar es lo caro —mil
  // veces más que mirar— y sin el nodo de origen todo ese gasto aparecía en el
  // dashboard como "sin-nodo". Un registro que no dice quién gastó no permite
  // decidir dónde recortar.
  async generar(prompt, referencias = [], { conTexto = false, origen = null } = {}) {
    const model = conTexto ? MODELOS.imagenTexto : MODELOS.imagen;
    const contenido = [{ type: "text", text: prompt }];
    referencias.forEach((url) => contenido.push({ type: "image_url", image_url: { url } }));
    const datos = await this.llamar(
      model,
      [{ role: "user", content: contenido }],
      { modalities: ["image", "text"] },
      origen
    );
    const imagenes = this.imagenes(datos);
    if (!imagenes.length) throw new Error("El modelo no devolvió ninguna imagen");
    return imagenes[0];
  }
};

window.FlowForgeModels = FlowForgeModels;
