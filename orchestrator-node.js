// Orquestador. Arranca con las vistas YA separadas en el canvas y coordina
// desde ahí. No genera ni juzga: sostiene el orden, el estado y las
// dependencias. Los criterios de cada etapa viven en su declaración, y el
// juicio lo emite quien apruebe — nunca el mismo acto que produjo.

// Etapas globales: se hacen una vez para todo el casco.
const ETAPAS_GLOBALES = [
  {
    id: "extraccion",
    label: "Extracción de elementos",
    criterio: "Vector, colores originales exactos, identidad absoluta con la fuente. Nada reinterpretado."
  },
  {
    id: "eleccion",
    label: "Elección por consonancia",
    criterio: "Describir primero la paleta del casco. Elegir por contraste contra ella, nombrando los colores."
  }
];

// Etapas por vista: secuencia dentro de cada vista, paralelo entre vistas.
const ETAPAS_VISTA = [
  {
    id: "fondo",
    label: "Fondo",
    criterio: "Patrón fiel, geometría intacta, sombreado conservado. Se aplica e integra en un solo acto.",
    requiereGlobal: []
  },
  {
    id: "colocacion",
    label: "Colocación",
    criterio: "Elementos pegados encima, SIN integrar. Proporción debida al papel: el que manda debe imponerse.",
    requiereGlobal: ["eleccion"]
  },
  {
    id: "integracion",
    label: "Integración",
    criterio: "Conformar a la curvatura y la luz. Nada cambia de sitio ni de tamaño."
  }
];

const ESTADO_ETIQUETA = {
  bloqueada: "Bloqueada",
  disponible: "Disponible",
  reservada: "En proceso",
  entregada: "Esperando juicio",
  validada: "Validada",
  devuelta: "Devuelta"
};

function orchestratorNode(id, x, y) {
  return {
    id,
    title: "Orquestador",
    x,
    y,
    kind: "orchestrator",
    concurrency: 3,
    tasks: {}
  };
}

function orchestratorViews() {
  return (activeTask?.nodes || [])
    .filter((item) => item.kind === "view-photo" && hasBinary(item.image))
    .map((item) => ({ id: item.id, label: item.title, image: item.image }));
}

function renderOrchestratorNode(element, taskNode, onChange) {
  const views = orchestratorViews();
  taskNode.tasks = taskNode.tasks || {};

  function task(scope, etapa) {
    const key = `${scope}|${etapa}`;
    if (!taskNode.tasks[key]) {
      taskNode.tasks[key] = { estado: "pendiente", intento: 0, artefacto: null, motivo: null };
    }
    return taskNode.tasks[key];
  }

  function esValidada(scope, etapa) {
    return task(scope, etapa).estado === "validada";
  }

  // Una etapa se desbloquea cuando su precedente en la misma vista está
  // validada, y cuando las etapas globales de las que depende lo están.
  function estadoEfectivo(scope, etapas, index) {
    const actual = task(scope, etapas[index].id);
    if (["reservada", "entregada", "validada", "devuelta"].includes(actual.estado)) return actual.estado;

    const previa = index === 0 || esValidada(scope, etapas[index - 1].id);
    const globales = (etapas[index].requiereGlobal || []).every((id) => esValidada("global", id));

    return previa && globales ? "disponible" : "bloqueada";
  }

  // El insumo de una etapa es el artefacto validado de la anterior, jamás el original.
  function insumoDe(view, etapas, index) {
    if (index === 0) return { href: view.image, name: `${view.id}-base.png` };
    const previa = task(view.id, etapas[index - 1].id);
    return hasBinary(previa.artefacto)
      ? { href: previa.artefacto, name: `${view.id}-${etapas[index - 1].id}.png` }
      : null;
  }

  function conjuntoDesbloqueado() {
    return views.length > 0 && views.every((view) => esValidada(view.id, "integracion"));
  }

  function contarPorEstado(estado) {
    return Object.values(taskNode.tasks).filter((item) => item.estado === estado).length;
  }

  function taskControls(scope, etapaId, estado, insumo) {
    const key = `${scope}|${etapaId}`;
    const registro = task(scope, etapaId);
    const wrap = document.createElement("div");
    wrap.className = "orch-actions";

    if (insumo && ["disponible", "reservada", "devuelta"].includes(estado)) {
      const link = document.createElement("a");
      link.className = "download-button";
      link.href = insumo.href;
      link.download = insumo.name;
      link.dataset.downloadInput = key;
      link.textContent = "Insumo";
      wrap.appendChild(link);
    }

    if (estado === "disponible" || estado === "devuelta") {
      const claim = document.createElement("button");
      claim.type = "button";
      claim.className = "download-button";
      claim.dataset.claim = key;
      claim.textContent = "Reservar";
      claim.addEventListener("click", () => {
        if (contarPorEstado("reservada") >= taskNode.concurrency) {
          registro.motivo = `Límite de concurrencia (${taskNode.concurrency}) alcanzado.`;
          render();
          return;
        }
        registro.estado = "reservada";
        registro.intento += 1;
        registro.motivo = null;
        render();
        onChange();
      });
      wrap.appendChild(claim);
    }

    if (estado === "reservada") {
      const label = document.createElement("label");
      label.className = "download-button batch-deliver";
      label.textContent = "Entregar";
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg";
      input.dataset.deliver = key;
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file || !file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = () => {
          registro.artefacto = reader.result;
          registro.estado = "entregada";
          render();
          onChange();
        };
        reader.readAsDataURL(file);
      });
      label.appendChild(input);
      wrap.appendChild(label);
    }

    if (estado === "entregada") {
      const approve = document.createElement("button");
      approve.type = "button";
      approve.className = "download-button orch-approve";
      approve.dataset.approve = key;
      approve.textContent = "Validar";
      approve.addEventListener("click", () => {
        registro.estado = "validada";
        registro.motivo = null;
        render();
        onChange();
      });

      const reject = document.createElement("button");
      reject.type = "button";
      reject.className = "download-button orch-reject";
      reject.dataset.reject = key;
      reject.textContent = "Devolver";
      reject.addEventListener("click", () => {
        registro.estado = "devuelta";
        registro.motivo = "Devuelta para corrección.";
        render();
        onChange();
      });

      wrap.append(approve, reject);
    }

    if (estado === "validada" && hasBinary(registro.artefacto)) {
      const link = document.createElement("a");
      link.className = "download-button";
      link.href = registro.artefacto;
      link.download = `${scope}-${etapaId}.png`;
      link.dataset.downloadArtifact = key;
      link.textContent = "Artefacto";
      wrap.appendChild(link);
    }

    return wrap;
  }

  function taskRow(scope, etapa, estado, insumo) {
    const key = `${scope}|${etapa.id}`;
    const registro = task(scope, etapa.id);

    const row = document.createElement("article");
    row.className = `orch-task is-${estado}`;
    row.dataset.task = key;
    row.dataset.taskState = estado;
    if (estado === "disponible") row.dataset.available = "true";

    const header = document.createElement("header");
    header.innerHTML = `<strong>${etapa.label}</strong><span class="orch-state">${ESTADO_ETIQUETA[estado] || estado}${registro.intento ? ` · intento ${registro.intento}` : ""}</span>`;
    row.appendChild(header);

    const criterio = document.createElement("small");
    criterio.className = "orch-criterio";
    criterio.dataset.criterio = key;
    criterio.textContent = etapa.criterio;
    row.appendChild(criterio);

    if (registro.motivo) {
      const motivo = document.createElement("small");
      motivo.className = "orch-motivo";
      motivo.textContent = registro.motivo;
      row.appendChild(motivo);
    }

    row.appendChild(taskControls(scope, etapa.id, estado, insumo));
    return row;
  }

  function render() {
    element.classList.add("orchestrator-node");
    element.innerHTML = `<span>${taskNode.title}</span>`;

    // Este nodo no hace ninguna llamada a modelo: reparte, ordena y registra
    // estados que una persona mueve a mano. Que se lea así y no como un motor.
    const demoAviso = document.createElement("span");
    demoAviso.className = "demo-badge";
    demoAviso.dataset.demoOrchestrator = "true";
    demoAviso.textContent = "Tablero manual · no ejecuta agentes por sí mismo";
    element.appendChild(demoAviso);

    if (views.length === 0) {
      const aviso = document.createElement("p");
      aviso.className = "orch-empty";
      aviso.textContent =
        "No hay vistas separadas todavía. Ejecuta @separarpdf primero: el orquestador arranca donde termina esa skill.";
      element.appendChild(aviso);
      return;
    }

    const resumen = document.createElement("div");
    resumen.className = "orch-summary";
    resumen.dataset.orchSummary = "true";
    resumen.innerHTML = `
      <strong>${views.length} vistas · ${contarPorEstado("validada")} validadas</strong>
      <label class="orch-concurrency">
        Concurrencia
        <input type="number" min="1" max="12" value="${taskNode.concurrency}" data-concurrency />
      </label>`;
    resumen.querySelector("[data-concurrency]").addEventListener("change", (event) => {
      taskNode.concurrency = Math.max(1, Number(event.target.value) || 1);
      onChange();
    });
    element.appendChild(resumen);

    const globalGroup = document.createElement("section");
    globalGroup.className = "orch-group";
    globalGroup.dataset.orchScope = "global";
    globalGroup.innerHTML = "<h3>Etapas globales</h3>";
    ETAPAS_GLOBALES.forEach((etapa, index) => {
      const estado = estadoEfectivo("global", ETAPAS_GLOBALES, index);
      globalGroup.appendChild(taskRow("global", etapa, estado, null));
    });
    element.appendChild(globalGroup);

    views.forEach((view) => {
      const group = document.createElement("section");
      group.className = "orch-group";
      group.dataset.orchScope = view.id;
      group.innerHTML = `<h3>${view.label}</h3>`;
      ETAPAS_VISTA.forEach((etapa, index) => {
        const estado = estadoEfectivo(view.id, ETAPAS_VISTA, index);
        group.appendChild(taskRow(view.id, etapa, estado, insumoDe(view, ETAPAS_VISTA, index)));
      });
      element.appendChild(group);
    });

    const cierre = document.createElement("section");
    cierre.className = "orch-group";
    cierre.dataset.orchScope = "conjunto";
    cierre.innerHTML = "<h3>Cierre</h3>";
    const etapaConjunto = {
      id: "conjunto",
      label: "Validación del conjunto",
      criterio:
        "Las vistas se juzgan juntas: la escala del patrón debe ser idéntica en todas. Ninguna vista por separado puede juzgar esto."
    };
    const registroConjunto = task("conjunto", "conjunto");
    const estadoConjunto = ["reservada", "entregada", "validada", "devuelta"].includes(registroConjunto.estado)
      ? registroConjunto.estado
      : conjuntoDesbloqueado()
        ? "disponible"
        : "bloqueada";
    cierre.appendChild(taskRow("conjunto", etapaConjunto, estadoConjunto, null));
    element.appendChild(cierre);
  }

  render();
}
