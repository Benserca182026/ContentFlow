const CRM_STAGES = ["Pendiente", "Comentado", "Conversación", "Propuesta"];

function crmRecordsFromCanvas(taskNode) {
  if (Array.isArray(taskNode.records) && taskNode.records.length) return taskNode.records;
  const nodes = window.activeTask?.nodes || [];
  return nodes.filter((node) => node.id?.endsWith("-profile")).map((profile) => {
    const prefix = profile.id.split("-")[0];
    const related = nodes.filter((node) => node.id !== profile.id && node.id?.startsWith(`${prefix}-`));
    const published = related.some((node) => node.title?.toLowerCase().includes("publicado"));
    const evidence = related.filter((node) => node.kind === "reference" || node.id.includes("post") || node.id.includes("public")).length;
    return {
      id: prefix,
      name: profile.title.replace(/\s+·.*$/, ""),
      context: profile.body || "",
      status: published ? "Comentado" : "Pendiente",
      evidence,
      profileNodeId: profile.id,
      profileUrl: profile.urls?.[0]?.href || ""
    };
  });
}

function escapeCrm(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function toggleCrmRecord(record, taskNode) {
  if (!record) return;
  taskNode.expandedRecordId = taskNode.expandedRecordId === record.id ? null : record.id;
  if (typeof window.renderCanvas === "function") window.renderCanvas();
  if (typeof window.scheduleCanvasSave === "function") window.scheduleCanvasSave();
}

function crmInlineDetail(record) {
  const nodes = window.activeTask?.nodes || [];
  const sourceNodes = nodes.filter((node) => node.id?.startsWith(`${record.id}-`));
  const profile = sourceNodes.find((node) => node.id.endsWith("-profile"));
  const privateNode = sourceNodes.find((node) => node.id.endsWith("-private"));
  const fitNode = sourceNodes.find((node) => node.id.endsWith("-fit"));
  const posts = sourceNodes.filter((node) => node.id.includes("post") || node.id.includes("public"));
  const evidenceImages = Array.isArray(record.evidenceImages) ? record.evidenceImages : [];
  const evidence = [
    ...posts.map((post) => `<p><strong>${escapeCrm(post.title)}</strong><br>${escapeCrm(post.body)}</p>`),
    ...evidenceImages.map((image, index) => `<figure class="crm-evidence-image"><img src="${escapeCrm(image.url || image)}" alt="${escapeCrm(image.title || `${record.name} · evidencia ${index + 1}`)}" loading="lazy"><figcaption>${escapeCrm(image.title || `Captura ${index + 1}`)}</figcaption></figure>`)
  ];
  return `<div class="crm-inline-detail"><div class="crm-inline-head"><strong>${escapeCrm(record.name)} · detalle</strong><button type="button" data-crm-close>Cerrar rama ×</button></div><div class="crm-inline-grid"><section><b>Perfil</b><p>${escapeCrm(profile?.body || record.context || "Sin notas de perfil.")}</p></section><section><b>Evidencia</b>${evidence.length ? evidence.join("") : "<p>Sin evidencia de publicación propia documentada.</p>"}</section><section><b>Mensaje y respuesta</b><p>${escapeCrm(privateNode?.body || record.messageDraft || "Registrar aquí el mensaje enviado y la respuesta recibida.")}</p><textarea data-crm-response placeholder="Respuesta del prospecto…">${escapeCrm(record.response || "")}</textarea></section><section><b>Servicio / próxima acción</b><p>${escapeCrm(fitNode?.body || record.service || record.nextAction || "Registrar servicio posible y siguiente paso.")}</p></section></div></div>`;
}

function renderLinkedInCrmNode(element, taskNode) {
  const records = crmRecordsFromCanvas(taskNode);
  const count = records.length || taskNode.crmCount || 0;
  const pending = records.filter((record) => !["Ganado", "Pausado"].includes(record.status)).length || count;
  const grouped = CRM_STAGES.map((stage) => [stage, records.filter((record) => (CRM_STAGES.includes(record.status) ? record.status : "Pendiente") === stage)]);
  element.classList.add("linkedin-crm-node");
  if (taskNode.expandedRecordId) element.classList.add("crm-expanded");
  element.innerHTML = `
    <span>${taskNode.title || "CRM de prospectos"}</span>
    <p>${count} prospectos · ${pending} en seguimiento</p>
    <small>${taskNode.body || "Mensajes, servicio ofrecido, respuestas y próxima acción."}</small>
    <div class="crm-kanban" aria-label="Progreso de prospectos">
      ${grouped.map(([stage, stageRecords]) => `<section class="crm-kanban-column"><strong>${stage} <em>${stageRecords.length}</em></strong>${stageRecords.map((record) => `<article class="crm-kanban-card"><b>${escapeCrm(record.name)}</b><small>${record.evidence || 0} evidencias</small><select data-crm-stage="${escapeCrm(record.id)}" aria-label="Estado de ${escapeCrm(record.name)}">${CRM_STAGES.map((option) => `<option ${record.status === option ? "selected" : ""}>${option}</option>`).join("")}</select><button type="button" data-crm-expand="${escapeCrm(record.id)}">${taskNode.expandedRecordId === record.id ? "Cerrar rama" : "Abrir rama"}</button></article>`).join("") || `<span class="crm-kanban-empty">Vacío</span>`}</section>`).join("")}
    </div>
    ${taskNode.expandedRecordId ? crmInlineDetail(records.find((record) => record.id === taskNode.expandedRecordId) || records[0]) : ""}
    <a class="crm-open-button" href="./linkedin-crm.html?project=linkedin-prospeccion&task=linkedin-prospeccion-inicio&node=${encodeURIComponent(taskNode.id)}">Ver detalle completo →</a>
  `;
  element.querySelectorAll("[data-crm-expand]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleCrmRecord(records.find((record) => record.id === button.dataset.crmExpand), taskNode);
  }));
  element.querySelector("[data-crm-close]")?.addEventListener("click", (event) => { event.stopPropagation(); taskNode.expandedRecordId = null; window.renderCanvas?.(); window.scheduleCanvasSave?.(); });
  element.querySelector("[data-crm-response]")?.addEventListener("input", (event) => {
    const record = records.find((item) => item.id === taskNode.expandedRecordId);
    if (!record) return;
    record.response = event.target.value;
    taskNode.records = records;
    window.scheduleCanvasSave?.();
  });
  element.querySelectorAll("[data-crm-stage]").forEach((select) => select.addEventListener("change", (event) => {
    event.stopPropagation();
    const record = records.find((item) => item.id === select.dataset.crmStage);
    if (!record) return;
    const nextRecords = records.map((item) => item.id === record.id ? { ...item, status: select.value } : item);
    taskNode.records = nextRecords;
    taskNode.crmCount = nextRecords.length;
    if (typeof window.scheduleCanvasSave === "function") window.scheduleCanvasSave();
    if (typeof window.renderCanvas === "function") window.renderCanvas();
  }));
}

window.renderLinkedInCrmNode = renderLinkedInCrmNode;
