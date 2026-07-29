

// ═══════════════════════════════════════════════════════════════
// OFFLINE STORE — Persistencia completa para modo sin internet
// Guarda VENTAS y PRODS en localStorage
// ═══════════════════════════════════════════════════════════════

var _offlineStoreTimer = null;

// ── Guardar estado completo ──────────────────────────────────
function offlineSaveVentas() {
  try {
    // Solo guardar las últimas 500 para no saturar localStorage
    var toSave = VENTAS.slice(0, 500);
    localStorage.setItem('erp_ventas_cache', JSON.stringify(toSave));
    localStorage.setItem('erp_ventas_cache_ts', Date.now().toString());
  } catch(e) { console.warn('offlineSaveVentas:', e); }
}

function offlineSaveProds() {
  try {
    localStorage.setItem('erp_prods_cache', JSON.stringify(PRODS));
    localStorage.setItem('erp_prods_cache_ts', Date.now().toString());
  } catch(e) { console.warn('offlineSaveProds:', e); }
}

// ── Cargar estado desde caché ────────────────────────────────
function offlineLoadVentas() {
  try {
    var raw = localStorage.getItem('erp_ventas_cache');
    if (!raw) return false;
    var cached = JSON.parse(raw);
    if (!cached || !cached.length) return false;
    VENTAS.length = 0;
    cached.forEach(function(v) { VENTAS.push(v); });
    // Reset venNextId
    var maxId = cached.reduce(function(a,v){ return Math.max(a, v.id||0); }, 999);
    venNextId = maxId + 1;
    console.log('Offline: loaded', VENTAS.length, 'ventas from cache');
    return true;
  } catch(e) { console.warn('offlineLoadVentas:', e); return false; }
}

function offlineLoadProds() {
  try {
    var raw = localStorage.getItem('erp_prods_cache');
    if (!raw) return false;
    var cached = JSON.parse(raw);
    if (!cached || !cached.length) return false;
    PRODS.length = 0;
    cached.forEach(function(p) { PRODS.push(p); });
    console.log('Offline: loaded', PRODS.length, 'productos from cache');
    return true;
  } catch(e) { console.warn('offlineLoadProds:', e); return false; }
}

// ── Auto-save debounced ──────────────────────────────────────
function offlineAutoSave() {
  clearTimeout(_offlineStoreTimer);
  _offlineStoreTimer = setTimeout(function() {
    offlineSaveVentas();
    offlineSaveProds();
    offlineSaveClientes();
    try{localStorage.setItem('erp_movs',JSON.stringify(MOVS.slice(0,500)));}catch(e){}
    try{localStorage.setItem('erp_cajas_movs',JSON.stringify((_cajasMovs||[]).slice(0,200)));}catch(e){}
    if(!_supaOnline && _syncQueue.length>0) showOfflineBanner(_syncQueue.length);
  }, 2000);
}

// ── Banner offline ────────────────────────────────────────────
function showOfflineBanner(pendingCount) {
  var existing = document.getElementById('offline-banner');
  if (existing) existing.remove();
  if (!pendingCount && _supaOnline) return;

  var banner = document.createElement('div');
  banner.id = 'offline-banner';
  banner.style.cssText = (
    'position:fixed;bottom:0;left:0;right:0;z-index:9998;'
    + 'background:' + (_supaOnline ? 'var(--color-background-warning)' : '#1a1a2e') + ';'
    + 'border-top:1px solid ' + (_supaOnline ? 'var(--color-text-warning)' : '#f87171') + ';'
    + 'padding:8px 16px;display:flex;align-items:center;justify-content:space-between;'
    + 'font-size:12px;gap:10px;flex-wrap:wrap'
  );

  if (!_supaOnline) {
    banner.innerHTML = '<span style="color:#f87171;font-weight:600">⚡ Modo offline</span>'
      + '<span style="color:var(--color-text-secondary)">'
      + (pendingCount ? pendingCount + ' venta' + (pendingCount>1?'s':'') + ' pendiente' + (pendingCount>1?'s':'') + ' de sync' : 'Sin conexión — datos guardados localmente')
      + '</span>'
      + '<span style="color:var(--color-text-tertiary);font-size:10px">Al reconectar se sincronizará automáticamente</span>';
  } else if (pendingCount) {
    banner.innerHTML = '<span style="color:var(--color-text-warning);font-weight:600">⏳ Sincronizando</span>'
      + '<span style="color:var(--color-text-secondary)">' + pendingCount + ' operación' + (pendingCount>1?'es':'') + ' pendiente' + (pendingCount>1?'s':'') + '</span>'
      + '<button onclick="flushQueue()" style="background:var(--color-background-primary);border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px">Sincronizar ahora</button>';
  }

  document.body.appendChild(banner);
}

function hideOfflineBanner() {
  var b = document.getElementById('offline-banner');
  if (b) b.remove();
}

// ── Monitorear conexión ───────────────────────────────────────
window.addEventListener('online', function() {
  console.log('Connection restored');
  _supaOnline = true;
  updOnlineDot();
  showToast('Conexión restaurada — sincronizando...');
  // Auto sync
  setTimeout(async function() {
    await flushQueue();
    await Promise.all([syncLoadProductos(), syncLoadVentas()]);
    offlineSaveVentas();
    offlineSaveProds();
    offlineSaveClientes();
    hideOfflineBanner();
    showToast('✓ Sincronizado');
  }, 500);
});

window.addEventListener('offline', function() {
  console.log('Connection lost');
  _supaOnline = false;
  updOnlineDot();
  showOfflineBanner(_syncQueue.length);
  showToast('Sin conexión — modo offline activado');
});


// ── Clientes cache ───────────────────────────────────────────
function offlineSaveClientes() {
  try {
    localStorage.setItem('erp_clientes_cache', JSON.stringify(CLIENTES));
    localStorage.setItem('erp_clientes_cache_ts', Date.now().toString());
  } catch(e) { console.warn('offlineSaveClientes:', e); }
}

function offlineLoadClientes() {
  try {
    var raw = localStorage.getItem('erp_clientes_cache');
    if (!raw) return false;
    var cached = JSON.parse(raw);
    if (!cached || !cached.length) return false;
    CLIENTES.length = 0;
    cached.forEach(function(c) { if(c&&c.id&&c.nombre) CLIENTES.push(c); });
    // Restore counters
    nextCid = CLIENTES.reduce(function(a,c){var n=parseInt((c.id||'c0').replace('c',''));return isNaN(n)?a:Math.max(a,n);},0)+1;
    nextFid = CLIENTES.reduce(function(a,c){return (c.folios||[]).reduce(function(b,f){var n=parseInt(f.id||'0');return isNaN(n)?b:Math.max(b,n);},a);},0)+1;
    nextAid = CLIENTES.reduce(function(a,c){return (c.folios||[]).reduce(function(b,f){return (f.abonos||[]).reduce(function(d,ab){var n=parseInt((ab.id||'a0').replace('a',''));return isNaN(n)?d:Math.max(d,n);},b);},a);},0)+1;
    console.log('Clientes loaded:', CLIENTES.length);
    return true;
  } catch(e) { console.warn('offlineLoadClientes:', e); return false; }
}
function _loadRatesCache() {
  try {
    var cached = JSON.parse(localStorage.getItem('erp_rates') || '{}');
    if (cached.CUP && cached.CUP > 0) {
      if (cached.EUR && cached.EUR > 0 && cached.EUR < 2) RATES.EUR = cached.EUR; // USD/EUR must be 0.5-2
      else if (cached.EUR && cached.EUR > 2) {
        // Looks like CUP/EUR was stored — ignore it, will recalculate
        console.warn('Invalid cached EUR rate:', cached.EUR, '— ignoring');
      }
      if (cached.CUP) RATES.CUP = cached.CUP;
      if (cached.CUPT) RATES.CUPT = cached.CUPT;
      if (cached.DTO_PREVENTA != null) RATES.DTO_PREVENTA = cached.DTO_PREVENTA;
      if (cached.WA_PLACETAS) RATES.WA_PLACETAS = String(cached.WA_PLACETAS);
      // Also populate market rates cache if not set
      try {
        if (!localStorage.getItem('erp_rates_mkt') && cached.CUP) {
          // Reverse-calculate market from final using stored adj
          var _sa = JSON.parse(localStorage.getItem('erp_rates_adj') || '{}');
          localStorage.setItem('erp_rates_mkt', JSON.stringify({
            CUP: cached.CUP - (_sa.USD||0),
            EUR: cached.CUP / (cached.EUR > 0 ? (1/cached.EUR) : 1), // convert USD/EUR back to CUP/EUR
            CUPT: cached.CUPT - (_sa.CUPT||0)
          }));
        }
      } catch(e) {}
      var age = cached.ts ? Math.round((Date.now()-cached.ts)/60000) : '?';
      console.log('Rates loaded from cache (' + age + ' min old)');
    }
  } catch(e) {}
}

// Load cached rates immediately on startup (before network call)
_loadRatesCache();

// Auto-refresh: fetch on load + every 30 minutes
// ── elToque API ──────────────────────────────────────────────
// TOKEN actualizado 2026-05-20 — renovar en Edge Function update-tasas también
var _TOQUE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc3OTIwNzc2OSwianRpIjoiMmRiMDRkNzMtZDcwMi00NGU1LWE3M2ItN2EzMjIxMjU0YjU2IiwidHlwZSI6ImFjY2VzcyIsInN1YiI6IjY5ZmNjM2U4ZDA3NmQ2OGM0NmFmNzg4ZCIsIm5iZiI6MTc3OTIwNzc2OSwiZXhwIjoxODEwNzQzNzY5fQ.lhPhEgDuYXn0S37SvnIphr9qYx828kRwfncjQOQnlro';

async function fetchElToqueAndSave(){
  showToast('🔄 Actualizando elToque...');
  try {
    var data = null;

    // ── Estrategia 1: Edge Function update-tasas (actualiza tabla + devuelve datos) ──
    try {
      var r1 = await fetch(SUPA_URL + '/functions/v1/update-tasas', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + SUPA_KEY,
          'Content-Type': 'application/json'
        }
      });
      if (r1.ok) {
        var raw1 = await r1.json();
        // Edge Function devuelve: { ok: true, tasas: {USD, ECU, MLC, ...} }
        // Si tasas tiene campo 'msg' es un error de elToque (token expirado, etc.)
        var tasasOk = raw1 && raw1.ok && raw1.tasas && !raw1.tasas.msg;
        if (tasasOk) {
          data = raw1;
        } else if (raw1 && raw1.tasas && raw1.tasas.msg) {
          throw new Error('elToque: ' + raw1.tasas.msg);
        } else if (raw1 && raw1.msg) {
          throw new Error('elToque: ' + raw1.msg);
        }
      } else {
        var errTxt = await r1.text().catch(function(){ return '{}'; });
        var errJson = {};
        try { errJson = JSON.parse(errTxt); } catch(e) {}
        if (errJson.msg) throw new Error('elToque: ' + errJson.msg);
        console.warn('update-tasas HTTP ' + r1.status + ':', errTxt.substring(0,200));
      }
    } catch(e) {
      // Si el error es de token, mostrarlo claramente y no continuar
      if (e.message && e.message.indexOf('expired') >= 0) {
        throw new Error('Token elToque expirado — actualiza el token en la Edge Function de Supabase');
      }
      console.warn('elToque Edge Function:', e);
    }

    // ── Estrategia 2: Leer directamente de la tabla tasas en Supabase (fallback) ──
    if (!data) {
      try {
        var r2 = await supaReq('GET', 'tasas?select=moneda,valor,tasa_mkt,ajuste&moneda=in.(USD,EUR,MLC,DTO_PREVENTA)');
        if (r2.ok) {
          var rows = await r2.json();
          if (Array.isArray(rows) && rows.length > 0) {
            var tasasMap = {}, adjMap = {};
            rows.forEach(function(row){ 
              // Usamos tasa_mkt como TRMI. Si no existe, usamos valor - ajuste.
              var _trmi = (row.tasa_mkt && row.tasa_mkt > 10) ? row.tasa_mkt : (row.valor - (row.ajuste||0));
              tasasMap[row.moneda] = _trmi;
              adjMap[row.moneda] = row.ajuste || 0;
            });
            var usd = parseFloat(tasasMap.USD||0);
            var eur = parseFloat(tasasMap.EUR||0);
            var mlc = parseFloat(tasasMap.MLC||0);
            var dto = parseFloat(tasasMap.DTO_PREVENTA||0);
            if(dto>0) RATES.DTO_PREVENTA = dto;
            if (usd > 10) {
              // Sincronizar ajustes globales en este dispositivo
              var localAdj = {};
              try { localAdj = JSON.parse(localStorage.getItem('erp_rates_adj')||'{}'); } catch(e) {}
              localAdj.USD = adjMap.USD;
              localAdj.EUR = adjMap.EUR;
              localAdj.CUPT = adjMap.MLC;
              try { localStorage.setItem('erp_rates_adj', JSON.stringify(localAdj)); } catch(e) {}
              
              data = { ok: true, tasas: { USD: usd, ECU: eur||usd, MLC: mlc||usd } };
              showToast('⚠ elToque: usando tasas guardadas (Edge Function sin respuesta)');
            }
          }
        }
      } catch(e) { console.warn('elToque tabla tasas fallback:', e); }
    }

    if (!data || !data.tasas) throw new Error('No se pudo obtener tasas. Verifica la Edge Function update-tasas en Supabase.');

    // Response: {tasas: {USD:525, ECU:590, MLC:390, ...}}
    var t = data.tasas;
    var cup  = parseFloat(t.USD || 0);   // CUP por 1 USD
    var ecu  = parseFloat(t.ECU || 0);   // CUP por 1 EUR (elToque llama ECU al EUR)
    var cupt = parseFloat(t.MLC || 0);   // CUP por 1 MLC

    if (!cup || cup < 10) throw new Error('Datos inesperados: ' + JSON.stringify(t).substring(0,100));

    // mkt stores: CUP=USD/CUP rate, EUR=ECU/CUP rate, CUPT=MLC/CUP rate
    var mkt = {CUP:cup, EUR:ecu||cup, CUPT:cupt||cup, ts:Date.now()};
    try { localStorage.setItem('erp_rates_mkt', JSON.stringify(mkt)); } catch(e) {}

    // RATES.CUP = CUP por USD (e.g. 525)
    // RATES.EUR = USD por EUR = CUP_USD / CUP_EUR (e.g. 525/590 = 0.89)
    // RATES.CUPT = CUP por MLC (e.g. 390)
    var adj = {};
    try { adj = JSON.parse(localStorage.getItem('erp_rates_adj')||'{}'); } catch(e) {}
    RATES.CUP  = cup  + (adj.USD  || 0);
    var ecuFin = ecu  + (adj.EUR  || 0);
    if (ecuFin > 0) RATES.EUR = parseFloat((RATES.CUP / ecuFin).toFixed(6));
    // RATES_EURUSD = CUP_EUR/CUP_USD (ratio for display panel)
    if(cup>0 && ecu>0) { RATES_EURUSD=parseFloat((ecu/cup).toFixed(4)); try{localStorage.setItem('erp_eurusd',RATES_EURUSD.toString());}catch(e){} }
    RATES.CUPT = (cupt || cup) + (adj.CUPT || 0);
    
    // Guardar tasas localmente para que el próximo inicio no muestre valores desactualizados
    try { localStorage.setItem('erp_rates', JSON.stringify({USD:1,EUR:RATES.EUR,CUP:RATES.CUP,CUPT:RATES.CUPT,DTO_PREVENTA:RATES.DTO_PREVENTA,WA_PLACETAS:RATES.WA_PLACETAS,ts:Date.now()})); } catch(e) {}

    showToast('✓ elToque: USD ' + fN(cup,0) + ' · EUR ' + fN(ecu,0) + ' · MLC ' + fN(cupt,0) + ' CUP');
    renderAdminTasas();
    return mkt;
  } catch(e) {
    console.warn('fetchElToqueAndSave:', e);
    showToast('⚠ elToque: ' + e.message.substring(0, 80));
    return null;
  }
}

window.addEventListener('load', function() {
  // Auto-fetch elToque on load if rates are stale (>1 hour)
  setTimeout(function(){
    try {
      var mkt = JSON.parse(localStorage.getItem('erp_rates_mkt')||'{}');
      var age = mkt.ts ? (Date.now()-mkt.ts)/1000/60 : 999;
      if (age > 60) fetchElToqueAndSave();
    } catch(e) {}
  }, 3000); // wait 3s after load
});




// ── MÓDULO CONTENEDORES ──────────────────────────────────────────
function renderContenedores() {
  var el=document.getElementById('contenedores-root');
  if(!el)return;
  var html='<div style="padding:16px;max-width:800px;margin:0 auto">';
  
  html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">'
    +'<div style="font-size:18px;font-weight:700">🚢 Contenedores</div>'
    +'<button onclick="showNuevoContenedor()" style="background:var(--color-primary);color:var(--color-text-primary);border:none;padding:6px 12px;border-radius:6px;font-weight:600;cursor:pointer">+ Nuevo Contenedor</button>'
    +'</div>';

  if(!CONTENEDORES.length){
    html+='<div style="text-align:center;color:var(--color-text-tertiary);padding:40px;border:1px dashed rgba(255,255,255,.1);border-radius:12px">No hay contenedores registrados.</div>';
  } else {
    // Sort: Activos primero, luego cerrados/recibidos. Dentro de cada grupo, ordenar por ETA ascendente.
    var sortedCnts = CONTENEDORES.slice().sort(function(a,b){
      var cA = (a.estado==='cerrado'||a.estado==='recibido');
      var cB = (b.estado==='cerrado'||b.estado==='recibido');
      if (cA !== cB) return cA ? 1 : -1;
      var tA = a.fecha_eta ? new Date(a.fecha_eta+'T00:00:00').getTime() : 9999999999999;
      var tB = b.fecha_eta ? new Date(b.fecha_eta+'T00:00:00').getTime() : 9999999999999;
      if (tA === tB) return b.id.localeCompare(a.id);
      return tA - tB;
    });
    sortedCnts.forEach(function(c){
      html += _renderCntCard(c);
    });
  }
  
  html+='</div>';
  el.innerHTML=html;
}

function _renderCntCard(c) {
  var estados = ['preparando', 'reservado', 'en_puerto', 'en_transito', 'en_aduana', 'recibido', 'cerrado'];
  var estadoLabels = {preparando:'Preparando',reservado:'Reservado',en_puerto:'En Puerto',en_transito:'En Tránsito',en_aduana:'En Aduana',recibido:'Recibido',cerrado:'Cerrado'};
  
  var currIdx = estados.indexOf(c.estado);
  var htmlTimeline = '<div class="cnt-timeline">';
  estados.forEach(function(st, idx) {
    var act = idx <= currIdx ? ' act' : '';
    htmlTimeline += '<span class="'+act+'">'+estadoLabels[st]+'</span>';
    if (idx < estados.length - 1) {
      htmlTimeline += '<span style="background:transparent;padding:0;color:var(--color-border-tertiary)">—</span>';
    }
  });
  htmlTimeline += '</div>';

  var totalUSD = 0;
  var pagadoUSD = 0;
  
  var htmlGastos = '';
  (c.gastos||[]).forEach(function(g) {
    var totalGasto = parseFloat(g.monto||0);
    var pagadoGasto = (g.pagos||[]).reduce(function(acc, pg){ return acc + parseFloat(pg.monto||0); }, 0);
    var pct = totalGasto > 0 ? Math.min(100, Math.round((pagadoGasto/totalGasto)*100)) : 0;
    
    var pagGastoUsd = (g.pagos||[]).reduce(function(acc, pg){ 
      if (pg.equivUSD) return acc + parseFloat(pg.equivUSD);
      return acc + (pg.mon==='USD' ? pg.monto : (typeof toUSD==='function'?toUSD(pg.monto,pg.mon):pg.monto/(RATES[pg.mon]||1)));
    }, 0);
    
    var faltaGasto = Math.max(0, totalGasto - pagadoGasto);
    var usdFalta = g.moneda==='USD' ? faltaGasto : (typeof toUSD==='function'?toUSD(faltaGasto,g.moneda):faltaGasto/(RATES[g.moneda]||1));
    var usdGasto = pagGastoUsd + usdFalta;
    
    totalUSD += usdGasto;
    pagadoUSD += pagGastoUsd;
    
    var vencido = false;
    if (pct < 100 && g.vencimiento && g.vencimiento < today()) vencido = true;
    
    htmlGastos += '<div class="cnt-gasto-row">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">'
      + '<div style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px">'
      + '▸ ' + g.concepto + (g.acreedor ? ' <span style="font-weight:400;color:var(--color-text-tertiary)">('+g.acreedor+')</span>' : '')
      + '</div>'
      + '<div style="font-size:12px;font-weight:600">' + fN(totalGasto, 2) + ' ' + (g.moneda||'USD') + '</div>'
      + '</div>'
      
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
      + '<div style="flex:1;background:var(--color-background-primary);border-radius:4px;height:6px">'
      + '<div style="background:var(--color-primary);height:6px;border-radius:4px;width:'+pct+'%;transition:width .4s"></div></div>'
      + '<div style="font-size:10px;font-weight:600;width:30px;text-align:right;color:'+(pct===100?'var(--color-text-success)':vencido?'var(--color-text-danger)':'var(--color-text-secondary)')+'">'+pct+'%</div>'
      + (vencido ? '<div style="font-size:9px;color:var(--color-text-danger);background:rgba(248,113,113,.1);padding:2px 4px;border-radius:4px">⚠ Vencido</div>' : (g.vencimiento&&pct<100 ? '<div style="font-size:9px;color:var(--color-text-tertiary)">vence '+fD(g.vencimiento)+'</div>' : ''))
      + '<button onclick="editarGastoCnt(\''+c.id+'\',\''+g.id+'\')" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--color-text-tertiary);padding:0">✏️</button>'
      + '</div>';
      
    if (g.pagos && g.pagos.length) {
      g.pagos.forEach(function(pg) {
        htmlGastos += '<div style="margin-left:12px;padding:3px 0;font-size:10px;color:var(--color-text-tertiary);display:flex;justify-content:space-between;align-items:center">'
          + '<span>└ '+pg.nota+' — '+fD(pg.fecha)+' — <strong style="color:var(--color-text-secondary)">'+fN(pg.monto,2)+' '+pg.mon+'</strong> '+(pg.caja||'')+'</span>'
          + '<button onclick="eliminarPagoCnt(\''+c.id+'\',\''+g.id+'\',\''+pg.id+'\')" style="background:none;border:none;cursor:pointer;color:var(--color-text-danger);font-size:12px;padding:0">×</button>'
          + '</div>';
      });
    }
    
    if (pct < 100) {
      htmlGastos += '<div style="margin-top:6px;margin-left:12px">'
        + '<button onclick="registrarPagoCnt(\''+c.id+'\',\''+g.id+'\')" style="font-size:10px;padding:4px 8px;border-radius:6px;border:1px solid rgba(100,149,237,.3);background:rgba(100,149,237,.1);color:#8ab4f8;cursor:pointer;font-weight:600">💸 Registrar pago</button>'
        + '</div>';
    }
    
    htmlGastos += '</div>';
  });

  var pctGen = totalUSD > 0 ? Math.min(100, Math.round((pagadoUSD/totalUSD)*100)) : 0;
  var restaUSD = Math.max(0, totalUSD - pagadoUSD);
  
  var h = '<div style="background:var(--color-background-secondary);border:1px solid var(--color-border-tertiary);border-radius:12px;padding:16px;margin-bottom:16px">';
  
  // Header
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">'
    + '<div>'
    + '<div style="font-size:14px;font-weight:700;display:flex;align-items:center;gap:8px">🚢 ' + c.ref 
    + (c.estado==='cerrado' ? '<span class="cnt-estado-badge" style="background:rgba(74,222,128,.15);color:var(--color-text-success)">✓ Cerrado</span>' : '')
    + '</div>'
    + '<div style="font-size:11px;color:var(--color-text-secondary);margin-top:4px">'
    + (c.proveedor||'Sin proveedor(es)') + ' → ' + (c.almacen_destino||'Sin destino') + ' | ' + (c.transitario||'Sin transitario')
    + '</div>'
    + '</div>'
    + '<div style="text-align:right">'
    + '<div style="font-size:11px;color:var(--color-text-tertiary)">ETA</div>'
    + '<div style="font-size:12px;font-weight:600;color:var(--color-text-secondary)">'+(c.fecha_eta ? fD(c.fecha_eta) : '—')+'</div>'
    + '</div>'
    + '</div>';
    
  if (c.notas) {
    h += '<div style="font-size:11px;color:var(--color-text-tertiary);margin-bottom:12px;background:var(--color-background-primary);border:1px solid var(--color-border-tertiary);padding:8px;border-radius:6px;white-space:pre-wrap;font-style:italic">📝 ' + String(c.notas).replace(/</g, "&lt;") + '</div>';
  }
    
  h += htmlTimeline;
  
  // Resumen financiero global (convertido a USD)
  h += '<div style="background:rgba(0,0,0,.15);border-radius:8px;padding:12px;margin-bottom:16px">'
    + '<div style="display:flex;justify-content:space-between;font-size:11px;font-weight:600;margin-bottom:6px">'
    + '<span>💰 Resumen financiero global (aprox)</span>'
    + '<span>Costo USD: '+fN(totalUSD,2)+'</span>'
    + '</div>'
    + '<div style="display:flex;align-items:center;gap:10px">'
    + '<div style="flex:1;background:var(--color-background-primary);border-radius:4px;height:8px">'
    + '<div style="background:var(--color-primary);height:8px;border-radius:4px;width:'+pctGen+'%;transition:width .4s"></div></div>'
    + '<div style="font-size:11px;width:120px;text-align:right;color:var(--color-text-tertiary)">Pagado: '+fN(pagadoUSD,2)+' USD<br><span style="color:var(--color-text-danger);font-weight:600">Resta: '+fN(restaUSD,2)+' USD</span></div>'
    + '</div>'
    + '</div>';
    
  // Gastos
  if (htmlGastos) {
    h += '<div style="border:1px solid var(--color-border-tertiary);border-radius:8px;padding:0 12px;margin-bottom:12px;background:var(--color-background-primary)">' + htmlGastos + '</div>';
  } else {
    h += '<div style="font-size:11px;color:var(--color-text-tertiary);text-align:center;padding:12px 0">No hay gastos registrados para este contenedor.</div>';
  }
  
  // Footer actions
  h += '<div style="display:flex;gap:8px;border-top:1px solid var(--color-border-tertiary);padding-top:12px">'
    + '<button onclick="agregarGastoCnt(\''+c.id+'\')" style="font-size:11px;padding:5px 10px;border-radius:6px;border:1px solid var(--color-border-tertiary);background:var(--color-background-primary);color:var(--color-text-secondary);cursor:pointer;font-weight:600">+ Añadir gasto</button>'
    + '<div style="flex:1"></div>'
    + '<button onclick="showEditContenedor(\''+c.id+'\')" style="font-size:11px;padding:5px 10px;border-radius:6px;border:1px solid var(--color-border-tertiary);background:transparent;color:var(--color-text-tertiary);cursor:pointer">✏️ Editar</button>'
    + '<button onclick="eliminarContenedor(\''+c.id+'\')" style="font-size:11px;padding:5px 10px;border-radius:6px;border:1px solid rgba(248,113,113,.2);background:transparent;color:var(--color-text-danger);cursor:pointer">🗑</button>'
    + '</div>';
    
  h += '</div>';
  return h;
}

