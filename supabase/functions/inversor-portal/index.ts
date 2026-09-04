// ── Portal del inversor (solo lectura, token privado) ─────────
// El inversor abre un enlace con su token (?t=...). Esta función lo
// valida con la clave de servicio y le devuelve SOLO su foto curada:
// avance del contenedor y su retorno. Nunca toca el ERP, nunca ve coste,
// margen, proveedor, otros contenedores ni otros inversores.
//
// verify_jwt=false: el token ES el secreto (como un enlace mágico).

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SB = Deno.env.get('SUPABASE_URL') || '';
const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

function J(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function db(path: string, method = 'GET', body?: unknown) {
  return fetch(`${SB}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!SB || !SRK) return J({ error: 'Falta configuración del servidor' }, 500);

  // token por querystring (?t=) o por cuerpo JSON; PIN solo por cuerpo
  let token = new URL(req.url).searchParams.get('t') || '';
  let pin = '';
  if (req.method === 'POST') {
    try {
      const b = await req.json();
      if (!token) token = String(b.token || '');
      pin = String(b.pin || '').trim();
    } catch { /* sin cuerpo */ }
  }
  token = token.trim();
  if (!token) return J({ error: 'Falta el token' }, 400);

  // ¿de quién es este token? (select=* tolera que las columnas de PIN aún no existan)
  const ri = await db(`inversores?select=*&token=eq.${encodeURIComponent(token)}&limit=1`);
  const inv = ri.ok ? (await ri.json())[0] : null;
  if (!inv || inv.activo === false) return J({ error: 'Enlace no válido' }, 401);

  // ── Segunda llave opcional: PIN del inversor ──
  // Hash con sal = sha256(token + ':' + pin). 5 fallos → 15 min de bloqueo.
  if (inv.pin_hash) {
    if (inv.pin_bloqueado_hasta && new Date(inv.pin_bloqueado_hasta) > new Date()) {
      return J({ requiere_pin: true, bloqueado: true, error: 'Demasiados intentos fallidos. Espera 15 minutos.' }, 429);
    }
    if (!pin) return J({ requiere_pin: true, error: '' }, 401);
    const h = await sha256Hex(`${token}:${pin}`);
    if (h !== inv.pin_hash) {
      const fallos = (Number(inv.pin_fallos) || 0) + 1;
      const patch: Record<string, unknown> = fallos >= 5
        ? { pin_fallos: 0, pin_bloqueado_hasta: new Date(Date.now() + 15 * 60000).toISOString() }
        : { pin_fallos: fallos };
      await db(`inversores?id=eq.${inv.id}`, 'PATCH', patch);
      return J({ requiere_pin: true, error: 'PIN incorrecto' }, 401);
    }
    if (Number(inv.pin_fallos) > 0) {
      await db(`inversores?id=eq.${inv.id}`, 'PATCH', { pin_fallos: 0 });
    }
  }

  // sus fotos curadas (una por contenedor), más recientes primero
  const rs = await db(`inversor_snapshot?select=*&inversor_id=eq.${inv.id}&order=actualizado.desc`);
  const snaps = rs.ok ? await rs.json() : [];

  // El ERP ya curó el bloque `datos`; se devuelve tal cual. Si una foto
  // vieja aún no lo tiene, se arma desde los campos sueltos (compatibilidad).
  // Campos sensibles: NUNCA salen si ver_detalle no está activo (red de
  // seguridad, aunque la foto se hubiera sembrado con ellos por error).
  const SENSIBLE = ['coste', 'margen_esperado', 'margen_actual', 'margen_pct'];
  const contenedores = (snaps as Record<string, unknown>[]).map((s) => {
    if (s.datos && typeof s.datos === 'object') {
      const d = { ...(s.datos as Record<string, unknown>) };
      if (!d.ver_detalle && d.finanzas && typeof d.finanzas === 'object') {
        const fin = { ...(d.finanzas as Record<string, unknown>) };
        for (const k of SENSIBLE) delete fin[k];
        d.finanzas = fin;
      }
      return { ...d, actualizado: s.actualizado || null };
    }
    return {
      contenedor: s.contenedor_nombre || s.contenedor_ref,
      estado: s.estado,
      ver_detalle: false,
      resumen: {
        unidades_total: Number(s.unidades_total || 0),
        unidades_vendidas: Number(s.unidades_vendidas || 0),
        unidades_restantes: Number(s.stock_restante || 0),
        pct_colocado: Number(s.pct_colocado || 0),
        ritmo_7d: Number(s.ritmo_7d || 0),
      },
      finanzas: {
        aporte: Number(s.aporte_usd || 0),
        ingresos_cobrados: Number(s.revenue_cobrado || 0),
        recuperado: Number(s.recuperado_usd || 0),
        retorno_usd: Number(s.retorno_usd || 0),
        retorno_proy_usd: Number(s.retorno_proy_usd || 0),
      },
      actualizado: s.actualizado || null,
    };
  });

  return J({ ok: true, inversor: inv.nombre, contenedores });
});
