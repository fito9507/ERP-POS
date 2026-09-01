// ── Service Worker del ERP Marin Metal ────────────────────────
// Estrategia pensada para un ERP que cambia varias veces al día:
//
//  · index.html (y navegaciones): RED PRIMERO — cada apertura intenta
//    bajar la última versión de GitHub Pages; si no hay internet, sirve
//    la última copia cacheada (la app abre offline igual).
//  · Estáticos (iconos, manifest, librería xlsx del CDN): caché primero
//    con revalidación en segundo plano.
//  · Supabase (API y funciones): NUNCA se cachea — siempre red, y el
//    modo offline propio del ERP (localStorage + cola) hace el resto.
//
// Así NO hay que "mandar" versiones a nadie: al abrir la app con
// internet ya se lleva la última. No hace falta tocar este archivo en
// cada cambio del ERP; solo subir CACHE si algún día cambia la lógica
// del propio service worker.

const CACHE = 'erp-v4-offline';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE))
      .catch(() => { /* sin red durante la instalación: se rellenará al usar */ })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // POST/PATCH etc: directo a la red
  const url = new URL(req.url);

  // Supabase y cualquier API: siempre red, sin tocar
  if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.abanca.com') ||
      url.hostname.endsWith('enablebanking.com') || url.hostname.includes('telegram')) {
    return;
  }

  // Navegaciones e index.html: red primero, caché de respaldo
  const esNavegacion = req.mode === 'navigate' ||
    (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname));
  if (esNavegacion) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copia)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Resto (estáticos propios + CDN): caché primero, revalidando detrás
  e.respondWith(
    caches.match(req).then((hit) => {
      const traer = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
      return hit || traer;
    })
  );
});

// ══ SINCRONIZACIÓN EN SEGUNDO PLANO ═══════════════════════════
// La cola de operaciones pendientes vive en IndexedDB (el service
// worker no puede leer localStorage). Cuando el sistema detecta que
// hay conexión dispara el evento 'sync' y mandamos lo pendiente a
// Supabase AUNQUE LA APP ESTÉ CERRADA. Pensado para conexiones
// intermitentes: se vende sin internet y el teléfono sincroniza solo
// en cuanto pilla señal.
//
// Soporte: Android/Chrome/Edge y Windows. En iPhone no existe
// Background Sync, así que allí sigue sincronizando al abrir la app.

const DB_NOMBRE = 'erp-sync';
const DB_VER = 1;

function abrirDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NOMBRE, DB_VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'qid' });
      if (!db.objectStoreNames.contains('cfg')) db.createObjectStore('cfg', { keyPath: 'k' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function idbTodo(db, store) {
  return new Promise((res, rej) => {
    const t = db.transaction(store, 'readonly').objectStore(store).getAll();
    t.onsuccess = () => res(t.result || []);
    t.onerror = () => rej(t.error);
  });
}

function idbBorrar(db, store, key) {
  return new Promise((res) => {
    const t = db.transaction(store, 'readwrite').objectStore(store).delete(key);
    t.onsuccess = () => res(true);
    t.onerror = () => res(false);
  });
}

function idbGuardar(db, store, val) {
  return new Promise((res) => {
    const t = db.transaction(store, 'readwrite').objectStore(store).put(val);
    t.onsuccess = () => res(true);
    t.onerror = () => res(false);
  });
}

async function vaciarCola() {
  let db;
  try { db = await abrirDB(); } catch (e) { return 0; }

  const cfgs = await idbTodo(db, 'cfg').catch(() => []);
  const cfg = cfgs.find((c) => c.k === 'supa');
  if (!cfg || !cfg.url || !cfg.key) return 0; // la app aún no ha dejado credenciales

  const ops = await idbTodo(db, 'queue').catch(() => []);
  if (!ops.length) return 0;

  // La app trabaja con una sesion (el PIN se valida en el servidor). Aqui
  // se usa ese mismo token; si esta a punto de caducar, se renueva. Sin
  // token valido se cae a la clave publica, que seguira valiendo mientras
  // las tablas no esten cerradas del todo.
  let auth = cfg.key;
  if (cfg.token && (cfg.exp || 0) > Date.now() / 1000 + 60) {
    auth = cfg.token;
  } else if (cfg.refresh) {
    try {
      const rr = await fetch(cfg.url + '/functions/v1/erp-auth', {
        method: 'POST',
        headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh', refresh_token: cfg.refresh }),
      });
      if (rr.ok) {
        const s = await rr.json();
        if (s && s.access_token) {
          auth = s.access_token;
          cfg.token = s.access_token; cfg.refresh = s.refresh_token || cfg.refresh; cfg.exp = s.expires_at || 0;
          await idbGuardar(db, 'cfg', cfg);
        }
      }
    } catch (e) { /* sin red: se intenta igualmente con lo que haya */ }
  }

  const ahora = Date.now();
  let enviadas = 0;

  for (const op of ops.sort((a, b) => (a.ts || 0) - (b.ts || 0))) {
    // Si la app la cogió hace menos de 60s, no la duplicamos
    if (op.enviando && ahora - op.enviando < 60000) continue;
    op.enviando = ahora;
    await idbGuardar(db, 'queue', op);

    const esUpsert = op.method === 'POST' && String(op.path).indexOf('on_conflict') >= 0;
    try {
      const r = await fetch(cfg.url + '/rest/v1/' + op.path, {
        method: op.method,
        headers: {
          apikey: cfg.key,
          Authorization: 'Bearer ' + auth,
          'Content-Type': 'application/json',
          Prefer: esUpsert ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal',
        },
        body: op.body === undefined ? undefined : JSON.stringify(op.body),
      });
      if (r.status === 401 || r.status === 403) {
        // NO es error de datos: es la sesión (caducada o sin renovar). Ahora
        // que la base está cerrada al público, descartar aquí perdería la
        // venta. Se conserva y se reintenta cuando la sesión se pueda renovar.
        op.enviando = 0;
        await idbGuardar(db, 'queue', op);
        break; // sin sesión válida, el resto tampoco pasará: no machacar
      } else if (r.ok || (r.status >= 400 && r.status < 500)) {
        // 4xx (de datos) = error permanente: reintentarlo eternamente envenena la cola
        await idbBorrar(db, 'queue', op.qid);
        if (r.ok) enviadas++;
      } else {
        op.enviando = 0;
        await idbGuardar(db, 'queue', op); // 5xx: se reintenta en el próximo sync
      }
    } catch (e) {
      op.enviando = 0;
      await idbGuardar(db, 'queue', op); // sin red todavía
      break; // no seguir intentando el resto
    }
  }

  if (enviadas > 0) {
    // avisar a las pestañas abiertas (si las hay) para que refresquen
    const clientes = await self.clients.matchAll({ includeUncontrolled: true });
    clientes.forEach((c) => c.postMessage({ tipo: 'cola-vaciada', enviadas: enviadas }));
    if (self.registration.showNotification) {
      const quedan = (await idbTodo(db, 'queue').catch(() => [])).length;
      if (!clientes.length) {
        self.registration.showNotification('Marin Metal ERP', {
          body: enviadas + ' operacion(es) sincronizada(s)' + (quedan ? ' · ' + quedan + ' pendiente(s)' : ''),
          icon: './icons/icon-192.png',
          tag: 'erp-sync',
          silent: true,
        }).catch(() => {});
      }
    }
  }
  return enviadas;
}

self.addEventListener('sync', (e) => {
  if (e.tag === 'erp-flush') e.waitUntil(vaciarCola());
});

// Sincronización periódica (Chrome la concede a PWAs instaladas y usadas)
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'erp-flush-periodico') e.waitUntil(vaciarCola());
});

// La app puede pedir un intento inmediato
self.addEventListener('message', (e) => {
  if (e.data && e.data.tipo === 'vaciar-cola') e.waitUntil(vaciarCola());
});
