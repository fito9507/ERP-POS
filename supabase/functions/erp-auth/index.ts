// ── Login del ERP en el servidor ──────────────────────────────
// Hasta ahora la tabla `usuarios` (con los PIN) se leía desde el
// navegador con la clave pública: cualquiera podía bajarse los hashes y,
// al ser PIN de 4 dígitos sin sal, sacarlos en menos de un segundo.
//
// Ahora:
//   · La lista de usuarios que ve la pantalla de login NO trae PIN.
//   · El PIN se comprueba aquí, con la clave de servicio, y con un
//     límite de intentos para que no se pueda probar 10.000 veces.
//   · Si el PIN es correcto se devuelve una SESIÓN de Supabase Auth,
//     que la app usa para hablar con la base de datos. Así las tablas
//     pueden cerrarse al público (rol `anon`) sin dejar de funcionar.
//
// El usuario de Auth es interno (uno por persona del ERP) y su
// contraseña se deriva del secreto ERP_AUTH_SECRET: no se guarda en
// ningún sitio y nadie la teclea nunca.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SB = Deno.env.get('SUPABASE_URL') || '';
const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SECRET = Deno.env.get('ERP_AUTH_SECRET') || '';

const MAX_INTENTOS = 8;          // por usuario
const VENTANA_MIN = 15;          // minutos

function J(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function db(method: string, path: string, body?: unknown, prefer?: string) {
  return fetch(`${SB}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      'Content-Type': 'application/json',
      Prefer: prefer || 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');

async function sha256(s: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}

// Contraseña interna del usuario de Auth: derivada del secreto, nunca guardada
async function passwordDe(usuario: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('erp-pass:' + usuario.toLowerCase()));
  return 'Xp' + hex(sig) + '!9';
}

const emailDe = (usuario: string) =>
  usuario.toLowerCase().replace(/[^a-z0-9]/g, '') + '@usuarios.erp-marinmetal.internal';

// ¿El PIN coincide? Acepta el formato viejo (SHA-256 del PIN a secas) y
// el nuevo con sal, para poder migrar sin dejar a nadie fuera.
async function pinCorrecto(pin: string, guardado: string, sal: string | null) {
  if (!guardado) return false;
  if (sal) return (await sha256(sal + ':' + pin)) === guardado;
  return (await sha256(pin)) === guardado;
}

// Límite de intentos: cuenta los fallos recientes de ese usuario
async function intentosRecientes(usuario: string) {
  const desde = new Date(Date.now() - VENTANA_MIN * 60000).toISOString();
  const r = await db('GET', `login_intentos?select=id&usuario=eq.${encodeURIComponent(usuario)}&ok=is.false&creado=gte.${desde}`);
  if (!r.ok) return 0;                       // si la tabla no existe aún, no bloquear
  return ((await r.json()) as unknown[]).length;
}

async function apuntarIntento(usuario: string, ok: boolean, ip: string) {
  try {
    await db('POST', 'login_intentos', { usuario, ok, ip }, 'return=minimal');
  } catch { /* el registro de intentos no debe tumbar el login */ }
}

// Asegura que existe el usuario de Auth y devuelve su sesión
async function sesionDe(usuario: string) {
  const email = emailDe(usuario);
  const password = await passwordDe(usuario);

  const entrar = () =>
    fetch(`${SB}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

  let r = await entrar();
  if (!r.ok) {
    // Primera vez (o contraseña desincronizada): crear/actualizar y reintentar
    const crear = await fetch(`${SB}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { erp_usuario: usuario } }),
    });
    if (!crear.ok) {
      // Ya existía: buscarlo y ponerle la contraseña derivada
      const lista = await fetch(`${SB}/auth/v1/admin/users?page=1&per_page=200`, {
        headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
      });
      const js = lista.ok ? await lista.json() : { users: [] };
      const u = (js.users || []).find((x: { email?: string }) => (x.email || '').toLowerCase() === email);
      if (u) {
        await fetch(`${SB}/auth/v1/admin/users/${u.id}`, {
          method: 'PUT',
          headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, email_confirm: true }),
        });
      }
    }
    r = await entrar();
  }
  if (!r.ok) return null;
  return await r.json();
}

// ¿Quién hace esta petición? (a partir de su sesión) — devuelve su ficha
// del ERP, para poder exigir que sea administrador.
async function usuarioDeToken(token: string) {
  if (!token || token === ANON) return null;
  const r = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const au = await r.json();
  const nombre = au?.user_metadata?.erp_usuario;
  if (!nombre) return null;
  const q = await db('GET', `usuarios?select=nombre,rol,activo&nombre=eq.${encodeURIComponent(nombre)}&limit=1`);
  const filas = q.ok ? await q.json() : [];
  const u = filas[0];
  return u && u.activo !== false ? u : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!SB || !SRK) return J({ error: 'Falta configuración del servidor' }, 500);

  let body: { action?: string; usuario?: string; pin?: string } = {};
  try { body = await req.json(); } catch { /* sin cuerpo */ }
  const accion = String(body.action || 'list');
  const ip = req.headers.get('x-forwarded-for') || '';

  // ── Lista de usuarios para la pantalla de login (SIN PIN) ──
  if (accion === 'list') {
    const r = await db('GET', 'usuarios?select=nombre,rol,almacen,color,tc,modulos,activo,puede_vender,a_comision&activo=eq.true&order=nombre');
    if (!r.ok) return J({ error: 'No se pudo leer usuarios' }, 500);
    return J({ usuarios: await r.json() });
  }

  // ── Entrar con PIN ──
  if (accion === 'login') {
    const usuario = String(body.usuario || '').trim();
    const pin = String(body.pin || '').trim();
    if (!usuario || !pin) return J({ error: 'Faltan usuario o PIN' }, 400);
    if (!SECRET) return J({ error: 'Falta ERP_AUTH_SECRET en los secretos de Supabase' }, 500);

    if (await intentosRecientes(usuario) >= MAX_INTENTOS) {
      return J({ error: `Demasiados intentos fallidos. Espera ${VENTANA_MIN} minutos.`, code: 'bloqueado' }, 429);
    }

    const r = await db('GET', `usuarios?select=*&nombre=eq.${encodeURIComponent(usuario)}&limit=1`);
    const filas = r.ok ? await r.json() : [];
    const u = filas[0];
    if (!u || u.activo === false) {
      await apuntarIntento(usuario, false, ip);
      return J({ error: 'Usuario o PIN incorrecto' }, 401);
    }

    if (!(await pinCorrecto(pin, u.pin || '', u.pin_salt || null))) {
      await apuntarIntento(usuario, false, ip);
      return J({ error: 'Usuario o PIN incorrecto' }, 401);
    }

    const sesion = await sesionDe(usuario);
    if (!sesion?.access_token) {
      return J({ error: 'PIN correcto, pero no se pudo abrir la sesión' }, 500);
    }
    await apuntarIntento(usuario, true, ip);

    const { pin: _p, pin_salt: _s, ...perfil } = u;   // el PIN nunca sale de aquí
    return J({
      ok: true,
      perfil,
      access_token: sesion.access_token,
      refresh_token: sesion.refresh_token,
      expires_at: sesion.expires_at,
    });
  }

  // ── Comprobar un PIN sin abrir sesión ──
  // (autorizaciones dentro de la app: p.ej. dejar el stock en negativo,
  //  que pide el PIN de un administrador)
  if (accion === 'verificar') {
    const pin = String(body.pin || '').trim();
    const rolReq = String((body as { rol?: string }).rol || '');
    if (!pin) return J({ error: 'Falta el PIN' }, 400);

    const usuario = String(body.usuario || '').trim();
    const filtro = usuario
      ? `usuarios?select=*&nombre=eq.${encodeURIComponent(usuario)}`
      : (rolReq ? `usuarios?select=*&rol=eq.${encodeURIComponent(rolReq)}` : 'usuarios?select=*');
    const r = await db('GET', filtro + '&activo=eq.true');
    const filas = r.ok ? await r.json() : [];

    const marca = usuario || ('rol:' + (rolReq || 'cualquiera'));
    if (await intentosRecientes(marca) >= MAX_INTENTOS) {
      return J({ error: `Demasiados intentos. Espera ${VENTANA_MIN} minutos.`, code: 'bloqueado' }, 429);
    }
    for (const u of filas) {
      if (await pinCorrecto(pin, u.pin || '', u.pin_salt || null)) {
        if (rolReq && u.rol !== rolReq) continue;
        await apuntarIntento(marca, true, ip);
        return J({ ok: true, nombre: u.nombre, rol: u.rol });
      }
    }
    await apuntarIntento(marca, false, ip);
    return J({ ok: false, error: 'PIN incorrecto' }, 401);
  }

  // ── Crear o editar un usuario (solo administradores) ──
  if (accion === 'guardar_usuario') {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const quien = await usuarioDeToken(token);
    if (!quien || quien.rol !== 'admin') return J({ error: 'Solo un administrador puede gestionar usuarios' }, 403);

    const u = (body as { usuario_datos?: Record<string, unknown> }).usuario_datos || {};
    if (!u.nombre) return J({ error: 'Falta el nombre' }, 400);

    // El PIN llega en claro y se guarda con sal (nunca se devuelve)
    const fila: Record<string, unknown> = { ...u };
    const pinNuevo = String((u as { pin_nuevo?: string }).pin_nuevo || '').trim();
    delete fila.pin_nuevo;
    if (pinNuevo) {
      const sal = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
      fila.pin_salt = sal;
      fila.pin = await sha256(sal + ':' + pinNuevo);
    }
    const r = await db('POST', 'usuarios?on_conflict=nombre', fila, 'resolution=merge-duplicates,return=representation');
    if (!r.ok) return J({ error: 'No se pudo guardar: ' + (await r.text()).slice(0, 160) }, 500);
    const [guardado] = await r.json();
    const { pin: _x, pin_salt: _y, ...limpio } = guardado || {};
    return J({ ok: true, usuario: limpio });
  }

  // ── Renovar la sesión (para que un móvil no tenga que repetir el PIN) ──
  if (accion === 'refresh') {
    const rt = String((body as { refresh_token?: string }).refresh_token || '');
    if (!rt) return J({ error: 'Falta refresh_token' }, 400);
    const r = await fetch(`${SB}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!r.ok) return J({ error: 'Sesión caducada' }, 401);
    const s = await r.json();
    return J({ ok: true, access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at });
  }

  return J({ error: 'Acción no reconocida' }, 400);
});
