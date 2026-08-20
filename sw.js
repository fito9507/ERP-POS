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

const CACHE = 'erp-v1';
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
