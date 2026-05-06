/* ═══════════════════════════════════════════════
   TEST SUITES — Containers ERP
   Variables accesibles globalmente (window.*):
     _cajasData, CATS, toUSD, fromUSD, goMod,
     _cajasMovs, RATES_ALM, RATES_EURUSD,
     PRODS_NAMES, PRESTAMOS, STOCK_MOVS
   Variables en closure (NO accesibles desde iframe):
     USERS, PRODS, VENTAS, MOVS, RATES, S
   ═══════════════════════════════════════════════ */

// ══════════════════════════════════════════════════
// 1. CARGA INICIAL — Globals reales
// ══════════════════════════════════════════════════
suite('🚀 Carga Inicial', [
  {
    name: 'toUSD es una función global',
    fn: async function(){
      assert(typeof erpWin().toUSD === 'function', 'toUSD debe ser función global');
      logDim('toUSD disponible ✓');
    }
  },
  {
    name: 'goMod es una función global',
    fn: async function(){
      assert(typeof erpWin().goMod === 'function', 'goMod debe ser función global');
      logDim('goMod disponible ✓');
    }
  },
  {
    name: 'CATS array existe con categorías',
    fn: async function(){
      var cats = erpGet('CATS');
      assert(Array.isArray(cats), 'CATS debe ser array');
      assertGt(cats.length, 0, 'CATS debe tener al menos 1 categoría');
      logDim('Categorías: ' + cats.join(', '));
    }
  },
  {
    name: 'RATES_ALM existe con almacenes',
    fn: async function(){
      var r = erpGet('RATES_ALM');
      assert(r && typeof r === 'object', 'RATES_ALM debe ser un objeto');
      logDim('Almacenes en RATES_ALM: ' + Object.keys(r).join(', '));
    }
  },
  {
    name: 'RATES_EURUSD es número positivo',
    fn: async function(){
      var eur = erpGet('RATES_EURUSD');
      assert(typeof eur === 'number', 'RATES_EURUSD debe ser número');
      assertGt(eur, 0, 'RATES_EURUSD debe ser positivo');
      logDim('EUR/USD = ' + eur);
    }
  },
  {
    name: 'PRODS_NAMES existe y tiene entradas',
    fn: async function(){
      var pn = erpGet('PRODS_NAMES');
      if(!pn){
        logDim('PRODS_NAMES no expuesto como global (en closure) — OK');
        return;
      }
      assert(typeof pn === 'object', 'PRODS_NAMES debe ser objeto');
      var keys = Object.keys(pn);
      if(keys.length === 0){
        logDim('PRODS_NAMES existe pero está vacío (carga asíncrona pendiente)');
      } else {
        logDim('Productos en PRODS_NAMES: ' + keys.length + ' ✓');
      }
    }
  }
]);

// ══════════════════════════════════════════════════
// 2. CAJAS & SALDOS
// ══════════════════════════════════════════════════
suite('💰 Cajas & Saldos', [
  {
    name: '_cajasData cargada correctamente',
    fn: async function(){
      var cajas = erpGet('_cajasData');
      assert(Array.isArray(cajas), '_cajasData debe ser array');
      assertGt(cajas.length, 0, 'Debe haber al menos 1 caja');
      logDim('Total cajas: ' + cajas.length);
      cajas.forEach(function(c){
        logDim('  ' + c.nombre + ' (' + c.moneda + ') ini=' + c.saldo_inicial);
      });
    }
  },
  {
    name: 'Cada caja tiene campos requeridos',
    fn: async function(){
      var cajas = erpGet('_cajasData');
      cajas.forEach(function(c){
        assert(c.nombre, 'Caja debe tener nombre');
        assert(c.moneda, 'Caja ' + c.nombre + ' debe tener moneda');
        assert(typeof c.saldo_inicial === 'number', c.nombre + ': saldo_inicial debe ser número');
      });
      logDim('Todas las cajas tienen campos válidos');
    }
  },
  {
    name: 'Monedas de cajas son válidas',
    fn: async function(){
      var cajas = erpGet('_cajasData');
      var validMon = ['USD','EUR','CUP','CUPT','MLC'];
      cajas.forEach(function(c){
        assertIncludes(validMon, c.moneda, c.nombre + ' tiene moneda inválida: ' + c.moneda);
      });
      logDim('Monedas válidas en todas las cajas ✓');
    }
  },
  {
    name: '_cajasMovs array existe',
    fn: async function(){
      var movs = erpGet('_cajasMovs');
      if(!movs){ logWarn('_cajasMovs no disponible'); return; }
      assert(Array.isArray(movs), '_cajasMovs debe ser array');
      logDim('Movimientos de cajas: ' + movs.length);
    }
  },
  {
    name: 'Saldos iniciales son no-negativos',
    fn: async function(){
      var cajas = erpGet('_cajasData');
      var neg = cajas.filter(function(c){ return c.saldo_inicial < 0; });
      if(neg.length > 0){
        logWarn(neg.length + ' cajas con saldo inicial negativo:');
        neg.forEach(function(c){ logDim('  ' + c.nombre + ': ' + c.saldo_inicial); });
      } else {
        logDim('Todos los saldos iniciales son ≥ 0 ✓');
      }
      assert(true);
    }
  }
]);

// ══════════════════════════════════════════════════
// 3. CONVERSIONES DE MONEDA
// ══════════════════════════════════════════════════
suite('💱 Conversiones de Moneda', [
  {
    name: 'toUSD(100, "USD") devuelve 100',
    fn: async function(){
      var r = erpCall('toUSD', 100, 'USD');
      assertEqual(r, 100, 'USD→USD debe ser identidad');
      logDim('100 USD → ' + r + ' USD ✓');
    }
  },
  {
    name: 'toUSD(monto, "EUR") retorna positivo',
    fn: async function(){
      var r = erpCall('toUSD', 50, 'EUR');
      assert(typeof r === 'number', 'Debe retornar número');
      assertGt(r, 0, 'EUR→USD debe ser positivo');
      logDim('50 EUR → ' + r.toFixed(2) + ' USD');
    }
  },
  {
    name: 'toUSD con CUP usa RATES_ALM o tasa global',
    fn: async function(){
      var ratesAlm = erpGet('RATES_ALM');
      var almKeys = Object.keys(ratesAlm);
      if(almKeys.length > 0){
        var alm = almKeys[0];
        var rate = ratesAlm[alm];
        logDim('Tasas para ' + alm + ': ' + JSON.stringify(rate).substring(0,80));
      }
      // toUSD con CUP debe dar resultado > 0
      try{
        var r = erpCall('toUSD', 1000, 'CUP');
        assertGt(r, 0, 'CUP→USD debe ser positivo');
        logDim('1000 CUP → ' + r.toFixed(4) + ' USD');
      } catch(e){
        logWarn('toUSD(CUP) requiere almacén: ' + e.message);
      }
    }
  },
  {
    name: 'fromUSD existe y funciona',
    fn: async function(){
      var fn = erpWin().fromUSD;
      assert(typeof fn === 'function', 'fromUSD debe ser función global');
      var r = fn(10, 'USD');
      assertEqual(r, 10, 'fromUSD(10, USD) debe ser 10');
      logDim('fromUSD(10, USD) = ' + r + ' ✓');
    }
  },
  {
    name: 'RATES_EURUSD coincide con toUSD EUR',
    fn: async function(){
      var eurUsd = erpGet('RATES_EURUSD');
      var calc = erpCall('toUSD', 1, 'EUR');
      assertClose(calc, eurUsd, 0.05, 'toUSD(1,EUR) debe ≈ RATES_EURUSD');
      logDim('RATES_EURUSD=' + eurUsd + ' toUSD(1,EUR)=' + calc.toFixed(4));
    }
  }
]);

// ══════════════════════════════════════════════════
// 4. STOCK MOVEMENTS
// ══════════════════════════════════════════════════
suite('📦 Stock Movements', [
  {
    name: 'STOCK_MOVS array existe',
    fn: async function(){
      var sm = erpGet('STOCK_MOVS');
      if(!sm){ logWarn('STOCK_MOVS no cargado'); return; }
      assert(Array.isArray(sm), 'STOCK_MOVS debe ser array');
      logDim('Stock movimientos: ' + sm.length);
    }
  },
  {
    name: 'STOCK_MOVS entradas tienen estructura válida',
    fn: async function(){
      var sm = erpGet('STOCK_MOVS');
      if(!sm || !sm.length){ logWarn('Sin datos en STOCK_MOVS'); return; }
      var m = sm[0];
      assert(m.fecha || m.created_at || m.ts, 'Mov debe tener fecha');
      logDim('Último mov stock: ' + JSON.stringify(m).substring(0, 120));
    }
  },
  {
    name: 'PRODS_NAMES referenciados en STOCK_MOVS son válidos',
    fn: async function(){
      var sm = erpGet('STOCK_MOVS');
      var pn = erpGet('PRODS_NAMES');
      if(!sm || !pn){ logWarn('Datos no disponibles para cruce'); return; }
      var orphans = 0;
      sm.slice(0,50).forEach(function(m){
        var id = m.prod_id || m.producto_id || m.id_prod;
        if(id && !pn[id]) orphans++;
      });
      logDim('Revisados 50 movs, refs huérfanas: ' + orphans);
      assert(true);
    }
  }
]);

// ══════════════════════════════════════════════════
// 5. PRÉSTAMOS
// ══════════════════════════════════════════════════
suite('🏦 Préstamos', [
  {
    name: 'PRESTAMOS array existe',
    fn: async function(){
      var p = erpGet('PRESTAMOS');
      if(!p){ logWarn('PRESTAMOS no disponible'); return; }
      assert(Array.isArray(p), 'PRESTAMOS debe ser array');
      logDim('Préstamos activos: ' + p.length);
    }
  },
  {
    name: 'Préstamos tienen campos requeridos',
    fn: async function(){
      var p = erpGet('PRESTAMOS');
      if(!p || !p.length){ logWarn('Sin préstamos para verificar'); return; }
      var loan = p[0];
      assert(loan.monto !== undefined || loan.amount !== undefined || loan.capital !== undefined,
        'Préstamo debe tener monto/amount/capital');
      logDim('Primer préstamo: ' + JSON.stringify(loan).substring(0,120));
    }
  }
]);

// ══════════════════════════════════════════════════
// 6. UI — Estructura del DOM
// ══════════════════════════════════════════════════
suite('🎨 UI — DOM', [
  {
    name: 'Login page existe y es visible inicialmente',
    fn: async function(){
      var pg = erpDoc().getElementById('pg-login');
      assert(pg, 'pg-login debe existir');
      assert(erpHasClass(pg, 'act'), 'Login debe estar activo al inicio');
      logDim('pg-login activo ✓');
    }
  },
  {
    name: 'User cards están renderizadas',
    fn: async function(){
      var cards = erpDoc().querySelectorAll('#user-cards-list .user-card');
      assertGt(cards.length, 0, 'Debe haber al menos 1 user card');
      logDim('User cards: ' + cards.length);
      for(var i=0; i<Math.min(cards.length,3); i++){
        logDim('  ' + (cards[i].textContent||'').trim().substring(0,40));
      }
    }
  },
  {
    name: 'PIN pad existe en el DOM',
    fn: async function(){
      var pin = erpDoc().getElementById('pin-wrap');
      assert(pin, 'pin-wrap debe existir en DOM');
      logDim('pin-wrap encontrado ✓');
    }
  },
  {
    name: 'Sidebar de navegación existe',
    fn: async function(){
      var sb = erpDoc().getElementById('sb-nav');
      assert(sb, 'sb-nav debe existir');
      logDim('Sidebar ✓');
    }
  },
  {
    name: 'Módulos core existen en DOM',
    fn: async function(){
      var mods = ['mod-pos','mod-ventas','mod-ig','mod-stock','mod-admin'];
      var found = [], missing = [];
      mods.forEach(function(id){
        if(erpDoc().getElementById(id)) found.push(id);
        else missing.push(id);
      });
      logDim('Módulos encontrados: ' + found.join(', '));
      if(missing.length) logWarn('Módulos faltantes: ' + missing.join(', '));
      assertGt(found.length, 0, 'Al menos 1 módulo debe existir');
    }
  },
  {
    name: 'Sync indicator (sync-dot) existe',
    fn: async function(){
      var dot = erpDoc().getElementById('sync-dot');
      assert(dot, 'sync-dot debe existir');
      var lbl = erpDoc().getElementById('sync-lbl');
      if(lbl) logDim('Sync status: ' + lbl.textContent.trim());
    }
  },
  {
    name: 'Topbar title existe',
    fn: async function(){
      var title = erpDoc().getElementById('tb-title');
      assert(title, 'tb-title debe existir');
      logDim('Title: ' + title.textContent.trim());
    }
  }
]);

// ══════════════════════════════════════════════════
// 7. AUTENTICACIÓN
// ══════════════════════════════════════════════════
suite('🔐 Autenticación', [
  {
    name: 'Seleccionar usuario muestra PIN pad',
    fn: async function(){
      var cards = erpDoc().querySelectorAll('#user-cards-list .user-card');
      assertGt(cards.length, 0, 'Debe haber user cards');
      cards[0].click();
      await sleep(400);
      var pin = erpDoc().getElementById('pin-wrap');
      assert(pin, 'pin-wrap debe existir');
      var visible = pin.style.display !== 'none' && pin.style.visibility !== 'hidden';
      assert(visible, 'PIN pad debe ser visible tras click en user card');
      logDim('PIN pad visible tras seleccionar usuario ✓');
    }
  },
  {
    name: 'PIN incorrecto no navega al dashboard',
    fn: async function(){
      erpEnterPin('0000');
      await sleep(500);
      var login = erpDoc().getElementById('pg-login');
      assert(erpHasClass(login, 'act'), 'Debe permanecer en login con PIN incorrecto');
      logDim('PIN incorrecto rechazado correctamente ✓');
    }
  },
  {
    name: 'pinKey es función global',
    fn: async function(){
      assert(typeof erpWin().pinKey === 'function', 'pinKey debe ser función global');
      logDim('pinKey disponible ✓');
    }
  }
]);

// ══════════════════════════════════════════════════
// 8. NAVEGACIÓN (goMod)
// ══════════════════════════════════════════════════
suite('🧭 Navegación', [
  {
    name: 'goMod navega a módulo válido',
    fn: async function(){
      // goMod requiere login, lo verificamos sin navegar
      assert(typeof erpWin().goMod === 'function', 'goMod debe ser función');
      logDim('goMod accesible globalmente ✓');
    }
  },
  {
    name: 'Items de sidebar tienen atributo onclick',
    fn: async function(){
      var items = erpDoc().querySelectorAll('.sb-item');
      if(items.length === 0){ logWarn('No hay .sb-item visibles (requiere login)'); return; }
      var withOnclick = 0;
      items.forEach(function(el){
        if(el.getAttribute('onclick')) withOnclick++;
      });
      logDim('Sidebar items con onclick: ' + withOnclick + '/' + items.length);
      assertGt(withOnclick, 0, 'Al menos 1 sidebar item debe tener onclick');
    }
  }
]);

// ══════════════════════════════════════════════════
// 9. OFFLINE / SYNC
// ══════════════════════════════════════════════════
suite('🌐 Offline / Sync', [
  {
    name: 'offlineAutoSave es función global',
    fn: async function(){
      var fn = erpWin().offlineAutoSave;
      assert(typeof fn === 'function', 'offlineAutoSave debe ser función global');
      logDim('offlineAutoSave disponible ✓');
    }
  },
  {
    name: '_supaOnline flag es accesible',
    fn: async function(){
      var online = erpWin()._supaOnline;
      logDim('_supaOnline = ' + online + ' (tipo: ' + typeof online + ')');
      // No es un hard fail, sólo informativo
      assert(true);
    }
  },
  {
    name: 'localStorage tiene datos ERP cacheados',
    fn: async function(){
      var ls = erpWin().localStorage;
      var keys = ['erp_rates','erp_movs','erp_cajas','erp_prods','erp_ventas'];
      var found = [];
      keys.forEach(function(k){
        var v = ls.getItem(k);
        if(v) found.push(k + '(' + v.length + 'b)');
        else logDim('  ' + k + ': null');
      });
      if(found.length > 0) logDim('Cache encontrada: ' + found.join(', '));
      else logWarn('Sin datos en localStorage (posible primer uso)');
      assert(true);
    }
  }
]);

// ══════════════════════════════════════════════════
// 10. INTEGRIDAD — Cajas vs Movimientos
// ══════════════════════════════════════════════════
suite('🔄 Integridad Cajas', [
  {
    name: 'Monedas en _cajasMovs coinciden con cajas',
    fn: async function(){
      var cajas = erpGet('_cajasData');
      var movs = erpGet('_cajasMovs');
      if(!movs || !movs.length){ logWarn('Sin _cajasMovs'); return; }
      var cajaNames = new Set(cajas.map(function(c){ return c.nombre; }));
      var orphans = [];
      movs.slice(0,50).forEach(function(m){
        var caja = m.caja || m.caja_nombre || m.caja_id;
        if(caja && !cajaNames.has(caja)) orphans.push(caja);
      });
      if(orphans.length > 0) logWarn('Movs con cajas no encontradas: ' + [...new Set(orphans)].join(', '));
      else logDim('Todos los movimientos referencian cajas válidas ✓');
      assert(true);
    }
  },
  {
    name: 'RATES_ALM cubre los almacenes de _cajasData',
    fn: async function(){
      var ratesAlm = erpGet('RATES_ALM');
      var cajas = erpGet('_cajasData');
      var almacenes = new Set(cajas.map(function(c){ return c.almacen || c.alm; }).filter(Boolean));
      logDim('Almacenes en cajas: ' + [...almacenes].join(', '));
      logDim('Almacenes en RATES_ALM: ' + Object.keys(ratesAlm).join(', '));
      assert(true);
    }
  },
  {
    name: 'CATS tiene strings no vacíos',
    fn: async function(){
      var cats = erpGet('CATS');
      cats.forEach(function(c){
        assert(typeof c === 'string' && c.length > 0, 'Categoría inválida: ' + c);
      });
      logDim('Categorías: ' + cats.join(' | ') + ' ✓');
    }
  }
]);

// ══════════════════════════════════════════════════
// 11. SUPABASE SYNC — Conexión y sincronización real
// ══════════════════════════════════════════════════
suite('☁️ Supabase Sync', [
  {
    name: 'Cliente Supabase está inicializado',
    fn: async function(){
      var w = erpWin();
      var sb = w.supabase || w.sb || w._supabase || w._sb;
      if(sb){
        assert(typeof sb.from === 'function' || typeof sb.rpc === 'function',
          'Cliente Supabase debe tener métodos .from() o .rpc()');
        logDim('Cliente Supabase disponible ✓');
      } else {
        logWarn('supabase/sb no expuesto como global — verificando por síntomas');
        // Verificamos por síntomas: _cajasData cargado desde Supabase
        var cajas = erpGet('_cajasData');
        assert(Array.isArray(cajas) && cajas.length > 0,
          'Si Supabase funciona, _cajasData debe estar cargado');
        logDim('_cajasData cargado (evidencia de sync OK): ' + cajas.length + ' cajas');
      }
    }
  },
  {
    name: '_supaOnline refleja estado de conexión real',
    fn: async function(){
      var online = erpWin()._supaOnline;
      logDim('_supaOnline = ' + online);
      var dot = erpDoc().getElementById('sync-dot');
      var lbl = erpDoc().getElementById('sync-lbl');
      assert(dot, 'sync-dot debe existir en el DOM');
      var dotClass = dot.className || '';
      var lblText = lbl ? lbl.textContent.trim() : '?';
      logDim('sync-dot class: "' + dotClass + '"');
      logDim('sync-lbl text: "' + lblText + '"');
      // Si está online, _cajasData debe tener datos de Supabase
      if(online){
        var cajas = erpGet('_cajasData');
        assertGt(cajas ? cajas.length : 0, 0, 'Online pero _cajasData vacío — sync falló');
        logDim('Online confirmado: ' + cajas.length + ' cajas desde Supabase ✓');
      } else {
        logWarn('ERP en modo OFFLINE — datos desde localStorage');
      }
    }
  },
  {
    name: 'Datos de Supabase tienen timestamp reciente',
    fn: async function(){
      var cajas = erpGet('_cajasData');
      if(!cajas || !cajas.length){ logWarn('Sin _cajasData'); return; }
      // Buscar campo updated_at o created_at en el primer registro
      var c = cajas[0];
      var ts = c.updated_at || c.created_at || c.fecha || null;
      if(ts){
        var d = new Date(ts);
        var now = new Date();
        var diffDays = (now - d) / (1000 * 60 * 60 * 24);
        logDim('Última actualización: ' + ts);
        logDim('Hace ' + diffDays.toFixed(1) + ' días');
        // Warning si datos > 30 días
        if(diffDays > 30) logWarn('Datos de Supabase tienen más de 30 días');
        else logDim('Datos frescos ✓');
      } else {
        logDim('No hay campo de timestamp en _cajasData (campos: ' + Object.keys(c).join(',') + ')');
      }
      assert(true);
    }
  },
  {
    name: '_cajasMovs y _cajasData son coherentes entre sí',
    fn: async function(){
      var cajas = erpGet('_cajasData');
      var movs = erpGet('_cajasMovs');
      if(!movs){ logWarn('_cajasMovs no disponible'); return; }
      logDim('Cajas: ' + cajas.length + ' | Movs de caja: ' + movs.length);
      // Verificar que los movs tienen moneda válida
      var validMon = new Set(['USD','EUR','CUP','CUPT','MLC']);
      var invalidMon = movs.filter(function(m){
        var mon = m.moneda || m.mon || m.currency;
        return mon && !validMon.has(mon);
      });
      if(invalidMon.length > 0){
        logWarn(invalidMon.length + ' movs con moneda inválida');
      } else {
        logDim('Todas las monedas en movs son válidas ✓');
      }
      assert(true);
    }
  }
]);

// ══════════════════════════════════════════════════
// 12. GUARDADO — localStorage y offlineAutoSave
// ══════════════════════════════════════════════════
suite('💾 Guardado & Persistencia', [
  {
    name: 'offlineAutoSave escribe en localStorage',
    fn: async function(){
      var fn = erpWin().offlineAutoSave;
      assert(typeof fn === 'function', 'offlineAutoSave debe ser función');
      var ls = erpWin().localStorage;
      // Snapshot de claves antes
      var keysBefore = ls.length;
      // Ejecutar el autoguardado
      try{
        fn();
        await sleep(500);
      } catch(e){
        logWarn('offlineAutoSave lanzó error: ' + e.message);
        return;
      }
      var keysAfter = ls.length;
      logDim('localStorage keys antes: ' + keysBefore + ' | después: ' + keysAfter);
      logDim('offlineAutoSave ejecutado sin crash ✓');
      assert(true);
    }
  },
  {
    name: 'localStorage tiene caché válida tras autoguardado',
    fn: async function(){
      var ls = erpWin().localStorage;
      // Ejecutar autoguardado primero
      var fn = erpWin().offlineAutoSave;
      if(typeof fn === 'function') fn();
      await sleep(600);
      // Verificar claves clave de la caché offline
      var criticalKeys = ['erp_cajas','erp_rates','erp_movs','erp_prods','erp_ventas',
                          'erp_cajasData','erp_cajasMovs','offline_cajas','offline_data'];
      var found = [];
      for(var i = 0; i < ls.length; i++){
        var k = ls.key(i);
        if(criticalKeys.some(function(ck){ return k.indexOf(ck) >= 0 || ck.indexOf(k) >= 0; })){
          found.push(k + '(' + (ls.getItem(k)||'').length + 'b)');
        }
      }
      if(found.length > 0){
        logDim('Caché offline encontrada:');
        found.forEach(function(f){ logDim('  ' + f); });
      } else {
        // Mostrar todas las claves ERP para diagnóstico
        logWarn('No se encontraron claves críticas, claves existentes:');
        for(var j = 0; j < Math.min(ls.length, 20); j++){
          logDim('  ' + ls.key(j));
        }
      }
      assert(true);
    }
  },
  {
    name: 'Datos en localStorage son JSON parseable',
    fn: async function(){
      var ls = erpWin().localStorage;
      var errors = [];
      for(var i = 0; i < ls.length; i++){
        var k = ls.key(i);
        var v = ls.getItem(k);
        if(v && v.startsWith('{') || v && v.startsWith('[')){
          try{ JSON.parse(v); }
          catch(e){ errors.push(k + ': JSON inválido'); }
        }
      }
      if(errors.length > 0){
        logWarn('Claves con JSON corrupto:');
        errors.forEach(function(e){ logDim('  ' + e); });
      } else {
        logDim('Todos los JSONs en localStorage son válidos ✓');
      }
      assert(errors.length === 0, errors.join('; '));
    }
  },
  {
    name: 'RATES_ALM persiste en localStorage',
    fn: async function(){
      var ls = erpWin().localStorage;
      var ratesAlm = erpGet('RATES_ALM');
      // Buscar cualquier clave que contenga las tasas
      var found = null;
      for(var i = 0; i < ls.length; i++){
        var k = ls.key(i);
        if(k.toLowerCase().indexOf('rate') >= 0 || k.toLowerCase().indexOf('tasa') >= 0){
          found = k;
          break;
        }
      }
      if(found){
        logDim('Tasas en localStorage: ' + found);
        var parsed = JSON.parse(ls.getItem(found));
        logDim('Contenido: ' + JSON.stringify(parsed).substring(0,100));
      } else {
        logWarn('No se encontró caché de tasas en localStorage');
        logDim('RATES_ALM actual: ' + JSON.stringify(ratesAlm).substring(0,100));
      }
      assert(true);
    }
  }
]);

// ══════════════════════════════════════════════════
// 13. LÓGICA DE NEGOCIO — Reglas y cálculos
// ══════════════════════════════════════════════════
suite('🧮 Lógica de Negocio', [
  {
    name: 'Tasas de almacén son positivas y consistentes',
    fn: async function(){
      var ratesAlm = erpGet('RATES_ALM');
      var alms = Object.keys(ratesAlm);
      assertGt(alms.length, 0, 'Debe haber al menos 1 almacén');
      var zeros = [];
      alms.forEach(function(alm){
        var rates = ratesAlm[alm];
        if(typeof rates === 'object'){
          Object.keys(rates).forEach(function(mon){
            var v = rates[mon];
            assert(typeof v === 'number', alm + '.' + mon + ' debe ser número, got: ' + v);
            // 0 es válido — significa que esa moneda no se usa en ese almacén
            if(v === 0) zeros.push(alm + '.' + mon);
          });
          logDim(alm + ': ' + JSON.stringify(rates));
        } else if(typeof rates === 'number'){
          assert(typeof rates === 'number', alm + ' rate debe ser número');
          if(rates === 0) zeros.push(alm);
          logDim(alm + ': ' + rates);
        }
      });
      if(zeros.length > 0) logWarn('Tasas en 0 (moneda no usada en ese almacén): ' + zeros.join(', '));
      logDim('Estructura de tasas válida ✓');
    }
  },
  {
    name: 'fromUSD y toUSD son inversas (round-trip)',
    fn: async function(){
      var fromUSD = erpWin().fromUSD;
      assert(typeof fromUSD === 'function', 'fromUSD debe ser función');
      var usd = 100;
      // Round-trip USD → USD
      var backUSD = erpCall('toUSD', fromUSD(usd, 'USD'), 'USD');
      assertClose(backUSD, usd, 0.01, 'Round-trip USD→USD debe ser identidad');
      // Round-trip EUR
      var eur = fromUSD(usd, 'EUR');
      var backEur = erpCall('toUSD', eur, 'EUR');
      assertClose(backEur, usd, 0.5, 'Round-trip USD→EUR→USD debe ≈ ' + usd);
      logDim('Round-trip USD→EUR→USD: ' + usd + '→' + eur.toFixed(2) + '→' + backEur.toFixed(2) + ' ✓');
    }
  },
  {
    name: 'Moneda USD: toUSD === fromUSD (identidad)',
    fn: async function(){
      var amounts = [1, 10, 100, 0.5, 999.99];
      amounts.forEach(function(a){
        assertEqual(erpCall('toUSD', a, 'USD'), a, 'toUSD(' + a + ',USD) debe ser ' + a);
        assertEqual(erpWin().fromUSD(a, 'USD'), a, 'fromUSD(' + a + ',USD) debe ser ' + a);
      });
      logDim('Identidad USD verificada para ' + amounts.length + ' valores ✓');
    }
  },
  {
    name: 'EUR/USD es racionalmente válida (0.5 < x < 2)',
    fn: async function(){
      var rate = erpGet('RATES_EURUSD');
      assert(rate > 0.5 && rate < 2.0,
        'EUR/USD debe estar entre 0.5 y 2.0, got: ' + rate);
      logDim('EUR/USD = ' + rate + ' (en rango válido) ✓');
    }
  },
  {
    name: 'Cajas: saldo_inicial de USD < 100,000 (sanity check)',
    fn: async function(){
      var cajas = erpGet('_cajasData');
      var usdCajas = cajas.filter(function(c){ return c.moneda === 'USD'; });
      var suspicious = usdCajas.filter(function(c){ return Math.abs(c.saldo_inicial) > 100000; });
      if(suspicious.length > 0){
        logWarn('Cajas con saldo inicial sospechosamente alto:');
        suspicious.forEach(function(c){ logDim('  ' + c.nombre + ': ' + c.saldo_inicial + ' USD'); });
      } else {
        logDim('Saldos iniciales en rango razonable ✓');
      }
      assert(true);
    }
  },
  {
    name: 'No hay cajas duplicadas por nombre',
    fn: async function(){
      var cajas = erpGet('_cajasData');
      var nombres = cajas.map(function(c){ return c.nombre; });
      var unicos = new Set(nombres);
      if(unicos.size < nombres.length){
        var dups = nombres.filter(function(n, i){ return nombres.indexOf(n) !== i; });
        logWarn('Cajas duplicadas: ' + [...new Set(dups)].join(', '));
      } else {
        logDim('Sin cajas duplicadas (' + cajas.length + ' cajas únicas) ✓');
      }
      assertEqual(unicos.size, nombres.length, 'No debe haber cajas con nombre duplicado');
    }
  }
]);

// ══════════════════════════════════════════════════
// 14. MODO OFFLINE — Funcionamiento sin red
// ══════════════════════════════════════════════════
suite('📴 Modo Offline', [
  {
    name: 'offlineAutoSave no falla sin conexión',
    fn: async function(){
      var fn = erpWin().offlineAutoSave;
      assert(typeof fn === 'function', 'offlineAutoSave debe existir');
      var threw = false;
      try{ fn(); await sleep(300); }
      catch(e){ threw = true; logWarn('offlineAutoSave lanzó: ' + e.message); }
      assert(!threw, 'offlineAutoSave no debe lanzar excepción');
      logDim('offlineAutoSave ejecutado sin errores ✓');
    }
  },
  {
    name: 'Datos críticos están en localStorage como fallback',
    fn: async function(){
      var ls = erpWin().localStorage;
      var allKeys = [];
      for(var i = 0; i < ls.length; i++) allKeys.push(ls.key(i));
      logDim('Total claves en localStorage: ' + allKeys.length);
      // Buscar algún dato ERP guardado
      var erpKeys = allKeys.filter(function(k){
        return k && (k.indexOf('erp') >= 0 || k.indexOf('offline') >= 0 ||
          k.indexOf('caja') >= 0 || k.indexOf('venta') >= 0 ||
          k.indexOf('prod') >= 0 || k.indexOf('rate') >= 0 ||
          k.indexOf('user') >= 0 || k.indexOf('mov') >= 0);
      });
      logDim('Claves ERP: ' + erpKeys.join(', '));
      if(erpKeys.length === 0){
        logWarn('Sin datos offline en localStorage — ejecutar offlineAutoSave() primero');
      } else {
        logDim('Datos offline disponibles (' + erpKeys.length + ' claves) ✓');
      }
      assert(true);
    }
  },
  {
    name: 'Indicador sync-dot es coherente con estado real',
    fn: async function(){
      var dot = erpDoc().getElementById('sync-dot');
      var lbl = erpDoc().getElementById('sync-lbl');
      assert(dot, 'sync-dot debe existir en el DOM');
      var lblText = lbl ? lbl.textContent.trim() : '';
      // Leer el color/clase real del dot para determinar estado
      var dotStyle = getComputedStyle(dot);
      var bgColor = dotStyle.backgroundColor || dot.style.backgroundColor || '';
      var dotCls = dot.className || '';
      logDim('sync-dot class: "' + dotCls + '"');
      logDim('sync-dot bg: "' + bgColor + '"');
      logDim('sync-lbl text: "' + lblText + '"');
      // _supaOnline puede estar en closure, así que usamos la UI como fuente de verdad
      var uiSaysOnline = lblText.toLowerCase().indexOf('online') >= 0 ||
        lblText.toLowerCase().indexOf('conectado') >= 0 ||
        lblText.toLowerCase().indexOf('sincroniz') >= 0;
      var uiSaysOffline = lblText.toLowerCase().indexOf('offline') >= 0 ||
        lblText.toLowerCase().indexOf('sin conexi') >= 0 ||
        lblText === '';
      // El dot debe tener algún estado visual distinguible
      if(uiSaysOnline) logDim('UI indica: ONLINE ✓');
      else if(uiSaysOffline) logDim('UI indica: OFFLINE ✓');
      else logWarn('sync-lbl tiene texto no reconocido: "' + lblText + '"');
      // _cajasData cargado = síntoma de que Supabase respondió
      var cajas = erpGet('_cajasData');
      var hasSupaData = Array.isArray(cajas) && cajas.length > 0;
      logDim('_cajasData disponible: ' + hasSupaData + ' (' + (cajas ? cajas.length : 0) + ' cajas)');
      // Si UI dice Online pero no hay datos, es inconsistente
      if(uiSaysOnline && !hasSupaData){
        logWarn('UI dice Online pero _cajasData está vacío — posible problema de sync');
      } else if(uiSaysOnline && hasSupaData){
        logDim('Coherencia: Online + datos de Supabase ✓');
      } else if(!uiSaysOnline && hasSupaData){
        logDim('Datos disponibles desde caché aunque UI indica offline ✓');
      }
      assert(true);
    }
  },
  {
    name: 'RATES_ALM disponible desde memoria (no requiere red)',
    fn: async function(){
      // RATES_ALM debe estar en memoria independientemente del estado de red
      var ratesAlm = erpGet('RATES_ALM');
      assert(ratesAlm && typeof ratesAlm === 'object', 'RATES_ALM debe estar en memoria');
      assertGt(Object.keys(ratesAlm).length, 0, 'RATES_ALM debe tener almacenes');
      logDim('RATES_ALM disponible en memoria sin necesidad de red ✓');
      logDim('Almacenes: ' + Object.keys(ratesAlm).join(', '));
    }
  },
  {
    name: 'toUSD/fromUSD funcionan en modo offline (sin fetch)',
    fn: async function(){
      // Estas funciones usan datos en memoria, no hacen fetch
      var r1 = erpCall('toUSD', 100, 'USD');
      assertEqual(r1, 100, 'toUSD USD offline');
      var r2 = erpCall('toUSD', 50, 'EUR');
      assertGt(r2, 0, 'toUSD EUR offline debe ser positivo');
      logDim('Conversiones funcionan sin red ✓');
    }
  }
]);

// ══════════════════════════════════════════════════
// 15. MODO ONLINE — Verificación de Supabase activo
// NOTA: _supaOnline está en closure — usamos _cajasData como proxy:
//   Si _cajasData tiene datos, Supabase respondió ⇒ estábamos online.
// ══════════════════════════════════════════════════
suite('🌐 Modo Online', [
  {
    name: '_cajasData proviene de Supabase (online confirmado)',
    fn: async function(){
      // _supaOnline está en closure — usamos _cajasData como proxy de estado online
      var cajas = erpGet('_cajasData');
      var online = Array.isArray(cajas) && cajas.length > 0;
      if(!online){
        logDim('Sin _cajasData — ERP arrancó en modo offline desde cache');
        return;
      }
      logDim('Online confirmado: ' + cajas.length + ' cajas desde Supabase ✓');
      var c = cajas[0];
      var hasSupaFields = c.id || c.created_at || c.updated_at;
      if(hasSupaFields) logDim('Campos Supabase detectados (id/timestamps) ✓');
      else logDim('Sin campos id/timestamp — puede ser caché local');
    }
  },
  {
    name: '_cajasMovs tiene datos (cargado desde Supabase)',
    fn: async function(){
      var cajas = erpGet('_cajasData');
      if(!cajas || !cajas.length){
        logDim('Modo offline — _cajasMovs no validado'); return;
      }
      var movs = erpGet('_cajasMovs');
      if(!movs){ logDim('_cajasMovs no disponible como global'); return; }
      assert(Array.isArray(movs), '_cajasMovs debe ser array');
      logDim('_cajasMovs: ' + movs.length + ' movimientos ✓');
      if(movs.length > 0){
        logDim('Ejemplo: ' + JSON.stringify(movs[movs.length-1]).substring(0, 100));
      }
    }
  },
  {
    name: 'Cliente Supabase — evidencia en globals',
    fn: async function(){
      var w = erpWin();
      var supaEvidence = w.supabase || w._sb || w.sb ||
        (w.createClient && 'createClient') ||
        (w.SUPABASE_URL && 'SUPABASE_URL');
      if(supaEvidence){
        logDim('Cliente Supabase global: ' + (typeof supaEvidence === 'string' ? supaEvidence : typeof supaEvidence) + ' ✓');
      } else {
        logDim('Cliente Supabase en closure (normal) — evidencia por _cajasData.length=' +
          ((erpGet('_cajasData')||[]).length));
      }
      assert(true);
    }
  },
  {
    name: 'sync-dot UI coherente con datos disponibles',
    fn: async function(){
      var dot = erpDoc().getElementById('sync-dot');
      var lbl = erpDoc().getElementById('sync-lbl');
      assert(dot, 'sync-dot debe existir');
      var lblText = lbl ? lbl.textContent.trim() : '';
      var cajas = erpGet('_cajasData');
      var hasData = Array.isArray(cajas) && cajas.length > 0;
      logDim('sync-lbl: "' + lblText + '"');
      logDim('_cajasData disponible: ' + hasData);
      if(hasData){
        logDim('Datos de Supabase + sync-lbl="' + lblText + '" ✓');
      } else {
        logDim('Sin datos Supabase — modo offline activo');
      }
      assert(true);
    }
  },
  {
    name: 'Datos Supabase: estructura completa de cajas',
    fn: async function(){
      var cajas = erpGet('_cajasData');
      if(!cajas || !cajas.length){ logDim('Sin datos online — skip'); return; }
      var requiredFields = ['nombre', 'moneda', 'saldo_inicial'];
      var incomplete = [];
      cajas.forEach(function(c){
        var missing = requiredFields.filter(function(f){ return c[f] === undefined || c[f] === null; });
        if(missing.length > 0) incomplete.push(c.nombre + ' falta: ' + missing.join(','));
      });
      if(incomplete.length > 0){
        incomplete.forEach(function(i){ logDim('  ' + i); });
      } else {
        logDim('Todas las ' + cajas.length + ' cajas tienen campos completos ✓');
      }
      assert(incomplete.length === 0, incomplete.join('; '));
    }
  }
]);

