const projects = {
  "mobile-design": {
    title: "Mobile Design",
    pill: "Mobile Design · Visual Flow",
    summary: "Exploración mobile-first con tareas independientes; cada tarea carga su propio canvas.",
    accent: "#1e64ff",
    tasks: [
      {
        id: "brief-mobile",
        title: "Definir narrativa mobile",
        status: "In Progress",
        summary: "Convertir objetivo de campaña en historia visual corta.",
        nodes: [
          node("assets", "Assets", "Referencias internas, constraints de marca y archivos base.", 80, 96),
          node("story", "Story", "Concepto: interfaz mobile clara con escenas de descubrimiento, confianza y acción.", 380, 86, true),
          node("prompts", "Prompts", "Prompt base: generar rutas visuales originales para una experiencia mobile-first.", 700, 96, true),
          outputNode("outputs", "Outputs/Review", "Comparar tres direcciones mock antes de pedir nuevas variantes.", 850, 340)
        ],
        links: [
          ["assets", "story"],
          ["story", "prompts"],
          ["prompts", "outputs"]
        ]
      },
      {
        id: "motion-mobile",
        title: "Secuencia video corta",
        status: "New",
        summary: "Preparar subtareas para un video de 8 segundos.",
        nodes: [
          node("assets", "Assets", "Pantallas, fondos neutros y ritmo visual.", 120, 120),
          node("story", "Story", "Inicio: problema claro. Medio: transición visual. Cierre: CTA limpio.", 420, 110, true),
          node("prompts", "Prompts", "Prompt: storyboard en tres beats con movimiento suave y composición vertical.", 715, 120, true),
          outputNode("review", "Outputs/Review", "Placeholders para clips A/B/C y decisión de ritmo.", 780, 385)
        ],
        links: [
          ["assets", "story"],
          ["story", "prompts"],
          ["prompts", "review"]
        ]
      },
      {
        id: "review-mobile",
        title: "Revisión de outputs",
        status: "Review",
        summary: "Ordenar criterios humanos de aprobación.",
        nodes: [
          node("criteria", "Criterios", "Claridad, originalidad, lectura mobile y coherencia con la historia.", 110, 120),
          node("story", "Story", "Resumen editable de intención visual aprobable.", 390, 100, true),
          node("prompts", "Prompts", "Prompt de corrección: ajustar composición sin copiar referencias externas.", 690, 120, true),
          outputNode("review", "Outputs/Review", "Elegir versión candidata y anotar cambios pendientes.", 410, 390)
        ],
        links: [
          ["criteria", "story"],
          ["story", "prompts"],
          ["prompts", "review"]
        ]
      }
    ]
  },
  "validar-alcance": {
    title: "Validar alcance sin API",
    pill: "Alcance · Sin API",
    summary: "Proyecto para separar mocks, autorizaciones y límites antes de automatizar.",
    accent: "#b76511",
    tasks: [
      {
        id: "mapa-limites",
        title: "Mapa de vistas",
        status: "Visión",
        summary: "Separar las cuatro vistas del casco y declarar su estructura antes de aplicar un diseño.",
        nodes: [
          viewMapNode("vistas-casco", 70, 82),
          node("claves", "Elementos clave", "Identificar silueta, visor, spoiler, ventilaciones, tomas y uniones que definen cada vista.", 650, 82, true),
          node("invariables", "No pueden variar", "Mantener geometría, proporciones, densidad del visor, textura/material base y ubicación funcional de componentes.", 920, 235, true),
          node("variables", "Sí pueden variar", "Iluminación, color, patrón de fondo y accesorios, sin cubrir ni deformar la estructura original.", 650, 430, true),
          promptNode("prompt-vision", "Prompt de visión", "Analiza esta vista del casco. Describe sus elementos clave. Separa componentes estructurales invariables de atributos que pueden variar. Conserva exactamente silueta, proporciones, visor, spoiler y uniones. No propongas una imagen lifestyle, 3D ni fotorrealista: la salida debe mantener lenguaje vectorial tipo Illustrator.", 920, 510)
        ],
        links: [
          ["vistas-casco", "claves"],
          ["claves", "invariables"],
          ["claves", "variables"],
          ["invariables", "prompt-vision"],
          ["variables", "prompt-vision"]
        ]
      },
      {
        id: "historial-prompts",
        title: "Historial Markdown",
        status: "In Progress",
        summary: "Asegurar que los prompts importantes tengan trazabilidad local.",
        nodes: [
          node("assets", "Prompt recibido", "Solicitud original del usuario y contexto del proyecto.", 120, 110),
          node("story", "Resumen", "Arquitectura: proyecto → tarea/canvas → subtarea/nodo.", 420, 120, true),
          node("prompts", "Markdown", "Guardar avances bajo proyectos/flowforge-visual/.", 720, 115, true),
          node("review", "Control", "No editar bitácora general ni Dashboard CxC.", 500, 390)
        ],
        links: [
          ["assets", "story"],
          ["story", "prompts"],
          ["prompts", "review"]
        ]
      }
    ]
  },
  "spiderman": {
    title: "Proyecto Spiderman",
    pill: "Spiderman · Visual Flow",
    summary: "Exploración mobile-first para convertir la idea de Spiderman en una secuencia visual revisable.",
    accent: "#1e64ff",
    tasks: [
      {
        id: "spiderman-narrativa",
        title: "Definir narrativa Spiderman",
        status: "In Progress",
        summary: "Organizar componentes, historia y revisión dentro de un único canvas.",
        nodes: [
          referenceNode("pdf-model", "1. Modelo BOSTON 4.0", "Unidad estructural de referencia. De aquí se derivan cinco vistas, no cinco cascos.", "assets/boston-model-page-1.png", 70, 120),
          viewImageNode("frontal", "Vista estructural · Frontal", "Manifestación parcial del mismo casco. Mantener silueta, visor, mentonera y proporciones.", "assets/boston-frontal.png", 440, 55),
          viewImageNode("lateral-izq", "Vista estructural · Lateral izquierda", "Vista base para aplicar el diseño. No confundirla con una captura de detalle.", "assets/boston-izquierda.png", 440, 350),
          viewImageNode("lateral-der", "Vista estructural · Lateral derecha", "Mantener spoiler, visor, uniones y geometría funcional.", "assets/boston-derecha.png", 440, 645),
          viewImageNode("trasera", "Vista estructural · Trasera", "Conservar componentes posteriores, ventilaciones y proporción del casco.", "assets/boston-trasera.png", 440, 940),
          viewImageNode("superior", "Vista estructural · Superior", "Conservar superficie superior, curvatura y zonas de aplicación permitidas.", "assets/boston-superior.png", 440, 1235),
          node("detalles", "2. Capturas de detalle asociadas", "Líneas, uniones, visor, spoiler, textura y componentes. Son ampliaciones subordinadas a su vista de origen; no son vistas nuevas.", 820, 300, true),
          node("area", "3. Área rectangular de aplicación", "Seleccionar una vista y marcar un rectángulo: aquí entra el patrón, sin alterar estructura ni geometría.", 1130, 300, true),
          referenceNode("pdf-design", "4. Referencia de diseño · HALLOWEEN", "Patrón, color, tonalidad, títulos e imágenes: referencia de diseño, no estructura del casco.", "assets/halloween-design-page-1.png", 1130, 550),
          node("permitido", "5. Permitido / accidental", "Puede variar: escala local, posición puntual y accesorios autorizados. No puede variar: silueta, proporción, visor, spoiler, uniones ni patrón como sistema.", 1500, 300, true),
          promptNode("prompt-vision", "6. Prompt de análisis", "Analiza las cinco vistas estructurales del mismo casco. Relaciona cada captura de detalle con su vista de origen. Distingue: necesario (estructura), permitido (color, patrón, accesorios autorizados) y accidental (escala o ubicación puntual). Selecciona una vista y marca un área rectangular para aplicar el diseño vectorial sin deformar casco, visor, spoiler, uniones ni geometría.", 1500, 600),
          outputNode("outputs", "7. Resultado visual controlado", "Vista elegida + área rectangular + patrón + accesorios. Revisión antes de generar cualquier variante.", 1850, 420)
        ],
        links: [["pdf-model", "frontal"], ["pdf-model", "lateral-izq"], ["pdf-model", "lateral-der"], ["pdf-model", "trasera"], ["pdf-model", "superior"], ["lateral-izq", "detalles"], ["detalles", "area"], ["area", "pdf-design"], ["pdf-design", "permitido"], ["permitido", "prompt-vision"], ["prompt-vision", "outputs"]]
      },
      {
        id: "spiderman-componentes",
        title: "Componentes del proyecto",
        status: "Review",
        summary: "Verificar qué contiene cada módulo antes de generar nuevas variantes.",
        nodes: [
          node("assets", "Assets", "Imágenes, referencias internas, logos autorizados y restricciones de formato.", 70, 110),
          node("story", "Story", "Objetivo, audiencia, tono y secuencia narrativa aprobable.", 390, 100, true),
          node("prompts", "Prompts", "Instrucciones separadas para composición, imagen/video y variantes.", 710, 110, true),
          outputNode("outputs", "Outputs/Review", "Resultados A/B/C, criterios de evaluación y cambios pendientes.", 470, 390)
        ],
        links: [["assets", "story"], ["story", "prompts"], ["prompts", "outputs"]]
      }
    ]
  },
  "campana-lanzamiento": {
    title: "Campaña lanzamiento",
    pill: "Lanzamiento · Brief",
    summary: "Proyecto para convertir mensajes de lanzamiento en piezas visuales coordinadas.",
    accent: "#0f9f6e",
    tasks: [
      {
        id: "mensaje-central",
        title: "Mensaje central",
        status: "New",
        summary: "Traducir propuesta de valor en secuencia visual.",
        nodes: [
          node("assets", "Inputs", "Audiencia, oferta, tono y contexto de lanzamiento.", 90, 105),
          node("story", "Story", "Narrativa editable: promesa, prueba y acción.", 390, 110, true),
          node("prompts", "Prompts", "Prompt: crear escenas originales para anunciar un producto digital.", 700, 115, true),
          outputNode("review", "Outputs/Review", "Comparar direcciones de campaña sin usar marcas externas.", 830, 365)
        ],
        links: [
          ["assets", "story"],
          ["story", "prompts"],
          ["prompts", "review"]
        ]
      },
      {
        id: "piezas-sociales",
        title: "Piezas sociales",
        status: "Backlog",
        summary: "Diseñar variaciones para formatos vertical, square y banner.",
        nodes: [
          node("assets", "Formatos", "9:16, 1:1 y 16:9 como constraints de composición.", 110, 120),
          node("story", "Story", "Cada pieza mantiene la misma idea con diferente ritmo visual.", 400, 105, true),
          node("prompts", "Prompts", "Prompt: variantes por formato con composición nativa.", 710, 120, true),
          outputNode("review", "Outputs/Review", "Placeholder de piezas por formato.", 790, 380)
        ],
        links: [
          ["assets", "story"],
          ["story", "prompts"],
          ["prompts", "review"]
        ]
      }
    ]
  },
  "catalogo-experimental": {
    title: "Catálogo experimental",
    pill: "Catálogo · Lab",
    summary: "Banco de pruebas para estilos, prompts y outputs sin conexión real.",
    accent: "#7c3aed",
    tasks: [
      {
        id: "estilos-base",
        title: "Estilos base",
        status: "Experimental",
        summary: "Comparar familias visuales originales.",
        nodes: [
          node("assets", "Referencias internas", "Paletas propias, formas abstractas y reglas de no copia.", 100, 110),
          node("story", "Story", "El catálogo debe explicar por qué cada estilo existe.", 405, 100, true),
          node("prompts", "Prompts", "Prompt: generar descripciones de estilos visuales únicos.", 705, 125, true),
          outputNode("review", "Outputs/Review", "Casos A/B/C/D como placeholders visuales.", 820, 370, true)
        ],
        links: [
          ["assets", "story"],
          ["story", "prompts"],
          ["prompts", "review"]
        ]
      },
      {
        id: "matriz-prompts",
        title: "Matriz de prompts",
        status: "In Progress",
        summary: "Cruzar intención, formato y tono.",
        nodes: [
          node("assets", "Variables", "Formato, tono, audiencia y nivel de detalle.", 115, 120),
          node("story", "Story", "Cada combinación produce una hipótesis visual documentada.", 420, 105, true),
          node("prompts", "Prompts", "Prompt editable para matriz de exploraciones.", 720, 120, true),
          outputNode("review", "Outputs/Review", "Ranking manual de resultados simulados.", 500, 390)
        ],
        links: [
          ["assets", "story"],
          ["story", "prompts"],
          ["prompts", "review"]
        ]
      }
    ]
  }
};

function node(id, title, body, x, y, editable = false) {
  return { id, title, body, x, y, editable, kind: "text" };
}

function outputNode(id, title, body, x, y, extra = false) {
  return { id, title, body, x, y, editable: false, kind: "output", extra };
}

function referenceNode(id, title, body, image, x, y) {
  return { id, title, body, image, x, y, editable: false, kind: "reference" };
}

function viewImageNode(id, title, body, image, x, y) {
  return { id, title, body, image, x, y, editable: false, kind: "view-image" };
}

function viewMapNode(id, x, y) {
  return { id, title: "PNG de cuatro vistas", x, y, kind: "view-map" };
}

function promptNode(id, title, body, x, y) {
  return { id, title, body, x, y, editable: true, kind: "prompt" };
}

const stage = document.querySelector(".flow-stage");
const plane = document.querySelector("#canvas-plane");
const nodeLayer = document.querySelector("#node-layer");
const connectors = document.querySelector(".connectors");
const taskList = document.querySelector("#task-list");
const taskCount = document.querySelector("#task-count");
const projectTitle = document.querySelector("#project-title");
const projectSummary = document.querySelector("#project-summary");
const projectPill = document.querySelector("#project-pill");
const canvasTitle = document.querySelector("#canvas-title");
const canvasDescription = document.querySelector("#canvas-description");
const zoomInButton = document.querySelector("#zoom-in");
const zoomOutButton = document.querySelector("#zoom-out");
const zoomResetButton = document.querySelector("#zoom-reset");
const zoomLabel = document.querySelector("#zoom-label");
const canvasFilter = document.querySelector("#canvas-filter");
const canvasFilterWrap = document.querySelector("#canvas-filter-wrap");
const addNodeButton = document.querySelector("#add-node");
const addNodeMenu = document.querySelector("#add-node-menu");
const supabase = window.FlowForgeSupabase;
let saveTimer = null;

const params = new URLSearchParams(window.location.search);
const solicitado = params.get("project");

// Un proyecto creado desde el portafolio no está en este mapa: se le abre un
// hueco con una tarea vacía para que la carga remota lo rellene. Sin esto,
// cualquier proyecto nuevo caía en mobile-design.
if (solicitado && !projects[solicitado]) {
  projects[solicitado] = {
    title: solicitado,
    pill: solicitado,
    summary: "",
    accent: "blue",
    tasks: [{ id: `${solicitado}-inicio`, title: "Inicio", status: "En curso", summary: "", nodes: [], links: [] }]
  };
}

const projectKey = projects[solicitado] ? solicitado : "mobile-design";
const project = projects[projectKey];

let activeTask = project.tasks[0];
let activeNode = null;
let pointerOffset = { x: 0, y: 0 };
let zoom = 1;
let canvasViewMode = projectKey === "linkedin-prospeccion" ? "crm" : "all";

// Estos nombres se exponen para nodos interactivos que necesitan abrir ramas
// nuevas dentro del canvas sin duplicar el estado ni crear otro lienzo.
//
// nextNodeSpot NO se preasigna aquí a null: es una function declaration más
// abajo, y en un script clásico el nombre global y window.nextNodeSpot son la
// MISMA celda. Ponerla en null aquí no era un placeholder inofensivo — borraba
// la única referencia a la función real antes de que nadie la usara, y la
// reasignación de más abajo (window.nextNodeSpot = nextNodeSpot) terminaba
// reasignándose null a sí misma. Esto rompía CUALQUIER "+ Añadir nodo" en
// cualquier proyecto. La hoisting de la function declaration ya instala
// window.nextNodeSpot correctamente sin necesidad de tocarla aquí.
window.activeTask = activeTask;

function setProjectChrome() {
  document.title = `FlowForge Visual — ${project.title}`;
  projectTitle.textContent = project.title;
  projectSummary.textContent = project.summary;
  projectPill.textContent = project.pill;
  taskCount.textContent = project.tasks.length;
  document.documentElement.style.setProperty("--accent", project.accent);
  if (canvasFilterWrap) canvasFilterWrap.hidden = projectKey !== "linkedin-prospeccion";
  if (canvasFilter) canvasFilter.value = canvasViewMode;
}

function renderTasks() {
  taskList.innerHTML = "";

  project.tasks.forEach((task) => {
    const wrapper = document.createElement("article");
    wrapper.className = `task-item${task.id === activeTask.id ? " active expanded" : ""}`;

    const button = document.createElement("button");
    button.className = "task-main";
    button.type = "button";
    button.innerHTML = `
      <span>${task.status}</span>
      <div>
        <strong>${task.title}</strong>
        <small>${task.summary}</small>
      </div>
    `;

    button.addEventListener("click", () => {
      activeTask = task;
      renderTasks();
      renderCanvas();
    });

    const subtasks = document.createElement("ul");
    subtasks.className = "subtask-list";
    const listedNodes = projectKey === "linkedin-prospeccion" && canvasViewMode === "crm"
      ? task.nodes.filter((taskNode) => taskNode.kind === "linkedin-crm")
      : task.nodes;
    listedNodes.forEach((taskNode) => {
      const item = document.createElement("li");
      item.textContent = taskNode.title;
      subtasks.appendChild(item);
    });

    const acciones = document.createElement("div");
    acciones.className = "task-row-actions";
    acciones.style.display = "flex";
    acciones.style.gap = "4px";
    acciones.style.padding = "0 8px 8px";

    const renameButton = document.createElement("button");
    renameButton.type = "button";
    renameButton.className = "ghost-button";
    renameButton.textContent = "Renombrar";
    renameButton.style.padding = "6px 10px";
    renameButton.setAttribute("aria-label", `Renombrar tarea ${task.title}`);
    renameButton.addEventListener("click", (event) => {
      event.stopPropagation();
      renombrarTarea(task);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "ghost-button";
    deleteButton.textContent = "Borrar";
    deleteButton.style.padding = "6px 10px";
    deleteButton.setAttribute("aria-label", `Borrar tarea ${task.title}`);
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      borrarTarea(task);
    });

    acciones.appendChild(renameButton);
    acciones.appendChild(deleteButton);

    wrapper.appendChild(button);
    wrapper.appendChild(subtasks);
    wrapper.appendChild(acciones);
    taskList.appendChild(wrapper);
  });
}

// Renombrar y borrar tareas. Antes la lista solo dejaba crear: una tarea mal
// nombrada se quedaba así para siempre y las de prueba ensuciaban el proyecto.
async function renombrarTarea(task) {
  const titulo = window.prompt("Nuevo nombre de la tarea (canvas)", task.title);
  if (titulo === null) return;
  if (!titulo.trim()) {
    window.alert("El nombre no puede quedar vacío. No se cambió nada.");
    return;
  }
  if (titulo.trim() === task.title) return;

  task.title = titulo.trim();
  renderTasks();
  if (task.id === activeTask.id) canvasTitle.textContent = task.title;

  try {
    await supabase?.upsert(
      "flowforge_tasks",
      { id: task.id, project_id: projectKey, title: task.title, status: task.status || "En curso", summary: task.summary || "" },
      "id"
    );
    projectPill.textContent = `${project.pill} · tarea renombrada`;
  } catch (error) {
    projectPill.textContent = `${project.pill} · renombrada solo aquí · nube caída`;
  }
}

// Tareas que el usuario borró a mano. Varias tareas están escritas en este
// archivo, así que sin esta lista reaparecerían en la siguiente recarga.
const CLAVE_TAREAS_BORRADAS = `${projectKey}::tareas-borradas`;

async function tareasBorradas() {
  const guardado = await localStoreGet(CLAVE_TAREAS_BORRADAS);
  return Array.isArray(guardado?.ids) ? guardado.ids : [];
}

async function marcarTareaBorrada(taskId) {
  const ids = await tareasBorradas();
  if (!ids.includes(taskId)) ids.push(taskId);
  await localStorePut(CLAVE_TAREAS_BORRADAS, { ids, savedAt: Date.now() });
}

async function borrarTarea(task) {
  if (project.tasks.length <= 1) {
    window.alert("No se puede borrar la última tarea del proyecto: el proyecto se quedaría sin canvas.");
    return;
  }

  const cuantos = (task.nodes || []).length;
  const confirmado = window.confirm(
    `¿Borrar la tarea "${task.title}"?\n\n` +
      `Se elimina su canvas de la nube con ${cuantos} nodo(s) y ${(task.links || []).length} conexión(es).\n` +
      "El respaldo local NO se borra, pero desde la interfaz la tarea desaparece.\n\n" +
      "Esta acción no se deshace con el botón Deshacer."
  );
  if (!confirmado) return;

  const indice = project.tasks.indexOf(task);
  project.tasks = project.tasks.filter((item) => item !== task);
  await marcarTareaBorrada(task.id);

  if (activeTask.id === task.id) {
    activeTask = project.tasks[Math.max(0, indice - 1)] || project.tasks[0];
  }

  taskCount.textContent = project.tasks.length;
  renderTasks();
  renderCanvas();

  // Borrado remoto con el cliente que ya existe: primero el canvas, luego la
  // fila de la tarea, para no dejar canvas huérfanos apuntando a nada.
  try {
    if (supabase?.enabled) {
      const bajaCanvas = await supabase.request(`flowforge_canvases?task_id=eq.${encodeURIComponent(task.id)}`, { method: "DELETE" });
      const bajaTarea = await supabase.request(`flowforge_tasks?id=eq.${encodeURIComponent(task.id)}`, { method: "DELETE" });
      if (!bajaCanvas.ok || !bajaTarea.ok) {
        // La fila puede seguir en la nube si las políticas RLS no permiten
        // borrar. Se dice, no se finge: aquí ya no aparece porque queda
        // apuntada como borrada en el almacén local.
        projectPill.textContent = `${project.pill} · tarea oculta aquí · la nube rechazó el borrado`;
        return;
      }
    }
    projectPill.textContent = `${project.pill} · tarea borrada`;
  } catch (error) {
    projectPill.textContent = `${project.pill} · borrada aquí · nube caída`;
  }
}

// Crear una tarea es abrir un canvas nuevo dentro del proyecto: un espacio
// propio para planificar, probar prompts o documentar, sin ensuciar los demás.
function slugTarea(titulo) {
  return `${projectKey}-${String(titulo)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)}`;
}

async function crearTarea() {
  const titulo = window.prompt("Nombre de la nueva tarea (canvas)");
  if (!titulo || !titulo.trim()) return;

  const id = slugTarea(titulo);
  if (project.tasks.some((t) => t.id === id)) {
    window.alert("Ya existe una tarea con ese nombre en este proyecto.");
    return;
  }

  const tarea = {
    id,
    title: titulo.trim(),
    status: "En curso",
    summary: "",
    nodes: [],
    links: []
  };
  project.tasks.push(tarea);
  activeTask = tarea;
  renderTasks();
  renderCanvas();
  scheduleCanvasSave();

  // Persistir la tarea para que exista desde cualquier navegador. Si la nube
  // falla, la tarea vive localmente igual: se degrada, no se rompe.
  try {
    await supabase?.upsert(
      "flowforge_tasks",
      { id, project_id: projectKey, title: tarea.title, status: tarea.status, summary: "", sort_order: project.tasks.length },
      "id"
    );
  } catch (error) {
    projectPill.textContent = `${project.pill} · tarea local · nube caída`;
  }
}

document.querySelector("#new-task")?.addEventListener("click", crearTarea);

function renderCanvas() {
  window.activeTask = activeTask;
  // El dashboard de gasto existe en toda tarea, siempre: si no está, se crea.
  if (typeof asegurarDashboardGasto === "function") asegurarDashboardGasto(activeTask);
  canvasTitle.textContent = activeTask.title;
  canvasDescription.textContent = activeTask.summary;
  const soloCrm = projectKey === "linkedin-prospeccion" && canvasViewMode === "crm";
  const crmNode = activeTask.nodes.find((item) => item.kind === "linkedin-crm");
  const expandedRecordId = crmNode?.expandedRecordId;
  const expandedPrefix = expandedRecordId ? `${expandedRecordId}-` : "";
  const colaboracionCrm = soloCrm && expandedRecordId;
  const visibleNodes = soloCrm
    ? colaboracionCrm
    ? activeTask.nodes.filter((item) => item.kind === "linkedin-crm" || item.id?.startsWith(expandedPrefix))
      : activeTask.nodes.filter((item) => item.kind === "linkedin-crm")
    : activeTask.nodes;
  const visibleIds = new Set(visibleNodes.map((item) => item.id));
  const visibleLinks = activeTask.links.filter(([from, to]) => visibleIds.has(from) && visibleIds.has(to));
  if (colaboracionCrm && crmNode) {
    const perfil = visibleNodes.find((item) => item.id?.startsWith(expandedPrefix) && item.id.endsWith("-profile"));
    if (perfil && !visibleLinks.some(([from, to]) => from === crmNode.id && to === perfil.id)) visibleLinks.push([crmNode.id, perfil.id]);
  }
  const canvasWidth = soloCrm && !colaboracionCrm ? 1100 : Math.max(1200, ...visibleNodes.map((item) => item.x + 620));
  const canvasHeight = soloCrm && !colaboracionCrm ? 720 : Math.max(720, ...visibleNodes.map((item) => item.y + 430));
  plane.style.width = `${canvasWidth}px`;
  plane.style.height = `${canvasHeight}px`;
  connectors.style.width = `${canvasWidth}px`;
  connectors.style.height = `${canvasHeight}px`;
  nodeLayer.innerHTML = "";
  connectors.innerHTML = "";

  visibleLinks.forEach(([from, to]) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.dataset.from = from;
    path.dataset.to = to;
    connectors.appendChild(path);
  });

  visibleNodes.forEach((taskNode) => {
    const element = document.createElement("article");
    element.className = [
      "flow-node",
      taskNode.editable ? "editable-node" : "",
      taskNode.kind === "output" ? "wide-node review-node" : ""
    ]
      .filter(Boolean)
      .join(" ");
    element.dataset.node = taskNode.id;
    element.tabIndex = 0;
    element.setAttribute("aria-label", `${taskNode.title}: ${taskNode.body || "módulo visual"}`);
    element.style.left = `${soloCrm && !colaboracionCrm ? 80 : taskNode.x}px`;
    element.style.top = `${soloCrm && !colaboracionCrm ? 70 : taskNode.y}px`;
    element.style.setProperty("--node-color", project.accent);

    if (taskNode.kind === "pdf-split") {
      renderPdfSplitNode(element, taskNode, scheduleCanvasSave);
    } else if (taskNode.kind === "pdf-explorer") {
      renderExplorerNode(element, taskNode, scheduleCanvasSave);
    } else if (taskNode.kind === "cost-dashboard") {
      renderCostDashboardNode(element, taskNode, scheduleCanvasSave);
    } else if (taskNode.kind === "trigger") {
      renderTriggerNode(element, taskNode, scheduleCanvasSave);
    } else if (taskNode.kind === "view-photo") {
      renderViewPhotoNode(element, taskNode, scheduleCanvasSave, renderCanvas);
    } else if (taskNode.kind === "resources") {
      renderResourcesNode(element, taskNode, scheduleCanvasSave);
    } else if (taskNode.kind === "orchestrator") {
      renderOrchestratorNode(element, taskNode, scheduleCanvasSave);
    } else if (taskNode.kind === "texture-batch") {
      renderTextureBatchNode(element, taskNode, scheduleCanvasSave);
    } else if (taskNode.kind === "design-apply") {
      renderDesignNode(element, taskNode, scheduleCanvasSave);
    } else if (taskNode.kind === "linkedin-crm") {
      renderLinkedInCrmNode(element, taskNode);
    } else if (taskNode.kind === "view-map") {
      element.classList.add("view-map-node");
      element.innerHTML = `
        <span>${taskNode.title}</span>
        <p class="eyebrow">DEMO · no ejecuta nada real</p>
        <label class="upload-views-label">Cargar PNG <input type="file" accept="image/png,image/jpeg" data-view-upload /></label>
        <small class="view-map-hint">El archivo se representa como cuatro recortes locales. No se envía a ningún servicio.</small>
        <div class="helmet-views" data-helmet-views>
          ${["Frontal", "Izquierda", "Derecha", "Posterior"].map((label, index) => `<figure class="helmet-view"><div class="view-preview" data-view-index="${index}"><span>Vista</span></div><figcaption>${label}</figcaption></figure>`).join("")}
        </div>`;
      attachViewUpload(element);
    } else if (taskNode.kind === "plan-step") {
      element.classList.add("plan-neon-node");
      element.innerHTML = `
        <span>${taskNode.title}</span>
        <p contenteditable="true" spellcheck="false">${taskNode.body}</p>
      `;
    } else if (taskNode.kind === "prompt") {
      element.classList.add("prompt-node");
      element.innerHTML = `
        <span>${taskNode.title}</span>
        <details>
          <summary>Ver indicación para ChatGPT Visión</summary>
          <p contenteditable="true" spellcheck="false">${taskNode.body}</p>
        </details>`;
    } else if (taskNode.kind === "output") {
      element.innerHTML = `
        <span>${taskNode.title}</span>
        <p class="eyebrow">DEMO · no ejecuta nada real</p>
        <small>${taskNode.body}</small>
        <div class="output-grid">
          <div class="visual-placeholder sunrise">Case A</div>
          <div class="visual-placeholder mint">Case B</div>
          <div class="visual-placeholder violet">Case C</div>
          ${taskNode.extra ? '<div class="visual-placeholder amber">Case D</div>' : ""}
        </div>
      `;
    } else if (taskNode.kind === "reference" || taskNode.kind === "view-image") {
      element.classList.add("reference-node");
      element.innerHTML = `
        <span>${taskNode.title}</span>
        <img src="${taskNode.image}" alt="${taskNode.title}" />
        <small>${taskNode.body}</small>
        <a href="${taskNode.image}" download>Descargar captura PNG</a>
      `;
    } else {
      element.innerHTML = `
        <span>${taskNode.title}</span>
        <p ${taskNode.editable ? 'contenteditable="true" spellcheck="false"' : ""}>${taskNode.body}</p>
      `;
    }

    if (taskNode.w || taskNode.h) {
      element.classList.add("has-custom-size");
      if (taskNode.w) element.style.width = `${taskNode.w}px`;
      if (taskNode.h) element.style.height = `${taskNode.h}px`;
    }

    // El dashboard de gasto es fijo: se pinta y se arrastra como cualquier
    // nodo, pero no lleva botón de borrar.
    if (taskNode.kind !== "cost-dashboard") {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "node-delete";
      deleteButton.textContent = "×";
      deleteButton.title = "Eliminar nodo";
      deleteButton.setAttribute("aria-label", `Eliminar ${taskNode.title}`);
      deleteButton.addEventListener("click", (event) => {
        event.stopPropagation();
        removeNode(taskNode);
      });
      element.appendChild(deleteButton);
    }

    const resizeHandle = document.createElement("button");
    resizeHandle.type = "button";
    resizeHandle.className = "node-resize";
    resizeHandle.dataset.resize = "true";
    resizeHandle.setAttribute("aria-label", `Redimensionar ${taskNode.title}`);
    element.appendChild(resizeHandle);
    attachNodeResize(element, resizeHandle, taskNode);

    attachNodeDrag(element, taskNode);
    element.addEventListener("click", () => {
      nodeLayer.querySelectorAll(".is-focused").forEach((nodeElement) => nodeElement.classList.remove("is-focused"));
      element.classList.add("is-focused");
    });
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        element.click();
      }
    });
    attachEditableSync(element, taskNode);
    nodeLayer.appendChild(element);
  });

  updateConnectors();
}

window.renderCanvas = renderCanvas;

function attachViewUpload(element) {
  const input = element.querySelector("[data-view-upload]");
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    const source = URL.createObjectURL(file);
    element.querySelectorAll(".view-preview").forEach((preview, index) => {
      preview.style.setProperty("--view-image", `url('${source}')`);
      preview.classList.add("has-image");
      preview.dataset.viewIndex = index;
      preview.querySelector("span").textContent = "Recorte local";
    });
    element.querySelector(".view-map-hint").textContent = `${file.name}: cuatro vistas preparadas para el análisis visual.`;
  });
}

// ---------------------------------------------------------------------------
// Historial y deshacer
//
// Dos ventanas abiertas sobre el mismo canvas se pisaron y borraron nodos sin
// forma de recuperarlos. Ahora, ANTES de cada guardado, la versión anterior del
// canvas se apila en un historial de 5 versiones (en memoria y en el almacén
// local, para que sobreviva a una recarga).
// ---------------------------------------------------------------------------

const MAX_VERSIONES = 5;
const historialPorTarea = new Map();
let restaurandoVersion = false;
let avisoCanvas = null;

function claveHistorial(taskId) {
  return `${localCanvasKey(projectKey, taskId)}::historial`;
}

function mostrarAvisoCanvas(mensaje) {
  if (!avisoCanvas) {
    avisoCanvas = document.createElement("p");
    avisoCanvas.className = "eyebrow";
    avisoCanvas.id = "canvas-aviso";
    canvasDescription?.parentNode?.appendChild(avisoCanvas);
  }
  avisoCanvas.textContent = mensaje;
}

async function versionesDeTarea(taskId) {
  if (historialPorTarea.has(taskId)) return historialPorTarea.get(taskId);
  const guardado = await localStoreGet(claveHistorial(taskId));
  const versiones = Array.isArray(guardado?.versions) ? guardado.versions : [];
  historialPorTarea.set(taskId, versiones);
  return versiones;
}

async function guardarVersiones(taskId, versiones) {
  historialPorTarea.set(taskId, versiones);
  await localStorePut(claveHistorial(taskId), { versions: versiones, savedAt: Date.now() });
}

// Apila el estado anterior del canvas. Recibe el snapshot local previo cuando
// existe: es exactamente "lo que había antes de este guardado".
async function apilarVersion(taskId, previo) {
  if (restaurandoVersion) return;
  const nodes = previo?.nodes || activeTask.nodes;
  const links = previo?.links || activeTask.links;
  if (!Array.isArray(nodes)) return;

  const versiones = await versionesDeTarea(taskId);
  const version = {
    nodes: JSON.parse(JSON.stringify(nodes)),
    links: JSON.parse(JSON.stringify(links || [])),
    savedAt: previo?.savedAt || Date.now()
  };

  const ultima = versiones[versiones.length - 1];
  const igual =
    ultima &&
    JSON.stringify(ultima.nodes) === JSON.stringify(version.nodes) &&
    JSON.stringify(ultima.links) === JSON.stringify(version.links);
  if (igual) return;

  versiones.push(version);
  while (versiones.length > MAX_VERSIONES) versiones.shift();
  await guardarVersiones(taskId, versiones);
}

async function deshacerCanvas() {
  if (!activeTask) return;
  const versiones = await versionesDeTarea(activeTask.id);

  if (!versiones.length) {
    mostrarAvisoCanvas("No hay versiones anteriores guardadas de esta tarea: no se restauró nada.");
    return;
  }

  const version = versiones.pop();
  await guardarVersiones(activeTask.id, versiones);

  activeTask.nodes = version.nodes;
  activeTask.links = version.links;
  renderCanvas();
  renderTasks();

  const cuando = version.savedAt ? new Date(version.savedAt).toLocaleTimeString() : "sin hora";
  mostrarAvisoCanvas(
    `Versión restaurada (${cuando}) con ${activeTask.nodes.length} nodo(s). Quedan ${versiones.length} versión(es) en el historial.`
  );

  // El guardado posterior no debe apilar el estado que acabamos de descartar:
  // si lo hiciera, pulsar Deshacer dos veces devolvería al punto de partida.
  restaurandoVersion = true;
  try {
    await saveActiveCanvas();
  } finally {
    restaurandoVersion = false;
  }
}

// ---------------------------------------------------------------------------
// Aviso de versión más nueva en la nube
//
// Se guarda por tarea la huella y la marca de tiempo de la fila remota tal como
// se vio en esta pestaña. Si al guardar la fila remota es más nueva, es que otra
// ventana escribió: se pregunta antes de sobrescribir.
// ---------------------------------------------------------------------------

const remotoConocido = new Map();

function marcaRemota(fila) {
  if (!fila) return 0;
  const bruto = fila.updated_at || fila.modified_at || fila.inserted_at || fila.created_at;
  const parseado = bruto ? Date.parse(bruto) : 0;
  return Number.isFinite(parseado) ? parseado : 0;
}

// Sin columna de fecha, la huella (ids de nodos + conexiones) sirve igual para
// detectar que lo remoto ya no es lo que esta pestaña sincronizó.
function huellaRemota(fila) {
  if (!fila) return "";
  const ids = (fila.nodes || []).map((item) => item?.id);
  return JSON.stringify([ids, fila.links || []]);
}

function registrarRemotoConocido(taskId, fila) {
  remotoConocido.set(taskId, { marca: marcaRemota(fila), huella: huellaRemota(fila) });
}

async function puedeSobrescribirRemoto(task) {
  if (!supabase?.enabled) return true;

  let fila = null;
  try {
    const filas = await supabase.read(`flowforge_canvases?task_id=eq.${encodeURIComponent(task.id)}&select=*`);
    fila = Array.isArray(filas) ? filas[0] : null;
  } catch (error) {
    // Si no se puede leer, no se bloquea el guardado: el respaldo local ya está
    // hecho y negarse a guardar sería peor que guardar.
    return true;
  }

  if (!fila) return true;

  const conocido = remotoConocido.get(task.id);
  if (!conocido) {
    // Primera vez que esta pestaña ve la fila: se adopta como referencia.
    registrarRemotoConocido(task.id, fila);
    return true;
  }

  const marca = marcaRemota(fila);
  const huella = huellaRemota(fila);
  const masNuevaPorFecha = marca > 0 && conocido.marca > 0 && marca > conocido.marca;
  const cambiadaPorContenido = marca === 0 || conocido.marca === 0 ? huella !== conocido.huella : false;

  if (!masNuevaPorFecha && !cambiadaPorContenido) return true;

  const cuando = marca ? new Date(marca).toLocaleString() : "hace un momento";
  const seguir = window.confirm(
    `Hay cambios MÁS NUEVOS en la nube para "${task.title}".\n\n` +
      `Otra ventana o pestaña guardó este canvas (${cuando}) con ${(fila.nodes || []).length} nodo(s); ` +
      `aquí tienes ${task.nodes.length} nodo(s).\n\n` +
      "Aceptar = sobrescribir la versión de la nube con lo que ves en esta ventana.\n" +
      "Cancelar = no subir nada (tu trabajo queda guardado localmente y puedes recargar para ver lo de la otra ventana)."
  );

  if (seguir) registrarRemotoConocido(task.id, fila);
  else mostrarAvisoCanvas("Guardado local hecho. NO se subió: la nube tiene una versión más nueva de otra ventana.");

  return seguir;
}

function scheduleCanvasSave() {
  if (!supabase?.enabled || !activeTask) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveActiveCanvas, 550);
}

window.scheduleCanvasSave = scheduleCanvasSave;

async function saveActiveCanvas() {
  if (!supabase?.enabled || !activeTask) return;

  // Mientras los binarios suben, decirlo. La píldora que dice "guardado"
  // durante una subida en curso hace cerrar navegadores con trabajo a medias.
  projectPill.textContent = `${project.pill} · guardando…`;

  // Primero el respaldo local, siempre. Si la nube falla, el trabajo ya está a salvo.
  const key = localCanvasKey(projectKey, activeTask.id);
  const previo = await localStoreGet(key);

  // Antes de tocar nada, la versión anterior al historial: 5 versiones de
  // margen para recuperar nodos que otra ventana borró.
  await apilarVersion(activeTask.id, previo);

  await localStorePut(key, {
    nodes: activeTask.nodes,
    links: activeTask.links,
    zoom,
    savedAt: Date.now(),
    syncedAt: previo?.syncedAt || 0
  });

  if (!supabase?.enabled) {
    projectPill.textContent = `${project.pill} · guardado local`;
    return;
  }

  // Nunca se sobrescribe la nube a ciegas.
  const autorizado = await puedeSobrescribirRemoto(activeTask);
  if (!autorizado) {
    projectPill.textContent = `${project.pill} · guardado local · nube NO sobrescrita`;
    return;
  }

  try {
    const escrito = await supabase.upsert(
      "flowforge_canvases",
      {
        task_id: activeTask.id,
        // Los binarios suben a Storage y en la fila queda su referencia. Si la
        // subida falla, uploadBinariesDeep deja el marcador local de siempre.
        nodes: await uploadBinariesDeep(activeTask.nodes),
        links: activeTask.links,
        zoom
      },
      "task_id"
    );
    await localStoreMarkSynced(key);
    // Lo que acabamos de escribir pasa a ser "lo remoto conocido": si no, el
    // siguiente guardado creería que otra ventana cambió la fila.
    const filaEscrita = Array.isArray(escrito) ? escrito[0] : escrito;
    if (filaEscrita) registrarRemotoConocido(activeTask.id, filaEscrita);
    projectPill.textContent = `${project.pill} · Supabase guardado`;
  } catch (error) {
    projectPill.textContent = `${project.pill} · guardado local · nube caída`;
  }
}

// Cambios que nunca llegaron a subir tienen prioridad sobre lo remoto.
async function applyLocalCanvases() {
  for (const task of project.tasks) {
    const snapshot = await localStoreGet(localCanvasKey(projectKey, task.id));
    if (!snapshot) continue;

    if (snapshot.savedAt > (snapshot.syncedAt || 0)) {
      // Cambios que nunca subieron: lo local manda entero.
      task.nodes = snapshot.nodes;
      task.links = snapshot.links;
    } else {
      // Ya sincronizado: la estructura viene de la nube, los binarios de aquí.
      mergeLocalBinaries(task.nodes, snapshot.nodes);
    }
  }
}

async function loadRemoteProject() {
  if (!supabase?.enabled) return;

  // Solo este proyecto y solo sus canvas: traer la tabla entera era lo que
  // ahogaba la instancia, porque cada fila arrastraba sus binarios.
  const [remoteProjects, remoteTasks] = await Promise.all([
    supabase.read(`flowforge_projects?id=eq.${projectKey}&select=*`),
    supabase.read(`flowforge_tasks?project_id=eq.${projectKey}&select=*&order=sort_order.asc`)
  ]);

  const idsLocales = project.tasks.map((task) => task.id);
  const idsTareas = [...new Set([...idsLocales, ...remoteTasks.map((task) => task.id)])];
  const remoteCanvases = idsTareas.length
    ? await supabase.read(`flowforge_canvases?task_id=in.(${idsTareas.join(",")})&select=*`)
    : [];

  remoteProjects.forEach((remoteProject) => {
    const localProject = projects[remoteProject.id];
    if (!localProject) return;
    localProject.title = remoteProject.title;
    localProject.pill = remoteProject.pill;
    localProject.summary = remoteProject.summary;
    localProject.accent = remoteProject.accent;
  });

  const canvasesByTask = new Map(remoteCanvases.map((canvas) => [canvas.task_id, canvas]));

  // Punto de referencia de esta pestaña: contra esto se compara al guardar para
  // detectar que otra ventana escribió después.
  remoteCanvases.forEach((canvas) => registrarRemotoConocido(canvas.task_id, canvas));
  const localTasksById = new Map(project.tasks.map((task) => [task.id, task]));

  const remoteTasksById = new Map(remoteTasks.map((remoteTask) => [remoteTask.id, remoteTask]));

  const mergedTasks = project.tasks.map((localTask) => {
    const remoteTask = remoteTasksById.get(localTask.id);
    const remoteCanvas = canvasesByTask.get(localTask.id);
    return {
      ...localTask,
      title: remoteTask?.title ?? localTask.title,
      status: remoteTask?.status ?? localTask.status,
      summary: remoteTask?.summary ?? localTask.summary,
      nodes: remoteCanvas?.nodes || localTask.nodes || [],
      links: remoteCanvas?.links || localTask.links || []
    };
  });

  remoteTasks.forEach((remoteTask) => {
    if (localTasksById.has(remoteTask.id)) return;
    const remoteCanvas = canvasesByTask.get(remoteTask.id);
    mergedTasks.push({
      id: remoteTask.id,
      title: remoteTask.title,
      status: remoteTask.status,
      summary: remoteTask.summary,
      nodes: remoteCanvas?.nodes || [],
      links: remoteCanvas?.links || []
    });
  });

  project.tasks = mergedTasks;

  // Las referencias de Storage se convierten en URLs firmadas ANTES de pintar:
  // así cualquier navegador, incluido el de un agente, ve el archivo real.
  await Promise.all(project.tasks.map((task) => resolveStorageRefsDeep(task.nodes)));

  if (project.tasks.length > 0) {
    activeTask = project.tasks[0];
    projectPill.textContent = `${project.pill} · Supabase conectado`;
  }
}

function attachEditableSync(element, taskNode) {
  if (taskNode.kind === "pdf-split") return;
  const editable = element.querySelector("[contenteditable]");
  if (!editable) return;

  editable.addEventListener("input", () => {
    taskNode.body = editable.textContent.trim();
    scheduleCanvasSave();
  });
}

function attachNodeResize(element, handle, taskNode) {
  let origin = null;

  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    origin = {
      x: event.clientX,
      y: event.clientY,
      width: element.offsetWidth,
      height: element.offsetHeight
    };
    handle.setPointerCapture(event.pointerId);
    element.classList.add("resizing", "has-custom-size");
  });

  handle.addEventListener("pointermove", (event) => {
    if (!origin) return;
    taskNode.w = Math.round(Math.max(170, origin.width + (event.clientX - origin.x) / zoom));
    taskNode.h = Math.round(Math.max(110, origin.height + (event.clientY - origin.y) / zoom));
    element.style.width = `${taskNode.w}px`;
    element.style.height = `${taskNode.h}px`;
    updateConnectors();
  });

  const endResize = () => {
    if (!origin) return;
    origin = null;
    element.classList.remove("resizing");
    scheduleCanvasSave();
  };

  handle.addEventListener("pointerup", endResize);
  handle.addEventListener("pointercancel", endResize);
}

function attachNodeDrag(element, taskNode) {
  element.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, input, select, option, label, a, p, [contenteditable]")) return;
    activeNode = { element, taskNode };
    const rect = element.getBoundingClientRect();
    pointerOffset = {
      x: (event.clientX - rect.left) / zoom,
      y: (event.clientY - rect.top) / zoom
    };
    element.setPointerCapture(event.pointerId);
    element.classList.add("dragging");
  });

  element.addEventListener("pointermove", (event) => {
    if (!activeNode || activeNode.element !== element) return;
    const stageRect = stage.getBoundingClientRect();
    const scrollLeft = stage.scrollLeft;
    const scrollTop = stage.scrollTop;
    const nextLeft = (event.clientX - stageRect.left + scrollLeft) / zoom - pointerOffset.x;
    const nextTop = (event.clientY - stageRect.top + scrollTop) / zoom - pointerOffset.y;
    // The plane grows with the node: there is no invisible right/bottom wall.
    taskNode.x = Math.max(12, nextLeft);
    taskNode.y = Math.max(12, nextTop);
    const requiredWidth = taskNode.x + element.offsetWidth + 320;
    const requiredHeight = taskNode.y + element.offsetHeight + 320;
    if (requiredWidth > plane.offsetWidth) {
      plane.style.width = `${requiredWidth}px`;
      connectors.style.width = `${requiredWidth}px`;
    }
    if (requiredHeight > plane.offsetHeight) {
      plane.style.height = `${requiredHeight}px`;
      connectors.style.height = `${requiredHeight}px`;
    }
    element.style.left = `${taskNode.x}px`;
    element.style.top = `${taskNode.y}px`;
    updateConnectors();
  });

  element.addEventListener("pointerup", () => {
    element.classList.remove("dragging");
    activeNode = null;
    scheduleCanvasSave();
  });
}

function connectionPoint(fromElement, toElement) {
  const fromCenter = {
    x: fromElement.offsetLeft + fromElement.offsetWidth / 2,
    y: fromElement.offsetTop + fromElement.offsetHeight / 2
  };
  const toCenter = {
    x: toElement.offsetLeft + toElement.offsetWidth / 2,
    y: toElement.offsetTop + toElement.offsetHeight / 2
  };
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);

  return {
    from: horizontal
      ? { x: fromCenter.x + Math.sign(dx || 1) * fromElement.offsetWidth / 2, y: fromCenter.y }
      : { x: fromCenter.x, y: fromCenter.y + Math.sign(dy || 1) * fromElement.offsetHeight / 2 },
    to: horizontal
      ? { x: toCenter.x - Math.sign(dx || 1) * toElement.offsetWidth / 2, y: toCenter.y }
      : { x: toCenter.x, y: toCenter.y - Math.sign(dy || 1) * toElement.offsetHeight / 2 }
  };
}

function updateConnectors() {
  connectors.querySelectorAll("path").forEach((line) => {
    const from = nodeLayer.querySelector(`[data-node="${line.dataset.from}"]`);
    const to = nodeLayer.querySelector(`[data-node="${line.dataset.to}"]`);
    if (!from || !to) return;

    const { from: a, to: b } = connectionPoint(from, to);
    const distance = Math.max(70, Math.abs(b.x - a.x) * 0.42);
    line.setAttribute(
      "d",
      `M${a.x} ${a.y} C${a.x + distance} ${a.y}, ${b.x - distance} ${b.y}, ${b.x} ${b.y}`
    );
  });
}

// Crea un nodo por cada pieza aceptada y retira los de las descartadas.
// Es idempotente a proposito: un agente reintenta, y repetir esto no debe
// llenar el canvas de copias.
function syncViewNodes(pdfNode) {
  const pieces = pdfNode.pieces || [];
  const accepted = pieces.filter((piece) => piece.accepted);
  const wanted = new Map(accepted.map((piece, index) => [`vista-${pdfNode.id}-${index}`, piece]));

  activeTask.nodes = activeTask.nodes.filter((item) => {
    if (item.kind !== "view-photo" || item.source !== pdfNode.id) return true;
    return wanted.has(item.id);
  });

  let position = 0;
  wanted.forEach((piece, id) => {
    const existing = activeTask.nodes.find((item) => item.id === id);
    if (existing) {
      existing.title = piece.label;
      existing.body = piece.note;
    } else {
      activeTask.nodes.push(
        viewPhotoNode(id, piece.label, piece.note, pdfNode.x + 420, pdfNode.y + position * 300, pdfNode.id)
      );
    }
    position += 1;
  });

  const ids = new Set(activeTask.nodes.map((item) => item.id));
  activeTask.links = activeTask.links.filter(([from, to]) => ids.has(from) && ids.has(to));
  wanted.forEach((piece, id) => {
    if (!activeTask.links.some(([from, to]) => from === pdfNode.id && to === id)) {
      activeTask.links.push([pdfNode.id, id]);
    }
  });

  renderCanvas();
  renderTasks();
  scheduleCanvasSave();
}

function uniqueNodeId(prefix) {
  let index = 1;
  while (activeTask.nodes.some((item) => item.id === `${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

// Colocación en rejilla. Antes se devolvía la posición del último nodo + 60/+260,
// así que cada nodo nuevo caía en diagonal encima del anterior. Ahora se recorre
// una cuadrícula y se devuelve la PRIMERA celda libre: nada se pinta encima de
// nada. Se respetan los tamaños personalizados (w/h) de los nodos existentes.
const SPOT_ORIGIN = { x: 80, y: 100 };
const SPOT_STEP_X = 420;
const SPOT_STEP_Y = 520;
const SPOT_COLUMNS = 14;
const SPOT_ROWS = 60;
const SPOT_GAP = 24;

// Ancho/alto aproximado de un nodo cuando no tiene medidas propias. El ancho
// sale del CSS (.flow-node 238px, .wide-node 340px); el alto es una estimación
// generosa porque varios tipos de nodo crecen con su contenido.
function nodeFootprint(item) {
  const anchoBase = item.kind === "output" ? 340 : 260;
  const w = Number(item.w) > 0 ? Number(item.w) : anchoBase;
  const h = Number(item.h) > 0 ? Number(item.h) : 320;
  return { x: Number(item.x) || 0, y: Number(item.y) || 0, w, h };
}

function rectsOverlap(a, b, gap = SPOT_GAP) {
  return (
    a.x < b.x + b.w + gap &&
    a.x + a.w + gap > b.x &&
    a.y < b.y + b.h + gap &&
    a.y + a.h + gap > b.y
  );
}

function nextNodeSpot() {
  const nodes = (activeTask && activeTask.nodes) || [];
  if (!nodes.length) return { x: SPOT_ORIGIN.x, y: SPOT_ORIGIN.y };

  const ocupados = nodes.map(nodeFootprint);
  const candidato = { x: 0, y: 0, w: 260, h: 320 };

  for (let fila = 0; fila < SPOT_ROWS; fila += 1) {
    for (let columna = 0; columna < SPOT_COLUMNS; columna += 1) {
      candidato.x = SPOT_ORIGIN.x + columna * SPOT_STEP_X;
      candidato.y = SPOT_ORIGIN.y + fila * SPOT_STEP_Y;
      if (!ocupados.some((ocupado) => rectsOverlap(ocupado, candidato))) {
        return { x: candidato.x, y: candidato.y };
      }
    }
  }

  // Rejilla llena (caso improbable): debajo de todo, nunca encima.
  const fondo = Math.max(...ocupados.map((ocupado) => ocupado.y + ocupado.h));
  return { x: SPOT_ORIGIN.x, y: fondo + SPOT_GAP + 40 };
}

window.nextNodeSpot = nextNodeSpot;

function designApplyNode(id, x, y) {
  return { id, title: "Aplicar diseño", x, y, kind: "design-apply", view: "lateral-izquierda", hasResult: false };
}

function triggerNode(id, x, y) {
  return { id, title: "Disparador de separación", x, y, kind: "trigger", targets: [], estado: {} };
}

function pdfSplitNode(id, x, y) {
  return { id, title: "Separar PDF en piezas", x, y, kind: "pdf-split", mode: "vistas", model: "haiku", pieces: [] };
}

function linkedinCrmNode(id, x, y) {
  return {
    id,
    title: "CRM · Prospectos LinkedIn",
    body: "Registrar mensajes, servicio ofrecido, respuestas y próxima acción.",
    x,
    y,
    w: 440,
    h: 210,
    kind: "linkedin-crm",
    records: [],
    crmCount: 0
  };
}

function createNodeOfKind(kind) {
  const { x, y } = nextNodeSpot();

  if (kind === "pdf-split") return pdfSplitNode(uniqueNodeId("separacion"), x, y);
  if (kind === "trigger") return triggerNode(uniqueNodeId("disparador"), x, y);
  if (kind === "pdf-explorer") return explorerNode(uniqueNodeId("explorador"), x, y);
  if (kind === "plan-step")
    return { id: uniqueNodeId("plan"), title: "Paso del plan", body: "Escribe aquí la acción.", x, y, kind: "plan-step" };
  if (kind === "design-apply") return designApplyNode(uniqueNodeId("diseno"), x, y);
  if (kind === "texture-batch") return textureBatchNode(uniqueNodeId("fondo"), x, y);
  if (kind === "orchestrator") return orchestratorNode(uniqueNodeId("orquestador"), x, y);
  if (kind === "resources") return resourcesNode(uniqueNodeId("recursos"), x, y);
  if (kind === "prompt") return promptNode(uniqueNodeId("prompt"), "Prompt nuevo", "Escribe aquí la indicación.", x, y);
  if (kind === "view-map") return viewMapNode(uniqueNodeId("imagen"), x, y);
  if (kind === "output") return outputNode(uniqueNodeId("resultados"), "Outputs/Review", "Compara las variantes antes de aprobar.", x, y);
  if (kind === "linkedin-crm") return linkedinCrmNode(uniqueNodeId("linkedin-crm"), x, y);
  return node(uniqueNodeId("nodo"), "Nodo nuevo", "Describe aquí este paso.", x, y, true);
}

function addNodeOfKind(kind) {
  if (!activeTask) return;
  activeTask.nodes.push(createNodeOfKind(kind));
  renderCanvas();
  renderTasks();
  scheduleCanvasSave();
}

function removeNode(taskNode) {
  // El dashboard de gasto es fijo: el registro del dinero no se borra.
  if (taskNode.kind === "cost-dashboard") return;
  activeTask.nodes = activeTask.nodes.filter((item) => item !== taskNode);
  activeTask.links = activeTask.links.filter(([from, to]) => from !== taskNode.id && to !== taskNode.id);
  renderCanvas();
  renderTasks();
  scheduleCanvasSave();
}

function setAddMenuOpen(open) {
  addNodeMenu.hidden = !open;
  addNodeButton.setAttribute("aria-expanded", String(open));
}

addNodeButton.addEventListener("click", (event) => {
  event.stopPropagation();
  setAddMenuOpen(addNodeMenu.hidden);
});

addNodeMenu.querySelectorAll("[data-node-kind]").forEach((option) => {
  option.addEventListener("click", () => {
    addNodeOfKind(option.dataset.nodeKind);
    setAddMenuOpen(false);
  });
});

document.addEventListener("click", (event) => {
  if (!addNodeMenu.hidden && !event.target.closest(".add-node-wrap")) setAddMenuOpen(false);
});

// ---------------------------------------------------------------------------
// Buscador de nodos + botón Deshacer
//
// A 20-30% de zoom los nodos son ilegibles y encontrar uno concreto obligaba a
// arrastrar el lienzo a ciegas: dos veces se dieron por perdidos nodos que sí
// existían. El buscador filtra por título en TODAS las tareas del proyecto,
// cambia de tarea si hace falta, centra la vista en el nodo y lo resalta.
//
// Todo el control se crea desde JavaScript: el HTML no se toca.
// ---------------------------------------------------------------------------

const zoomControls = document.querySelector(".zoom-controls");
let searchInput = null;
let searchResults = null;

function setSearchOpen(open) {
  if (!searchResults) return;
  searchResults.hidden = !open;
}

// Centra la vista del canvas en un nodo ya pintado. El plano escala con
// transform-origin 0 0, así que la posición en pantalla es posición * zoom.
function centerOnNode(nodeId) {
  const element = nodeLayer.querySelector(`[data-node="${nodeId}"]`);
  if (!element) return false;

  const centroX = (element.offsetLeft + element.offsetWidth / 2) * zoom;
  const centroY = (element.offsetTop + element.offsetHeight / 2) * zoom;
  stage.scrollLeft = Math.max(0, centroX - stage.clientWidth / 2);
  stage.scrollTop = Math.max(0, centroY - stage.clientHeight / 2);

  nodeLayer.querySelectorAll(".is-focused").forEach((otro) => otro.classList.remove("is-focused"));
  element.classList.add("is-focused");
  element.focus?.({ preventScroll: true });
  window.setTimeout(() => element.classList.remove("is-focused"), 2800);
  return true;
}

function buscarNodos(texto) {
  const consulta = texto.trim().toLowerCase();
  if (!consulta) return [];

  const encontrados = [];
  project.tasks.forEach((task) => {
    (task.nodes || []).forEach((item) => {
      const titulo = String(item.title || item.id || "");
      if (titulo.toLowerCase().includes(consulta)) {
        encontrados.push({ task, item, titulo });
      }
    });
  });
  return encontrados.slice(0, 12);
}

function irANodo(resultado) {
  if (resultado.task.id !== activeTask.id) {
    activeTask = resultado.task;
    renderTasks();
    renderCanvas();
  }
  const centrado = centerOnNode(resultado.item.id);
  if (!centrado) {
    mostrarAvisoCanvas(`"${resultado.titulo}" existe en los datos de la tarea, pero no está pintado en el lienzo.`);
  } else {
    mostrarAvisoCanvas(`Vista centrada en "${resultado.titulo}" (tarea: ${resultado.task.title}).`);
  }
  setSearchOpen(false);
}

function pintarResultados(resultados) {
  searchResults.innerHTML = "";

  if (!resultados.length) {
    const vacio = document.createElement("button");
    vacio.type = "button";
    vacio.disabled = true;
    vacio.textContent = "Ningún nodo con ese título";
    searchResults.appendChild(vacio);
    setSearchOpen(true);
    return;
  }

  resultados.forEach((resultado) => {
    const opcion = document.createElement("button");
    opcion.type = "button";
    opcion.textContent =
      resultado.task.id === activeTask.id
        ? resultado.titulo
        : `${resultado.titulo} · ${resultado.task.title}`;
    opcion.addEventListener("click", () => irANodo(resultado));
    searchResults.appendChild(opcion);
  });
  setSearchOpen(true);
}

function crearBuscadorNodos() {
  if (!zoomControls) return;

  const wrap = document.createElement("div");
  wrap.className = "node-search-wrap";
  wrap.style.position = "relative";

  searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.id = "node-search";
  searchInput.className = "node-search-input";
  searchInput.placeholder = "Buscar nodo…";
  searchInput.setAttribute("aria-label", "Buscar nodo por título");
  // Estilo mínimo en línea: el CSS de este control todavía no existe y sin esto
  // el campo aparecería sin bordes ni tamaño usable.
  searchInput.style.padding = "9px 12px";
  searchInput.style.minWidth = "180px";
  searchInput.style.border = "1px solid rgba(20, 22, 28, 0.18)";
  searchInput.style.borderRadius = "999px";
  searchInput.style.font = "inherit";

  // Se reutiliza .add-node-menu: es el desplegable que ya existe en el CSS.
  searchResults = document.createElement("div");
  searchResults.className = "add-node-menu node-search-results";
  searchResults.hidden = true;
  searchResults.setAttribute("role", "listbox");
  searchResults.style.maxHeight = "320px";
  searchResults.style.overflowY = "auto";

  searchInput.addEventListener("input", () => {
    const texto = searchInput.value;
    if (!texto.trim()) {
      setSearchOpen(false);
      return;
    }
    pintarResultados(buscarNodos(texto));
  });

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setSearchOpen(false);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const resultados = buscarNodos(searchInput.value);
      if (resultados.length) irANodo(resultados[0]);
      else mostrarAvisoCanvas("Ningún nodo con ese título en este proyecto.");
    }
  });

  wrap.appendChild(searchInput);
  wrap.appendChild(searchResults);
  zoomControls.insertBefore(wrap, zoomControls.firstChild);

  document.addEventListener("click", (event) => {
    if (!searchResults.hidden && !event.target.closest(".node-search-wrap")) setSearchOpen(false);
  });
}

function crearBotonDeshacer() {
  if (!zoomControls) return;
  const boton = document.createElement("button");
  boton.type = "button";
  boton.id = "undo-canvas";
  boton.textContent = "Deshacer";
  boton.title = "Restaurar la versión anterior de este canvas";
  boton.addEventListener("click", () => {
    deshacerCanvas();
  });
  zoomControls.appendChild(boton);
}

crearBuscadorNodos();
crearBotonDeshacer();

function applyZoom(nextZoom) {
  zoom = Math.min(1.6, Math.max(0.2, nextZoom));
  plane.style.transform = `scale(${zoom})`;
  zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  updateConnectors();
  scheduleCanvasSave();
}

zoomInButton.addEventListener("click", () => applyZoom(zoom + 0.1));
zoomOutButton.addEventListener("click", () => applyZoom(zoom - 0.1));
zoomResetButton.addEventListener("click", () => applyZoom(1));
canvasFilter?.addEventListener("change", () => {
  canvasViewMode = canvasFilter.value;
  renderTasks();
  renderCanvas();
});
window.addEventListener("resize", updateConnectors);

async function boot() {
  let connectionLabel = `${project.pill} · Supabase conectado`;

  try {
    await loadRemoteProject();
  } catch (error) {
    connectionLabel = `${project.pill} · modo local`;
  }

  await applyLocalCanvases();

  // Las tareas borradas a mano no vuelven en la siguiente carga. Nunca se deja
  // el proyecto sin ninguna tarea: si el filtro las quitaría todas, no se aplica.
  const borradas = await tareasBorradas();
  if (borradas.length) {
    const quedan = project.tasks.filter((task) => !borradas.includes(task.id));
    if (quedan.length) project.tasks = quedan;
  }

  if (project.tasks.length > 0 && !project.tasks.includes(activeTask)) {
    activeTask = project.tasks[0];
  }

  setProjectChrome();
  projectPill.textContent = connectionLabel;
  renderTasks();
  renderCanvas();
  applyZoom(1);
}

boot();
