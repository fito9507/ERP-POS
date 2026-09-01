// AUTO-TEST DEL GUARDIÁN: desde dentro del navegador se intenta escribir
// a propósito en Supabase (PATCH/POST/DELETE) y se verifica DESDE FUERA
// (Node, sin pasar por el guardián) que la base de datos NO cambió.
// Si esta prueba falla, ninguna otra prueba es segura.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const G = require('./guardian');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const SUPA_URL = (src.match(/const SUPA_URL = '([^']+)'/) || [])[1];
const SUPA_KEY = (src.match(/const SUPA_KEY = '([^']+)'/) || [])[1];

let TOK = SUPA_KEY;
async function leerProducto950() {
  const r = await fetch(SUPA_URL + '/rest/v1/productos?select=id,badge_texto,qty_reservada,updated_at&id=eq.950', {
    headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + TOK },
  });
  return (await r.json())[0];
}

test('guardián: las escrituras del navegador NO llegan a la base de datos', async ({ page }) => {
  const st = await G.armar(page);
  TOK = await G.tokenSesion(SUPA_URL, SUPA_KEY);   // la base está cerrada: verificar con sesión
  const antes = await leerProducto950();

  await page.goto('/index.html?nc=' + Date.now());
  await page.waitForSelector('.user-card', { timeout: 40000 });

  // Intentos deliberados de escritura desde la página
  const res = await page.evaluate(async function (args) {
    const h = { apikey: args.key, Authorization: 'Bearer ' + args.key, 'Content-Type': 'application/json', Prefer: 'return=representation' };
    const out = [];
    const r1 = await fetch(args.url + '/rest/v1/productos?id=eq.950', { method: 'PATCH', headers: h, body: JSON.stringify({ badge_texto: 'ROBOT-PRUEBA' }) });
    out.push('PATCH ' + r1.status);
    const r2 = await fetch(args.url + '/rest/v1/reservas?on_conflict=id', { method: 'POST', headers: h, body: JSON.stringify({ id: 'robot-prueba', usuario: 'Tester', activa: true, lineas: [], total_usd: 0 }) });
    out.push('POST ' + r2.status);
    const r3 = await fetch(args.url + '/rest/v1/reservas?id=eq.robot-prueba', { method: 'DELETE', headers: h });
    out.push('DELETE ' + r3.status);
    const r4 = await fetch(args.url + '/functions/v1/openai-proxy', { method: 'POST', headers: h, body: JSON.stringify({ model: 'gpt-4o', messages: [] }) });
    out.push('FUNCTION ' + r4.status);
    return out;
  }, { url: SUPA_URL, key: SUPA_KEY });

  console.log('Respuestas que vio la app (falsas):', res.join(' | '));
  console.log('Capturadas por el guardián:', st.escrituras.map(function (e) { return e.metodo + ' ' + e.ruta; }).join(' | '));
  console.log('Bloqueadas (externas/functions):', st.bloqueadas.map(function (e) { return e.metodo + ' ' + e.url.slice(0, 80); }).join(' | '));

  // La app cree que todo fue bien...
  expect(res.filter(function (s) { return /20[01]/.test(s); }).length).toBe(4);
  // ...pero el guardián se lo quedó todo
  expect(st.escrituras.length).toBeGreaterThanOrEqual(3);

  // Y la base de datos, vista desde FUERA del navegador, no cambió
  const despues = await leerProducto950();
  expect(despues.badge_texto).toBe(antes.badge_texto);
  expect(despues.updated_at).toBe(antes.updated_at);
  const rr = await fetch(SUPA_URL + '/rest/v1/reservas?select=id&id=eq.robot-prueba', { headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + TOK } });
  expect((await rr.json()).length).toBe(0);
  console.log('Verificado desde fuera: producto 950 intacto y sin reserva robot-prueba en la nube.');
});
