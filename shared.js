const commandLog = document.querySelector("#command-log");

const mockCommands = {
  "export-prompts": "Mock: se prepararía un paquete Markdown con prompts y avances del portafolio.",
  "prepare-agent-prompt": "Mock: se construiría el prompt para una tarea/agente de ChatGPT.",
  "queue-render": "Mock: se agregaría un output visual a una cola local, sin API.",
  "save-markdown": "Mock: se guardaría el historial en proyectos/flowforge-visual/prompts/.",
  "snapshot-flow": "Mock: se registraría un snapshot del canvas actual como entrada de bitácora.",
  "compose-story-agent": "Mock: se compondría un prompt para refinar el nodo Story de la tarea activa.",
  "compose-image-agent": "Mock: se compondría un prompt para Image/Video Gen de la tarea activa.",
  "mark-review-ready": "Mock: se marcaría la tarea activa como lista para revisión humana."
};

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => {
    const commandName = button.dataset.command;
    const message = mockCommands[commandName] || `Mock: comando ${commandName} sin conexión externa.`;
    if (commandLog) {
      commandLog.value = message;
      commandLog.textContent = message;
    }
  });
});
