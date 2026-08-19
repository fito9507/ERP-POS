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
function parsearImporte(primaryAmount: unknown, tipo: string, titulo: string) {
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
  //
  // Caso especial: las conversiones entre saldos propios (type INTERBALANCE,
  // título "To USD", "To EUR"...) vienen expresadas en la moneda DESTINO,
  // así que son dinero que ENTRA a ese saldo. La heurística vieja las
  // registraba como retiro y dejó el USD WISE en negativo. Ojo: la pata de
  // salida (el saldo origen de la conversión) no aparece en /activities;
  // el descuadre residual lo absorbe la comparación contra `balances`.
  const esConversionEntrante = (tipo === 'INTERBALANCE' || tipo === 'BALANCE_TRANSACTION') && /^To\s/i.test(titulo);
  const esEntrada = primaryAmount.includes('<positive>') ||
                    limpio.startsWith('+') ||
                    tipo === 'DEPOSIT' ||
                    esConversionEntrante;

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
    const auth = { 'Authorization': `Bearer ${wiseToken}` };

    // Actividades y saldos reales en paralelo. Los saldos (/v4/balances) son
    // la verdad contable: el ERP los compara con sus cajas WISE y ofrece el
    // ajuste, porque /activities solo cubre una ventana y no da las dos patas
    // de las conversiones.
    const [actRes, balRes] = await Promise.all([
      fetch(`https://api.transferwise.com/v1/profiles/${profileId}/activities?limit=50`, { headers: auth }),
      fetch(`https://api.transferwise.com/v4/profiles/${profileId}/balances?types=STANDARD`, { headers: auth }),
    ]);

    if (!actRes.ok) {
      throw new Error("Wise API Error: " + await actRes.text());
    }

    const actData = await actRes.json();
    const activities = Array.isArray(actData?.activities) ? actData.activities : [];

    let balances: { currency: string; amount: number }[] = [];
    if (balRes.ok) {
      const balData = await balRes.json();
      if (Array.isArray(balData)) {
        balances = balData.map((b: any) => ({
          currency: b?.currency ?? '',
          amount: typeof b?.amount?.value === 'number' ? b.amount.value : parseFloat(b?.amount?.value ?? '0'),
        })).filter((b) => b.currency);
      }
    } else {
      console.warn('Wise balances:', balRes.status, await balRes.text());
    }

    const parsedTransactions = activities.map((a: any) => {
      const tipo = a?.type ?? '';
      const titleStr = typeof a?.title === 'string' ? a.title.replace(/<[^>]*>?/gm, '').trim() : '';
      const descStr = typeof a?.description === 'string' ? a.description.replace(/<[^>]*>?/gm, '').trim() : '';
      const { importe, moneda, signoConocido } = parsearImporte(a?.primaryAmount, tipo, titleStr);

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

    return new Response(JSON.stringify({ transactions: parsedTransactions, balances }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
