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
    // accounts es un array de UIDs (strings); los detalles (IBAN) se piden
    // aparte porque Enable Banking no los expone directos en la sesión.
    const uids: string[] = (ses.json?.accounts || []).map((a: any) => typeof a === 'string' ? a : (a?.uid ?? a?.account_id?.iban)).filter(Boolean);

    const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const transactions: any[] = [];
    const balances: any[] = [];

    for (const uid of uids) {
      // 1. Detalles → IBAN y moneda
      let iban = String(uid), alias = '', monedaCta = '';
      const det = await ebGet(`/accounts/${encodeURIComponent(uid)}/details`, token);
      if (det.ok) {
        iban = det.json?.account_id?.iban ?? det.json?.iban ?? String(uid);
        alias = det.json?.name ?? det.json?.product ?? '';
        monedaCta = det.json?.currency && det.json.currency !== 'XXX' ? det.json.currency : '';
      } else { avisos.push(`details ${uid}: ${det.status}`); }

      // 2. Saldo — disponible (amount) y posición contable (booked, la que
      // en una póliza de crédito va en negativo por lo dispuesto)
      const bal = await ebGet(`/accounts/${encodeURIComponent(uid)}/balances`, token);
      if (bal.ok) {
        const arr = bal.json?.balances || [];
        const leer = (b: any) => {
          const ba = b?.balance_amount ?? b?.amount ?? {};
          const bn = parseFloat(String(ba.amount ?? ba.value ?? '').replace(',', '.'));
          return isFinite(bn) ? { n: bn, cur: ba.currency ?? (monedaCta || 'EUR') } : null;
        };
        const tipoDe = (b: any) => String(b?.balance_type ?? b?.name ?? '');
        const pick = arr.find((b: any) => /avail|expected|interim|xpcd|itav/i.test(tipoDe(b))) || arr[0];
        const book = arr.find((b: any) => /clbd|itbd|closingbooked|book/i.test(tipoDe(b)) && b !== pick);
        const pv = leer(pick);
        if (pv) {
          const bv = book ? leer(book) : null;
          balances.push({ iban, alias, currency: pv.cur, amount: pv.n,
            booked: bv ? bv.n : null,
            tipos: arr.map((b: any) => ({ tipo: tipoDe(b), valor: leer(b)?.n ?? null })) });
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

    // ── 4. Cuadre automático en el SERVIDOR ─────────────────────────
    // La inserción ya no depende del dispositivo (mapeo local, PWA vieja,
    // freno de 30 min): la propia función compara banco↔base por el
    // marcador ABANCA_ID y escribe lo que falte en movimientos_ig y
    // mov_cajas. El cliente sigue recibiendo transactions/balances y su
    // dedup verá los marcadores, así que nunca duplica.
    let insertadas = 0;
    const detalles: string[] = [];
    const SB = Deno.env.get('SUPABASE_URL');
    const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const MAPA: Record<string, string> = {
      'ES2120805043933940202989': 'USD ABANCA',
      'ES8720805043943040076381': 'EUR ABANCA',
      'ES6020805043995500163656': 'EUR CRÉDITO ABANCA',
    };
    if (SB && SRK) {
      const db = (method: string, path: string, body?: unknown) =>
        fetch(`${SB}/rest/v1/${path}`, {
          method,
          headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      try {
        const rv = await db('GET', 'movimientos_ig?select=notas&notas=like.*ABANCA_ID*&limit=10000');
        if (!rv.ok) throw new Error(`markers: ${rv.status}`);
        const vistos = new Set<string>();
        for (const f of await rv.json()) {
          const m = String(f?.notas ?? '').match(/ABANCA_ID:([A-Za-z0-9_-]+)/);
          if (m) vistos.add(m[1]);
        }
        // tasa para equiv_usd de los EUR (misma fila que usa el ERP)
        let eurusd = 0.89;
        try {
          const rt = await db('GET', 'tasas?select=valor&moneda=eq.EURUSD');
          const v = parseFloat((await rt.json())?.[0]?.valor);
          if (isFinite(v) && v > 0.5 && v < 2) eurusd = v;
        } catch { /* fallback 0.89 */ }

        for (const t of transactions) {
          if (t.estado !== 'COMPLETED' || t.signo_conocido === false) continue;
          if (typeof t.amount !== 'number' || !isFinite(t.amount) || t.amount === 0) continue;
          if (vistos.has(t.id)) continue;
          const caja = MAPA[t.cuenta_iban];
          if (!caja) { avisos.push(`sin caja para ${t.cuenta_iban}: ${t.amount} ${t.currency}`); continue; }
          const esIng = t.amount > 0;
          const amt = Math.abs(t.amount);
          const equiv = t.currency === 'USD' ? amt : (t.currency === 'EUR' ? amt / eurusd : amt);
          const marca = 'ABANCA_ID:' + t.id;
          const fecha = t.created_at || new Date().toISOString().slice(0, 10);
          const r1 = await db('POST', 'movimientos_ig', {
            fecha, tipo: esIng ? 'Ingreso no-venta' : 'Gasto operativo',
            descripcion: t.reference, monto: amt, moneda: t.currency,
            equiv_usd: parseFloat(equiv.toFixed(4)), cuenta: caja, vendedor: 'Sistema', notas: marca,
          });
          if (!r1.ok) { avisos.push(`ig ${t.id}: ${r1.status}`); continue; }
          const r2 = await db('POST', 'mov_cajas', {
            fecha, tipo: esIng ? 'deposito' : 'retiro',
            caja_origen: esIng ? null : caja, caja_destino: esIng ? caja : null,
            monto_origen: amt, monto_destino: amt,
            notas: `${t.reference} (${marca})`, usuario: 'Sistema',
          });
          if (!r2.ok) {
            // revertir el marcador para que el próximo sync lo reintente
            await db('DELETE', `movimientos_ig?notas=eq.${encodeURIComponent(marca)}`);
            avisos.push(`mov_cajas ${t.id}: ${r2.status}`);
            continue;
          }
          insertadas++;
          vistos.add(t.id);
          detalles.push(`${caja} ${esIng ? '+' : '-'}${amt} ${t.currency} · ${String(t.reference).slice(0, 40)}`);
        }
      } catch (e: any) { avisos.push(`cuadre servidor: ${e.message}`); }
    } else { avisos.push('cuadre servidor desactivado: falta SERVICE_ROLE_KEY'); }

    return J({ transactions, balances, avisos, cuentas: uids.length, insertadas, detalles });
  } catch (e: any) {
    return J({ error: e.message }, 400);
  }
});
