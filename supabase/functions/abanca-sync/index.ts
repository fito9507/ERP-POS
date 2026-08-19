import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ── ABANCA Open Banking ───────────────────────────────────────
// Flujo según la Documentación oficial del portal:
//  - Token:  POST {base}/oauth2/token  con cabecera AuthKey y body
//            grant_type=refresh_token&APLICACION={id}&refresh_token={rt}
//            (la app se identifica con AuthKey, no hay client_secret)
//  - API V2: {base}/v2/psd2 (producción) · {base}/sandbox/v2/psd2 (sandbox)
//  - Toda petición lleva AuthKey + Authorization: Bearer.
//  - Cuentas de EMPRESA: el ticket trae "contracts"; cada contrato se
//    consulta con la cabecera x-clienteContratoId.
//
// Secrets: ABANCA_CLIENT_ID, ABANCA_API_KEY, ABANCA_REFRESH_TOKEN.
// Opcionales: ABANCA_INSTANCE (Abanca|Sandbox), ABANCA_BASE_URL.
//
// Devuelve el contrato común: { transactions, balances }, cada transacción
// con cuenta_iban para que el ERP la mapee a su caja por IBAN.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function limpiarId(v: unknown): string {
  return String(v ?? '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').replace(/[^A-Za-z0-9_-]/g, '');
}

// El importe puede venir como número firmado, string, u objeto {amount}.
// Si hay indicador de sentido se respeta; si no, PSD2 firma el número.
function importeFirmado(t: any): { importe: number; conocido: boolean } {
  let v: unknown = t?.amount ?? t?.importe ?? t?.transactionAmount?.amount ?? t?.transactionAmount;
  if (v && typeof v === 'object') v = (v as any).amount ?? (v as any).value;
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  if (!isFinite(n) || n === 0) return { importe: 0, conocido: false };

  const ind = String(t?.creditDebitIndicator ?? t?.type ?? t?.tipo ?? '').toUpperCase();
  if (ind.includes('CRDT') || ind.includes('CREDIT') || ind.includes('ABONO') || ind.includes('HABER')) {
    return { importe: Math.abs(n), conocido: true };
  }
  if (ind.includes('DBIT') || ind.includes('DEBIT') || ind.includes('CARGO') || ind.includes('DEBE')) {
    return { importe: -Math.abs(n), conocido: true };
  }
  return { importe: n, conocido: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get('ABANCA_CLIENT_ID');
    const apiKey = Deno.env.get('ABANCA_API_KEY') || Deno.env.get('ABANCA_CLIENT_SECRET');
    const refreshToken = Deno.env.get('ABANCA_REFRESH_TOKEN');
    if (!clientId || !apiKey) throw new Error('Faltan ABANCA_CLIENT_ID / ABANCA_API_KEY en Supabase Secrets.');
    if (!refreshToken) throw new Error('Falta ABANCA_REFRESH_TOKEN: autoriza primero desde /functions/v1/abanca-callback');

    const base = (Deno.env.get('ABANCA_BASE_URL') || 'https://api.abanca.com').replace(/\/$/, '');
    const instancia = Deno.env.get('ABANCA_INSTANCE') || 'Abanca';
    const apiBase = Deno.env.get('ABANCA_API_BASE') ||
      (instancia.toLowerCase() === 'sandbox' ? `${base}/sandbox/v2/psd2` : `${base}/v2/psd2`);
    const tokenUrl = Deno.env.get('ABANCA_TOKEN_URL') || `${base}/oauth2/token`;

    // 1. refresh_token → access_token (formato exacto de la Documentación)
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'AuthKey': apiKey },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        APLICACION: clientId,
        refresh_token: refreshToken,
      }).toString(),
    });
    if (!tokenRes.ok) {
      throw new Error(`Token Abanca: ${tokenRes.status} ${await tokenRes.text()} — si el refresh token caducó, re-autoriza en /functions/v1/abanca-callback`);
    }
    const tok = await tokenRes.json();

    // Contratos de empresa: cada uno se consulta con x-clienteContratoId.
    // Sin contratos (particular) se hace una única pasada sin cabecera.
    let contratos: (string | null)[] = [null];
    const rawC = tok?.contracts;
    if (Array.isArray(rawC) && rawC.length) {
      contratos = rawC.map((c: any) => String(c?.identifier ?? c?.id ?? c)).filter(Boolean);
    } else if (rawC && typeof rawC === 'object') {
      contratos = Object.values(rawC).map((c: any) => String(c?.identifier ?? c?.id ?? c)).filter(Boolean);
    } else if (typeof rawC === 'string' && rawC) {
      contratos = [rawC];
    }
    if (!contratos.length) contratos = [null];

    const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const transactions: any[] = [];
    const balances: any[] = [];
    const ibansVistos = new Set<string>();

    for (const contrato of contratos) {
      const auth: Record<string, string> = {
        'Authorization': `Bearer ${tok.access_token}`,
        'AuthKey': apiKey,
      };
      if (contrato) auth['x-clienteContratoId'] = contrato;

      // 2. Cuentas (a la vista y de crédito)
      const accRes = await fetch(`${apiBase}/me/accounts`, { headers: auth });
      if (!accRes.ok) {
        console.warn('accounts', contrato, accRes.status, await accRes.text());
        continue;
      }
      const accData = await accRes.json();
      const cuentas: any[] = Array.isArray(accData) ? accData
        : accData?.accounts ?? accData?.accountList ?? accData?.data ?? [];

      for (const acc of cuentas) {
        const accountId = acc?.accountId ?? acc?.id ?? acc?.resourceId;
        if (!accountId) continue;
        const iban = String(acc?.iban ?? acc?.IBAN ?? acc?.accountNumber ?? accountId);
        if (ibansVistos.has(iban)) continue; // misma cuenta visible en 2 contratos
        ibansVistos.add(iban);
        const alias = acc?.alias ?? acc?.name ?? acc?.product ?? '';
        const monedaCta = acc?.currency ?? acc?.divisa ?? '';

        // 2a. Saldo real
        try {
          const balRes = await fetch(`${apiBase}/me/accounts/${encodeURIComponent(accountId)}/balance`, { headers: auth });
          if (balRes.ok) {
            const bal = await balRes.json();
            let bv: unknown = bal?.amount ?? bal?.balance ?? bal?.balanceAmount?.amount ?? bal?.saldo;
            if (bv && typeof bv === 'object') bv = (bv as any).amount ?? (bv as any).value;
            const bn = typeof bv === 'number' ? bv : parseFloat(String(bv ?? '').replace(',', '.'));
            if (isFinite(bn)) {
              balances.push({ iban, alias, currency: bal?.currency ?? (monedaCta || 'EUR'), amount: bn, contrato });
            }
          } else {
            console.warn('balance', iban, balRes.status, await balRes.text());
          }
        } catch (e) { console.warn('balance', iban, e); }

        // 2b. Movimientos (concept es obligatorio; vacío = todos)
        try {
          const txUrl = `${apiBase}/me/accounts/${encodeURIComponent(accountId)}/transactions?concept=&dateFrom=${desde}`;
          const txRes = await fetch(txUrl, { headers: auth });
          if (!txRes.ok) { console.warn('transactions', iban, txRes.status, await txRes.text()); continue; }
          const txData = await txRes.json();
          const movs: any[] = Array.isArray(txData) ? txData
            : txData?.transactions ?? txData?.transactionList ?? txData?.data ?? [];

          for (const t of movs) {
            const { importe, conocido } = importeFirmado(t);
            const rawId = t?.transactionId ?? t?.id ?? t?.reference ?? '';
            const estado = String(t?.status ?? t?.bookingStatus ?? 'BOOKED').toUpperCase();
            transactions.push({
              // el id de PSD2 es por cuenta: se prefija con el IBAN para no
              // colisionar entre cuentas
              id: limpiarId(iban) + '-' + limpiarId(rawId || (t?.bookingDate ?? '') + '-' + importe),
              created_at: t?.bookingDate ?? t?.valueDate ?? t?.date ?? t?.fecha ?? null,
              estado: (estado.includes('PDNG') || estado.includes('PENDING')) ? 'PENDING' : 'COMPLETED',
              currency: t?.currency ?? t?.divisa ?? t?.transactionAmount?.currency ?? (monedaCta || 'EUR'),
              amount: importe,
              signo_conocido: conocido,
              reference: String(t?.concept ?? t?.concepto ?? t?.description ?? t?.remittanceInformation ?? '').trim() || 'Abanca',
              type: 'ABANCA',
              cuenta_iban: iban,
              cuenta_alias: alias,
            });
          }
        } catch (e) { console.warn('transactions', iban, e); }
      }
    }

    return new Response(JSON.stringify({ transactions, balances }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
