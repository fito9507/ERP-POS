import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Wise devuelve los importes maquetados: "<positive>+ 100 USD</positive>" para
// las entradas y "100 USD" a secas para las salidas. Devolvemos el signo ya
// resuelto y, cuando no se puede resolver, `signo_conocido: false` — el ERP
// descarta esas actividades en vez de adivinar, porque adivinar mal registra
// un ingreso como gasto.
function parsearImporte(primaryAmount: unknown, tipo: string) {
  if (typeof primaryAmount !== 'string' || !primaryAmount.trim()) {
    return { importe: 0, moneda: '', signoConocido: false };
  }

  const limpio = primaryAmount.replace(/<[^>]*>?/gm, '').trim();
  const partes = limpio.split(/\s+/);
  if (partes.length < 2) {
    return { importe: 0, moneda: '', signoConocido: false };
  }

  const moneda = partes[partes.length - 1];
  const valStr = partes.slice(0, -1).join('').replace(/,/g, '').replace(/^[+-]/, '');
  const valor = parseFloat(valStr);
  if (!isFinite(valor) || valor === 0) {
    return { importe: 0, moneda, signoConocido: false };
  }

  // Entrada solo si Wise lo marca explícitamente. Todo lo demás es salida,
  // que es la convención de la API. Antes se miraba además si la descripción
  // contenía "received", y eso invertía el signo de pagos salientes cuyo
  // texto mencionaba un cobro.
  const esEntrada = primaryAmount.includes('<positive>') ||
                    limpio.startsWith('+') ||
                    tipo === 'DEPOSIT';

  return { importe: esEntrada ? valor : -valor, moneda, signoConocido: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const wiseToken = Deno.env.get('WISE_API_TOKEN');
    if (!wiseToken) throw new Error("Missing WISE_API_TOKEN");

    const profileId = Deno.env.get('WISE_PROFILE_ID') || '65594311';

    const actRes = await fetch(`https://api.transferwise.com/v1/profiles/${profileId}/activities?limit=50`, {
      headers: { 'Authorization': `Bearer ${wiseToken}` }
    });

    if (!actRes.ok) {
      throw new Error("Wise API Error: " + await actRes.text());
    }

    const actData = await actRes.json();
    const activities = Array.isArray(actData?.activities) ? actData.activities : [];

    const parsedTransactions = activities.map((a: any) => {
      const tipo = a?.type ?? '';
      const { importe, moneda, signoConocido } = parsearImporte(a?.primaryAmount, tipo);

      const titleStr = typeof a?.title === 'string' ? a.title.replace(/<[^>]*>?/gm, '').trim() : '';
      const descStr = typeof a?.description === 'string' ? a.description.replace(/<[^>]*>?/gm, '').trim() : '';

      return {
        id: a?.id,
        created_at: a?.createdOn,
        // El ERP solo importa lo liquidado: una actividad IN_PROGRESS o
        // CANCELLED todavía no ha movido dinero.
        estado: a?.status ?? null,
        currency: moneda || 'USD',
        amount: importe,
        signo_conocido: signoConocido,
        reference: titleStr + (descStr ? ' - ' + descStr : ''),
        type: tipo
      };
    });

    return new Response(JSON.stringify({ transactions: parsedTransactions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
