const PIECES = {
  vistas: [
    { label: "Vista frontal", note: "Silueta, visor y mentonera completos.", confidence: 0.96 },
    { label: "Vista lateral izquierda", note: "Base habitual para aplicar el diseño.", confidence: 0.94 },
    { label: "Vista lateral derecha", note: "Spoiler y uniones visibles.", confidence: 0.93 },
    { label: "Vista trasera", note: "Ventilaciones y componentes posteriores.", confidence: 0.9 },
    { label: "Vista superior", note: "Curvatura y zona de aplicación permitida.", confidence: 0.88 }
  ],
  secciones: [
    { label: "Portada del modelo", note: "Nombre comercial y código de referencia.", confidence: 0.97 },
    { label: "Ficha de especificaciones", note: "Tallas, materiales y homologación.", confidence: 0.92 },
    { label: "Paleta de color", note: "Códigos de color declarados en el documento.", confidence: 0.89 },
    { label: "Patrón gráfico", note: "Motivo repetible separado del fondo.", confidence: 0.86 },
    { label: "Detalles de montaje", note: "Ampliaciones de uniones y herrajes.", confidence: 0.81 }
  ]
};

const MODE_HINTS = {
  vistas: "Vistas: frontal, laterales, trasera y superior del mismo casco.",
  secciones: "Secciones: bloques del documento (portada, ficha, paleta, patrón, detalles)."
};

const MODEL_STEPS = {
  haiku: ["Leyendo el PDF página por página", "Haiku describe cada bloque visual", "Recortando piezas y nombrándolas"],
  mini: ["Leyendo el PDF página por página", "El modelo mini clasifica cada bloque", "Recortando piezas y nombrándolas"],
  local: ["Leyendo el PDF página por página", "Detectando marcos por contraste", "Recortando piezas por reglas fijas"]
};

const MODEL_LABELS = {
  haiku: "Claude Haiku 4.5",
  mini: "GPT mini",
  local: "Recorte local"
};

const MODEL_COSTS = {
  haiku: "≈ $0.004 por PDF · el más barato",
  mini: "≈ $0.006 por PDF",
  local: "$0 · recorte por reglas, sin modelo"
};

function pdfSplitWait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
