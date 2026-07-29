











// ═══════════════════════════════════════════════════════════════
// SUPABASE SYNC LAYER v2
// ═══════════════════════════════════════════════════════════════
const SUPA_URL = 'https://gpkslaqfqfdeoleiayng.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdwa3NsYXFmcWZkZW9sZWlheW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2Nzk0MzQsImV4cCI6MjA4OTI1NTQzNH0.iTMO4obXaYC2O1QkAgkaRjygMvjkFnCFuVBVO35DmRk';

// ── Telegram Bot ─────────────────────────────────────────────
// Token eliminado del cliente: los envios van por la Edge Function 'tg-send'
// (secreto TG_BOT_TOKEN en Supabase). Dejar vacio. Solo rellenar en emergencia
// como fallback temporal si la Edge Function estuviera caida.
const TG_TOKEN = '';
const TG_ON = true; // Telegram habilitado (via Edge Function)
const TG_CHAT  = '575008904';  // personal (admin)
const TG_BACKUP = '-5277125001';  // Grupo Backups
// Grupos por almacén
const TG_VENTAS  = { Habana:'-1003851284058', Placetas:'-1003866260307' };
const TG_PEDIDOS = { Habana:'-5253654121', Placetas:'-5209909669' };
function _tgApi(tgMethod, payload, isForm){
  var url=SUPA_URL+'/functions/v1/tg-send';
  var hdrs={'Authorization':'Bearer '+SUPA_KEY,'apikey':SUPA_KEY};
  var opts;
  if(isForm){
    payload.append('tg_method',tgMethod);
    opts={method:'POST',headers:hdrs,body:payload};
  } else {
    var bodyJ=Object.assign({tg_method:tgMethod},payload);
    hdrs['Content-Type']='application/json';
    opts={method:'POST',headers:hdrs,body:JSON.stringify(bodyJ)};
  }
  return fetch(url,opts).then(function(r){
    if(r.ok) return r;
    throw new Error('edge tg-send '+r.status);
  }).catch(function(e){
    // FALLBACK TEMPORAL: token directo. Eliminar cuando la Edge Function este desplegada.
    if(typeof TG_TOKEN!=='undefined'&&TG_TOKEN){
      if(isForm){ try{payload.delete('tg_method');}catch(_e){} return fetch('https://api.telegram.org/bot'+TG_TOKEN+'/'+tgMethod,{method:'POST',body:payload}); }
      return fetch('https://api.telegram.org/bot'+TG_TOKEN+'/'+tgMethod,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    }
    throw e;
  });
}

function tgSend(msg, alm, tipo){
  if(!TG_ON&&!TG_TOKEN) return;
  // tipo: 'venta' o 'pedido'
  var grupos = tipo==='pedido' ? TG_PEDIDOS : TG_VENTAS;
  var cid = alm && grupos[alm] ? grupos[alm] : TG_CHAT;
  [TG_CHAT, cid].filter(function(x,i,a){return a.indexOf(x)===i;}).forEach(function(id){
    _tgApi('sendMessage',{chat_id:id,text:msg,parse_mode:'HTML'}).catch(function(e){console.warn('Telegram:',e);});
  });
}

function _tgCliBalance(cliName) {
  if(!cliName || cliName==='Walk-in') return '';
  if(typeof CLIENTES==='undefined' || !CLIENTES) return '';
  var cli = CLIENTES.find(function(x){return x.nombre===cliName;});
  if(!cli) return '';
  var _tot = 0, _pag = 0;
  (cli.folios||[]).forEach(function(f){
    _tot += (f.totalUSD||0);
    (f.abonos||[]).forEach(function(ab){ _pag += (ab.equivUSD||0); });
  });
  var _pdt = _tot - _pag;
  var _favor = _pag > _tot + 0.01 ? _pag - _tot : 0;
  if (_pdt > 0.01) return '\n\n🔴 <b>Deuda pendiente:</b> '+fN(_pdt)+' USD';
  if (_favor > 0.01) return '\n\n💰 <b>Saldo a favor:</b> +'+fN(_favor)+' USD';
  if (_tot > 0) return '\n\n🟢 <b>Cuenta:</b> Saldada';
  return '';
}
let _supaOnline = navigator.onLine;
let _syncQueue  = [];

function supaReq(method, path, body) {
  var isUpsert = method === 'POST' && path.indexOf('on_conflict') >= 0;
  var headers = {
    'apikey': SUPA_KEY,
    'Authorization': 'Bearer ' + SUPA_KEY,
    'Content-Type': 'application/json',
    'Prefer': isUpsert ? 'resolution=merge-duplicates,return=representation' : (method === 'POST' ? 'return=representation' : 'return=minimal')
  };
  return fetch(SUPA_URL + '/rest/v1/' + path, {
    method: method,
    headers: headers,
    body: body ? JSON.stringify(body) : undefined
  });
}

// ── Test desde consola: supaTest() ──────────────────────────
window.supaTest = async function() {
  try {
    showSyncStatus('Probando conexión...');
    const r = await fetch(SUPA_URL + '/rest/v1/ventas?limit=1', {
      headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY }
    });
    const text = await r.text();
    console.log('Supabase status:', r.status, r.statusText);
    console.log('Response:', text.substring(0, 200));
    if (r.ok) {
      showSyncStatus('✓ Conectado — ' + r.status);
      showToast('Supabase OK: ' + r.status);
    } else {
      showSyncStatus('Error ' + r.status);
      showToast('Error Supabase: ' + r.status + ' — ' + text.substring(0,100));
    }
  } catch(e) {
    console.error('supaTest error:', e);
    showToast('Error de red: ' + e.message);
    showSyncStatus('Error de red');
  }
};

function showSyncStatus(msg) {
  var lbl = document.getElementById('sync-lbl');
  var dot = document.getElementById('sync-dot');
  if (lbl) lbl.textContent = msg;
  if (dot) dot.style.background = msg.includes('✓') ? '#4ade80' : msg.includes('Error') ? '#f87171' : '#fbbf24';
}

function updOnlineDot() {
  var col = _supaOnline ? (_syncQueue.length>0 ? '#fbbf24' : '#4ade80') : '#f87171';
  var txt = _supaOnline ? (_syncQueue.length>0 ? _syncQueue.length+' pend.' : 'Online') : 'Offline';
  ['sync-dot','pos-sync-dot'].forEach(function(id){var e=document.getElementById(id);if(e)e.style.background=col;});
  ['sync-lbl','pos-sync-lbl'].forEach(function(id){var e=document.getElementById(id);if(e)e.textContent=txt;});
}

window.addEventListener('beforeunload', function(){
  try{localStorage.setItem('erp_queue',JSON.stringify(_syncQueue));}catch(e){}
  if(typeof offlineSaveVentas==='function') offlineSaveVentas();
  if(typeof offlineSaveProds==='function') offlineSaveProds();
});
window.addEventListener('online', function() {
  _supaOnline = true; updOnlineDot();
  showToast('📶 Conexión restaurada — sincronizando...');
  flushQueue();
  _autoSync(); // sync immediately on reconnect
});
window.addEventListener('offline', function() { _supaOnline = false; updOnlineDot(); });

// ── AUTO SYNC ─────────────────────────────────────────────
var _lastSync = 0;
async function _autoSync() {
  if (!_supaOnline) return;
  var now = Date.now();
  if (now - _lastSync < 30000) return; // max once per 30s
  _lastSync = now;
  try {
    await syncLoadProductos();
    if (typeof syncLoadVentas === 'function') await syncLoadVentas();
    if (typeof loadCajasData === 'function') await loadCajasData();
    if (typeof renderStock === 'function') try { renderStock(); } catch(e) {}
    if (typeof renderVentas === 'function') try { renderVentas(); } catch(e) {}
  } catch(e) { console.warn('autoSync:', e); }
}
// Run auto sync every 2 minutes
setInterval(_autoSync, 120000);
// Run once 5 seconds after load
setTimeout(_autoSync, 5000);

// ── CIERRE DIARIO 8PM ─────────────────────────────────
var _cierreEnviado = '';
function _checkCierre() {
  if (!_supaOnline || (!TG_ON&&!TG_TOKEN)) return;
  // Use Cuba timezone (America/Havana) — UTC-4 summer, UTC-5 winter
  var now = new Date();
  var cubaNow = new Date(now.toLocaleString('en-US', {timeZone:'America/Havana'}));
  var hoy = cubaNow.getFullYear()+'-'+String(cubaNow.getMonth()+1).padStart(2,'0')+'-'+String(cubaNow.getDate()).padStart(2,'0');
  var hora = cubaNow.getHours();
  // Solo a las 20h (8pm hora Cuba) y si no se envió hoy ya
  if (hora !== 20) return;
  if (_cierreEnviado === hoy) return;
  _cierreEnviado = hoy;
  try { localStorage.setItem('erp_cierre_enviado', hoy); } catch(e) {}
  enviarCierreDiario(hoy, true);
}
// Check every minute
setInterval(_checkCierre, 60000);
// Restore last sent date
try { _cierreEnviado = localStorage.getItem('erp_cierre_enviado')||''; } catch(e) {}

async function enviarCierreDiario(fecha, isAuto) {
  if (!fecha) fecha = new Date().toISOString().slice(0,10);
  var alms = ['Habana','Placetas'];
  for (var i=0; i<alms.length; i++) {
    var alm = alms[i];
    var ventasAlm = (typeof VENTAS!=='undefined'?VENTAS:[]).filter(function(v){
      var vAlm = v.alm || v.almacen || 'Habana';
      return v.fecha && v.fecha.slice(0,10)===fecha && vAlm===alm;
    });
    var numVentas = ventasAlm.length;
    var totalUSD = ventasAlm.reduce(function(a,v){return a+(v.totalUSD||0);},0);

    // Cobros por moneda
    var cobros = {USD:0,EUR:0,CUP:0,CUPT:0,MLC:0};
    var vueltosMon = {USD:0,EUR:0,CUP:0,CUPT:0,MLC:0};
    ventasAlm.forEach(function(v){
      var pagos=[]; try{
        if(Array.isArray(v.pagos)) pagos=v.pagos;
        else if(typeof v.pagos==='string') pagos=JSON.parse(v.pagos);
        else if(v.cobros_json){var _c=JSON.parse(v.cobros_json);pagos=_c.pagos||[];}
      }catch(e){}
      pagos.forEach(function(p){if(cobros[p.mon]!=null)cobros[p.mon]+=(p.m||0);});
      var vts=[]; try{
        if(Array.isArray(v.vueltos)) vts=v.vueltos;
        else if(typeof v.vueltos==='string') vts=JSON.parse(v.vueltos);
        else if(v.cobros_json){var _c2=JSON.parse(v.cobros_json);vts=_c2.vueltos||[];}
      }catch(e){}
      vts.forEach(function(p){if(vueltosMon[p.mon]!=null)vueltosMon[p.mon]+=(p.m||0);});
    });
    var monSym={USD:'$',EUR:'\u20ac',CUP:'\u20b1',CUPT:'\u20b1',MLC:'\u20b1'};
    var cobrosLines=Object.keys(cobros).filter(function(m){return cobros[m]>0;}).map(function(m){
      var eq=m==='USD'?'':' \u2248 $'+fN(toUSD(cobros[m],m));
      return '  '+monSym[m]+' '+fN(cobros[m],m==='USD'||m==='EUR'?2:0)+' '+m+eq;
    }).join('\n');
    var vueltosLines=Object.keys(vueltosMon).filter(function(m){return vueltosMon[m]>0;}).map(function(m){
      return '  '+monSym[m]+' '+fN(vueltosMon[m],m==='USD'||m==='EUR'?2:0)+' '+m;
    }).join('\n');


    // Neto por moneda = cobrado - vueltos en cada moneda
    var monSym2={USD:'$',EUR:'\u20ac',CUP:'\u20b1',CUPT:'\u20b1',MLC:'\u20b1'};
    var allMons=['USD','EUR','CUP','CUPT','MLC'];
    var _netoTotalUSD=0;
    var _netoMonCount=allMons.filter(function(m){return cobros[m]>0||vueltosMon[m]>0;}).length;
    var netoLines=allMons.filter(function(m){return cobros[m]>0||vueltosMon[m]>0;}).map(function(m){
      var neto=cobros[m]-(vueltosMon[m]||0);
      var dec=m==='USD'||m==='EUR'?2:0;
      var netoEquiv=m!=='USD'?(' \u2248 $'+fN(toUSD(neto,m,alm))):'';
      _netoTotalUSD+=toUSD(neto,m,alm);
      return '  '+(monSym2[m]||'')+'  '+fN(cobros[m],dec)+' cobrado'+(vueltosMon[m]>0?' \u2212 '+fN(vueltosMon[m],dec)+' vuelto':'')+' = <b>'+fN(neto,dec)+'</b> '+m+netoEquiv;
    }).join('\n');
    if(_netoMonCount>1) netoLines+='\n  \u2014\u2014\u2014\n  <b>\uD83D\uDCB0 Total neto: $'+fN(_netoTotalUSD)+'</b>';
    // Saldo de cajas del almacen
    // IG movements of the day for this almacen
    var movsHoy=(typeof MOVS!=='undefined'?MOVS:[]).filter(function(m){
      var mAlm=['Habana','Placetas','Xportprise'].find(function(a){return (m.cta||'').indexOf(a)>=0;})||m.alm||'';
      return m.fecha&&m.fecha.slice(0,10)===fecha && mAlm===alm;
    });
    var igByMon={};
    movsHoy.forEach(function(m){
      if(!igByMon[m.mon]) igByMon[m.mon]={ing:0,gas:0,movs:[]};
      if(m.sentido==='ingreso') igByMon[m.mon].ing+=m.monto;
      else igByMon[m.mon].gas+=m.monto;
      igByMon[m.mon].movs.push(m);
    });
    var igLines=Object.keys(igByMon).map(function(mon){
      var d=igByMon[mon];
      var dec=mon==='USD'||mon==='EUR'?2:0;
      var lines=d.movs.map(function(m){
        var sym=m.sentido==='ingreso'?'+':'-';
        return '  '+sym+' '+fN(m.monto,dec)+' '+mon+' · '+m.desc;
      }).join('\n');
      var neto=d.ing-d.gas;
      var netoStr=(neto>=0?'+':'-')+fN(Math.abs(neto),dec)+' '+mon+' neto';
      return lines+'\n  = '+netoStr;
    }).join('\n');
    // ── Abonos a folios de clientes del día ──
    var abonosHoy = [];
    (typeof CLIENTES !== 'undefined' ? CLIENTES : []).forEach(function(cli) {
      (cli.folios || []).forEach(function(f) {
        var fAlm = f.alm || f.almacen || 'Habana';
        if (fAlm !== alm) return;
        (f.abonos || []).forEach(function(ab) {
          if (ab.fecha && ab.fecha.slice(0,10) === fecha) {
            abonosHoy.push({ cli: cli.nombre, monto: ab.monto||ab.m||0, mon: ab.mon||'USD', equivUSD: ab.equivUSD||0, desc: ab.desc||ab.concepto||'' });
          }
        });
      });
    });
    var abonosByMon = {};
    var abonosTotalUSD = 0;
    abonosHoy.forEach(function(ab) {
      if (!abonosByMon[ab.mon]) abonosByMon[ab.mon] = 0;
      abonosByMon[ab.mon] += ab.monto;
      abonosTotalUSD += ab.equivUSD || toUSD(ab.monto, ab.mon, alm);
    });
    var abonosLines = '';
    if (abonosHoy.length > 0) {
      var monSymA = {USD:'$',EUR:'€',CUP:'₱',CUPT:'₱',MLC:'₱'};
      abonosLines = Object.keys(abonosByMon).map(function(m) {
        var dec = m==='USD'||m==='EUR' ? 2 : 0;
        var eq = m!=='USD' ? ' ≈ $'+fN(toUSD(abonosByMon[m],m,alm)) : '';
        return '  '+(monSymA[m]||'')+' '+fN(abonosByMon[m],dec)+' '+m+eq;
      }).join('\n');
      if (Object.keys(abonosByMon).length > 1)
        abonosLines += '\n  ——\n  <b>💰 Total cobrado clientes: $'+fN(abonosTotalUSD)+'</b>';
    }


    if(typeof loadCajasData==='function' && (!_cajasData||!_cajasData.length)){
      try{ await loadCajasData(); }catch(e){}
    }
        var cajasAlm=typeof _cajasData!=='undefined'?_cajasData.filter(function(c){
      return c.activa!==false && c.almacen===alm && c.nombre.indexOf('ZELLE')<0;
    }):[];
    var cajasLines=cajasAlm.map(function(c){
      var saldo=typeof _getSaldoCaja==='function'?_getSaldoCaja(c.nombre||c.id):(parseFloat(c.saldo_inicial)||0);
      // Show all cajas even if empty
      var monSym2={USD:'$',EUR:'\u20ac',CUP:'\u20b1',CUPT:'\u20b1',MLC:'\u20b1'};
      return '  '+(monSym2[c.moneda]||'')+' '+fN(saldo,c.moneda==='USD'||c.moneda==='EUR'?2:0)+' '+c.moneda+' ('+c.nombre+')';
    }).filter(Boolean).join('\n');


    // Por vendedor
    var porVend={};
    ventasAlm.forEach(function(v){
      var vend=v.vend||v.vendedor||'?';
      if(!porVend[vend])porVend[vend]={n:0,usd:0};
      porVend[vend].n++;porVend[vend].usd+=(v.totalUSD||0);
    });
    var vendLines=Object.keys(porVend).map(function(vend){
      return '  \uD83D\uDC64 '+vend+': '+porVend[vend].n+' venta'+(porVend[vend].n!==1?'s':'')+' � $'+fN(porVend[vend].usd);
    }).join('\n');

     // Productos vendidos completo + margen
     var prodData={};
     ventasAlm.forEach(function(v){
       (v.prods||'').split(',').forEach(function(p){
         var m=p.trim().match(/^(\d+)(?:\xd7|\u00d7|x|X)\s*(.+)/i);
         if(m){
           var nm=m[2].trim();
           var qty=parseInt(m[1]);
           if(!prodData[nm]) prodData[nm]={qty:0,usd:0,ddp:0};
           prodData[nm].qty+=qty;
           // Find product price and DDP
           var prod=typeof PRODS!=='undefined'?PRODS.find(function(pr){return pr.n===nm;}):null;
           var precioUSD=prod?((prod.maj||prod.min)||((prod.escala&&prod.escala.length)?parseFloat(prod.escala[0].precio)||0:0)):0;
           var ddpUSD=prod?(prod.ddp||0):0;
           prodData[nm].usd+=precioUSD*qty;
           prodData[nm].ddp+=ddpUSD*qty;
         }
       });
     });
     var totalMargen=0;
     var prodLines=Object.keys(prodData).sort(function(a,b){return prodData[b].qty-prodData[a].qty;}).map(function(n){
       var d=prodData[n];
       var margen=d.ddp>0?d.usd-d.ddp:null;
       if(margen!=null) totalMargen+=margen;
           return '  \u2022 '+d.qty+'\u00d7 '+n+(d.usd>0?' \u2014 $'+fN(d.usd):'');
     }).join('\n');


    var msg='\uD83D\uDCCA <b>Cierre \u2014 '+alm+'</b>\n'
      +'\uD83D\uDDD3 '+fecha+'\n\n'
      +(numVentas===0
        ? '\uD83D\uDEAB Sin ventas registradas hoy\n'
        : '\uD83D\uDED2 <b>'+numVentas+' venta'+(numVentas!==1?'s':'')+'</b>\n\n'
        +(cobrosLines?'<b>Cobrado:</b>\n'+cobrosLines+'\n':'')
        +(vueltosLines?'\n<b>Vueltos:</b>\n'+vueltosLines+'\n':'')
        +(netoLines?'\n<b>\uD83D\uDCB5 Neto por moneda:</b>\n'+netoLines+'\n':'')
        +(vendLines?'\n<b>Por vendedor:</b>\n'+vendLines:'')
        +(prodLines?'\n\n<b>Vendido:</b>\n'+prodLines+'\n':'')
      )
      +(igLines?'\n<b>📋 I/G del día:</b>\n'+igLines+'\n':'')
      +(abonosLines?'\n<b>🤝 Cobros clientes (folios):</b>\n'+abonosLines+'\n':'')
      +(cajasLines?'\n<b>🏦 Saldo cajas:</b>\n'+cajasLines:'');
    tgSend(msg, alm, 'venta');
  }
  if(isAuto){ try{ await enviarBackupTelegram(); }catch(e){} }
  showToast('\uD83D\uDCCA Cierre enviado');
}

function enqueue(op) {
  op.ts = Date.now();
  _syncQueue.push(op);
  updOnlineDot();
  try { localStorage.setItem('erp_queue', JSON.stringify(_syncQueue)); } catch(e) {}
}

// Write to Supabase if online, otherwise enqueue for later
function _supaWrite(method, path, body) {
  if (_supaOnline && typeof supaReq === 'function') {
    return supaReq(method, path, body).then(function(r){
      if(!r.ok) r.text().then(function(t){
        console.warn('supaWrite error',path,t);
        // If it failed, enqueue for retry
        enqueue({method:method, path:path, body:body});
      });
      return r;
    }).catch(function(e){
      console.warn('supaWrite offline fallback:',e);
      enqueue({method:method, path:path, body:body});
    });
  } else {
    enqueue({method:method, path:path, body:body});
    return Promise.resolve({ok:false, queued:true});
  }
}

function loadQueue() {
  try {
    var q = localStorage.getItem('erp_queue');
    if (q) {
      var loaded = JSON.parse(q);
      // Auto-correct corrupted queue items from previous bug
      loaded.forEach(function(op){
        if (op.path === 'ventas' && op.method === 'POST' && op.body && op.body.id) {
          op.method = 'PATCH';
          op.path = 'ventas?id=eq.'+op.body.id;
          delete op.body.id;
        }
      });
      // Drop items older than 7 days to avoid infinite retry
      var cutoff = Date.now() - 604800000;
      _syncQueue = loaded.filter(function(op){ return !op.ts || op.ts > cutoff; });
    }
  } catch(e) { _syncQueue = []; }
}

async function flushQueue() {
  if (!_supaOnline || _syncQueue.length === 0) return;
  var toProcess = _syncQueue.splice(0);
  localStorage.removeItem('erp_queue');
  updOnlineDot();
  for (var op of toProcess) {
    try {
      if (op.path.includes('movimientos_ig') && op.body) {
        // Normalize field names — Supabase columns are 'descripcion', 'cuenta', 'vendedor'
        if (op.body.concepto !== undefined) { op.body.descripcion = op.body.concepto; delete op.body.concepto; }
        if (op.body.cta !== undefined) { op.body.cuenta = op.body.cta; delete op.body.cta; }
        if (op.body.caja !== undefined) { op.body.cuenta = op.body.caja; delete op.body.caja; }
        if (op.body.usuario !== undefined) { op.body.vendedor = op.body.usuario; delete op.body.usuario; }
        if (op.body.vend !== undefined) { op.body.vendedor = op.body.vend; delete op.body.vend; }
        // Ensure equiv_usd is present, if missing calculate it roughly from monto
        if (op.body.equiv_usd === undefined && op.body.monto !== undefined) {
          op.body.equiv_usd = op.body.monto; // Safe fallback, assuming it's roughly 1:1 or already converted
        }
        // Strip fields not in Supabase schema (causes 400)
        delete op.body.almacen;
        delete op.body.sentido;
        delete op.body.id;
      }
      var r = await supaReq(op.method, op.path, op.body);
      if (!r.ok) {
        var _errBody = '';
        try { _errBody = await r.clone().text(); } catch(e2) {}
        console.warn('Queue op failed:', r.status, op.path, _errBody);
        _syncQueue.push(op);
      }
    } catch(e) {
      console.warn('Queue flush error:', e);
      _syncQueue.push(op);
    }
  }
  if (_syncQueue.length > 0) {
    try { localStorage.setItem('erp_queue', JSON.stringify(_syncQueue)); } catch(e) {}
  } else {
    // All flushed — reload all data from Supabase
    var _reloads = [];
    // Only reload ventas if queue had POST/PATCH (not just DELETEs)
    var _hadPosts=toProcess.some(function(op){return op.method==='POST'||op.method==='PATCH';});
    if(_hadPosts&&((typeof TG_ON!=='undefined'&&TG_ON)||(typeof TG_TOKEN!=='undefined'&&TG_TOKEN))){
      toProcess.filter(function(op){return op.method==='POST'&&op.path==='ventas'&&op.body;}).forEach(function(op){
        var v=op.body; if(!v||!v.almacen) return;
        var _pr=(function(){
          if(v.productos_json) return v.productos_json.map(function(p){return '  • '+p.q+'x '+p.n+' @ $'+fN(p.p||0)+' = $'+fN(p.q*(p.p||0));}).join('\n');
          return (v.productos||'').split(', ').map(function(p){return '  • '+p.trim();}).join('\n');
        })();
        // cobros_json may be string JSON or array
        var _cj=v.cobros_json;
        if(typeof _cj==='string'){try{_cj=JSON.parse(_cj);}catch(e){_cj=null;}}
        var _pagos=Array.isArray(_cj)?_cj:(_cj&&Array.isArray(_cj.pagos)?_cj.pagos:[]);
        var _vueltos=(_cj&&Array.isArray(_cj.vueltos))?_cj.vueltos:[];
        var _cb=_pagos.map(function(c){return fN(c.m||c.monto||0,2)+' '+(c.mon||c.moneda||'USD')+(c.caja?' ('+c.caja+')':'');}).join(' + ');
        var _vt=_vueltos.map(function(c){return fN(c.m||c.monto||0,2)+' '+(c.mon||c.moneda||'USD')+(c.caja?' ('+c.caja+')':'');}).join(' + ');
        var _tk=v.notas&&v.notas.match(/\[([A-Z0-9]{3,5}-\d+)\]/)?v.notas.match(/\[([A-Z0-9]{3,5}-\d+)\]/)[1]:(v.notas&&v.notas.match(/([A-Z]{3}\d{2}-\d+)/)?v.notas.match(/([A-Z]{3}\d{2}-\d+)/)[1]:'');
        tgSend('\uD83D\uDCB0 <b>Venta POS (offline)</b>'+(_tk?' <code>'+_tk+'</code>':'')+'\n'
          +'\uD83D\uDC64 '+(v.vendedor||'?')+' \u2022 '+v.almacen+'\n'
          +'\uD83D\uDED2 '+(v.cliente||'Walk-in')+'\n'
          +(_pr?'\uD83D\uDCE6 '+_pr+'\n':'')
          +'\uD83D\uDCB5 <b>$'+fN(parseFloat(v.total_usd||0))+'</b>\n'
          +'\uD83D\uDCB3 '+(_cb||'-')
          +(_vt?'\n\uD83D\uDD04 Vuelto: '+_vt:'')
          +(v.notas&&v.notas.replace(/\[[A-Z]{3}\d{2}-\d{3}\]\s*/,'').trim()?'\n\uD83D\uDCDD '+v.notas.replace(/\[[A-Z]{3}\d{2}-\d{3}\]\s*/,'').trim():'')
          +'\n\u2601\uFE0F Sincronizada offline',v.almacen,'venta');
      });
    }
    if (_hadPosts && typeof syncLoadVentas === 'function') _reloads.push(syncLoadVentas());
    if (typeof syncLoadMovsIG === 'function') _reloads.push(syncLoadMovsIG());
    if (typeof loadCajasData === 'function') _reloads.push(loadCajasData());
    if (typeof loadComReglas === 'function') _reloads.push(loadComReglas());
    if (typeof syncLoadClientes === 'function') _reloads.push(syncLoadClientes());
    await Promise.all(_reloads);
    // Refresh any open views
    if(typeof renderLibro==='function') try{renderLibro();}catch(e){}
    if(typeof renderCajas==='function') try{renderCajas();}catch(e){}
    if(typeof renderLista==='function') try{renderLista();}catch(e){}
    showToast('✓ Datos sincronizados con Supabase');
  }
  updOnlineDot();
}

// ── VENTAS ────────────────────────────────────────────────────
async function syncSaveVenta(v) {
  var row = {
    fecha:        v.fecha,
    vendedor:     v.vend,
    almacen:      v.alm,
    cliente:      v.cli || 'Walk-in',
    tipo:         v.tipo,
    productos:    v.prods,
    total_usd:    v.totalUSD,
    moneda_cobro: v.mon,
    com_pct:      v.comPct || 0,
    com_usd:      v.comUSD  || 0,
    est_com:      v.estCom  || 'Pendiente',
    notas:        (v.ticket?'['+v.ticket+']':'')
                 +(v.hora?'['+v.hora+']':'')
                 +(v.nota?' '+v.nota:''),
    cobros_json:  v.pagos   ? JSON.stringify({pagos:v.pagos,vueltos:v.vueltos||[],comDetalle:v.comDetalle||{}}) : ''
  };
  // Solo incluir id si NO es PATCH (para evitar errores en update)
  var path = v.supaId ? 'ventas?id=eq.'+v.supaId : 'ventas';
  var method = v.supaId ? 'PATCH' : 'POST';
  if(v.supaId && method !== 'PATCH') row.id = v.supaId;

  if (_supaOnline) {
    try {
      var r = await supaReq(method, path, row);
      if (r.ok) {
        if(!v.supaId){
          var data = await r.json();
          if (data && data[0] && data[0].id){
            v.supaId = data[0].id;
            // Save back to local with supaId
            offlineSaveVentas();
          }
        }
        showSyncStatus('✓ Guardado');
        return true;
      } else {
        var errText = await r.text();
        console.error('syncSaveVenta error:', r.status, errText);
        // Queue for retry
        enqueue({ method: method, path: path, body: row });
      }
    } catch(e) {
      console.error('syncSaveVenta:', e);
      enqueue({ method: method, path: path, body: row });
    }
  } else {
    enqueue({ method: method, path: path, body: row });
  }
  return false;
}

async function syncLoadMovsIG(){
  try{
    var _rm=await supaReq('GET','movimientos_ig?order=fecha.desc&limit=500');
    if(!_rm.ok) return;
    var _rd=await _rm.json()||[];
    // Always replace MOVS with Supabase data (even if empty — clears stale cache)
    MOVS=_rd.map(function(r){return{
      id:r.id, fecha:r.fecha, tipo:r.tipo, desc:r.descripcion||r.desc||'',
      monto:parseFloat(r.monto||0), mon:r.moneda||r.mon||'USD',
      equivUSD:parseFloat(r.equiv_usd||r.monto||0),
      cta:r.caja||r.cuenta||r.cta||'',
      sentido:(typeof TIPO_META!=='undefined'&&TIPO_META[r.tipo]?TIPO_META[r.tipo].sentido:'gasto'),
      notas:r.notas||'', vend:r.vendedor||r.vend||'', alm:'',
      ts:r.created_at||(r.fecha+'T00:00:00Z')
    };});
    if(_rd.length){
      igNextId=Math.max(igNextId,_rd.reduce(function(a,r){return Math.max(a,r.id||0);},0)+1);
    }
    try{localStorage.setItem('erp_movs',JSON.stringify(MOVS.slice(0,500)));}catch(e){}
    if(typeof renderLibro==='function')try{renderLibro();}catch(e){}
  }catch(e){console.warn('syncLoadMovsIG:',e);}
}

async function syncLoadVentas() {
  if (!_supaOnline) return false;
  try {
    var r = await supaReq('GET', 'ventas?order=fecha.desc&limit=500&select=*,cobros_json');
    if (!r.ok) {
      console.error('syncLoadVentas HTTP error:', r.status);
      return false;
    }
    var rows = await r.json();
    VENTAS.length = 0;
    venNextId = 1;
    (rows || []).forEach(function(row) {
      var _raw = row.notas||'';
      var _tkM  = _raw.match(/\[([A-Z]{3}\d{2}-\d+)\]/);
      var _hrM  = _raw.match(/\[(\d{2}:\d{2})\]/);
      var _nota = _raw.replace(/\[[^\]]*\]/g,'').trim();
      VENTAS.push({
        id:       venNextId++,
        supaId:   row.id,
        fecha:    row.fecha,
        ticket:   _tkM ? _tkM[1] : '',
        hora:     _hrM ? _hrM[1] : '',
        vend:     row.vendedor,
        alm:      row.almacen,
        cli:      row.cliente,
        tipo:     row.tipo,
        mon:      row.moneda_cobro,
        prods:    row.productos,
        totalUSD: parseFloat(row.total_usd),
        comPct:   parseFloat(row.com_pct || 0),
        comUSD:   parseFloat(row.com_usd  || 0),
        estCom:   row.est_com,
        nota:     _nota,
        pagos:   (function(){ try{ var c=JSON.parse(row.cobros_json||'{}'); return c.pagos||[]; }catch(e){return [];} })(),
        vueltos: (function(){ try{ var c=JSON.parse(row.cobros_json||'{}'); return c.vueltos||[]; }catch(e){return [];} })(),
        comDetalle: (function(){ try{ var c=JSON.parse(row.cobros_json||'{}'); return c.comDetalle||{}; }catch(e){return {};} })()
      });
    });
    if (typeof renderVentas === 'function') { try { renderVentas(); } catch(e) {} }
    if (typeof offlineSaveVentas === 'function') offlineSaveVentas();
    return true;
  } catch(e) { console.error('syncLoadVentas error:', e); return false; }
}

async function syncLoadProductos() {
  if (!_supaOnline) return false;
  try {
    var r = await supaReq('GET', 'productos?select=*,stock_almacen(*)');
    if (!r.ok) { console.error('syncLoadProductos error:', r.status); return false; }
    var rows = await r.json();
    if (!rows || !rows.length) return true;
    rows.forEach(function(row) {
      var stk_alm = {};
      (row.stock_almacen || []).forEach(function(s) { stk_alm[s.almacen] = s.cantidad; });
      var stk = Object.values(stk_alm).reduce(function(a,v){return a+v;}, 0);
      var prod = {
        n: row.nombre, cat: row.categoria||'',
        min: row.precio_min != null ? parseFloat(row.precio_min) : null,
        maj: row.precio_maj != null ? parseFloat(row.precio_maj) : null,
        escala: (function(v){ try{ return v ? (typeof v==='string'?JSON.parse(v):v) : null; }catch(e){ return null; } })(row.precios_escala),
        ddp: row.precio_ddp != null ? parseFloat(row.precio_ddp) : null,
        cif: row.precio_cif != null ? parseFloat(row.precio_cif) : null,
        stk: stk, stk_alm: stk_alm, stk_min: row.stk_min||10,
        activo: row.activo !== false, enStock: row.en_stock !== false, enWeb: row.en_web !== false,
        enTransito: {Habana:row.en_transito_habana===true, Placetas:row.en_transito_placetas===true, Xportprise:row.en_transito_xportprise===true},
        preventa_min: row.precio_preventa_min!=null?parseFloat(row.precio_preventa_min):null,
        moq: row.moq!=null?parseInt(row.moq):1,
        preventa_maj: row.precio_preventa_maj!=null?parseFloat(row.precio_preventa_maj):null,
        min_placetas: row.precio_min_placetas!=null ? parseFloat(row.precio_min_placetas) : null,
        maj_placetas: row.precio_maj_placetas!=null ? parseFloat(row.precio_maj_placetas) : null,
        img: row.imagen_url||'', supaId: row.id,
        oferta: row.en_oferta===true && row.badge_texto!=='RESERVADO', 
        badgeTexto: row.badge_texto==='RESERVADO' ? '' : (row.badge_texto||''),
        precioOfertaHabana: row.precio_oferta_habana!=null?parseFloat(row.precio_oferta_habana):null,
        precioOfertaPlacetas: row.precio_oferta_placetas!=null?parseFloat(row.precio_oferta_placetas):null,
        reservado: row.badge_texto==='RESERVADO',
        por_encargo: row.por_encargo===true,
        esquema_pago: row.esquema_pago||'',
        tiempo_transito: row.tiempo_transito||'',
        precio_mercado: row.precio_mercado!=null?parseFloat(row.precio_mercado):null,
        cif: row.precio_cif!=null?parseFloat(row.precio_cif):null,
        ficha_tecnica: row.ficha_tecnica||''
      };
      var existing = PRODS.find(function(p){return p.n===row.nombre;});
      if (existing) Object.assign(existing, prod); else PRODS.push(prod);
    });
    if (typeof renderStock === 'function') { try { renderStock(); } catch(e) {} }
    if (typeof offlineSaveProds === 'function') offlineSaveProds();
    return true;
  } catch(e) { console.error('syncLoadProductos error:', e); return false; }
}

async function getOrCreateProductoId(p) {
  // Try to get existing id first
  if (p.supaId) return p.supaId;
  try {
    var lr = await supaReq('GET', 'productos?nombre=eq.'+encodeURIComponent(p.n)+'&select=id');
    if (lr.ok) { var ld = await lr.json(); if (ld&&ld[0]) { p.supaId=ld[0].id; return p.supaId; } }
  } catch(e) {}
  return null;
}

async function syncStockAlmacen(prodId, almacen, cantidad) {
  // Upsert — works whether row exists or not
  var r = await supaReq('POST',
    'stock_almacen?on_conflict=producto_id,almacen',
    {producto_id:prodId, almacen:almacen, cantidad:cantidad});
  return r.ok;
}

async function syncSaveProducto(p) {
  var row = {nombre:p.n,categoria:p.cat||'',
    precio_min:p.min!=null?p.min:null,precio_maj:p.maj!=null?p.maj:null,
    precios_escala:p.escala&&p.escala.length?JSON.stringify(p.escala):null,
    precio_ddp:p.ddp!=null?p.ddp:null,
    precio_cif:p.cif!=null?p.cif:null,stk_min:p.stk_min||10,
    activo:p.activo!==false,en_stock:p.enStock!==false,en_web:p.enWeb!==false,
    en_transito_habana:!!(p.enTransito&&p.enTransito.Habana),
    en_transito_placetas:!!(p.enTransito&&p.enTransito.Placetas),
    en_transito_xportprise:!!(p.enTransito&&p.enTransito.Xportprise),
    precio_preventa_min:p.preventa_min!=null?p.preventa_min:null,
    precio_preventa_maj:p.preventa_maj!=null?p.preventa_maj:null,
    precio_min_placetas:p.min_placetas!=null?p.min_placetas:null,
    moq:p.moq||1,
    precio_maj_placetas:p.maj_placetas!=null?p.maj_placetas:null,
    imagen_url:p.img||null,
    en_oferta:p.oferta===true, badge_texto:p.reservado?'RESERVADO':(p.badgeTexto||null),
    precio_oferta_habana:p.precioOfertaHabana!=null?p.precioOfertaHabana:null,
    precio_oferta_placetas:p.precioOfertaPlacetas!=null?p.precioOfertaPlacetas:null,
    por_encargo:p.por_encargo===true,
    esquema_pago:p.esquema_pago||null,
    tiempo_transito:p.tiempo_transito||null,
    precio_mercado:p.precio_mercado!=null?p.precio_mercado:null,
    ficha_tecnica:p.ficha_tecnica||null,
    nombre_puerto:p.nombre_puerto||null};

  if (!_supaOnline) {
    // Offline: use PATCH if supaId known, else POST upsert by nombre
    if(p.supaId){
      enqueue({method:'PATCH',path:'productos?id=eq.'+p.supaId,body:row});
    } else {
      enqueue({method:'POST',path:'productos?on_conflict=nombre',body:row});
    }
    return false;
  }
  try {
    var r;
    if (p.supaId) {
      // Product exists — PATCH by id (safe rename)
      r = await supaReq('PATCH', 'productos?id=eq.'+p.supaId, row);
      if (!r.ok) { console.error('syncSaveProducto PATCH failed:', r.status); return false; }
    } else {
      // New product — POST upsert by nombre
      r = await supaReq('POST', 'productos?on_conflict=nombre', row);
      if (!r.ok) { console.error('syncSaveProducto POST failed:', r.status); return false; }
      var data = await r.json();
      if (data && data[0] && data[0].id) { p.supaId = data[0].id; }
      else { p.supaId = await getOrCreateProductoId(p) || p.supaId; }
      if (!p.supaId) { console.error('syncSaveProducto: no supaId for', p.n); return false; }
    }
    // Sync stock for all almacenes
    for (var alm of ['Habana','Placetas','Xportprise']) {
      var stk = (p.stk_alm&&p.stk_alm[alm]!=null) ? p.stk_alm[alm] : 0;
      await syncStockAlmacen(p.supaId, alm, stk);
    }
    return true;
  } catch(e) { console.error('syncSaveProducto:', e); return false; }
}

// ── INIT ──────────────────────────────────────────────────────
async function supaInit() {
  loadQueue();
  // Always try cache first so ventas show immediately
  offlineLoadVentas();
  offlineLoadProds();
  offlineLoadClientes();
  if (VENTAS.length || PRODS.length) {
    if (typeof renderVentas === 'function') try { renderVentas(); } catch(e) {}
    if (typeof renderStock  === 'function') try { renderStock();  } catch(e) {}
  }
  // Now check real connectivity with a test fetch
  _supaOnline = navigator.onLine;
  updOnlineDot();
  if (!_supaOnline) {
    if (VENTAS.length || PRODS.length) {
      showToast('⚡ Offline — ' + VENTAS.length + ' ventas · ' + PRODS.length + ' productos (caché local)');
    } else {
      showToast('Sin conexión y sin datos en caché');
    }
    showOfflineBanner(_syncQueue.length);
    return;
  }
  try {
    (function(){var _d=document.getElementById('sync-dot'),_l=document.getElementById('sync-lbl');if(_d)_d.style.background='#fbbf24';if(_l)_l.textContent='⏳ Sincronizando...';})();
    await flushQueue();
    var [okP, okV, okC] = await Promise.all([syncLoadProductos(), syncLoadVentas(), typeof loadComReglas === 'function' ? loadComReglas() : Promise.resolve()]);
  try{
    var ra=await supaReq('GET','tasas_almacen?select=almacen,moneda,ajuste');
    if(ra.ok){(await ra.json()||[]).forEach(function(r){
      if(!RATES_ALM[r.almacen])RATES_ALM[r.almacen]={};
      RATES_ALM[r.almacen][r.moneda]=parseFloat(r.ajuste||0);
    });
    try{localStorage.setItem('erp_rates_alm',JSON.stringify(RATES_ALM));}catch(e){}
    }
  }catch(e){}
  try{
    var rTasas=await supaReq('GET','tasas?select=moneda,valor&moneda=in.(USDEUR,WA_PLACETAS,DTO_PREVENTA)');
    if(rTasas.ok){
      var dTasas=await rTasas.json();
      (dTasas||[]).forEach(function(t){
        if(t.moneda==='USDEUR') RATES_EURUSD=parseFloat(t.valor);
        if(t.moneda==='WA_PLACETAS') RATES.WA_PLACETAS=String(Math.round(parseFloat(t.valor)*1000000));
        if(t.moneda==='DTO_PREVENTA') RATES.DTO_PREVENTA=parseFloat(t.valor)||0;
      });
      // Persist to localStorage so admin panel loads correctly even before network
      try{
        var _rc=JSON.parse(localStorage.getItem('erp_rates')||'{}');
        _rc.DTO_PREVENTA=RATES.DTO_PREVENTA;
        _rc.WA_PLACETAS=RATES.WA_PLACETAS;
        localStorage.setItem('erp_rates',JSON.stringify(_rc));
      }catch(e){}
    }
  }catch(e){}
    if (okV || okP) {
      _supaOnline = true; updOnlineDot();
      // Clear stale localStorage caches — Supabase is authoritative
      try{localStorage.removeItem('erp_cajas_movs');}catch(e){}
      _cajasMovs = []; // will be reloaded by loadCajasData below
      offlineSaveVentas(); offlineSaveProds(); offlineSaveClientes();
      hideOfflineBanner();
      showToast('✓ ' + VENTAS.length + ' ventas · ' + PRODS.length + ' productos');
    await syncLoadUsers();
    await syncLoadClientes();
    await syncLoadPrestamos();
    await syncLoadContenedores();
    await syncLoadMovsIG();
    } else {
      _supaOnline = false; updOnlineDot();
      showToast('Error al conectar con Supabase');
    }
  } catch(e) {
    console.error('supaInit error:', e);
    showSyncStatus('Error');
    showToast('Error Supabase: ' + e.message);
  }
  // If no products in Supabase, push local PRODS
  try {
    var pr = await supaReq('GET', 'productos?select=id&limit=1');
    if (pr.ok) {
      var pd = await pr.json();
      if (!pd || pd.length === 0) {
        showToast('Sincronizando productos con Supabase...');
        for (var _p of PRODS) { await syncSaveProducto(_p); }
        showToast('✓ Productos sincronizados');
      }
    }
  } catch(e) { console.warn('product push:', e); }

  // Sync every 2 min + save cache every 30s
  setInterval(async function() {
    if (_supaOnline) { 
      await flushQueue(); 
      await syncLoadVentas(); 
      await syncLoadClientes();
    }
  }, 120000);
  setInterval(function() {
    if (_supaOnline && VENTAS.length) {
      offlineSaveVentas(); offlineSaveProds(); offlineSaveClientes();
    }
  }, 30000);
}












