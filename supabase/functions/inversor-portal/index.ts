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

function db(path: string) {
  return fetch(`${SB}/rest/v1/${path}`, {
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!SB || !SRK) return J({ error: 'Falta configuración del servidor' }, 500);

  // token por querystring (?t=) o por cuerpo JSON
  let token = new URL(req.url).searchParams.get('t') || '';
  if (!token && req.method === 'POST') {
    try { token = String((await req.json()).token || ''); } catch { /* sin cuerpo */ }
  }
  token = token.trim();
  if (!token) return J({ error: 'Falta el token' }, 400);

  // ¿de quién es este token?
  const ri = await db(`inversores?select=id,nombre,activo&token=eq.${encodeURIComponent(token)}&limit=1`);
  const inv = ri.ok ? (await ri.json())[0] : null;
  if (!inv || inv.activo === false) return J({ error: 'Enlace no válido' }, 401);

  // sus fotos curadas (una por contenedor), más recientes primero
  const rs = await db(`inversor_snapshot?select=*&inversor_id=eq.${inv.id}&order=actualizado.desc`);
  const snaps = rs.ok ? await rs.json() : [];

  // El ERP ya curó el bloque `datos`; se devuelve tal cual. Si una foto
  // vieja aún no lo tiene, se arma desde los campos sueltos (compatibilidad).
  const contenedores = (snaps as Record<string, unknown>[]).map((s) => {
    if (s.datos && typeof s.datos === 'object') {
      return { ...(s.datos as Record<string, unknown>), actualizado: s.actualizado || null };
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
