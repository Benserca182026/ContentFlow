// Los binarios (PDF, texturas, capturas, artefactos) viven en Supabase Storage,
// no dentro de la fila del canvas. En la fila queda solo la referencia, que no
// pesa: la fila sigue en kilobytes y el archivo pasa a ser común a todos los
// navegadores, que es lo que un agente necesita para poder trabajar.
//
// El archivo se nombra por el hash de su contenido, no por el nodo que lo
// cargó. Así el mismo archivo subido cinco veces es un solo objeto, dos nodos
// pueden compartirlo sin conflicto, y borrar un nodo no destruye el archivo
// del otro.

const STORAGE_BUCKET = "flowforge";
const STORAGE_PREFIX = "storage:";
const SIGNED_TTL = 60 * 60 * 8; // ocho horas: una tarea larga de agente cabe entera

const EXTENSIONES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf"
};

function esReferenciaStorage(valor) {
  return typeof valor === "string" && valor.startsWith(STORAGE_PREFIX);
}

function rutaDeReferencia(valor) {
  return valor.slice(STORAGE_PREFIX.length);
}

function dataUrlABytes(dataUrl) {
  const coma = dataUrl.indexOf(",");
  const cabecera = dataUrl.slice(5, coma);
  const mime = cabecera.split(";")[0] || "application/octet-stream";
  const binario = atob(dataUrl.slice(coma + 1));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return { bytes, mime };
}

async function hashDeBytes(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const FlowForgeStorage = {
  get enabled() {
    return Boolean(window.FlowForgeSupabase?.enabled && window.crypto?.subtle);
  },

  base() {
    return `${window.FlowForgeSupabase.url}/storage/v1`;
  },

  auth() {
    const key = window.FlowForgeSupabase.headers.apikey;
    return { apikey: key, Authorization: `Bearer ${key}` };
  },

  // Cache de URLs firmadas dentro de la sesión: firmar cuesta una llamada y la
  // misma textura aparece en muchos nodos.
  firmadas: new Map(),

  async existe(ruta) {
    const res = await fetch(`${this.base()}/object/info/${STORAGE_BUCKET}/${ruta}`, {
      method: "GET",
      headers: this.auth()
    });
    return res.ok;
  },

  // Sube el data URL y devuelve su referencia estable. Si algo falla devuelve
  // null: quien llama decide, y nunca se pierde la copia local.
  async subir(dataUrl) {
    if (!this.enabled || typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return null;
    try {
      const { bytes, mime } = dataUrlABytes(dataUrl);
      const hash = await hashDeBytes(bytes);
      const ruta = `sha256/${hash}.${EXTENSIONES[mime] || "bin"}`;

      // Mismo contenido, mismo objeto: si ya está, no se vuelve a subir.
      if (!(await this.existe(ruta))) {
        const res = await fetch(`${this.base()}/object/${STORAGE_BUCKET}/${ruta}`, {
          method: "POST",
          headers: { ...this.auth(), "Content-Type": mime, "x-upsert": "true" },
          body: new Blob([bytes], { type: mime })
        });
        // 409 es colisión con una subida simultánea del mismo contenido: es el
        // mismo archivo, así que no es un error.
        if (!res.ok && res.status !== 409) return null;
      }
      return `${STORAGE_PREFIX}${ruta}`;
    } catch (error) {
      return null;
    }
  },

  async firmar(ruta) {
    if (this.firmadas.has(ruta)) return this.firmadas.get(ruta);
    try {
      const res = await fetch(`${this.base()}/object/sign/${STORAGE_BUCKET}/${ruta}`, {
        method: "POST",
        headers: { ...this.auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: SIGNED_TTL })
      });
      if (!res.ok) return null;
      const { signedURL } = await res.json();
      const url = `${this.base()}${signedURL.replace("/storage/v1", "")}`;
      this.firmadas.set(ruta, url);
      return url;
    } catch (error) {
      return null;
    }
  }
};

// Recorre la estructura subiendo cada binario y dejando su referencia. Lo que
// no se pueda subir queda como marcador local: se degrada, no se rompe.
// Una URL firmada NUNCA debe guardarse: caduca a las horas y deja la fila
// apuntando a un token muerto. Al guardar se convierte de vuelta en su
// referencia permanente.
function refDeUrlFirmada(valor) {
  const marca = "/storage/v1/object/sign/" + STORAGE_BUCKET + "/";
  const i = valor.indexOf(marca);
  if (i === -1) return null;
  const ruta = valor.slice(i + marca.length).split("?")[0];
  return STORAGE_PREFIX + decodeURIComponent(ruta);
}

async function uploadBinariesDeep(valor) {
  if (typeof valor === "string") {
    const ref = refDeUrlFirmada(valor);
    if (ref) return ref;
    if (!valor.startsWith("data:")) return valor;
    return (await FlowForgeStorage.subir(valor)) || CLOUD_PLACEHOLDER;
  }
  if (Array.isArray(valor)) {
    const salida = [];
    for (const item of valor) salida.push(await uploadBinariesDeep(item));
    return salida;
  }
  if (valor && typeof valor === "object") {
    const copia = {};
    for (const clave of Object.keys(valor)) copia[clave] = await uploadBinariesDeep(valor[clave]);
    return copia;
  }
  return valor;
}

// Convierte las referencias que llegaron de la nube en URLs firmadas, para que
// los nodos las pinten como cualquier imagen. Lo que no se pueda firmar se
// deja como marcador y el nodo muestra su hueco.
async function resolveStorageRefsDeep(valor) {
  if (typeof valor === "string") {
    if (!esReferenciaStorage(valor)) return valor;
    return (await FlowForgeStorage.firmar(rutaDeReferencia(valor))) || CLOUD_PLACEHOLDER;
  }
  if (Array.isArray(valor)) {
    const salida = [];
    for (const item of valor) salida.push(await resolveStorageRefsDeep(item));
    return salida;
  }
  if (valor && typeof valor === "object") {
    for (const clave of Object.keys(valor)) valor[clave] = await resolveStorageRefsDeep(valor[clave]);
    return valor;
  }
  return valor;
}

window.FlowForgeStorage = FlowForgeStorage;
