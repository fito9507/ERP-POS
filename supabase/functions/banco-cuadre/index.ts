// ── Cuadre bancario TOTAL en el servidor ─────────────────────────
// Llama a los tres syncs (wise-sync, revolut-sync, enablebanking-sync),
// normaliza cada banco igual que el cliente del ERP y escribe en
// movimientos_ig + mov_cajas lo que falte, deduplicando por el marcador
// (WISE_ID: / REV_ID: / ABANCA_ID:). Abanca ya se cuadra a sí misma
// dentro de enablebanking-sync; aquí solo se invoca y se recoge el conteo.
// Pensada para el cron (supabase_cron_bancos.sql) y para llamarla a mano.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SB = Deno.env.get('SUPABASE_URL') || '';
const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

function sanear(id: unknown): string {
  return String(id ?? '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').replace(/[^A-Za-z0-9_-]/g, '');
}
function sanearLegacy(id: unknown): string {
  return String(id ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);
}

function db(method: string, path: string, body?: unknown) {
  return fetch(`${SB}/rest/v1/${path}`, {
    method,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

interface Entrada { id: string; idLegacy: string | null; fecha: string; moneda: string; importe: number; concepto: string; }

// ── normalizadores (calcados del cliente) ──
function normWise(t: any): Entrada[] {
  if (t.estado && t.estado !== 'COMPLETED') return [];
  if (t.signo_conocido === false) return [];
  if (typeof t.amount !== 'number' || !isFinite(t.amount) || t.amount === 0) return [];
  if (!t.currency) return [];
  const id = sanear(t.id);
  if (!id) return [];
  return [{ id, idLegacy: sanearLegacy(t.id), fecha: t.created_at || new Date().toISOString(), moneda: t.currency, importe: t.amount, concepto: t.reference || 'Wise Sync' }];
}
function normRevolut(t: any): Entrada[] {
  if (t.state !== 'completed') return [];
  const baseId = sanear(t.id);
  if (!baseId) return [];
  const out: Entrada[] = [];
  (t.legs || []).forEach((leg: any, k: number) => {
    if (!leg || typeof leg.amount !== 'number' || !isFinite(leg.amount) || !leg.currency || leg.amount === 0) return;
    let concepto = t.reference || leg.description || 'Revolut Sync';
    if (leg.description && leg.description !== concepto) concepto += ' - ' + leg.description;
    out.push({ id: k === 0 ? baseId : baseId + '-l' + k, idLegacy: k === 0 ? sanearLegacy(t.id) : null, fecha: t.created_at, moneda: leg.currency, importe: leg.amount, concepto });
  });
  return out;
}

const BANCOS = [
  { nombre: 'Wise', endpoint: 'wise-sync', prefijo: 'WISE_ID', cajas: { USD: 'USD WISE', EUR: 'EUR WISE' } as Record<string, string>, norm: normWise },
  { nombre: 'Revolut', endpoint: 'revolut-sync', prefijo: 'REV_ID', cajas: { USD: 'USD REVOLUT', EUR: 'EUR REVOLUT' } as Record<string, string>, norm: normRevolut },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (!SB || !SRK) return J({ error: 'faltan SUPABASE_URL / SERVICE_ROLE_KEY' }, 500);

  const resultado: Record<string, unknown> = {};

  // tasa EUR→USD para equiv_usd (misma fila que usa el ERP)
  let eurusd = 0.89;
  try {
    const rt = await db('GET', 'tasas?select=valor&moneda=eq.EURUSD');
    const v = parseFloat((await rt.json())?.[0]?.valor);
    if (isFinite(v) && v > 0.5 && v < 2) eurusd = v;
  } catch { /* fallback */ }
  const equivUSD = (amt: number, mon: string) => mon === 'USD' ? amt : (mon === 'EUR' ? amt / eurusd : amt);

  for (const B of BANCOS) {
    const avisos: string[] = [];
    let insertadas = 0;
    const detalles: string[] = [];
    try {
      const r = await fetch(`${SB}/functions/v1/${B.endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SRK}`, apikey: SRK, 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!r.ok) throw new Error(`${B.endpoint}: ${r.status} ${(await r.text()).slice(0, 150)}`);
      const data = await r.json();
      const brutas: any[] = data.transactions || [];

      // dedup por marcador — si no se puede leer, NO insertar (duplicaría)
      const rv = await db('GET', `movimientos_ig?select=notas&notas=like.*${encodeURIComponent(B.prefijo + ':')}*&limit=10000`);
      if (!rv.ok) throw new Error(`markers ${B.prefijo}: ${rv.status}`);
      const vistos = new Set<string>();
      const re = new RegExp(B.prefijo + ':([A-Za-z0-9_-]+)');
      for (const f of await rv.json()) {
        const m = String(f?.notas ?? '').match(re);
        if (m) vistos.add(m[1]);
      }

      for (const bruta of brutas) {
        for (const t of B.norm(bruta)) {
          if (vistos.has(t.id) || (t.idLegacy && vistos.has(t.idLegacy))) continue;
          const caja = B.cajas[t.moneda];
          if (!caja) { avisos.push(`sin caja ${B.nombre} para ${t.moneda}: ${t.importe}`); continue; }
          const esIng = t.importe > 0;
          const amt = Math.abs(t.importe);
          const marca = `${B.prefijo}:${t.id}`;
          const fecha = String(t.fecha).slice(0, 10);
          const r1 = await db('POST', 'movimientos_ig', {
            fecha, tipo: esIng ? 'Ingreso no-venta' : 'Gasto operativo',
            descripcion: t.concepto, monto: amt, moneda: t.moneda,
            equiv_usd: parseFloat(equivUSD(amt, t.moneda).toFixed(4)), cuenta: caja, vendedor: 'Sistema', notas: marca,
          });
          if (!r1.ok) { avisos.push(`ig ${t.id}: ${r1.status}`); continue; }
          const r2 = await db('POST', 'mov_cajas', {
            fecha, tipo: esIng ? 'deposito' : 'retiro',
            caja_origen: esIng ? null : caja, caja_destino: esIng ? caja : null,
            monto_origen: amt, monto_destino: amt,
            notas: `${t.concepto} (${marca})`, usuario: 'Sistema',
          });
          if (!r2.ok) {
            await db('DELETE', `movimientos_ig?notas=eq.${encodeURIComponent(marca)}`);
            avisos.push(`mov_cajas ${t.id}: ${r2.status}`);
            continue;
          }
          insertadas++;
          vistos.add(t.id);
          detalles.push(`${caja} ${esIng ? '+' : '-'}${amt} ${t.moneda} · ${t.concepto.slice(0, 40)}`);
        }
      }
    } catch (e: any) { avisos.push(e.message); }
    resultado[B.nombre.toLowerCase()] = { insertadas, detalles, avisos };
  }

  // Abanca: se cuadra a sí misma dentro de enablebanking-sync
  try {
    const r = await fetch(`${SB}/functions/v1/enablebanking-sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SRK}`, apikey: SRK, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const data = r.ok ? await r.json() : { avisos: [`enablebanking-sync: ${r.status}`] };
    resultado['abanca'] = { insertadas: data.insertadas ?? 0, detalles: data.detalles ?? [], avisos: data.avisos ?? [] };
  } catch (e: any) { resultado['abanca'] = { insertadas: 0, detalles: [], avisos: [e.message] }; }

  return J(resultado);
});
