// Composición de textura sobre el casco, en el navegador.
// No genera ni redibuja: toma los pixeles reales de la foto y solo les cambia
// el color, modulado por su propia luminancia. Por eso la estructura no puede
// deformarse — la silueta sigue siendo exactamente la de la fotografía.

function loadComposeImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    image.src = src;
  });
}

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Medido sobre boston-izquierda.png: la carcasa tiene luminancia mediana 60,
// y visor y rejillas caen por debajo de 25. Un corte en 28 separa las piezas
// negras sin comerse la carcasa. Un umbral alto (60) protegia el casco entero.
const DARK_THRESHOLD = 28;
const BACKGROUND_LEVEL = 242;

// El patrón vive en la mitad derecha de la guía; la izquierda es portada y logos.
function buildTile(texture, scale, patternStart) {
  const cropX = Math.round(texture.naturalWidth * patternStart);
  const cropWidth = texture.naturalWidth - cropX;

  const tile = document.createElement("canvas");
  tile.width = Math.max(1, Math.round(cropWidth * scale));
  tile.height = Math.max(1, Math.round(texture.naturalHeight * scale));
  tile
    .getContext("2d")
    .drawImage(texture, cropX, 0, cropWidth, texture.naturalHeight, 0, 0, tile.width, tile.height);

  return tile;
}

async function composeTexture(viewSrc, textureSrc, options = {}) {
  const { scale = 0.45, protectDark = true, patternStart = 0.4 } = options;

  const [view, texture] = await Promise.all([loadComposeImage(viewSrc), loadComposeImage(textureSrc)]);
  const width = view.naturalWidth;
  const height = view.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(view, 0, 0);
  const base = context.getImageData(0, 0, width, height);

  const patternCanvas = document.createElement("canvas");
  patternCanvas.width = width;
  patternCanvas.height = height;
  const patternContext = patternCanvas.getContext("2d", { willReadFrequently: true });
  patternContext.fillStyle = patternContext.createPattern(buildTile(texture, scale, patternStart), "repeat");
  patternContext.fillRect(0, 0, width, height);
  const pattern = patternContext.getImageData(0, 0, width, height);

  // Primera pasada: luminancia media de la carcasa, para modular en vez de oscurecer.
  let sum = 0;
  let count = 0;
  for (let i = 0; i < base.data.length; i += 4) {
    const r = base.data[i];
    const g = base.data[i + 1];
    const b = base.data[i + 2];
    if (r > BACKGROUND_LEVEL && g > BACKGROUND_LEVEL && b > BACKGROUND_LEVEL) continue;
    const value = luminance(r, g, b);
    if (protectDark && value < DARK_THRESHOLD) continue;
    sum += value;
    count += 1;
  }
  const mean = count > 0 ? sum / count : 128;

  const output = context.createImageData(width, height);
  let painted = 0;

  for (let i = 0; i < base.data.length; i += 4) {
    const r = base.data[i];
    const g = base.data[i + 1];
    const b = base.data[i + 2];
    const value = luminance(r, g, b);

    const isBackground = r > BACKGROUND_LEVEL && g > BACKGROUND_LEVEL && b > BACKGROUND_LEVEL;
    const isProtected = protectDark && value < DARK_THRESHOLD;

    if (isBackground || isProtected) {
      output.data[i] = r;
      output.data[i + 1] = g;
      output.data[i + 2] = b;
      output.data[i + 3] = 255;
      continue;
    }

    const shade = Math.min(1.6, Math.max(0.25, value / mean));
    output.data[i] = Math.min(255, pattern.data[i] * shade);
    output.data[i + 1] = Math.min(255, pattern.data[i + 1] * shade);
    output.data[i + 2] = Math.min(255, pattern.data[i + 2] * shade);
    output.data[i + 3] = 255;
    painted += 1;
  }

  context.putImageData(output, 0, 0);

  return {
    dataUrl: canvas.toDataURL("image/png"),
    coverage: Math.round((painted / (width * height)) * 100)
  };
}
