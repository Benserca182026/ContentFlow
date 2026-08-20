// Puente a OpenRouter. Existe por una razón concreta: la app corre entera en
// el navegador, así que cualquier clave que estuviera en el código quedaría
// pública en Vercel. Aquí la clave vive en la variable de entorno del servidor
// y nunca sale de él.
//
// El navegador manda qué modelo quiere y los mensajes; esta función pone la
// clave y devuelve la respuesta tal cual.

const MODELOS_PERMITIDOS = new Set([
  // Visión y razonamiento
  "qwen/qwen3.7-flash",
  "qwen/qwen3-vl-235b-a22b-thinking",
  "qwen/qwen3.8-max",
  "google/gemini-2.5-flash",
  // Generación de imagen
  "google/gemini-2.5-flash-image",
  "google/gemini-3.1-flash-image",
  "google/gemini-3-pro-image",
  "qwen/qwen-image-3-pro"
]);

const LIMITE_PETICION = 8 * 1024 * 1024; // 8 MB: una imagen en base64 cabe de sobra

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const clave = process.env.QWEN;
  if (!clave) {
    return res.status(503).json({
      error: "Falta QWEN en las variables de entorno de Vercel"
    });
  }

  const cuerpo = req.body || {};
  const { model, messages } = cuerpo;

  if (!model || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Hacen falta 'model' y 'messages'" });
  }

  // Lista blanca: esta URL es pública, y sin ella cualquiera podría usar tu
  // saldo con el modelo más caro que encuentre.
  if (!MODELOS_PERMITIDOS.has(model)) {
    return res.status(403).json({
      error: `Modelo no permitido: ${model}`,
      permitidos: [...MODELOS_PERMITIDOS]
    });
  }

  if (JSON.stringify(cuerpo).length > LIMITE_PETICION) {
    return res.status(413).json({ error: "Petición demasiado grande" });
  }

  try {
    const respuesta = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clave}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://flowforge-visual.vercel.app",
        "X-Title": "FlowForge Visual"
      },
      body: JSON.stringify({
        model,
        messages,
        ...(cuerpo.max_tokens ? { max_tokens: cuerpo.max_tokens } : {}),
        ...(cuerpo.temperature != null ? { temperature: cuerpo.temperature } : {}),
        ...(cuerpo.modalities ? { modalities: cuerpo.modalities } : {}),
        // Los modelos híbridos de Qwen piensan por defecto y se comen el
        // presupuesto de tokens antes de contestar. Quien llama decide.
        ...(cuerpo.reasoning ? { reasoning: cuerpo.reasoning } : {})
      })
    });

    const datos = await respuesta.json();
    // El error de OpenRouter se devuelve tal cual: diagnosticar a ciegas es peor
    // que ver el motivo real.
    return res.status(respuesta.status).json(datos);
  } catch (error) {
    return res.status(502).json({ error: "OpenRouter no respondió", detalle: String(error) });
  }
}
