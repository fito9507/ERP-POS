// ── Enable Banking · sincronización ───────────────────────────
// Lee las cuentas de la sesión autorizada (EB_SESSION_ID) y devuelve el
// contrato común { transactions, balances } que ya consume el ERP, con
// cuenta_iban en cada movimiento para el mapeo IBAN→caja.
// La sesión se obtiene una vez desde enablebanking.html (válida ~90 días).

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const API = Deno.env.get('EB_API_URL') || 'https://api.enablebanking.com';

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function limpiarId(v: unknown): string {
  return String(v ?? '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').replace(/[^A-Za-z0-9_-]/g, '');
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
  if (!appId) throw new Error('Falta EB_APP_ID');
  const now = Math.floor(Date.now() / 1000);
  const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const cuerpo = `${enc({ typ: 'JWT', alg: 'RS256', kid: appId })}.${enc({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: now, exp: now + 3600 })}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await clave(), new TextEncoder().encode(cuerpo));
  return `${cuerpo}.${b64url(sig)}`;
}
async function ebGet(path: string, token: string) {
  const r = await fetch(`${API}${path}`, { headers: { 'Authorization': `Bearer ${token}` } });
  const txt = await r.text();
  let json: any = null;
  try { json = JSON.parse(txt); } catch { /* no-json */ }
  return { ok: r.ok, status: r.status, json, txt };
}

// Enable Banking devuelve importes como { amount:"12.34", currency:"EUR" }
// con credit_debit_indicator CRDT/DBIT.
function importe(t: any): { n: number; cur: string; conocido: boolean } {
  const a = t?.transaction_amount ?? t?.amount ?? {};
  const raw = typeof a === 'object' ? (a.amount ?? a.value) : a;
  let n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(',', '.'));
  const cur = (typeof a === 'object' ? a.currency : t?.currency) || '';
  if (!isFinite(n) || n === 0) return { n: 0, cur, conocido: false };
  const ind = String(t?.credit_debit_indicator ?? t?.creditDebitIndicator ?? '').toUpperCase();
  if (ind === 'CRDT') return { n: Math.abs(n), cur, conocido: true };
  if (ind === 'DBIT') return { n: -Math.abs(n), cur, conocido: true };
  return { n, cur, conocido: ind === '' ? false : true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const sessionId = Deno.env.get('EB_SESSION_ID');
    if (!sessionId) throw new Error('Falta EB_SESSION_ID: autoriza en enablebanking.html');
    const token = await jwt();
    const avisos: string[] = [];

    // 1. Cuentas de la sesión
    const ses = await ebGet(`/sessions/${encodeURIComponent(sessionId)}`, token);
    if (!ses.ok) throw new Error(`Sesión Enable Banking: ${ses.status} ${ses.txt.slice(0, 200)} — puede haber caducado; re-autoriza en enablebanking.html`);
    const cuentas: any[] = ses.json?.accounts || [];

    const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const transactions: any[] = [];
    const balances: any[] = [];

    for (const acc of cuentas) {
      const uid = acc?.uid ?? acc?.account_id?.iban ?? acc?.resource_id;
      if (!uid) continue;
      const iban = acc?.account_id?.iban ?? acc?.iban ?? String(uid);
      const alias = acc?.name ?? acc?.product ?? acc?.details ?? '';
      const monedaCta = acc?.currency ?? '';

      // 2. Saldo
      const bal = await ebGet(`/accounts/${encodeURIComponent(uid)}/balances`, token);
      if (bal.ok) {
        const arr = bal.json?.balances || [];
        // preferir "disponible" (interimAvailable/expected), si no el primero
        const pick = arr.find((b: any) => /avail|expected|clbd|interim/i.test(String(b?.balance_type ?? b?.name ?? ''))) || arr[0];
        if (pick) {
          const ba = pick.balance_amount ?? pick.amount ?? {};
          const bn = parseFloat(String(ba.amount ?? ba.value ?? '').replace(',', '.'));
          if (isFinite(bn)) balances.push({ iban, alias, currency: ba.currency ?? (monedaCta || 'EUR'), amount: bn });
        }
      } else { avisos.push(`balance ${iban}: ${bal.status} ${bal.txt.slice(0, 120)}`); }

      // 3. Movimientos
      const tx = await ebGet(`/accounts/${encodeURIComponent(uid)}/transactions?date_from=${desde}`, token);
      if (!tx.ok) { avisos.push(`tx ${iban}: ${tx.status} ${tx.txt.slice(0, 120)}`); continue; }
      const movs: any[] = tx.json?.transactions || [];
      for (const t of movs) {
        const { n, cur, conocido } = importe(t);
        const ref = (Array.isArray(t?.remittance_information) ? t.remittance_information.join(' ') : t?.remittance_information)
          || t?.reference_number || t?.creditor?.name || t?.debtor?.name || 'Abanca';
        const rawId = t?.entry_reference ?? t?.transaction_id ?? t?.reference_number ?? '';
        const estado = String(t?.status ?? t?.transaction_status ?? 'BOOK').toUpperCase();
        transactions.push({
          id: limpiarId(iban) + '-' + limpiarId(rawId || (t?.booking_date ?? '') + '-' + n),
          created_at: t?.booking_date ?? t?.value_date ?? t?.transaction_date ?? null,
          estado: estado.includes('PDNG') || estado.includes('PENDING') ? 'PENDING' : 'COMPLETED',
          currency: cur || monedaCta || 'EUR',
          amount: n,
          signo_conocido: conocido,
          reference: String(ref).trim().slice(0, 200) || 'Abanca',
          type: 'ABANCA_EB',
          cuenta_iban: iban,
          cuenta_alias: alias,
        });
      }
    }

    return J({ transactions, balances, avisos, cuentas: cuentas.length });
  } catch (e: any) {
    return J({ error: e.message }, 400);
  }
});
