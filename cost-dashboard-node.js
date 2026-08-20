// Dashboard de gasto de API. Nodo fijo: no se puede eliminar, y si no existe
// en el canvas se crea solo. Cada llamada a Qwen/Gemini registra aquí su
// coste real (el que reporta OpenRouter), atribuido al nodo que la hizo.
// La justicia del sistema aplicada al dinero: cada gasto declarado, ninguno
// en silencio.

// Valores por defecto del freno: avisar a $1.00, cortar a $5.00 por tarea.
const GASTO_AVISO_DEFECTO = 1.0;
const GASTO_TOPE_DEFECTO = 5.0;

function costDashboardNode(x = 40, y = 40) {
  return {
    id: "gasto-api",
    title: "Gasto de API",
    x,
    y,
    kind: "cost-dashboard",
    gastos: [], // { n: nodoId, c: coste, m: modelo, t: timestamp }
    avisoUsd: GASTO_AVISO_DEFECTO,
    topeUsd: GASTO_TOPE_DEFECTO
  };
}

// Un dashboard antiguo, guardado antes de que existieran los frenos, no tiene
// umbrales. Se los ponemos: un tope ausente es un tope infinito, y eso miente.
function umbralesDeGasto(nodo) {
  const aviso = Number(nodo?.avisoUsd);
  const tope = Number(nodo?.topeUsd);
  return {
    aviso: Number.isFinite(aviso) && aviso > 0 ? aviso : GASTO_AVISO_DEFECTO,
    tope: Number.isFinite(tope) && tope > 0 ? tope : GASTO_TOPE_DEFECTO
  };
}

function totalDeGasto(nodo) {
  return (nodo?.gastos || []).reduce((s, g) => s + (g.c || 0), 0);
}

// Bandera pública que cualquier otro módulo puede consultar antes de gastar.
// El dashboard no bloquea por su cuenta: declara, y quien llama decide.
function actualizarBanderaGasto(nodo) {
  const { tope } = umbralesDeGasto(nodo);
  const bloqueado = totalDeGasto(nodo) >= tope;
  if (typeof window !== "undefined") window.FlowForgeGastoBloqueado = bloqueado;
  return bloqueado;
}

function gastoApiBloqueado() {
  if (typeof window !== "undefined" && typeof window.FlowForgeGastoBloqueado === "boolean") {
    return window.FlowForgeGastoBloqueado;
  }
  if (typeof activeTask === "undefined" || !activeTask) return false;
  const nodo = (activeTask.nodes || []).find((n) => n.kind === "cost-dashboard");
  return nodo ? actualizarBanderaGasto(nodo) : false;
}

// Garantiza que el dashboard exista en la tarea. Se llama al cargar y antes
// de registrar: un gasto sin libro donde anotarse se perdería.
function asegurarDashboardGasto(task) {
  if (!task) return null;
  let nodo = task.nodes.find((n) => n.kind === "cost-dashboard");
  if (!nodo) {
    nodo = costDashboardNode();
    task.nodes.unshift(nodo);
  }
  const { aviso, tope } = umbralesDeGasto(nodo);
  nodo.avisoUsd = aviso;
  nodo.topeUsd = tope;
  actualizarBanderaGasto(nodo);
  return nodo;
}

// Punto único de registro. Lo llama FlowForgeModels tras cada respuesta.
function registrarGastoApi(origen, coste, modelo) {
  if (typeof activeTask === "undefined" || !activeTask || !coste) return;
  const dashboard = asegurarDashboardGasto(activeTask);
  dashboard.gastos.push({ n: origen || "sin-nodo", c: coste, m: modelo, t: Date.now() });

  // Se registra siempre —ningún gasto en silencio— y después se declara si el
  // tope quedó rebasado, para que quien vaya a gastar lo consulte.
  actualizarBanderaGasto(dashboard);

  const element = document.querySelector('[data-node="gasto-api"]');
  if (element) renderCostDashboardNode(element, dashboard, () => {});
  if (typeof scheduleCanvasSave === "function") scheduleCanvasSave();
}

function formatoUsd(v) {
  if (v >= 0.01) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(5)}`;
}

function tituloDeNodo(id) {
  const nodo = (activeTask?.nodes || []).find((n) => n.id === id);
  return nodo ? nodo.title : id;
}

function renderCostDashboardNode(element, taskNode, onChange) {
  const gastos = taskNode.gastos || [];
  const total = gastos.reduce((s, g) => s + (g.c || 0), 0);

  const porNodo = new Map();
  const porModelo = new Map();
  gastos.forEach((g) => {
    porNodo.set(g.n, (porNodo.get(g.n) || 0) + g.c);
    porModelo.set(g.m, (porModelo.get(g.m) || 0) + g.c);
  });

  const filasNodo = [...porNodo.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, v]) => `<div class="cost-row"><span>${tituloDeNodo(id)}</span><strong>${formatoUsd(v)}</strong></div>`)
    .join("");

  const filasModelo = [...porModelo.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([m, v]) => `<div class="cost-row cost-row-model"><span>${String(m).split("/").pop()}</span><strong>${formatoUsd(v)}</strong></div>`)
    .join("");

  const { aviso, tope } = umbralesDeGasto(taskNode);
  const bloqueado = total >= tope;
  const avisando = !bloqueado && total >= aviso;

  const linea = bloqueado
    ? `<div class="cost-row"><strong>TOPE ALCANZADO</strong></div>
       <div class="cost-empty">El gasto de esta tarea llegó al tope de ${formatoUsd(tope)}. No se lanzan más llamadas hasta que subas el tope.</div>`
    : avisando
      ? `<div class="cost-row"><strong>AVISO DE GASTO</strong></div>
         <div class="cost-empty">Pasaste el umbral de aviso de ${formatoUsd(aviso)}. Quedan ${formatoUsd(Math.max(tope - total, 0))} antes del tope.</div>`
      : `<div class="cost-empty">Aviso en ${formatoUsd(aviso)} · tope en ${formatoUsd(tope)}.</div>`;

  element.classList.add("cost-dashboard-node");
  element.innerHTML = `
    <span>${taskNode.title}</span>
    <div class="cost-total">
      <strong>${formatoUsd(total)}</strong>
      <small>${gastos.length} llamadas · esta tarea${bloqueado ? " · TOPE ALCANZADO" : avisando ? " · aviso" : ""}</small>
    </div>
    <div class="cost-section">
      <small>Freno de gasto</small>
      ${linea}
      <div class="cost-row">
        <span>Aviso (USD)</span>
        <input type="number" min="0" step="0.25" value="${aviso}" data-gasto-aviso size="5" />
      </div>
      <div class="cost-row">
        <span>Tope (USD)</span>
        <input type="number" min="0" step="0.25" value="${tope}" data-gasto-tope size="5" />
      </div>
    </div>
    <div class="cost-section">
      <small>Por nodo</small>
      ${filasNodo || '<div class="cost-empty">Sin gasto todavía.</div>'}
    </div>
    <div class="cost-section">
      <small>Por modelo</small>
      ${filasModelo || '<div class="cost-empty">—</div>'}
    </div>
  `;

  function guardar() {
    if (typeof onChange === "function") onChange();
    if (typeof scheduleCanvasSave === "function") scheduleCanvasSave();
  }

  function campo(selector, clave, defecto) {
    const input = element.querySelector(selector);
    if (!input) return;
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("pointerdown", (event) => event.stopPropagation());
    input.addEventListener("change", () => {
      const valor = Number(input.value);
      taskNode[clave] = Number.isFinite(valor) && valor > 0 ? valor : defecto;
      actualizarBanderaGasto(taskNode);
      guardar();
      renderCostDashboardNode(element, taskNode, onChange);
    });
  }

  campo("[data-gasto-aviso]", "avisoUsd", GASTO_AVISO_DEFECTO);
  campo("[data-gasto-tope]", "topeUsd", GASTO_TOPE_DEFECTO);

  actualizarBanderaGasto(taskNode);
}
