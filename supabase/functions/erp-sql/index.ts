// ── SQL de administración ─────────────────────────────────────
// Ejecuta SQL contra la base del ERP usando la conexión directa que la
// plataforma da a las Edge Functions (SUPABASE_DB_URL). Sirve para aplicar
// migraciones y correcciones sin pasar por el SQL Editor a mano.
//
// Solo para sesiones con rol ADMIN (misma llave que ya abre todo el ERP):
// el token se valida contra Supabase Auth y el usuario contra la tabla
// `usuarios`. Todo el texto se ejecuta dentro de UNA transacción: si una
// sentencia falla, no se aplica nada.
import postgres from 'https://deno.land/x/postgresjs@v3.4.5/mod.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const SB = Deno.env.get('SUPABASE_URL') || '';
const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') || '';
const DB_URL = Deno.env.get('SUPABASE_DB_URL') || '';

function J(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
}

async function esAdmin(token: string): Promise<string | null> {
  if (!token || token === ANON) return null;
  const r = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const au = await r.json();
  const nombre = au?.user_metadata?.erp_usuario;
  if (!nombre) return null;
  const q = await fetch(`${SB}/rest/v1/usuarios?select=nombre,rol,activo&nombre=eq.${encodeURIComponent(nombre)}&limit=1`, {
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
  });
  const u = q.ok ? (await q.json())[0] : null;
  return u && u.activo !== false && u.rol === 'admin' ? String(u.nombre) : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!SB || !SRK || !DB_URL) return J({ error: 'Falta configuración del servidor (SUPABASE_DB_URL)' }, 500);

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const admin = await esAdmin(token);
  if (!admin) return J({ error: 'Solo administradores' }, 403);

  let body: { sql?: string } = {};
  try { body = await req.json(); } catch { return J({ error: 'Cuerpo JSON inválido' }, 400); }
  const texto = String(body.sql || '').trim();
  if (!texto) return J({ error: 'Falta sql' }, 400);

  const sql = postgres(DB_URL, { prepare: false, max: 1 });
  try {
    // deno-lint-ignore no-explicit-any
    const out = await sql.begin(async (tx: any) => await tx.unsafe(texto));
    // una sentencia → array de filas; varias → array de arrays de filas
    const lista: unknown[] = (Array.isArray(out) && out.length && Array.isArray(out[0])) ? out : [out];
    const resultados = lista.map((r) => {
      const arr = r as unknown as Record<string, unknown>[] & { command?: string; count?: number };
      return { command: arr.command ?? null, count: arr.count ?? (Array.isArray(arr) ? arr.length : null), rows: Array.isArray(arr) ? arr.slice(0, 200) : [] };
    });
    return J({ ok: true, admin, resultados });
  } catch (e) {
    return J({ ok: false, error: (e as Error).message }, 400);
  } finally {
    try { await sql.end({ timeout: 2 }); } catch { /* nada */ }
  }
});
