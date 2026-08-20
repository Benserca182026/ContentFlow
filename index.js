const portfolioSupabase = window.FlowForgeSupabase;
const projectGrid = document.querySelector("#project-grid");
const apiMetric = document.querySelector("#api-metric");
const projectMetric = document.querySelector("#project-metric");
const cardThemes = ["project-blue", "project-amber", "project-green", "project-violet"];
const cardTimers = new Map();
const portfolioFilter = document.querySelector("#portfolio-filter");

function applyPortfolioFilter() {
  const filter = portfolioFilter?.value || "all";
  projectGrid?.querySelectorAll(".project-card").forEach((card) => {
    const isLinkedIn = `${card.dataset.projectId || ""} ${card.textContent || ""}`.toLowerCase().includes("linkedin");
    card.classList.toggle("is-filtered-out", filter === "linkedin" ? !isLinkedIn : filter === "other" ? isLinkedIn : false);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function editable(value, field) {
  return `contenteditable="true" spellcheck="false" data-edit-field="${field}" tabindex="0">${escapeHtml(value)}`;
}

function saveCardProject(project, card) {
  clearTimeout(cardTimers.get(project.id));
  card.dataset.saveState = "Guardando";
  cardTimers.set(
    project.id,
    setTimeout(async () => {
      try {
        await portfolioSupabase.upsert("flowforge_projects", project, "id");
        card.dataset.saveState = "Guardado";
      } catch (error) {
        card.dataset.saveState = "Local";
      }
    }, 500)
  );
}

function bindCards(projects) {
  projectGrid.querySelectorAll(".project-card").forEach((card) => {
    const project = projects.find((item) => item.id === card.dataset.projectId);
    if (!project) return;

    card.querySelectorAll("[data-edit-field]").forEach((field) => {
      field.addEventListener("click", (event) => event.preventDefault());
      field.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          field.blur();
        }
      });
      field.addEventListener("input", () => {
        project[field.dataset.editField] = field.textContent.trim();
        saveCardProject(project, card);
      });
    });
  });
}

function countLocalCards() {
  return projectGrid ? projectGrid.querySelectorAll(".project-card").length : 0;
}

async function loadPortfolio() {
  if (!portfolioSupabase?.enabled || !projectGrid) return;

  const projects = await portfolioSupabase.read(
    "flowforge_projects?select=id,title,pill,summary,accent,sort_order&order=sort_order.asc"
  );

  // Si la base está vacía, se conservan las tarjetas del HTML. Antes las
  // borraba y dejaba el portafolio sin ninguna puerta de entrada.
  if (!projects || projects.length === 0) {
    projectMetric.textContent = countLocalCards();
    apiMetric.textContent = "Local";
    return;
  }

  projectMetric.textContent = projects.length;
  apiMetric.textContent = "Supabase";
  projectGrid.innerHTML = projects
    .map((project, index) => {
      const theme = cardThemes[index % cardThemes.length];
      return `
        <a class="project-card ${theme}" data-project-id="${project.id}" href="./design-project.html?project=${project.id}">
          <span class="status-pill active" ${editable(project.pill, "pill")}</span>
          <h2 ${editable(project.title, "title")}</h2>
          <p ${editable(project.summary, "summary")}</p>
          <div class="project-meta">
            <span>Supabase</span>
            <span>Canvas editable</span>
          </div>
        </a>
      `;
    })
    .join("");
  bindCards(projects);
  applyPortfolioFilter();
}

// Crear proyectos desde aquí. Un proyecto sin ninguna tarea no tiene canvas
// donde trabajar, así que nace con la suya.
function slugDe(titulo) {
  return String(titulo)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function crearProyecto() {
  const titulo = window.prompt("Nombre del proyecto");
  if (!titulo || !titulo.trim()) return;

  const id = slugDe(titulo);
  if (!id) return window.alert("Ese nombre no genera un identificador válido.");

  try {
    await portfolioSupabase.upsert(
      "flowforge_projects",
      { id, title: titulo.trim(), pill: titulo.trim(), summary: "", accent: "blue", sort_order: Date.now() % 100000 },
      "id"
    );
    await portfolioSupabase.upsert(
      "flowforge_tasks",
      { id: `${id}-inicio`, project_id: id, title: "Inicio", status: "En curso", summary: "", sort_order: 1 },
      "id"
    );
    window.location.href = `./design-project.html?project=${id}`;
  } catch (error) {
    window.alert(`No se pudo crear: ${error.message}`);
  }
}

document.querySelector("#new-project")?.addEventListener("click", crearProyecto);
portfolioFilter?.addEventListener("change", applyPortfolioFilter);

loadPortfolio().catch(() => {
  if (apiMetric) apiMetric.textContent = "Local";
  if (projectMetric) projectMetric.textContent = countLocalCards();
});
