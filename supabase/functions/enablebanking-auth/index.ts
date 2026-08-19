// ── Enable Banking · autorización ─────────────────────────────
// Enable Banking es el agregador (tiene la licencia eIDAS); nosotros solo
// firmamos un JWT RS256 con nuestra clave privada. Flujo:
//   1) action=aspsps        → lista de bancos de un país (para elegir Abanca)
//   2) action=start         → POST /auth → devuelve la URL del login del banco
//   3) action=finish {code} → POST /sessions → devuelve session_id + cuentas
// La página enablebanking.html (GitHub Pages) llama a estas acciones; el
// login del usuario ocurre en el banco vía Enable Banking.
// Desplegar con --no-verify-jwt (la usa el navegador del usuario).

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const API = Deno.env.get('EB_API_URL') || 'https://api.enablebanking.com';

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let _key: CryptoKey | null = null;
async function clave(): Promise<CryptoKey> {
  if (_key) return _key;
  const pem = (Deno.env.get('EB_PRIVATE_KEY') || '').trim();
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  _key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  return _key;
}

async function jwt(): Promise<string> {
  const appId = Deno.env.get('EB_APP_ID');
  if (!appId) throw new Error('Falta EB_APP_ID en Secrets');
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: 'JWT', alg: 'RS256', kid: appId };
  const claims = { iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: now, exp: now + 3600 };
  const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const cuerpo = `${enc(header)}.${enc(claims)}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await clave(), new TextEncoder().encode(cuerpo));
  return `${cuerpo}.${b64url(sig)}`;
}

async function ebFetch(path: string, init: RequestInit = {}) {
  const token = await jwt();
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const txt = await r.text();
  let json: any = null;
  try { json = JSON.parse(txt); } catch { /* no-json */ }
  return { ok: r.ok, status: r.status, json, txt };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const J = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = body.action || new URL(req.url).searchParams.get('action') || 'aspsps';

    if (action === 'aspsps') {
      const country = body.country || 'ES';
      const r = await ebFetch(`/aspsps?country=${encodeURIComponent(country)}`);
      if (!r.ok) return J({ error: r.json || r.txt }, r.status);
      const lista = (r.json?.aspsps || r.json || []).map((a: any) => ({
        name: a.name, country: a.country, psu_types: a.psu_types || a.psuTypes || [],
      }));
      return J({ aspsps: lista });
    }

    if (action === 'start') {
      const aspspName = body.aspsp_name;
      const country = body.country || 'ES';
      const psuType = body.psu_type || 'business';
      const redirectUrl = body.redirect_url;
      if (!aspspName || !redirectUrl) return J({ error: 'faltan aspsp_name o redirect_url' }, 400);
      const validUntil = new Date(Date.now() + 89 * 24 * 60 * 60 * 1000).toISOString();
      const r = await ebFetch('/auth', {
        method: 'POST',
        body: JSON.stringify({
          access: { valid_until: validUntil },
          aspsp: { name: aspspName, country },
          state: crypto.randomUUID(),
          redirect_url: redirectUrl,
          psu_type: psuType,
        }),
      });
      if (!r.ok) return J({ error: r.json || r.txt }, r.status);
      return J({ url: r.json?.url, authorization_id: r.json?.authorization_id });
    }

    if (action === 'finish') {
      if (!body.code) return J({ error: 'falta code' }, 400);
      const r = await ebFetch('/sessions', { method: 'POST', body: JSON.stringify({ code: body.code }) });
      if (!r.ok) return J({ error: r.json || r.txt }, r.status);
      const s = r.json || {};
      const cuentas = (s.accounts || []).map((a: any) => ({
        uid: a.uid ?? a.account_id ?? a.resource_id,
        iban: a.account_id?.iban ?? a.iban ?? a.identification ?? '',
        name: a.name ?? a.product ?? a.details ?? '',
        currency: a.currency ?? '',
      }));
      return J({ session_id: s.session_id ?? s.sessionId ?? s.id, accounts: cuentas });
    }

    return J({ error: 'acción desconocida: ' + action }, 400);
  } catch (e: any) {
    return J({ error: e.message }, 500);
  }
});
