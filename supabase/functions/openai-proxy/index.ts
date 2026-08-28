// ── Puente seguro con OpenAI ──────────────────────────────────
// La clave de OpenAI vive AQUÍ, como secreto del servidor, y nunca se
// envía al navegador. Antes estaba escrita en index.html, que se publica
// en GitHub Pages: cualquiera podía leerla, y de hecho se filtró y
// generó 155 USD de consumo ajeno en dos días (27-28/08/2026).
//
// Además pone un tope de gasto diario: si se supera, la función deja de
// llamar a OpenAI y devuelve un aviso, en vez de dejar correr la factura.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI = 'https://api.openai.com/v1';
const SB = Deno.env.get('SUPABASE_URL') || '';
const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Tope de gasto por día en USD (se puede subir con el secreto IA_TOPE_DIARIO)
const TOPE_DIARIO = parseFloat(Deno.env.get('IA_TOPE_DIARIO') || '3');

// Solo estos modelos: evita que alguien pida uno carísimo
const MODELOS = new Set(['gpt-4o', 'gpt-4o-mini']);

// Precio por millón de tokens (USD) para estimar el gasto
const PRECIO: Record<string, { in: number; out: number }> = {
  'gpt-4o': { in: 2.5, out: 10 },
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
};

function db(method: string, path: string, body?: unknown) {
  return fetch(`${SB}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const hoy = () => new Date().toISOString().slice(0, 10);

async function gastoDeHoy(): Promise<number> {
  if (!SB || !SRK) return 0;
  try {
    const r = await db('GET', `ia_uso?select=coste_usd&fecha=eq.${hoy()}`);
    if (!r.ok) return 0;
    const rows = await r.json();
    return rows?.[0]?.coste_usd ? parseFloat(rows[0].coste_usd) : 0;
  } catch { return 0; }
}

async function apuntarGasto(modelo: string, tIn: number, tOut: number, gastoPrevio: number) {
  if (!SB || !SRK) return;
  const p = PRECIO[modelo] || PRECIO['gpt-4o'];
  const coste = (tIn / 1e6) * p.in + (tOut / 1e6) * p.out;
  try {
    await db('POST', 'ia_uso?on_conflict=fecha', {
      fecha: hoy(),
      coste_usd: parseFloat((gastoPrevio + coste).toFixed(6)),
      actualizado: new Date().toISOString(),
    });
  } catch { /* el registro de uso no debe tumbar la respuesta */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const J = (o: unknown, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  const KEY = Deno.env.get('OPENAI_API_KEY');
  if (!KEY) return J({ error: { message: 'Falta OPENAI_API_KEY en los secretos de Supabase' } }, 500);

  const url = new URL(req.url);
  const esAudio = url.searchParams.get('endpoint') === 'transcriptions';

  // ── Tope de gasto diario ──
  const gastado = await gastoDeHoy();
  if (gastado >= TOPE_DIARIO) {
    return J({
      error: {
        message: `Se alcanzó el tope de gasto diario del asistente (${TOPE_DIARIO} USD). ` +
          `Llevas ${gastado.toFixed(2)} USD hoy. Se reanuda mañana, o sube IA_TOPE_DIARIO en Supabase.`,
        code: 'tope_diario',
      },
    }, 429);
  }

  try {
    // ── Transcripción de audio: se reenvía el formulario tal cual ──
    if (esAudio) {
      const form = await req.formData();
      const r = await fetch(`${OPENAI}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}` },
        body: form,
      });
      const txt = await r.text();
      // Whisper: 0,006 USD/minuto; se apunta un mínimo simbólico
      await apuntarGasto('gpt-4o-mini', 0, 0, gastado);
      return new Response(txt, { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // ── Chat ──
    const body = await req.json();
    const modelo = String(body?.model || 'gpt-4o-mini');
    if (!MODELOS.has(modelo)) {
      return J({ error: { message: `Modelo no permitido: ${modelo}` } }, 400);
    }
    // Techo duro de respuesta, por si el cliente pide de más
    body.max_tokens = Math.min(parseInt(body.max_tokens, 10) || 1500, 2000);

    const pedir = (m: string) =>
      fetch(`${OPENAI}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, model: m }),
      });

    let r = await pedir(modelo);
    let data = await r.json();
    let modeloUsado = modelo;

    // Si el proyecto todavia no tiene habilitado el modelo barato,
    // reintentar con gpt-4o para no dejar al usuario sin asistente.
    if (!r.ok && data?.error?.code === 'model_not_found' && modelo !== 'gpt-4o') {
      r = await pedir('gpt-4o');
      data = await r.json();
      modeloUsado = 'gpt-4o';
    }

    if (r.ok && data?.usage) {
      await apuntarGasto(modeloUsado, data.usage.prompt_tokens || 0, data.usage.completion_tokens || 0, gastado);
    }
    return J(data, r.status);
  } catch (e) {
    return J({ error: { message: (e as Error).message } }, 500);
  }
});
