// Clave publishable a propósito: esto corre en el navegador y cualquier clave
// aquí es pública. La protección real son las políticas RLS de las tablas.
const FLOWFORGE_SUPABASE_URL = "https://jfvmuemyjcdesnoqeaix.supabase.co";
const FLOWFORGE_SUPABASE_KEY = "sb_publishable_7l3WptofYtgvkDUHKyfwPQ_x0nl0lc1";

const FlowForgeSupabase = {
  enabled: Boolean(FLOWFORGE_SUPABASE_URL && FLOWFORGE_SUPABASE_KEY),
  url: FLOWFORGE_SUPABASE_URL,
  headers: {
    apikey: FLOWFORGE_SUPABASE_KEY,
    Authorization: `Bearer ${FLOWFORGE_SUPABASE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=representation"
  },

  // Sin tope, una base enferma deja la página en blanco hasta que el navegador
  // se rinde. Preferimos rendirnos pronto y pintar el canvas.
  timeout: 5000,

  async request(path, options = {}) {
    const controller = new AbortController();
    const alarma = setTimeout(() => controller.abort(), this.timeout);
    try {
      return await fetch(`${this.url}/rest/v1/${path}`, {
        ...options,
        headers: this.headers,
        signal: controller.signal
      });
    } finally {
      clearTimeout(alarma);
    }
  },

  async read(path) {
    if (!this.enabled) return null;
    const response = await this.request(path);
    if (!response.ok) throw new Error(`Supabase read failed: ${response.status}`);
    return response.json();
  },

  async upsert(table, payload, conflictKey) {
    if (!this.enabled) return null;
    const response = await this.request(`${table}?on_conflict=${conflictKey}`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Supabase upsert failed: ${response.status}`);
    return response.json();
  }
};

window.FlowForgeSupabase = FlowForgeSupabase;
