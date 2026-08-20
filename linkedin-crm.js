const crmSupabase = window.FlowForgeSupabase;
const crmParams = new URLSearchParams(window.location.search);
const crmTaskId = crmParams.get("task") || "linkedin-prospeccion-inicio";
const crmNodeId = crmParams.get("node") || "linkedin-crm";
const crmGrid = document.querySelector("#crm-grid");
const crmSummary = document.querySelector("#crm-summary");
const crmStatus = document.querySelector("#crm-status");
const crmSearch = document.querySelector("#crm-search");
const crmFilter = document.querySelector("#crm-filter");
let crmCanvas = null;
let crmNode = null;
let crmRecords = [];

const ESTADOS = ["Pendiente", "Comentado", "Conectado", "Conversación", "Propuesta", "Ganado", "Pausado"];

function esc(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function slug(value) {
  return String(value || "prospecto").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 44) || `prospecto-${Date.now()}`;
}

function urlFromNode(node) { return node?.urls?.[0]?.href || ""; }

function seedRecords(nodes) {
  const profiles = nodes.filter((node) => node.id?.endsWith("-profile"));
  return profiles.map((profile) => {
    const prefix = profile.id.slice(0, -"-profile".length);
    const related = nodes.filter((node) => node.id?.startsWith(`${prefix}-`));
    const posts = related.filter((node) => node.id.includes("post") || node.id.includes("public"));
    const privateNode = related.find((node) => node.id.endsWith("-private"));
    const fitNode = related.find((node) => node.id.endsWith("-fit"));
    const published = related.find((node) => node.title?.toLowerCase().includes("publicado"));
    return {
      id: prefix,
      name: profile.title.replace(/\s+·.*$/, ""),
      company: profile.title.includes("·") ? profile.title.split("·").slice(1).join("·").trim() : "",
      profileUrl: urlFromNode(profile),
      context: profile.body || "",
      status: published ? "Comentado" : "Pendiente",
      priority: "Media",
      postUrl: urlFromNode(posts[0]),
      postTitle: posts[0]?.title || "",
      messageDraft: privateNode?.body || "",
      service: fitNode?.body || "",
      response: "",
      nextAction: published ? "Esperar respuesta y preparar seguimiento" : "Revisar publicación y comentar manualmente",
      notes: "",
      interactions: published ? [{ date: new Date().toISOString().slice(0, 10), channel: "LinkedIn", type: "Comentario", text: "Comentario publicado según el registro del canvas." }] : []
    };
  });
}

function normalizeRecord(record, index) {
  return { id: record.id || `prospecto-${index + 1}`, name: record.name || `Prospecto ${index + 1}`, company: record.company || "", profileUrl: record.profileUrl || "", context: record.context || "", status: ESTADOS.includes(record.status) ? record.status : "Pendiente", priority: record.priority || "Media", postUrl: record.postUrl || "", postTitle: record.postTitle || "", messageDraft: record.messageDraft || "", service: record.service || "", response: record.response || "", nextAction: record.nextAction || "", notes: record.notes || "", interactions: Array.isArray(record.interactions) ? record.interactions : [] };
}

function visibleRecords() {
  const query = crmSearch.value.trim().toLowerCase();
  const status = crmFilter.value;
  return crmRecords.filter((record) => {
    const haystack = Object.values(record).join(" ").toLowerCase();
    return (!query || haystack.includes(query)) && (status === "Todos" || record.status === status);
  });
}

function renderSummary() {
  const values = [
    [crmRecords.length, "prospectos"],
    [crmRecords.filter((r) => r.status === "Pendiente").length, "pendientes"],
    [crmRecords.filter((r) => ["Comentado", "Conectado", "Conversación"].includes(r.status)).length, "en conversación"],
    [crmRecords.filter((r) => ["Propuesta", "Ganado"].includes(r.status)).length, "con oferta"]
  ];
  crmSummary.innerHTML = values.map(([value, label]) => `<div class="crm-stat"><strong>${value}</strong><span>${label}</span></div>`).join("");
}

function renderFilters() {
  const current = crmFilter.value || "Todos";
  crmFilter.innerHTML = `<option value="Todos">Todos los estados</option>${ESTADOS.map((estado) => `<option value="${esc(estado)}">${esc(estado)}</option>`).join("")}`;
  crmFilter.value = ESTADOS.includes(current) ? current : "Todos";
}

function renderCard(record) {
  const links = [
    record.profileUrl ? `<a href="${esc(record.profileUrl)}" target="_blank" rel="noreferrer">Perfil LinkedIn ↗</a>` : "",
    record.postUrl ? `<a href="${esc(record.postUrl)}" target="_blank" rel="noreferrer">${esc(record.postTitle || "Publicación ↗")}</a>` : ""
  ].filter(Boolean).join("");
  const interactions = record.interactions.length ? record.interactions.slice(-4).reverse().map((item) => `<div class="crm-interaction"><strong>${esc(item.date)} · ${esc(item.channel)} · ${esc(item.type)}</strong>${esc(item.text)}</div>`).join("") : `<div class="crm-interaction">Todavía no hay interacciones registradas.</div>`;
  return `<article class="crm-card" data-record-id="${esc(record.id)}">
    <div class="crm-card-head"><div><h2>${record.profileUrl ? `<a href="${esc(record.profileUrl)}" target="_blank" rel="noreferrer">${esc(record.name)} ↗</a>` : esc(record.name)}</h2><p class="crm-card-meta">${esc(record.company)}${record.company && record.context ? " · " : ""}${esc(record.context)}</p></div><span class="crm-badge">${esc(record.status)}</span></div>
    <div class="crm-links">${links || "<span class=crm-card-meta>Sin enlaces de evidencia</span>"}</div>
    <div class="crm-fields">
      <div class="crm-field"><label>Estado</label><select data-field="status">${ESTADOS.map((estado) => `<option ${record.status === estado ? "selected" : ""}>${esc(estado)}</option>`).join("")}</select></div>
      <div class="crm-field"><label>Prioridad</label><select data-field="priority">${["Alta", "Media", "Baja"].map((value) => `<option ${record.priority === value ? "selected" : ""}>${value}</option>`).join("")}</select></div>
      <div class="crm-field full"><label>Mensaje enviado / borrador</label><textarea data-field="messageDraft" placeholder="Qué escribiste o qué falta adaptar…">${esc(record.messageDraft)}</textarea></div>
      <div class="crm-field full"><label>Servicio ofrecido o posible encaje</label><textarea data-field="service" placeholder="Qué servicio tiene sentido después de validar la necesidad…">${esc(record.service)}</textarea></div>
      <div class="crm-field full"><label>Respuesta del prospecto</label><textarea data-field="response" placeholder="Registrar respuesta literal o resumen…">${esc(record.response)}</textarea></div>
      <div class="crm-field full"><label>Próxima acción</label><input data-field="nextAction" value="${esc(record.nextAction)}" placeholder="Ej. hacer seguimiento el viernes" /></div>
      <div class="crm-field full"><label>Notas internas</label><textarea data-field="notes" placeholder="Hipótesis, objeciones, contexto…">${esc(record.notes)}</textarea></div>
    </div>
    <div class="crm-interactions">${interactions}</div>
    <div class="crm-toolbar" style="margin:14px 0 0"><button class="crm-button secondary" type="button" data-add-interaction>+ Registrar interacción</button><span class="crm-status" data-card-status></span></div>
  </article>`;
}

function render() {
  renderSummary();
  const records = visibleRecords();
  crmGrid.innerHTML = records.length ? records.map(renderCard).join("") : `<div class="crm-empty">No hay prospectos que coincidan con el filtro.</div>`;
  crmGrid.querySelectorAll(".crm-card").forEach((card) => bindCard(card));
}

async function save() {
  if (!crmCanvas || !crmNode) return;
  crmNode.records = crmRecords;
  crmNode.body = `${crmRecords.length} prospectos · seguimiento de mensajes, oferta y respuestas.`;
  crmStatus.textContent = "Guardando…";
  try {
    const result = await crmSupabase.upsert("flowforge_canvases", { task_id: crmTaskId, nodes: crmCanvas.nodes, links: crmCanvas.links || [], zoom: crmCanvas.zoom || 1 }, "task_id");
    if (Array.isArray(result) && result[0]) crmCanvas = result[0];
    crmStatus.textContent = "Guardado en Supabase";
  } catch (error) {
    localStorage.setItem(`linkedin-crm::${crmTaskId}`, JSON.stringify(crmRecords));
    crmStatus.textContent = "Guardado local · no se pudo sincronizar";
  }
}

function bindCard(card) {
  const record = crmRecords.find((item) => item.id === card.dataset.recordId);
  if (!record) return;
  card.querySelectorAll("[data-field]").forEach((field) => field.addEventListener("input", () => { record[field.dataset.field] = field.value; if (field.dataset.field === "status") render(); save(); }));
  card.querySelector("[data-add-interaction]").addEventListener("click", () => {
    const text = window.prompt("Qué ocurrió con este prospecto?");
    if (!text || !text.trim()) return;
    record.interactions.push({ date: new Date().toISOString().slice(0, 10), channel: "LinkedIn", type: "Nota", text: text.trim() });
    render();
    save();
  });
}

document.querySelector("#crm-search").addEventListener("input", render);
document.querySelector("#crm-filter").addEventListener("change", render);
document.querySelector("#crm-add").addEventListener("click", () => {
  const name = window.prompt("Nombre del nuevo prospecto");
  if (!name || !name.trim()) return;
  crmRecords.push(normalizeRecord({ id: slug(name), name: name.trim(), status: "Pendiente", priority: "Media", nextAction: "Investigar perfil y publicación" }, crmRecords.length));
  render();
  save();
});

async function init() {
  renderFilters();
  try {
    const rows = await crmSupabase.read(`flowforge_canvases?task_id=eq.${encodeURIComponent(crmTaskId)}&select=*`);
    crmCanvas = Array.isArray(rows) ? rows[0] : null;
    const nodes = crmCanvas?.nodes || [];
    crmNode = nodes.find((node) => node.id === crmNodeId || node.kind === "linkedin-crm");
    const stored = localStorage.getItem(`linkedin-crm::${crmTaskId}`);
    crmRecords = (crmNode?.records?.length ? crmNode.records : stored ? JSON.parse(stored) : seedRecords(nodes)).map(normalizeRecord);
  } catch (error) {
    crmRecords = [];
    crmStatus.textContent = "No se pudo leer el canvas";
  }
  render();
}

init();
