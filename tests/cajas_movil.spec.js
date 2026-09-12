// Cajas en móvil: entrar como Tester y comprobar que las dos vistas de cajas
// (Administración ▸ Cajas ▸ Resumen y módulo I/G ▸ Cajas) caben en pantalla
// sin desbordar horizontalmente. Guarda capturas en tests/_capturas/.
// No escribe nada: ver tests/guardian.js.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const G = require('./guardian');

const USUARIO = process.env.ERP_TEST_USER || 'Tester';
const PIN = process.env.ERP_TEST_PIN || '1995';
const OUT = process.env.ERP_CAPTURAS || path.join(__dirname, '_capturas');

const VIEWPORTS = [
  { n: 'movil-360', width: 360, height: 780 },
  { n: 'movil-390', width: 390, height: 844 },
  { n: 'escritorio-1280', width: 1280, height: 900 },
];

// Los módulos tienen scroll propio (height:100%; overflow:auto): para una captura
// entera hay que soltar esas alturas antes del screenshot fullPage.
async function expandir(page) {
  await page.evaluate(function () {
    document.querySelectorAll('.module.act, #app, #main, body, html').forEach(function (el) {
      el.style.height = 'auto'; el.style.maxHeight = 'none'; el.style.overflow = 'visible';
    });
    var m = document.querySelector('.module.act'); var p = m && m.parentElement;
    while (p && p !== document.body) { p.style.height = 'auto'; p.style.maxHeight = 'none'; p.style.overflow = 'visible'; p = p.parentElement; }
  });
  await page.waitForTimeout(200);
}


async function medidas(page, sel) {
  return page.evaluate(function (sel) {
    var root = document.querySelector(sel); if (!root) return null;
    var card = root.querySelector('.cajas-cards>.card'); if (!card) return null;
    var cad = [], el = card;
    while (el && el !== document.body) { var cs = getComputedStyle(el); cad.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : '') + ' w=' + Math.round(el.getBoundingClientRect().width) + ' pad=' + cs.paddingLeft + '/' + cs.paddingRight); el = el.parentElement; }
    return cad;
  }, sel);
}

async function desbordes(page, sel) {
  return page.evaluate(function (sel) {
    var root = document.querySelector(sel);
    if (!root) return { existe: false };
    var W = window.innerWidth, out = [];
    root.querySelectorAll('*').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.width === 0) return;
      if (r.right > W + 1 || r.left < -1) {
        var cs = getComputedStyle(el);
        // un contenedor con scroll horizontal propio es legítimo (tablas)
        var dentroScroll = false, p = el.parentElement;
        // solo cuentan como legítimos los envoltorios de tabla (overflow-x explícito), no los módulos con scroll vertical
        while (p && p !== root) { if (/adm-table-wrap/.test(p.className||'') || /auto|scroll/.test(p.style.overflowX||'') || (p.tagName==='DIV' && p.querySelector(':scope>table') && /auto|scroll/.test(getComputedStyle(p).overflowX))) { dentroScroll = true; break; } p = p.parentElement; }
        if (dentroScroll) return;
        out.push((el.tagName.toLowerCase()) + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '')
          + ' → ' + Math.round(r.left) + '..' + Math.round(r.right) + ' (ancho ' + Math.round(r.width) + ') "' + (el.textContent || '').trim().slice(0, 40).replace(/\s+/g, ' ') + '"');
      }
    });
    return {
      existe: true,
      anchoPagina: document.documentElement.scrollWidth,
      anchoVentana: W,
      elementos: out.slice(0, 15),
      total: out.length,
    };
  }, sel);
}

for (const vp of VIEWPORTS) {
  test('cajas responsive ' + vp.n, async ({ page }) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    fs.mkdirSync(OUT, { recursive: true });
    const st = await G.armar(page);
    G.vigilarDialogos(page, st);
    await G.login(page, USUARIO, PIN);
    await page.waitForTimeout(3500);

    const rol = await page.evaluate(function () { return (typeof S !== 'undefined' && S.user && typeof USERS !== 'undefined' && USERS[S.user]) ? USERS[S.user].rol : null; });
    console.log('Usuario ' + USUARIO + ' rol=' + rol);

    // ── Módulo I/G ▸ Cajas ──
    await page.evaluate(function () { goMod('mod-ig', 'Ingresos / Gastos'); });
    await page.waitForTimeout(4500);
    await G.cerrarModales(page);
    const hayBtnCajas = await page.evaluate(function () {
      var b = document.getElementById('ig-btn-cajas');
      if (!b || b.style.display === 'none') return false;
      navTo_ig('cajas', b); return true;
    });
    let dIG = { existe: false };
    if (hayBtnCajas) {
      await page.waitForFunction(function () { var g = document.getElementById('cajas-grid'); return g && g.innerHTML.indexOf('Cargando') < 0 && g.innerHTML.length > 200; }, null, { timeout: 30000 }).catch(function () {});
      await page.waitForTimeout(800);
      await page.evaluate(function () { var b=document.getElementById('ig-btn-cajas'); if (!document.getElementById('cajas').classList.contains('act')) navTo_ig('cajas', b); });
      await page.waitForFunction(function () { var g = document.getElementById('cajas-grid'); return document.getElementById('cajas').classList.contains('act') && g && g.innerHTML.indexOf('Cargando') < 0 && g.innerHTML.length > 200; }, null, { timeout: 30000 }).catch(function () {});
      await page.waitForTimeout(500);
      dIG = await desbordes(page, '#cajas');
      console.log('MEDIDAS I/G: ' + JSON.stringify(await medidas(page, '#cajas')));
      await expandir(page);
      await page.screenshot({ path: path.join(OUT, 'ig-cajas-' + vp.n + '.png'), fullPage: true });
      console.log('I/G Cajas ' + vp.n + ': ' + JSON.stringify(dIG, null, 1));
    } else {
      console.log('I/G Cajas: el botón no está visible para este usuario (rol ' + rol + ')');
    }

    // ── Administración ▸ Cajas ▸ Resumen ──
    await page.evaluate(function () { adminTab = 'cajas'; if (typeof _cajasTab !== 'undefined') _cajasTab = 'resumen'; goMod('mod-admin', 'Administración'); });
    await page.waitForFunction(function () { var g = document.getElementById('admin-content'); return g && g.innerHTML.indexOf('Cargando') < 0 && g.innerHTML.length > 100; }, null, { timeout: 30000 }).catch(function () {});
    await page.waitForTimeout(800);
    const dAdm = await desbordes(page, '#mod-admin');
    console.log('MEDIDAS ADMIN: ' + JSON.stringify(await medidas(page, '#mod-admin')));
    console.log('COLUMNAS ADMIN: ' + JSON.stringify(await page.evaluate(function(){ return Array.prototype.map.call(document.querySelectorAll('#admin-content .cajas-cards'), function(g){ return getComputedStyle(g).gridTemplateColumns + ' | ' + Math.round(g.getBoundingClientRect().width) + ' | ' + Math.round(g.scrollWidth); }); })));
    await expandir(page);
    await page.screenshot({ path: path.join(OUT, 'admin-cajas-' + vp.n + '.png'), fullPage: true });
    console.log('Admin Cajas ' + vp.n + ': ' + JSON.stringify(dAdm, null, 1));

    const ts = await G.toasts(page);
    console.log(G.resumen(st, ts));
    expect(st.errores, 'errores JavaScript en la página').toEqual([]);
    if (dIG.existe) {
      expect(dIG.anchoPagina, 'I/G: la página no debe desbordar').toBeLessThanOrEqual(dIG.anchoVentana + 1);
      expect(dIG.elementos, 'I/G: elementos fuera de pantalla').toEqual([]);
    }
    if (dAdm.existe) {
      expect(dAdm.anchoPagina, 'Admin: la página no debe desbordar').toBeLessThanOrEqual(dAdm.anchoVentana + 1);
      expect(dAdm.elementos, 'Admin: elementos fuera de pantalla').toEqual([]);
    }
  });
}
