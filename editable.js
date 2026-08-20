const editableTimers = {
  project: null,
  task: null,
  canvas: null
};

function editableBlurOnEnter(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    event.currentTarget.blur();
  }
}

function setEditable(element, onInput) {
  if (!element || element.dataset.editableBound === "true") return;
  element.contentEditable = "true";
  element.spellcheck = false;
  element.tabIndex = 0;
  element.dataset.editableBound = "true";
  element.addEventListener("keydown", editableBlurOnEnter);
  element.addEventListener("input", onInput);
}

function markSaveState(text) {
  if (projectPill) projectPill.textContent = text;
}

function scheduleProjectEditableSave() {
  if (!supabase?.enabled) return;
  clearTimeout(editableTimers.project);
  markSaveState(`${project.pill} · guardando`);
  editableTimers.project = setTimeout(async () => {
    try {
      await supabase.upsert(
        "flowforge_projects",
        {
          id: projectKey,
          title: project.title,
          pill: project.pill,
          summary: project.summary,
          accent: project.accent
        },
        "id"
      );
      markSaveState(`${project.pill} · guardado`);
    } catch (error) {
      markSaveState(`${project.pill} · local`);
    }
  }, 500);
}

function scheduleTaskEditableSave(task) {
  if (!supabase?.enabled || !task) return;
  clearTimeout(editableTimers.task);
  markSaveState(`${project.pill} · guardando`);
  editableTimers.task = setTimeout(async () => {
    try {
      await supabase.upsert(
        "flowforge_tasks",
        {
          id: task.id,
          project_id: projectKey,
          title: task.title,
          status: task.status,
          summary: task.summary
        },
        "id"
      );
      markSaveState(`${project.pill} · guardado`);
    } catch (error) {
      markSaveState(`${project.pill} · local`);
    }
  }, 500);
}

function bindProjectEditableFields() {
  setEditable(projectTitle, () => {
    project.title = projectTitle.textContent.trim();
    document.title = `FlowForge Visual — ${project.title}`;
    scheduleProjectEditableSave();
  });

  setEditable(projectSummary, () => {
    project.summary = projectSummary.textContent.trim();
    scheduleProjectEditableSave();
  });

  setEditable(projectPill, () => {
    const nextPill = projectPill.textContent.replace(/ · .+$/, "").trim();
    project.pill = nextPill || project.pill;
    scheduleProjectEditableSave();
  });
}

function bindCanvasTaskEditableFields() {
  setEditable(canvasTitle, () => {
    activeTask.title = canvasTitle.textContent.trim();
    scheduleTaskEditableSave(activeTask);
    renderTasks();
  });

  setEditable(canvasDescription, () => {
    activeTask.summary = canvasDescription.textContent.trim();
    scheduleTaskEditableSave(activeTask);
    renderTasks();
  });
}

function bindTaskListEditableFields() {
  taskList.querySelectorAll(".task-item").forEach((item, index) => {
    const task = project.tasks[index];
    if (!task) return;

    const status = item.querySelector(".task-main span");
    const title = item.querySelector(".task-main strong");
    const summary = item.querySelector(".task-main small");

    [status, title, summary].forEach((field) => {
      field.addEventListener("click", (event) => event.stopPropagation());
      field.addEventListener("pointerdown", (event) => event.stopPropagation());
    });

    setEditable(status, () => {
      task.status = status.textContent.trim();
      scheduleTaskEditableSave(task);
    });
    setEditable(title, () => {
      task.title = title.textContent.trim();
      if (task.id === activeTask.id) canvasTitle.textContent = task.title;
      scheduleTaskEditableSave(task);
    });
    setEditable(summary, () => {
      task.summary = summary.textContent.trim();
      if (task.id === activeTask.id) canvasDescription.textContent = task.summary;
      scheduleTaskEditableSave(task);
    });
  });
}

function bindNodeEditableFields() {
  nodeLayer.querySelectorAll(".flow-node").forEach((nodeElement) => {
    const nodeData = activeTask.nodes.find((item) => item.id === nodeElement.dataset.node);
    // Estos nodos llevan sus propios controles: su texto no es un cuerpo editable.
    if (!nodeData || nodeData.kind === "pdf-split" || nodeData.kind === "view-map") return;

    const title = nodeElement.querySelector("span");
    const body = nodeElement.querySelector("p, small");
    setEditable(title, () => {
      nodeData.title = title.textContent.trim();
      scheduleCanvasSave();
      renderTasks();
    });
    setEditable(body, () => {
      nodeData.body = body.textContent.trim();
      scheduleCanvasSave();
    });
  });
}

const originalRenderTasks = renderTasks;
renderTasks = function renderTasksWithEditing() {
  originalRenderTasks();
  bindTaskListEditableFields();
};

const originalRenderCanvas = renderCanvas;
renderCanvas = function renderCanvasWithEditing() {
  originalRenderCanvas();
  bindCanvasTaskEditableFields();
  bindNodeEditableFields();
};

window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    bindProjectEditableFields();
    bindTaskListEditableFields();
    bindCanvasTaskEditableFields();
    bindNodeEditableFields();
  }, 800);
});
