// ── Guardián de red ─────────────────────────────────────────────
// La app corre de verdad y LEE los datos reales de Supabase, pero
// NINGUNA escritura sale de la máquina:
//   - GET/HEAD a Supabase (rest, storage)  -> pasan (solo lectura)
//   - POST/PATCH/DELETE a Supabase          -> se capturan y se responde
//                                              un éxito falso (la app cree
//                                              que guardó)
//   - Edge functions, Telegram, OpenAI...  -> capturadas/bloqueadas
// Además recoge errores JS, avisos de consola y los toasts de la app.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const SUPA_URL = (src.match(/const SUPA_URL = '([^']+)'/) || [])[1] || '';
const SUPA_HOST = SUPA_URL ? new URL(SUPA_URL).host : '';
const LOCAL = '127.0.0.1:8787';

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': '*',
  };
}

async function armar(page) {
  const st = { escrituras: [], bloqueadas: [], errores: [], consola: [] };

  page.on('pageerror', function (e) { st.errores.push(String((e && e.message) || e)); });
  page.on('console', function (m) {
    const t = m.type();
    if (t === 'error' || t === 'warning') st.consola.push(t + ': ' + m.text().slice(0, 300));
  });

  // Capturar los toasts (avisos) que muestra la app
  await page.addInitScript(function () {
    window.__toasts = [];
    document.addEventListener('DOMContentLoaded', function () {
      var ob = new MutationObserver(function () {
        var t = document.getElementById('g-toast');
        if (!t || t.style.opacity !== '1' || !t.textContent) return;
        var ult = window.__toasts[window.__toasts.length - 1];
        if (ult !== t.textContent) window.__toasts.push(t.textContent);
      });
      ob.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    });
  });

  // Ventanas emergentes (PDF, impresión): también vigiladas
  st.popups = [];
  page.context().on('page', function (p) {
    st.popups.push(p.url());
    p.on('pageerror', function (e) { st.errores.push('[popup] ' + String((e && e.message) || e)); });
  });

  // A nivel de CONTEXTO, no de página: cubre también las ventanas
  // emergentes que abra la app (una page.route no las vigilaría).
  await page.context().route('**/*', async function (route) {
    const req = route.request();
    const url = new URL(req.url());
    const m = req.method();

    if (url.host === LOCAL) return route.continue();
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') return route.continue();
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: cors() });

    const esSupa = url.host === SUPA_HOST;
    const lectura = (m === 'GET' || m === 'HEAD');
    if (esSupa && lectura && (url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/storage/'))) {
      return route.continue();
    }
    // Login del ERP: debe pasar de verdad (comprueba el PIN y abre la
    // sesión con la que la app lee la base de datos). Solo se deja pasar
    // lo que no escribe datos: guardar_usuario se sigue capturando.
    if (esSupa && url.pathname.endsWith('/functions/v1/erp-auth')) {
      let accion = '';
      try { accion = (JSON.parse(req.postData() || '{}').action || 'list'); } catch (e) { accion = 'list'; }
      if (['list', 'login', 'verificar', 'refresh'].includes(accion)) return route.continue();
    }

    // Todo lo demás es escritura o servicio externo: capturar, no enviar
    let body = null;
    try { body = req.postData(); } catch (e) { body = null; }
    const reg = {
      metodo: m,
      url: req.url(),
      ruta: esSupa ? url.pathname.replace('/rest/v1/', '') + (url.search || '') : req.url(),
      cuerpo: body ? body.slice(0, 3000) : null,
      hora: new Date().toISOString(),
    };
    if (esSupa && !url.pathname.startsWith('/functions/')) st.escrituras.push(reg); else st.bloqueadas.push(reg);

    let resp = '[]';
    try {
      if (body) { const j = JSON.parse(body); resp = JSON.stringify(Array.isArray(j) ? j : [j]); }
    } catch (e) { resp = '[]'; }
    if (url.pathname.startsWith('/functions/')) {
      resp = JSON.stringify({ ok: true, choices: [{ message: { content: '(respuesta simulada por el robot)' } }], usage: { prompt_tokens: 0, completion_tokens: 0 } });
    }
    if (url.hostname === 'api.telegram.org') resp = JSON.stringify({ ok: true, result: {} });
    return route.fulfill({
      status: m === 'POST' ? 201 : 200,
      headers: Object.assign({ 'content-type': 'application/json' }, cors()),
      body: resp,
    });
  });

  return st;
}

async function login(page, usuario, pin) {
  await page.goto('/index.html?nc=' + Date.now());
  await page.waitForSelector('.user-card', { timeout: 40000 });
  // el usuario de pruebas vive en la nube: esperar a que se carguen los usuarios
  await page.waitForSelector('.user-card[data-uname="' + usuario + '"]', { timeout: 40000 });
  await page.click('.user-card[data-uname="' + usuario + '"]');
  await page.waitForSelector('#pin-wrap', { state: 'visible', timeout: 5000 });
  for (const d of String(pin)) {
    await page.click('.pin-pad .pin-btn:text-is("' + d + '")');
  }
  await page.waitForSelector('#pg-alm.act', { timeout: 10000 });
  // El menú lateral debe quedar construido tras el login (se rompió una vez
  // al hacer el login asíncrono: el menú se quedaba vacío).
  await page.waitForSelector('#sb-nav .sb-item', { timeout: 10000 });
}

async function toasts(page) {
  return page.evaluate(function () { return window.__toasts || []; });
}

// Cerrar cualquier modal/overlay abierto (tapan la pantalla y bloquean clics)
async function cerrarModales(page) {
  try { await page.keyboard.press('Escape'); } catch (e) { /* nada */ }
  await page.evaluate(function () {
    // Modales: unos se muestran con la clase .show, otros con style.display
    document.querySelectorAll('.modal-bg').forEach(function (m) {
      if (getComputedStyle(m).display !== 'none') { m.classList.remove('show'); m.style.display = 'none'; }
    });
    ['res-overlay', 'res-modal-cnt'].forEach(function (id) { var e = document.getElementById(id); if (e) e.style.display = 'none'; });
  });
}

// Registrar y descartar diálogos nativos (prompt/confirm/alert)
function vigilarDialogos(page, st) {
  st.dialogos = st.dialogos || [];
  page.on('dialog', async function (d) {
    st.dialogos.push(d.type() + ': ' + d.message().slice(0, 120));
    try { await d.dismiss(); } catch (e) { /* ya cerrado */ }
  });
}

function resumen(st, ts) {
  const lineas = [];
  lineas.push('Escrituras interceptadas (NO enviadas a la nube): ' + st.escrituras.length);
  st.escrituras.forEach(function (e) {
    lineas.push('   ' + e.metodo + ' ' + e.ruta + '  ' + (e.cuerpo || '').slice(0, 140));
  });
  if (st.bloqueadas.length) {
    lineas.push('Servicios externos bloqueados: ' + st.bloqueadas.length);
    st.bloqueadas.forEach(function (b) { lineas.push('   ' + b.metodo + ' ' + b.url.slice(0, 100)); });
  }
  if (st.dialogos && st.dialogos.length) lineas.push('Diálogos abiertos (descartados): ' + JSON.stringify(st.dialogos));
  lineas.push('Toasts de la app: ' + JSON.stringify(ts));
  lineas.push('Errores JS: ' + JSON.stringify(st.errores));
  if (st.consola.length) lineas.push('Consola (error/warning): ' + JSON.stringify(st.consola.slice(0, 15)));
  return lineas.join('\n');
}

module.exports = { armar, login, toasts, resumen, cerrarModales, vigilarDialogos, SUPA_HOST };
