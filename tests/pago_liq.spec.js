// Pago fraccionado de una liquidación: entrar como Tester, abrir Ventas ▸
// Liquidación semanal, pulsar Pagar en la primera liquidación pendiente y
// repartir el pago entre dos cajas de distinta moneda. El guardián intercepta
// las escrituras (no se guarda nada) y aquí se comprueba qué habría escrito.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const G = require('./guardian');

const USUARIO = process.env.ERP_TEST_USER || 'Tester';
const PIN = process.env.ERP_TEST_PIN || '1995';
const OUT = process.env.ERP_CAPTURAS || path.join(__dirname, '_capturas');

function buscar(st, metodo, ruta) {
  return st.escrituras.filter(function (e) { return (!metodo || e.metodo === metodo) && new RegExp(ruta).test(e.ruta); });
}

for (const vp of [{ n: 'escritorio', width: 1280, height: 900 }, { n: 'movil', width: 360, height: 780 }]) {
  test('pago fraccionado de liquidación · ' + vp.n, async ({ page }) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    fs.mkdirSync(OUT, { recursive: true });
    const st = await G.armar(page);
    G.vigilarDialogos(page, st);
    await G.login(page, USUARIO, PIN);
    await page.waitForTimeout(4000);

    await page.evaluate(function () { goMod('mod-ventas', 'Ventas'); });
    await page.waitForTimeout(1500);
    await page.evaluate(function () { navTo_ven('liquidacion', document.getElementById('btn-liq-nav')); });
    await page.waitForFunction(function () { return document.querySelectorAll('#liq-hist tr').length > 0; }, null, { timeout: 30000 });

    // Si no hay ninguna pendiente, crear una con la semana actual (el guardián no la sube)
    const creada = await page.evaluate(function () {
      var hay = Array.prototype.some.call(document.querySelectorAll('#liq-hist button'), function (x) { return /Pagar/.test(x.textContent); });
      if (hay) return 'ya había pendiente';
      var b = Array.prototype.find.call(document.querySelectorAll('#liq-out button'), function (x) { return /Crear Liquidaci/.test(x.textContent); });
      if (!b) return null;
      b.click(); return 'creada en el navegador';
    });
    console.log('Liquidación: ' + creada);
    await page.waitForTimeout(1200);
    await G.cerrarModales(page);
    // Primera liquidación pendiente con botón Pagar
    const hayPendiente = await page.evaluate(function () {
      var b = Array.prototype.find.call(document.querySelectorAll('#liq-hist button'), function (x) { return /Pagar/.test(x.textContent); });
      if (!b) return null;
      var i = +((b.getAttribute('onclick') || '').match(/pagarLiq\((\d+)\)/) || [])[1];
      var l = liquidaciones[i];
      window.__liqTest = { i: i, mon: l.mon, total: l.totalCUP || l.comCUP, tasa: l.tasa, vend: l.vend, semana: l.semana };
      b.click();
      return window.__liqTest;
    });
    console.log('Liquidación pendiente: ' + JSON.stringify(hayPendiente));
    expect(hayPendiente, 'hace falta una liquidación pendiente para probar').not.toBeNull();

    await page.waitForSelector('#pliq-overlay', { timeout: 5000 });
    // No se puede pagar más de lo que hay en caja: con el total en una caja sin saldo, Confirmar queda bloqueado
    const bloqueo = await page.evaluate(function () {
      var vacia = _pliqCtx.cajas.find(function (x) { return _pliqSaldo(x.nombre) < 1; });
      if (!vacia) return null;
      _pliqSetCaja(0, vacia.nombre); _pliqResto(0);
      return { caja: vacia.nombre, monto: _pliqCtx.lineas[0].monto, ok: !document.getElementById('pliq-ok').disabled, resumen: document.getElementById('pliq-resumen').textContent, saldoTxt: document.getElementById('pliq-sal-0').textContent };
    });
    console.log('Sin saldo: ' + JSON.stringify(bloqueo));
    if (bloqueo) { expect(bloqueo.ok, 'no debe dejar confirmar sin saldo').toBe(false); expect(bloqueo.saldoTxt).toContain('solo hay'); }

    // Reparto válido: línea 1 = 100 en una caja de la moneda de la liquidación con saldo; línea 2 = otra moneda con saldo para el resto
    const cajaOtra = await page.evaluate(function () {
      var ctx = _pliqCtx;
      var c1 = ctx.cajas.find(function (x) { return (x.moneda || 'USD') === ctx.mon && _pliqSaldo(x.nombre) >= 100; });
      if (!c1) return null;
      _pliqSetCaja(0, c1.nombre); _pliqSetMonto(0, '100');
      _pliqAddLinea();
      var resto = ctx.monto - 100;
      var c2 = ctx.cajas.find(function (x) { var m = x.moneda || 'USD'; return m !== ctx.mon && x.nombre !== c1.nombre && _pliqSaldo(x.nombre) >= _pliqConv(resto, ctx.mon, m, ctx.liq); });
      if (!c2) return null;
      _pliqSetCaja(1, c2.nombre); _pliqResto(1);
      return { caja: c2.nombre, mon: c2.moneda, lineas: ctx.lineas, resumen: document.getElementById('pliq-resumen').textContent };
    });
    console.log('Reparto: ' + JSON.stringify(cajaOtra));
    expect(cajaOtra, 'hacen falta dos cajas con saldo en monedas distintas').not.toBeNull();
    expect(cajaOtra.resumen).toContain('Cuadra');
    await page.screenshot({ path: path.join(OUT, 'pago-liq-' + vp.n + '.png') });

    const okHabilitado = await page.evaluate(function () { return !document.getElementById('pliq-ok').disabled; });
    expect(okHabilitado).toBe(true);
    await page.click('#pliq-ok');
    await page.waitForTimeout(1500);

    const ts = await G.toasts(page);
    console.log(G.resumen(st, ts));
    const movs = buscar(st, 'POST', '^mov_cajas').map(function (e) { var b = JSON.parse(e.cuerpo); return [b.caja_origen, b.monto_origen, b.tasa_usada, b.notas]; });
    const igs = buscar(st, 'POST', '^movimientos_ig').map(function (e) { var b = JSON.parse(e.cuerpo); return [b.cuenta, b.monto, b.moneda, b.equiv_usd]; });
    const liq = buscar(st, 'PATCH', '^liquidaciones').map(function (e) { return JSON.parse(e.cuerpo); });
    console.log('mov_cajas: ' + JSON.stringify(movs));
    console.log('movimientos_ig: ' + JSON.stringify(igs));
    console.log('liquidaciones PATCH: ' + JSON.stringify(liq));

    expect(st.errores, 'errores JavaScript').toEqual([]);
    expect(movs.length, 'un retiro por caja').toBe(2);
    expect(igs.length, 'un gasto I/G por caja').toBe(2);
    expect(liq.length).toBe(1);
    expect(liq[0].estado).toBe('Pagado');
    expect(liq[0].cuenta).toContain(' + ');
    // El detalle por cajas solo viaja si la columna "pagos" existe en la nube (supabase_liquidaciones_pagos.sql)
    const hayColPagos = await page.evaluate(function () { return window._liqPagosOK !== false; });
    console.log('Columna pagos en la nube: ' + hayColPagos);
    if (hayColPagos) expect(Array.isArray(liq[0].pagos) ? liq[0].pagos.length : 0).toBe(2);
    else expect(liq[0].pagos).toBeUndefined();
    const estadoLocal = await page.evaluate(function () { return liquidaciones[window.__liqTest.i].estado + ' · ' + liquidaciones[window.__liqTest.i].cuenta; });
    console.log('Estado local: ' + estadoLocal);
    expect(ts.some(function (t) { return /Liquidación pagada/.test(t); }), 'toast de pago').toBe(true);

    // Borrar la liquidación pagada: la reversión debe devolver cada importe a su caja
    const antes = st.escrituras.length;
    await page.evaluate(function () { window.confirm = function () { return true; }; eliminarLiq(window.__liqTest.i); });
    await page.waitForTimeout(1200);
    const nuevas = st.escrituras.slice(antes);
    const rev = nuevas.filter(function (e) { return e.metodo === 'POST' && /^mov_cajas/.test(e.ruta); }).map(function (e) { var b = JSON.parse(e.cuerpo); return [b.tipo, b.caja_destino, b.monto_destino]; });
    const revIg = nuevas.filter(function (e) { return e.metodo === 'POST' && /^movimientos_ig/.test(e.ruta); }).map(function (e) { var b = JSON.parse(e.cuerpo); return [b.cuenta, b.monto, b.moneda]; });
    console.log('reversión mov_cajas: ' + JSON.stringify(rev));
    console.log('reversión I/G: ' + JSON.stringify(revIg));
    expect(rev.length, 'un depósito de reversión por caja').toBe(2);
    expect(rev.map(function (r) { return r[1] + ':' + r[2]; }).sort()).toEqual(movs.map(function (m) { return m[0] + ':' + m[1]; }).sort());
    expect(revIg.length).toBe(2);
    expect(st.errores, 'errores JavaScript tras borrar').toEqual([]);
  });
}
