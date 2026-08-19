// ── Autorización OAuth de ABANCA ──────────────────────────────
// Supabase reescribe cualquier text/html de las edge functions a
// text/plain (anti-phishing), así que esta función NO sirve páginas:
// la UI vive en GitHub Pages (abanca.html del repo). Aquí solo:
//  · GET  (redirect_uri registrado en el portal de Abanca): recibe el
//    ?code del banco y redirige 302 a la página de Pages con él.
//  · POST {code}: canjea el código por tokens contra /oauth2/token
//    (grant_type=authorization_code&APLICACION={id} + cabecera AuthKey,
//    formato exacto de la Documentación oficial) y devuelve JSON.
// Desplegar con --no-verify-jwt.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const clientId = Deno.env.get('ABANCA_CLIENT_ID');
  const apiKey = Deno.env.get('ABANCA_API_KEY') || Deno.env.get('ABANCA_CLIENT_SECRET') || '';
  const base = (Deno.env.get('ABANCA_BASE_URL') || 'https://api.abanca.com').replace(/\/$/, '');
  const tokenUrl = Deno.env.get('ABANCA_TOKEN_URL') || `${base}/oauth2/token`;
  const ui = Deno.env.get('ABANCA_UI_URL') || 'https://fito9507.github.io/ERP-POS/abanca.html';

  // ── POST {code} → canje por tokens (JSON) ──
  if (req.method === 'POST') {
    try {
      if (!clientId || !apiKey) throw new Error('Faltan ABANCA_CLIENT_ID / ABANCA_API_KEY en Supabase Secrets');
      const { code } = await req.json();
      if (!code) throw new Error('Falta "code" en el cuerpo de la petición');

      const r = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'AuthKey': apiKey },
        body: new URLSearchParams({ grant_type: 'authorization_code', APLICACION: clientId, code }).toString(),
      });
      const texto = await r.text();
      let tok: any = null;
      try { tok = JSON.parse(texto); } catch { tok = { error: 'respuesta no JSON', raw: texto.slice(0, 500) }; }
      return new Response(JSON.stringify(tok), {
        status: r.ok ? 200 : (r.status || 400),
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // ── GET: redirección desde Abanca → reenviar a la página de Pages ──
  const dest = new URL(ui);
  for (const k of ['code', 'state', 'scope', 'error', 'error_description']) {
    const v = url.searchParams.get(k);
    if (v) dest.searchParams.set(k, v);
  }
  return new Response(null, { status: 302, headers: { 'Location': dest.toString(), 'Cache-Control': 'no-store' } });
});
