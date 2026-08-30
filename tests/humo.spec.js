// Prueba de HUMO: entrar como Tester y recorrer todos los módulos y sus
// pestañas. Falla si hay errores JavaScript o avisos ⚠ de la app.
// No escribe nada: ver tests/guardian.js.
const { test, expect } = require('@playwright/test');
const G = require('./guardian');

const USUARIO = process.env.ERP_TEST_USER || 'Tester';
const PIN = process.env.ERP_TEST_PIN || '1995';

test('humo: entrar y recorrer todos los módulos sin errores', async ({ page }) => {
  const st = await G.armar(page);
  G.vigilarDialogos(page, st);
  await G.login(page, USUARIO, PIN);

  // Dejar que termine la carga inicial (Supabase, recálculos)
  await page.waitForTimeout(4000);

  const visitados = [];
  const nItems = (await page.$$('.sb-item')).length;
  for (let i = 0; i < nItems; i++) {
    const items = await page.$$('.sb-item');
    const it = items[i];
    if (!it) continue;
    const lbl = (await it.innerText()).replace(/\s+/g, ' ').trim();
    await G.cerrarModales(page);
    await it.click({ timeout: 5000 });
    await page.waitForTimeout(700);
    const act = await page.evaluate(function () {
      const m = document.querySelector('.module.act'); return m ? m.id : null;
    });
    let pestanas = 0;
    // Pestañas internas del módulo activo
    const nTabs = (await page.$$('.module.act .nav button')).length;
    for (let j = 0; j < nTabs; j++) {
      const t = (await page.$$('.module.act .nav button'))[j];
      if (!t) continue;
      try { await t.click({ timeout: 2000 }); await page.waitForTimeout(350); pestanas++; } catch (e) { /* pestaña oculta */ }
      await G.cerrarModales(page); // por si la "pestaña" era un botón que abre un modal
    }
    visitados.push(lbl + ' → ' + act + (pestanas ? ' (' + pestanas + ' pestañas)' : ''));
  }

  const ts = await G.toasts(page);
  console.log('\nMódulos visitados:\n   ' + visitados.join('\n   '));
  console.log(G.resumen(st, ts));

  expect(st.errores, 'errores JavaScript en la página').toEqual([]);
  const avisos = ts.filter(function (t) { return /^⚠|^Error|no se guard|no guardad/i.test(t); });
  expect(avisos, 'avisos ⚠ de la app').toEqual([]);
});
