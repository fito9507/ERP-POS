import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ── Callback OAuth2 de ABANCA (se usa UNA vez) ────────────────
// 1. En el portal Open Banking de Abanca, al crear la APP, poner como
//    Redirect URI la URL de esta función:
//    https://gpkslaqfqfdeoleiayng.supabase.co/functions/v1/abanca-callback
// 2. Abrir en el navegador la URL de autorización que indica su
//    Documentación (authorize?response_type=code&client_id=...&redirect_uri=...)
//    e iniciar sesión con la banca electrónica (SCA).
// 3. Abanca redirige aquí con ?code=... — esta función lo canjea y MUESTRA
//    el refresh_token para copiarlo en Supabase Secrets como
//    ABANCA_REFRESH_TOKEN. No se guarda en ningún sitio.
//
// NOTA: en el dashboard de Supabase, desactivar "Verify JWT" para esta
// función (el navegador de Abanca no envía cabeceras de Supabase).

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  const html = (titulo: string, cuerpo: string, extra = '') =>
    new Response(
      `<!doctype html><meta charset="utf-8"><title>${titulo}</title>` +
      `<body style="font-family:system-ui;max-width:640px;margin:40px auto;line-height:1.5">` +
      `<h2>${titulo}</h2><p>${cuerpo}</p>${extra}</body>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );

  if (error) {
    return html('Autorización rechazada', `Abanca devolvió: <code>${error}</code> — ${url.searchParams.get('error_description') ?? ''}`);
  }
  if (!code) {
    return html('Falta el código', 'Esta URL debe abrirse desde la redirección de Abanca (con <code>?code=...</code>).');
  }

  try {
    const clientId = Deno.env.get('ABANCA_CLIENT_ID');
    const clientSecret = Deno.env.get('ABANCA_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      return html('Faltan secrets', 'Configura primero ABANCA_CLIENT_ID y ABANCA_CLIENT_SECRET en Supabase Secrets.');
    }
    const base = (Deno.env.get('ABANCA_BASE_URL') || 'https://api.abanca.com').replace(/\/$/, '');
    const tokenUrl = Deno.env.get('ABANCA_TOKEN_URL') || `${base}/oauth2/token`;
    const redirectUri = `${url.origin}${url.pathname}`;

    const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
    let r = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`),
      },
      body: body.toString(),
    });
    if (!r.ok) {
      const body2 = new URLSearchParams({
        grant_type: 'authorization_code', code, redirect_uri: redirectUri,
        client_id: clientId, client_secret: clientSecret,
      });
      r = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body2.toString(),
      });
    }
    if (!r.ok) {
      return html('Error canjeando el código', `<code>${tokenUrl}</code> devolvió ${r.status}:<pre>${(await r.text()).slice(0, 500)}</pre>` +
        'Si la URL del token no es esa, configura ABANCA_TOKEN_URL en Secrets con la que indique la Documentación del portal.');
    }
    const tok = await r.json();
    return html('✅ Autorización completada',
      'Copia este <b>refresh_token</b> en Supabase → Edge Functions → Secrets como <code>ABANCA_REFRESH_TOKEN</code> y luego cierra esta pestaña:',
      `<pre style="background:#f4f4f4;padding:12px;border-radius:8px;word-break:break-all;white-space:pre-wrap">${tok.refresh_token ?? '(no vino refresh_token: ' + JSON.stringify(tok).slice(0, 300) + ')'}</pre>` +
      `<p style="color:#888;font-size:13px">access_token de prueba (caduca pronto, no hace falta guardarlo): ${(tok.access_token ?? '').slice(0, 12)}…</p>`);
  } catch (e: any) {
    return html('Error', `<pre>${e.message}</pre>`);
  }
});
