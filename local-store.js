// Respaldo local del canvas. Guarda cada tarea en el navegador ANTES de
// intentar Supabase, para que el trabajo sobreviva aunque la nube esté caída.
//
// Regla de precedencia al cargar: si lo local es más nuevo que la última
// sincronización confirmada, lo local manda — son cambios que nunca llegaron
// a subir. Si ya se sincronizó, manda lo remoto.

const LOCAL_DB = "flowforge-local";
const LOCAL_STORE = "canvases";

function openLocalStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(LOCAL_STORE)) {
        request.result.createObjectStore(LOCAL_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function localStoreGet(key) {
  try {
    const db = await openLocalStore();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(LOCAL_STORE, "readonly");
      const request = tx.objectStore(LOCAL_STORE).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    return null;
  }
}

async function localStorePut(key, value) {
  try {
    const db = await openLocalStore();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(LOCAL_STORE, "readwrite");
      tx.objectStore(LOCAL_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    return false;
  }
}

async function localStoreMarkSynced(key) {
  const snapshot = await localStoreGet(key);
  if (!snapshot) return;
  snapshot.syncedAt = snapshot.savedAt;
  await localStorePut(key, snapshot);
}

function localCanvasKey(projectId, taskId) {
  return `${projectId}::${taskId}`;
}

// Los binarios (PDF, texturas, capturas, artefactos) NO van a la base: como
// data URL pesan megabytes por fila y agotan la instancia. En la nube viaja
// solo la estructura; los binarios se quedan en el navegador.

const CLOUD_PLACEHOLDER = "__local__";

// Un binario que viene de la nube llega como marcador, no como imagen. Hay que
// tratarlo como ausente: pintarlo daría una imagen rota en otro navegador.
// Una referencia sin firmar tampoco es pintable: se trata como ausente hasta
// que resolveStorageRefsDeep la convierta en URL.
function hasBinary(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value !== CLOUD_PLACEHOLDER &&
    !value.startsWith("storage:")
  );
}

function stripBinaries(value) {
  if (typeof value === "string") return value.startsWith("data:") ? CLOUD_PLACEHOLDER : value;
  if (Array.isArray(value)) return value.map(stripBinaries);
  if (value && typeof value === "object") {
    const copia = {};
    Object.keys(value).forEach((clave) => {
      copia[clave] = stripBinaries(value[clave]);
    });
    return copia;
  }
  return value;
}

function restoreBinariesDeep(destino, origen) {
  if (!destino || !origen || typeof destino !== "object" || typeof origen !== "object") return;
  Object.keys(destino).forEach((clave) => {
    const actual = destino[clave];
    const local = origen[clave];
    if (actual === CLOUD_PLACEHOLDER && typeof local === "string") destino[clave] = local;
    else if (actual && local && typeof actual === "object") restoreBinariesDeep(actual, local);
  });
}

// Devuelve los binarios reales a una estructura que vino de la nube.
function mergeLocalBinaries(nodosRemotos, nodosLocales) {
  const porId = new Map((nodosLocales || []).map((nodo) => [nodo.id, nodo]));
  (nodosRemotos || []).forEach((nodo) => {
    const local = porId.get(nodo.id);
    if (local) restoreBinariesDeep(nodo, local);
  });
}
