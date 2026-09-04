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
      Prefer: 'resolution=merge-duplicates,return=minimal',
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
  if (!token && !pin) return J({ error: 'Falta el PIN' }, 400);

  let inv: Record<string, unknown> | null = null;

  if (token) {
    // ── Vía 1: enlace con token (compatible con los enlaces ya repartidos) ──
    const ri = await db(`inversores?select=*&token=eq.${encodeURIComponent(token)}&limit=1`);
    inv = ri.ok ? (await ri.json())[0] : null;
    if (!inv || inv.activo === false) return J({ error: 'Enlace no válido' }, 401);

    // Segunda llave opcional sobre el enlace: sha256(token+':'+pin)
    if (inv.pin_hash) {
      if (inv.pin_bloqueado_hasta && new Date(inv.pin_bloqueado_hasta as string) > new Date()) {
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
  } else {
    // ── Vía 2: portal común (marinmetal.com/investment) — entra SOLO con PIN ──
    // El PIN identifica al inversor: se prueba sha256(token_i+':'+pin) contra
    // cada hash guardado (tabla pequeña). Límite por IP: 5 fallos → 15 min.
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'desconocida';
    let rlRow: Record<string, unknown> | null = null;
    try {
      const rl = await db(`portal_intentos?ip=eq.${encodeURIComponent(ip)}&select=*&limit=1`);
      if (rl.ok) rlRow = (await rl.json())[0] || null;
    } catch { /* tabla aún no creada: sin límite, pero se avisa en el SQL */ }
    if (rlRow?.bloqueado_hasta && new Date(rlRow.bloqueado_hasta as string) > new Date()) {
      return J({ login_pin: true, bloqueado: true, error: 'Demasiados intentos. Espera 15 minutos.' }, 429);
    }

    const ri = await db(`inversores?select=*&pin_hash=not.is.null`);
    const cands = ri.ok ? await ri.json() : [];
    for (const c of cands as Record<string, unknown>[]) {
      if (c.activo === false) continue;
      if (await sha256Hex(`${c.token}:${pin}`) === c.pin_hash) { inv = c; break; }
    }

    if (!inv) {
      const fallos = (Number(rlRow?.fallos) || 0) + 1;
      const fila: Record<string, unknown> = { ip, fallos, actualizado: new Date().toISOString() };
      if (fallos >= 5) { fila.fallos = 0; fila.bloqueado_hasta = new Date(Date.now() + 15 * 60000).toISOString(); }
      try { await db('portal_intentos?on_conflict=ip', 'POST', fila); } catch { /* sin tabla */ }
      return J({ login_pin: true, error: 'PIN incorrecto' }, 401);
    }
    if (rlRow) { try { await db(`portal_intentos?ip=eq.${encodeURIComponent(ip)}`, 'DELETE'); } catch { /* nada */ } }
  }

  if (!inv) return J({ error: 'Acceso no válido' }, 401);

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
