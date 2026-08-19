import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ── ABANCA Open Banking (PSD2) ────────────────────────────────
// Secrets necesarios en Supabase (Edge Functions → Secrets):
//   ABANCA_CLIENT_ID      — de la APP creada en el portal Open Banking (Claves)
//   ABANCA_CLIENT_SECRET  — idem
//   ABANCA_REFRESH_TOKEN  — se obtiene UNA vez autorizando con abanca-callback
// Opcionales (los valores exactos están en Documentación del portal):
//   ABANCA_BASE_URL   — por defecto https://api.abanca.com (verificado: /psd2/me/accounts y /oauth2/token responden 401 sin credenciales)
//   ABANCA_TOKEN_URL  — por defecto {BASE}/oauth2/token
//
// Devuelve el mismo contrato que wise-sync: { transactions, balances }.
// Cada transacción lleva cuenta_iban para que el ERP la mapee a su caja
// (hay varias cajas ABANCA en EUR: el mapeo IBAN→caja vive en el cliente).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function limpiarId(v: unknown): string {
  return String(v ?? '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').replace(/[^A-Za-z0-9_-]/g, '');
}

// El importe puede venir como número firmado, como string, o como objeto
// {amount, currency} según la versión. Se intenta en ese orden y, si además
// hay un campo de sentido (creditDebitIndicator / type), se respeta.
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
  // Sin indicador: PSD2 suele firmar el número directamente.
  return { importe: n, conocido: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get('ABANCA_CLIENT_ID');
    const clientSecret = Deno.env.get('ABANCA_CLIENT_SECRET');
    const refreshToken = Deno.env.get('ABANCA_REFRESH_TOKEN');
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Faltan credenciales de Abanca en Supabase Secrets (ABANCA_CLIENT_ID / ABANCA_CLIENT_SECRET / ABANCA_REFRESH_TOKEN). Ver docs/Abanca.md');
    }

    const base = (Deno.env.get('ABANCA_BASE_URL') || 'https://api.abanca.com').replace(/\/$/, '');
    const tokenUrl = Deno.env.get('ABANCA_TOKEN_URL') || `${base}/oauth2/token`;

    // 1. refresh_token → access_token (client_secret_basic + fallback en body)
    const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });
    let tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`),
      },
      body: body.toString(),
    });
    if (!tokenRes.ok) {
      const body2 = new URLSearchParams({
        grant_type: 'refresh_token', refresh_token: refreshToken,
        client_id: clientId, client_secret: clientSecret,
      });
      tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body2.toString(),
      });
    }
    if (!tokenRes.ok) {
      throw new Error(`Token Abanca (${tokenUrl}): ${tokenRes.status} ${await tokenRes.text()}`);
    }
    const tok = await tokenRes.json();
    const auth = { 'Authorization': `Bearer ${tok.access_token}` };

    // 2. Cuentas del cliente
    const accRes = await fetch(`${base}/psd2/me/accounts`, { headers: auth });
    if (!accRes.ok) throw new Error(`Abanca /accounts: ${accRes.status} ${await accRes.text()}`);
    const accData = await accRes.json();
    const cuentas: any[] = Array.isArray(accData) ? accData
      : accData?.accounts ?? accData?.accountList ?? accData?.data ?? [];

    const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const transactions: any[] = [];
    const balances: any[] = [];

    for (const acc of cuentas) {
      const accountId = acc?.accountId ?? acc?.id ?? acc?.resourceId;
      if (!accountId) continue;
      const iban = acc?.iban ?? acc?.IBAN ?? acc?.accountNumber ?? String(accountId);
      const alias = acc?.alias ?? acc?.name ?? acc?.product ?? '';
      const monedaCta = acc?.currency ?? acc?.divisa ?? '';

      // 2a. Saldo real de la cuenta
      try {
        const balRes = await fetch(`${base}/psd2/me/accounts/${encodeURIComponent(accountId)}/balance`, { headers: auth });
        if (balRes.ok) {
          const bal = await balRes.json();
          let bv: unknown = bal?.amount ?? bal?.balance ?? bal?.balanceAmount?.amount ?? bal?.saldo;
          if (bv && typeof bv === 'object') bv = (bv as any).amount ?? (bv as any).value;
          const bn = typeof bv === 'number' ? bv : parseFloat(String(bv ?? '').replace(',', '.'));
          if (isFinite(bn)) {
            balances.push({ iban, alias, currency: bal?.currency ?? (monedaCta || 'EUR'), amount: bn });
          }
        } else {
          console.warn('balance', iban, balRes.status, await balRes.text());
        }
      } catch (e) { console.warn('balance', iban, e); }

      // 2b. Movimientos (concept es obligatorio según la referencia: vacío = todos)
      try {
        const txUrl = `${base}/psd2/me/accounts/${encodeURIComponent(accountId)}/transactions?concept=&dateFrom=${desde}`;
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
            // el id de PSD2 es por cuenta: se prefija con el IBAN para que no
            // colisione entre cuentas
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
