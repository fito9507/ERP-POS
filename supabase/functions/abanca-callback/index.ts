import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ── Autorización OAuth de ABANCA (flujo authorization_code) ───
// Según la Documentación del portal:
//  - Authorize (redirección en el navegador):
//      GET {base}/oauth/{APLICACION}/{instancia}?response_type=code
//          &redirect_uri={callback}&state={state}
//    instancia = Abanca (producción) | Sandbox (pruebas).
//  - Token: POST {base}/oauth2/token con cabecera AuthKey y body
//      grant_type=authorization_code&APLICACION={id}&code={code}
//    (SIN client_secret; la app se identifica con AuthKey).
//
// Esta función hace las dos cosas:
//  · Abierta sin ?code  → muestra un botón que lleva al login de Abanca.
//  · Vuelta con ?code   → canjea el código y muestra el refresh_token.
// Desplegar con --no-verify-jwt.

const html = (titulo: string, cuerpo: string) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${titulo}</title>` +
    `<body style="font-family:system-ui;max-width:600px;margin:36px auto;line-height:1.55;padding:0 16px">` +
    `<h2>${titulo}</h2>${cuerpo}</body>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

serve(async (req) => {
  const url = new URL(req.url);
  const clientId = Deno.env.get('ABANCA_CLIENT_ID');
  const apiKey = Deno.env.get('ABANCA_API_KEY') || Deno.env.get('ABANCA_CLIENT_SECRET') || '';
  const base = (Deno.env.get('ABANCA_BASE_URL') || 'https://api.abanca.com').replace(/\/$/, '');
  const instancia = Deno.env.get('ABANCA_INSTANCE') || 'Abanca'; // Abanca | Sandbox
  const tokenUrl = Deno.env.get('ABANCA_TOKEN_URL') || `${base}/oauth2/token`;
  // OJO: dentro del runtime la URL vista es interna (http:// y sin el
  // prefijo /functions/v1), así que el redirect_uri se reconstruye para que
  // coincida EXACTAMENTE con el registrado en el portal de Abanca.
  const ruta = url.pathname.startsWith('/functions/') ? url.pathname : `/functions/v1${url.pathname}`;
  const aqui = Deno.env.get('ABANCA_REDIRECT_URI') || `https://${url.host}${ruta}`;

  if (!clientId || !apiKey) {
    return html('Faltan secrets', '<p>Configura ABANCA_CLIENT_ID y ABANCA_API_KEY en Supabase Secrets.</p>');
  }

  const error = url.searchParams.get('error');
  if (error) {
    return html('Autorización rechazada',
      `<p>Abanca devolvió: <code>${esc(error)}</code> ${esc(url.searchParams.get('error_description') ?? '')}</p>`);
  }

  const code = url.searchParams.get('code');
  if (!code) {
    // Punto de partida: enlace al login de Abanca.
    const authUrl = `${base}/oauth/${encodeURIComponent(clientId)}/${encodeURIComponent(instancia)}`
      + `?response_type=code&redirect_uri=${encodeURIComponent(aqui)}&state=erp${Math.floor(Date.now() / 1000)}`;
    return html('Conectar ABANCA con el ERP',
      `<p>Vas a autorizar al ERP a leer tus cuentas y movimientos de Abanca
       (entorno <b>${esc(instancia)}</b>). Se abrirá el login oficial de Abanca.</p>
       <p><a href="${authUrl}" style="display:inline-block;background:#0055a4;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">Entrar en Abanca →</a></p>
       <p style="color:#888;font-size:12px">Tus credenciales se validan en la web de Abanca, no aquí.</p>`);
  }

  // Vuelta con ?code → canjear por tokens.
  try {
    const body = new URLSearchParams({ grant_type: 'authorization_code', APLICACION: clientId, code });
    const r = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'AuthKey': apiKey },
      body: body.toString(),
    });
    const texto = await r.text();
    let tok: any = null;
    try { tok = JSON.parse(texto); } catch { /* respuesta no-JSON */ }

    if (r.ok && tok && tok.refresh_token) {
      const contratos = tok.contracts ? `<p style="font-size:13px">Contratos de empresa detectados: <code>${esc(JSON.stringify(tok.contracts))}</code> — el sync los usa solo.</p>` : '';
      return html('✅ Autorización completada',
        `<p>Copia este <b>refresh_token</b> en Supabase → Edge Functions → Secrets como
         <code>ABANCA_REFRESH_TOKEN</code> (o pásaselo a Claude) y cierra esta pestaña:</p>
         <pre style="background:#f4f4f4;padding:12px;border-radius:8px;word-break:break-all;white-space:pre-wrap">${esc(tok.refresh_token)}</pre>
         ${contratos}
         <p style="color:#888;font-size:13px">Usuario: ${esc(tok.username ?? tok.displayName ?? '')}</p>`);
    }
    return html('Error canjeando el código',
      `<p>El endpoint de token (${esc(tokenUrl)}) devolvió HTTP ${r.status}:</p>
       <pre style="background:#f4f4f4;padding:12px;border-radius:8px;white-space:pre-wrap;word-break:break-all">${esc(texto.slice(0, 700))}</pre>`);
  } catch (e: any) {
    return html('Error', `<pre>${esc(e.message)}</pre>`);
  }
});
