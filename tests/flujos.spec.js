// FLUJOS CRÍTICOS con auditoría de escrituras.
// La app se usa como una persona (clics reales) y el guardián captura
// cada escritura que INTENTA hacer; aquí se comprueba que sea coherente:
// venta con cobro cuadrado, depósito en caja, stock que nunca baja de
// cero, reserva que se libera solo al confirmar, folio con vendedor,
// abono con su depósito y sin comisión para quien no comisiona...
// Nada llega a la base de datos (tests/guardian.js).
const { test, expect } = require('@playwright/test');
const G = require('./guardian');

const USUARIO = process.env.ERP_TEST_USER || 'Tester';
const PIN = process.env.ERP_TEST_PIN || '1995';

// ── utilidades ──────────────────────────────────────────────
function cuerpo(e) { try { return JSON.parse(e.cuerpo || 'null'); } catch (x) { return null; } }
function buscar(st, metodo, ruta) {
  return st.escrituras.filter(function (e) { return (!metodo || e.metodo === metodo) && new RegExp(ruta).test(e.ruta); });
}
function aprox(a, b, tol) { return Math.abs((+a || 0) - (+b || 0)) <= (tol == null ? 0.02 : tol); }

async function entrarYAlmacen(page, alm, cliente) {
  await G.login(page, USUARIO, PIN);
  await page.waitForTimeout(3500); // carga inicial (Supabase, reservas, recálculos)
  await page.click('.alm-card:has-text("' + alm + '")');
  if (cliente) {
    await page.evaluate(function (nombre) {
      var sel = document.getElementById('s-cli');
      var c = (CLIENTES || []).find(function (x) { return x.nombre === nombre; });
      if (sel && c) sel.value = c.id;
    }, cliente);
  }
  await page.click('button:has-text("Continuar")');
  await page.waitForSelector('#pg-prod.act', { timeout: 10000 });
}

// Elige un producto con stock suficiente y lo mete al carrito con cantidad q
async function meterProducto(page, q) {
  const prod = await page.evaluate(function (q) {
    var cands = PRODS.filter(function (p) { return p.activo !== false && typeof stkDisp === 'function' && stkDisp(p) >= q + 5; });
    if (!cands.length) return null;
    var p = cands[0];
    return { n: p.n, stk: stkDisp(p), supaId: p.supaId || null, stkHabana: (typeof _getStk === 'function' ? _getStk(p, S.alm) : p.stk) };
  }, q);
  expect(prod, 'hay algún producto con stock para probar').not.toBeNull();
  await page.click('.pb[data-n="' + prod.n.replace(/"/g, '&quot;') + '"]');
  await page.waitForTimeout(200);
  await page.evaluate(function (q) { setQtyDirect(0, q); }, q);
  await page.waitForTimeout(200);
  const carro = await page.evaluate(function () { return S.cart.map(function (c) { return { n: c.n, q: c.q, p: c.precioUSD }; }); });
  expect(carro.length).toBe(1);
  expect(carro[0].q).toBe(q);
  return Object.assign(prod, { precio: carro[0].p, total: +(carro[0].p * q).toFixed(2) });
}

async function pagarYConfirmar(page) {
  await page.click('button:has-text("Cobrar al contado")');
  await page.waitForSelector('#pg-pago.act', { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.click('#cobro-btns .bf >> nth=0'); // USD por el importe pendiente exacto
  await page.waitForSelector('#btn-conf:not([disabled])', { timeout: 10000 });
  await page.click('#btn-conf');
  await page.waitForSelector('#pg-ok.act', { timeout: 15000 });
  await page.waitForTimeout(1500); // dejar salir las escrituras
}

function auditarVenta(st, prod, qty, ts) {
  const ventas = buscar(st, 'POST', '^ventas');
  expect(ventas.length, 'se registró exactamente 1 venta').toBe(1);
  const v = cuerpo(ventas[0]);
  expect(v.productos).toContain(prod.n);
  expect(aprox(v.total_usd, prod.total, 0.05), 'total de la venta = cantidad × precio').toBeTruthy();
  const cj = typeof v.cobros_json === 'string' ? JSON.parse(v.cobros_json) : (v.cobros_json || {});
  expect((cj.pagos || []).length, 'la venta lleva forma de cobro').toBeGreaterThan(0);
  const cobrado = (cj.pagos || []).reduce(function (a, p) { return a + (p.mon === 'USD' ? +p.m : 0); }, 0);
  expect(aprox(cobrado, prod.total, 0.05), 'cobro cuadrado con el total').toBeTruthy();

  const dep = buscar(st, 'POST', '^mov_cajas').map(cuerpo).filter(function (m) { return m && m.tipo === 'deposito' && m.notas === 'Venta POS'; });
  expect(dep.length, 'depósito en caja por la venta').toBeGreaterThan(0);
  expect(aprox(dep.reduce(function (a, m) { return a + (+m.monto_destino || 0); }, 0), prod.total, 0.05), 'el depósito iguala el cobro').toBeTruthy();
  expect(dep[0].caja_destino, 'caja del depósito').toMatch(/USD/);

  const stock = buscar(st, null, '^stock_almacen').map(cuerpo).filter(Boolean);
  expect(stock.length, 'se escribió el stock').toBeGreaterThan(0);
  stock.forEach(function (s) { expect(+s.cantidad, 'stock nunca negativo').toBeGreaterThanOrEqual(0); });
  const mio = stock.filter(function (s) { return prod.supaId && String(s.producto_id) === String(prod.supaId); });
  if (mio.length) expect(aprox(mio[mio.length - 1].cantidad, prod.stkHabana - qty, 0.5), 'stock = anterior − vendido').toBeTruthy();

  expect(st.errores, 'errores JS').toEqual([]);
  expect(ts.filter(function (t) { return /^⚠/.test(t); }), 'avisos ⚠').toEqual([]);
  return v;
}

// ══════════════════════════════════════════════════════════════
test('POS: venta al contado → venta, cobro cuadrado, depósito en caja y stock', async ({ page }) => {
  const st = await G.armar(page); G.vigilarDialogos(page, st);
  await entrarYAlmacen(page, 'Habana');
  const prod = await meterProducto(page, 3);
  await pagarYConfirmar(page);
  const ts = await G.toasts(page);
  const v = auditarVenta(st, prod, 3, ts);
  console.log('Venta:', v.productos, '| total', v.total_usd, '| cobros', v.cobros_json);
  console.log(G.resumen(st, ts));
});

test('POS: no se puede confirmar sin forma de cobro (candado)', async ({ page }) => {
  const st = await G.armar(page); G.vigilarDialogos(page, st);
  await entrarYAlmacen(page, 'Habana');
  await meterProducto(page, 1);
  await page.click('button:has-text("Cobrar al contado")');
  await page.waitForSelector('#pg-pago.act');
  await page.waitForTimeout(500);
  const deshabilitado = await page.$eval('#btn-conf', function (b) { return b.disabled; });
  expect(deshabilitado, 'botón Confirmar deshabilitado sin pagos').toBeTruthy();
  // Forzar el click aunque la UI lo bloquee (simula el botón habilitado a destiempo)
  await page.evaluate(function () { confirmar(); });
  await page.waitForTimeout(800);
  const ts = await G.toasts(page);
  expect(buscar(st, 'POST', '^ventas').length, 'ninguna venta registrada').toBe(0);
  expect(ts.some(function (t) { return /forma de cobro/i.test(t); }), 'aviso de forma de cobro').toBeTruthy();
  console.log('Candado OK →', ts.filter(function (t) { return /cobro/i.test(t); }));
});

test('POS: reserva → cobrar → confirmar (la reserva se libera solo al confirmar)', async ({ page }) => {
  const st = await G.armar(page); G.vigilarDialogos(page, st);
  await entrarYAlmacen(page, 'Habana');
  const prod = await meterProducto(page, 2);
  await page.click('button:has-text("Solo Reservar")');
  await page.waitForSelector('#res-nota-inp', { timeout: 5000 });
  await page.fill('#res-nota-inp', 'ROBOT prueba reserva');
  await page.click('#res-modal-cnt button:has-text("Reservar")');
  await page.waitForTimeout(1200);

  const resPost = buscar(st, 'POST', '^reservas');
  expect(resPost.length, 'reserva subida a la nube').toBeGreaterThan(0);
  const r = cuerpo(resPost[0]);
  expect(r.activa).toBe(true);
  expect(JSON.stringify(r.lineas)).toContain(prod.n);
  expect(buscar(st, 'DELETE', '^reservas').length, 'nunca DELETE de reservas').toBe(0);
  const qtyRes = buscar(st, 'PATCH', '^productos').map(cuerpo).filter(function (b) { return b && b.qty_reservada != null; });
  expect(qtyRes.length, 'qty_reservada actualizada al reservar').toBeGreaterThan(0);

  // Cobrar la reserva
  await page.evaluate(function () { openRes(); });
  await page.waitForSelector('#res-overlay', { state: 'visible' });
  const antesCobrar = buscar(st, 'PATCH', '^reservas').length;
  await page.click('#res-overlay button:has-text("Cobrar ahora")');
  await page.waitForSelector('#pg-pago.act', { timeout: 10000 });
  await page.waitForTimeout(600);
  expect(buscar(st, 'PATCH', '^reservas').length, 'al pulsar Cobrar la reserva sigue viva').toBe(antesCobrar);

  await page.click('#cobro-btns .bf >> nth=0');
  await page.waitForSelector('#btn-conf:not([disabled])');
  await page.click('#btn-conf');
  await page.waitForSelector('#pg-ok.act', { timeout: 15000 });
  await page.waitForTimeout(1500);

  const idxVenta = st.escrituras.findIndex(function (e) { return e.metodo === 'POST' && /^ventas/.test(e.ruta); });
  const lapida = st.escrituras.map(function (e, i) { return { e: e, i: i }; }).filter(function (x) {
    return x.e.metodo === 'PATCH' && /^reservas\?id=eq\./.test(x.e.ruta) && (cuerpo(x.e) || {}).activa === false;
  });
  expect(idxVenta, 'venta registrada').toBeGreaterThanOrEqual(0);
  expect(lapida.length, 'reserva desactivada (lápida) al confirmar').toBeGreaterThan(0);
  expect(lapida[0].i, 'la lápida va DESPUÉS de la venta').toBeGreaterThan(idxVenta);
  expect(buscar(st, 'DELETE', '^reservas').length, 'nunca DELETE de reservas').toBe(0);
  const ts = await G.toasts(page);
  auditarVenta(st, prod, 2, ts);
  console.log(G.resumen(st, ts));
});

test('POS: cancelar reserva → lápida, nunca DELETE', async ({ page }) => {
  const st = await G.armar(page); G.vigilarDialogos(page, st);
  await entrarYAlmacen(page, 'Habana');
  await meterProducto(page, 1);
  await page.click('button:has-text("Solo Reservar")');
  await page.waitForSelector('#res-nota-inp');
  await page.fill('#res-nota-inp', 'ROBOT cancelar');
  await page.click('#res-modal-cnt button:has-text("Reservar")');
  await page.waitForTimeout(800);
  await page.evaluate(function () { openRes(); });
  await page.waitForSelector('#res-overlay', { state: 'visible' });
  await page.click('#res-overlay button:has-text("Cancelar")');
  await page.waitForTimeout(1000);
  const lap = buscar(st, 'PATCH', '^reservas\\?id=eq\\.').map(cuerpo).filter(function (b) { return b && b.activa === false; });
  expect(lap.length, 'cancelar = activa:false').toBeGreaterThan(0);
  expect(buscar(st, 'DELETE', '^reservas').length).toBe(0);
  const ts = await G.toasts(page);
  expect(st.errores).toEqual([]);
  console.log('Cancelar reserva OK →', ts.slice(-2));
});

test('POS: venta a crédito → folio con vendedor + fila en ventas; abono → depósito y sin comisión para Tester', async ({ page }) => {
  const st = await G.armar(page);
  // Diálogos de la venta a crédito: responder como lo haría el admin
  st.dialogos = [];
  page.on('dialog', async function (d) {
    const m = d.message();
    st.dialogos.push(d.type() + ': ' + m.slice(0, 60));
    if (/Descripci/i.test(m)) return d.accept('ROBOT crédito');
    if (/Abono inicial/i.test(m)) return d.accept('0');
    if (/contenedor/i.test(m)) return d.accept('0');
    if (/qué folio/i.test(m)) return d.accept('0');
    if (/PIN/i.test(m)) return d.dismiss();
    return d.accept();
  });
  const cliente = await (async function () {
    await page.goto('/index.html?nc=' + Date.now());
    await page.waitForSelector('.user-card', { timeout: 40000 });
    await page.waitForTimeout(3000);
    return page.evaluate(function () { var c = (CLIENTES || []).find(function (x) { return x.nombre !== 'Walk-in'; }); return c ? { id: c.id, nombre: c.nombre } : null; });
  })();
  expect(cliente, 'hay clientes').not.toBeNull();

  await entrarYAlmacen(page, 'Habana', cliente.nombre);
  const prod = await meterProducto(page, 2);
  await page.click('button:has-text("Venta a crédito")');
  await page.waitForTimeout(2500);

  const folios = buscar(st, 'POST', '^folios').map(cuerpo).filter(Boolean);
  expect(folios.length, 'folio subido').toBeGreaterThan(0);
  const f = folios[folios.length - 1];
  expect(JSON.stringify(f.lineas)).toContain(prod.n);
  expect(f.vendedor, 'el folio lleva vendedor').toBe(USUARIO);
  expect(f.cliente_id).toBe(cliente.id);
  const vf = buscar(st, 'POST', '^ventas').map(cuerpo).filter(Boolean);
  expect(vf.length, 'fila de venta del folio').toBeGreaterThan(0);
  expect(vf[0].notas || '').toMatch(/Folio/);
  buscar(st, null, '^stock_almacen').map(cuerpo).filter(Boolean).forEach(function (s) { expect(+s.cantidad).toBeGreaterThanOrEqual(0); });
  expect(buscar(st, 'POST', '^abonos').length, 'sin abono inicial').toBe(0);

  // ── Abono al folio desde la ficha del cliente ──
  await page.evaluate(function () { goMod('mod-cli', 'Cuentas clientes'); });
  await page.waitForTimeout(500);
  await page.evaluate(function (cid) { abrirCliente(cid); }, cliente.id);
  await page.waitForTimeout(500);
  await page.click('#mod-clientes .nav button:has-text("Abonar")');
  await page.waitForTimeout(500);
  const cid = cliente.id;
  const hayForm = await page.$('#a-monto-' + cid);
  expect(hayForm, 'formulario de abono').not.toBeNull();
  await page.evaluate(function (a) {
    var sel = document.getElementById('a-folio-' + a.cid);
    if (sel) { var op = Array.from(sel.options).find(function (o) { return o.value === String(a.fid); }); if (op) sel.value = op.value; }
    var m = document.getElementById('a-mon-' + a.cid); if (m) { m.value = 'USD'; m.dispatchEvent(new Event('change')); }
    var ct = document.getElementById('a-cajatipo-' + a.cid); if (ct) { ct.value = 'efectivo'; ct.dispatchEvent(new Event('change')); }
    var cj = document.getElementById('a-caja-' + a.cid); if (cj) { var o2 = Array.from(cj.options).find(function (o) { return /USD Habana/.test(o.textContent); }); if (o2) cj.value = o2.value; }
  }, { cid: cid, fid: f.id });
  await page.fill('#a-monto-' + cid, '10');
  await page.fill('#a-desc-' + cid, 'ROBOT abono');
  const antesAb = st.escrituras.length;
  await page.click('button[onclick^="registrarAbonoCli"]');
  await page.waitForTimeout(1500);

  const ab = buscar(st, 'POST', '^abonos').map(cuerpo).filter(Boolean);
  expect(ab.length, 'abono registrado').toBeGreaterThan(0);
  expect(aprox(ab[0].equiv_usd, 10), 'abono de 10 USD').toBeTruthy();
  const dep = st.escrituras.slice(antesAb).filter(function (e) { return e.metodo === 'POST' && /^mov_cajas/.test(e.ruta); }).map(cuerpo).filter(Boolean);
  expect(dep.length, 'depósito en caja por el abono').toBeGreaterThan(0);
  expect(aprox(dep[0].monto_destino, 10)).toBeTruthy();
  expect(buscar(st, 'POST', '^comisiones').length, 'Tester no comisiona: sin comisión').toBe(0);
  const ts = await G.toasts(page);
  expect(st.errores).toEqual([]);
  console.log('Folio', f.id, 'cliente', cliente.nombre, '| diálogos:', st.dialogos.join(' | '));
  console.log(G.resumen(st, ts));
});

test('Ventas: borrar una venta POS devuelve el stock y retira el dinero', async ({ page }) => {
  const st = await G.armar(page); G.vigilarDialogos(page, st);
  page.removeAllListeners('dialog');
  page.on('dialog', function (d) { d.accept(); }); // "¿Eliminar esta venta?" → sí
  await entrarYAlmacen(page, 'Habana');
  const prod = await meterProducto(page, 2);
  await pagarYConfirmar(page);
  const idLocal = await page.evaluate(function () { return VENTAS[0].id; });
  const n0 = st.escrituras.length;
  await page.evaluate(function (id) { eliminarV(id, true); }, idLocal);
  await page.waitForTimeout(1500);
  const nuevas = st.escrituras.slice(n0);
  expect(nuevas.some(function (e) { return e.metodo === 'DELETE' && /^ventas/.test(e.ruta); }), 'DELETE de la venta').toBeTruthy();
  const stock = nuevas.filter(function (e) { return /^stock_almacen/.test(e.ruta); }).map(cuerpo).filter(Boolean);
  expect(stock.length, 'el stock se devuelve').toBeGreaterThan(0);
  const mio = stock.filter(function (s) { return prod.supaId && String(s.producto_id) === String(prod.supaId); });
  if (mio.length) expect(aprox(mio[mio.length - 1].cantidad, prod.stkHabana, 0.5), 'stock vuelve al valor anterior').toBeTruthy();
  const retiro = nuevas.filter(function (e) { return e.metodo === 'POST' && /^mov_cajas/.test(e.ruta); }).map(cuerpo).filter(function (m) { return m && m.tipo === 'retiro'; });
  console.log('Al borrar: stock →', mio.map(function (s) { return s.cantidad; }), '| retiros de caja:', retiro.map(function (m) { return m.caja_origen + ' ' + m.monto_origen; }));
  expect(retiro.length, 'el dinero cobrado se retira de la caja').toBeGreaterThan(0);
  expect(aprox(retiro.reduce(function (a, m) { return a + (+m.monto_origen || 0); }, 0), prod.total, 0.05)).toBeTruthy();
  expect(st.errores).toEqual([]);
});
