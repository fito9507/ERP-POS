
// ── CONFIG ───────────────────────────────────────────────
const SUPA_URL = 'https://gpkslaqfqfdeoleiayng.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdwa3NsYXFmcWZkZW9sZWlheW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2Nzk0MzQsImV4cCI6MjA4OTI1NTQzNH0.iTMO4obXaYC2O1QkAgkaRjygMvjkFnCFuVBVO35DmRk';

const WA = {
  Habana:   '5358721200',
  Placetas: '5353941127',
  Importacion: '34664505406'
};
const TG_TOKEN = '5729620093:AAHEi7-8tqm3Eig4yoryBYMh0PPGIF9--js';
const TG_GROUPS = { Habana:'-5253654121', Placetas:'-5209909669' };
function tgSend(msg, alm){
  if(!TG_TOKEN) return;
  var cid = TG_GROUPS[alm] || TG_GROUPS.Habana;
  fetch('https://api.telegram.org/bot'+TG_TOKEN+'/sendMessage',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat_id:cid,text:msg,parse_mode:'HTML'})
  }).catch(function(){});
}

// Exchange rates (loaded from Supabase tasas table)
let RATES = { USD:1, EUR:1.12, CUP:370, CUPT:270, DTO_PREVENTA:0 };
let RATES_EURUSD = 1.13;
let RATES_ALM = { Habana:{USD:0,EUR:0,MLC:0,CUPT:10}, Placetas:{USD:0,EUR:0,MLC:0,CUPT:10} };
// CUPT_PCT = % extra sobre precio CUP para transferencia
let PRODS = [];
let ALM = 'Habana';
let MON = 'USD';
let CART_MON = 'USD'; // moneda independiente solo para el carrito
let CART = {}; // {prodName: {prod, qty}}
const CART_KEY = 'marinmetal_cart_v1';
const CART_TTL = 24 * 60 * 60 * 1000; // 24h en ms

function saveCartState(){
  try{
    var items = Object.values(CART).map(function(i){ return {name:i.prod.n, qty:i.qty}; });
    localStorage.setItem(CART_KEY, JSON.stringify({items:items, cartMon:CART_MON, alm:ALM, ts:Date.now()}));
  }catch(e){}
}
function loadCartState(){
  try{
    var raw = localStorage.getItem(CART_KEY);
    if(!raw) return;
    var data = JSON.parse(raw);
    if(!data || Date.now() - data.ts > CART_TTL){ localStorage.removeItem(CART_KEY); return; }
    // Restore almacen
    if(data.alm && (data.alm==='Habana'||data.alm==='Placetas'||data.alm==='Importacion')){
      ALM = data.alm;
      document.querySelectorAll('.alm-btn').forEach(function(b){
        b.classList.toggle('active', b.dataset.alm===ALM);
      });
    }
    // Restore cart currency
    if(data.cartMon && MON_SYM[data.cartMon]) CART_MON = data.cartMon;
    // Restore cart items
    (data.items||[]).forEach(function(saved){
      var p = PRODS.find(function(x){ return x.n===saved.name; });
      if(p) CART[p.n] = {prod:p, qty:saved.qty||1};
    });
    if(Object.keys(CART).length) updCart();
  }catch(e){}
}

const MON_SYM = { USD:'$', EUR:'€', CUP:'₱', CUPT:'₱' };
const MON_DEC = { USD:2, EUR:2, CUP:0, CUPT:0 };

// ── UTILS ─────────────────────────────────────────────────
function fN(n, dec){ 
  if(isNaN(n)||n==null) return '—';
  var d = dec ?? 2;
  var v=parseFloat(n);var maxD=d;if(d>0&&d<4){var rounded=Math.round(v*10000)/10000;var str=rounded.toString();if(str.includes('.')){var decs=str.split('.')[1].length;if(decs>d&&decs<=4)maxD=decs;}}return v.toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:maxD});
}
function fromUSD(usd, mon, alm){
  if(mon==='USD') return usd;
  var _alm = alm || ALM;
  // USD adj = extra CUP per USD for this almacen
  var adjUSD = (_alm&&RATES_ALM[_alm]&&RATES_ALM[_alm]['USD']) ? RATES_ALM[_alm]['USD'] : 0;
  // EUR adj = extra CUP per EUR for this almacen
  var adjEUR = (_alm&&RATES_ALM[_alm]&&RATES_ALM[_alm]['EUR']) ? RATES_ALM[_alm]['EUR'] : 0;
  // MLC adj = extra CUP per CUPT for this almacen
  var adjMLC = (_alm&&RATES_ALM[_alm]&&RATES_ALM[_alm]['MLC']) ? RATES_ALM[_alm]['MLC'] : 0;

  if(mon==='CUP'){
    // CUP = USD × (tasa_CUP/USD + ajuste_almacen)
    return parseFloat((usd*(RATES.CUP+adjUSD)).toFixed(0));
  }
  if(mon==='CUPT'){
    // CUPT = precio CUP × (1 + ajuste_CUPT%)
    // tasas_almacen moneda='CUPT' ajuste = % extra sobre CUP
    var cupt_pct = (_alm&&RATES_ALM[_alm]&&RATES_ALM[_alm]['CUPT']!=null) ? RATES_ALM[_alm]['CUPT'] : 10;
    var cupBase = usd*(RATES.CUP+adjUSD);
    return parseFloat((cupBase*(1+cupt_pct/100)).toFixed(0));
  }
  if(mon==='EUR'){
    var cupUSD = RATES.CUP + adjUSD;
    var cupEUR_base = RATES_EURUSD > 0.5 && RATES_EURUSD < 5
                    ? RATES.CUP * RATES_EURUSD
                    : RATES.CUP / 0.89;
    var cupEUR = cupEUR_base + adjEUR;
    return parseFloat((usd * cupUSD / cupEUR).toFixed(2));
  }
  return usd;
}
function fPrice(usd, mon, alm){
  var v = fromUSD(usd, mon, alm||ALM);
  return MON_SYM[mon] + ' ' + fN(v, MON_DEC[mon]);
}
function fSaving(usd, mon, alm){
  // Use 4 decimals max for USD/EUR savings so small amounts are visible, minimum 2
  var v = fromUSD(usd, mon, alm||ALM);
  if (mon === 'CUP' || mon === 'CUPT') return MON_SYM[mon] + ' ' + fN(v, 0);
  return MON_SYM[mon] + ' ' + v.toLocaleString('es-ES', {minimumFractionDigits: 2, maximumFractionDigits: 4});
}

// ── SUPABASE ──────────────────────────────────────────────
async function supa(path){
  var r = await fetch(SUPA_URL+'/rest/v1/'+path, {
    headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY}
  });
  if(!r.ok) throw new Error('Supabase '+r.status);
  return r.json();
}

// ── INIT ──────────────────────────────────────────────────
async function init(){
  try{
    // Load rates — fallback to hardcoded if RLS blocks anon
    try{
      var tasas = await supa('tasas?select=moneda,valor');
      if(tasas&&tasas.length){
        tasas.forEach(function(t){
          if(t.moneda==='USD')    RATES.CUP      = parseFloat(t.valor)||370;
          if(t.moneda==='USDEUR') RATES.EUR      = parseFloat(t.valor)||1.12;
          if(t.moneda==='CUPT')   RATES.CUPT     = parseFloat(t.valor)||270;
          if(t.moneda==='CUP')    RATES.CUP      = RATES.CUP||parseFloat(t.valor)||370;
          if(t.moneda==='EUR')    { var _cupEUR=parseFloat(t.valor); if(_cupEUR>10) RATES_EURUSD=parseFloat((_cupEUR/RATES.CUP).toFixed(4)); }
          if(t.moneda==='DTO_PREVENTA') RATES.DTO_PREVENTA = parseFloat(t.valor)||0;
          if(t.moneda==='WA_PLACETAS') { var pn = Math.round(parseFloat(t.valor)*1000000); if(pn>0) WA.Placetas = String(pn); }
        });
        // Load per-almacen adjustments
        try{
          var tasasAlm = await supa('tasas_almacen?select=almacen,moneda,ajuste');
          (tasasAlm||[]).forEach(function(r){
            if(!RATES_ALM[r.almacen]) RATES_ALM[r.almacen]={CUPT_PCT:10};
            RATES_ALM[r.almacen][r.moneda] = parseFloat(r.ajuste||0);
            // MLC ajuste used as CUPT % extra
  
          });
        }catch(e){ console.warn('tasas_almacen fallback'); }
      }
    }catch(e){ console.warn('Tasas: usando valores por defecto'); }
    // Load products
    var rows;
    try{
      rows = await supa('productos?select=*,stock_almacen(*)&activo=eq.true&order=nombre.asc');
    }catch(e){
      // Show specific error
      var msg = e.message||'Error desconocido';
      document.getElementById('prod-grid').innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="empty-icon">⚠️</div><p>Error cargando productos:<br><code style="font-size:11px;color:var(--accent)">'+msg+'</code><br><br>Verifica que RLS está desactivado en Supabase:<br><code style="font-size:10px;color:var(--text-dim)">ALTER TABLE productos DISABLE ROW LEVEL SECURITY;</code></p></div>';
      document.getElementById('last-update').textContent = '● Error 401';
      return;
    }
    PRODS = (rows||[]).map(function(r){
      var stk_alm = {};
      (r.stock_almacen||[]).forEach(function(s){ stk_alm[s.almacen]=(stk_alm[s.almacen]||0)+(s.cantidad||0); });
      return {
        id: r.id,
        n: r.nombre,
        cat: r.categoria||'',
        stk_alm: stk_alm,
        lotes: (r.stock_almacen || []).map(function(s){
          s.costo = parseFloat(s.costo)||0;
          s.precio_venta = parseFloat(s.precio_venta)||0;
          return s;
        }),
        min: parseFloat(r.precio_min)||0,
        maj: parseFloat(r.precio_maj)||0,
        stk: Object.values(stk_alm).reduce(function(a,b){return a+b;},0),
        img: r.imagen_url||'',
        enStock: r.en_stock!==false,
        enTransito: {Habana:r.en_transito_habana===true, Placetas:r.en_transito_placetas===true, Xportprise:r.en_transito_xportprise===true},
        preventa_min: r.precio_preventa_min!=null?parseFloat(r.precio_preventa_min):null,
        preventa_maj: r.precio_preventa_maj!=null?parseFloat(r.precio_preventa_maj):null,
        moq: r.moq!=null?parseInt(r.moq):1,
        escala: (function(v){ try{ return v?(typeof v==='string'?JSON.parse(v):v):null; }catch(e){return null;} })(r.precios_escala),
        min_placetas: r.precio_min_placetas!=null ? parseFloat(r.precio_min_placetas) : null,
        maj_placetas: r.precio_maj_placetas!=null ? parseFloat(r.precio_maj_placetas) : null,
        activo: r.activo!==false,
        enWeb: r.en_web!==false,
        oferta: r.en_oferta===true,
        badgeTexto: r.badge_texto||'',
        qty_reservada: parseInt(r.qty_reservada)||0,
        reservado: r.badge_texto==='RESERVADO',
        precioOfertaHabana: r.precio_oferta_habana!=null?parseFloat(r.precio_oferta_habana):null,
        precioOfertaPlacetas: r.precio_oferta_placetas!=null?parseFloat(r.precio_oferta_placetas):null,
        por_encargo: r.por_encargo===true,
        esquema_pago: r.esquema_pago||'',
        tiempo_transito: r.tiempo_transito||'',
        precio_mercado: r.precio_mercado!=null?parseFloat(r.precio_mercado):null,
        ficha_tecnica: r.ficha_tecnica||''
      };
    }).filter(function(p){ return p.enWeb !== false; });

// ── Motor de Lote Activo ──────────────────────────────────────
var LOTE_RULE = (typeof localStorage !== 'undefined' && localStorage.getItem('erp_lote_rule')) || 'precio_desc_fifo';

function getLoteActivo(prod, almacen) {
  var lotes = (prod.lotes || []).filter(function(l) {
    return l.almacen === almacen && (l.cantidad || 0) > 0;
  });
  if (!lotes.length) return null;
  
  lotes.sort(function(a, b) {
    if (LOTE_RULE === 'precio_desc_fifo') {
      if ((b.precio_venta||0) !== (a.precio_venta||0)) 
        return (b.precio_venta||0) - (a.precio_venta||0);
      return new Date(a.fecha_entrada||0) - new Date(b.fecha_entrada||0);
    }
    if (LOTE_RULE === 'fifo') {
      return new Date(a.fecha_entrada||0) - new Date(b.fecha_entrada||0);
    }
    if (LOTE_RULE === 'lifo') {
      return new Date(b.fecha_entrada||0) - new Date(a.fecha_entrada||0);
    }
    return 0;
  });
  
  return lotes[0];
}

    // Build categories
    var cats = [...new Set(PRODS.map(function(p){return p.cat;}).filter(Boolean))].sort();
    var sel = document.getElementById('cat-sel');
    cats.forEach(function(c){
      var o = document.createElement('option');
      o.value=c; o.textContent=c; sel.appendChild(o);
    });

    document.getElementById('last-update').textContent = '● En línea';
    loadCartState();
    render();
  }catch(e){
    document.getElementById('last-update').textContent = '● Error: '+e.message;
    document.getElementById('prod-grid').innerHTML = '<div class="empty"><div class="empty-icon">📡</div><p>'+e.message+'</p></div>';
  }
}

// ── FILTERS ───────────────────────────────────────────────
function setAlm(alm, btn){
  ALM = alm;
  document.querySelectorAll('.alm-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  CART = {}; updCart(); saveCartState();
  render();
}
function setMon(mon, btn){
  MON = mon;
  CART_MON = mon; // sincronizar carrito con la tienda
  document.querySelectorAll('.mon-pill').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  render();
  // Si el carrito está abierto re-renderizar también
  if(document.getElementById('cart-modal').classList.contains('open')) renderCart();
}

function filteredProds(){
  var q = (document.getElementById('search').value||'').toLowerCase();
  var cat = document.getElementById('cat-sel').value;
  return PRODS.filter(function(p){
    if(cat && p.cat !== cat) return false;
    if(q && p.n.toLowerCase().indexOf(q)<0) return false;
    var stk = (p.stk_alm&&p.stk_alm[ALM])||0;
    return stk > 0 || (p.enTransito && p.enTransito[ALM]);
  });
}

// ── RENDER ────────────────────────────────────────────────
function render(){
  var grid = document.getElementById('prod-grid');
  var allProds = window.ALL_PRODS || PRODS;
  
  var q = (document.getElementById('search')||{}).value||'';
  var cat = document.getElementById('cat-sel').value;

  var baseFiltered = allProds.filter(function(p){
    if(p.enWeb===false) return false;
    if(cat && p.cat !== cat) return false;
    if(q && p.n.toLowerCase().indexOf(q.toLowerCase())<0) return false;
    return true;
  });

  if (ALM === 'Importacion') {
    var encargoProds = baseFiltered.filter(function(p){ return p.por_encargo; }).sort(function(a,b) { return (a.n||'').localeCompare(b.n||'', undefined, {numeric:true, sensitivity:'base'}); });
    if(!encargoProds.length){
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="empty-icon">🚢</div><p>Sin productos por importación disponibles.<br>Prueba con otra búsqueda o categoría.</p></div>';
      return;
    }
    grid.innerHTML = '<div style="grid-column:1/-1;margin-bottom:4px">'
      +'<div style="display:flex;flex-direction:column;gap:8px">'
      +'<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.25);border-radius:12px">'
      +'<span style="font-size:20px">🚢</span>'
      +'<div><div style="font-size:14px;font-weight:700;color:#3b82f6">Ventas por importación directa</div>'
      +'<div style="font-size:12px;color:var(--text-dim)">Paga de forma fraccionada y asegúrate de recibir exactamente lo que necesitas bajo demanda.</div></div>'
      +'</div>'
      +'<div style="display:flex;gap:10px;justify-content:center;margin-bottom:8px">'
      +'<div style="font-size:11px;color:#10b981;display:flex;align-items:center;gap:4px">✓ <span style="color:var(--text-dim)">Pagos seguros</span></div>'
      +'<div style="font-size:11px;color:#10b981;display:flex;align-items:center;gap:4px">✓ <span style="color:var(--text-dim)">Ahorro asegurado</span></div>'
      +'<div style="font-size:11px;color:#10b981;display:flex;align-items:center;gap:4px">✓ <span style="color:var(--text-dim)">Garantía de entrega</span></div>'
      +'</div>'
      +'</div></div>'
      + encargoProds.map(function(p){ return encargoCardHTML(p); }).join('');
    return;
  }

  // Stock section (Habana / Placetas)
  var stockProds = baseFiltered.filter(function(p){ return !p.por_encargo; });

  var transitProds = stockProds.filter(function(p){ return p.enTransito && p.enTransito[ALM]; }).sort(function(a,b) { return (a.n||'').localeCompare(b.n||'', undefined, {numeric:true, sensitivity:'base'}); });
  
  var normalProds = stockProds.filter(function(p){
    if(p.enTransito && p.enTransito[ALM]) return false; // handled in transit section
    var stk = (p.stk_alm&&p.stk_alm[ALM])||0;
    if(stk <= 0) return false;
    return true;
  }).sort(function(a,b) { return (a.n||'').localeCompare(b.n||'', undefined, {numeric:true, sensitivity:'base'}); });

  var transitBanner = '';
  var transitCards = '';
  if(transitProds.length){
    transitBanner = '<div style="grid-column:1/-1;margin-bottom:4px">'
      +'<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:12px">'
      +'<span style="font-size:20px">🚢</span>'
      +'<div><div style="font-size:13px;font-weight:700;color:#f59e0b">Próximamente en '+ALM+'</div>'
      +'<div style="font-size:11px;color:var(--text-dim)">Reserva ahora a precio especial antes de que llegue</div></div>'
      +'</div></div>';
    transitCards = transitProds.map(function(p){ return transitCardHTML(p); }).join('');
  }
  if(!normalProds.length && !transitProds.length){
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="empty-icon">📦</div><p>Sin productos disponibles para <strong>'+ALM+'</strong>.<br>Prueba con otro almacén o categoría.</p></div>';
    return;
  }
  var normalHTML = normalProds.map(function(p){ return cardHTML(p); }).join('');
  var divider = (transitProds.length && normalProds.length)
    ? '<div style="grid-column:1/-1;margin:4px 0">'
      +'<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:12px">'
      +'<span style="font-size:20px">&#9989;</span>'
      +'<div><div style="font-size:13px;font-weight:700;color:#10b981">Disponible ahora en '+ALM+'</div>'
      +'<div style="font-size:11px;color:var(--text-dim)">Productos con stock listo para entregar</div></div>'
      +'</div></div>'
    : '';
  grid.innerHTML = transitBanner + transitCards + divider + normalHTML;
}

function transitCardHTML(p){
  var cardId = (p.id||p.n.replace(/[^a-zA-Z0-9]/g,'_'));
  // Add to PRODS if not already there so qty controls work
  if(PRODS.indexOf(p) < 0) PRODS.push(p);
  var pidx = PRODS.indexOf(p);
  var _isRes = (p.badgeTexto === 'RESERVADO' || p.reservado === true);
  var cartItem = CART[p.n];
  var moq = p.moq || 1;
  var moq = p.moq || 1;
  var qty = cartItem ? cartItem.qty : moq;
  var normPrice = (ALM==='Placetas'&&p.min_placetas!=null)?p.min_placetas:(p.min||p.maj||0);
  
  var pvPrice = null;
  if (p.preventa_min != null) {
    pvPrice = p.preventa_min;
  } else if (RATES.DTO_PREVENTA > 0) {
    pvPrice = Number((normPrice * (1 - RATES.DTO_PREVENTA/100)).toFixed(4));
  } else {
    pvPrice = normPrice;
  }

  var hasDiscount = normPrice > 0 && pvPrice < normPrice;
  var savingVal = normPrice - pvPrice; var savingStr = hasDiscount ? fSaving(savingVal, MON, ALM) : null;

  // If no price at all show placeholder
  var showPrice = pvPrice > 0;
  return '<div class="card" style="border:1px solid rgba(245,158,11,.35);position:relative">'
    +'<div class="card-img" style="position:relative">'
    +(p.img?'<img src="'+p.img+'" alt="'+esc(p.n)+'" onerror="this.style.display=\'none\'">':'<div class="placeholder"><span>&#127959;</span><span>'+esc(p.n.split(' ').slice(0,2).join(' '))+'</span></div>')
    +(function(){
        var b='<div style="position:absolute;top:8px;left:8px;z-index:10;display:flex;flex-direction:column;gap:4px">';
        b+='<div style="background:#f59e0b;color:#1a1f2e;font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,.4)">EN TRANSITO</div>';
        if(_isRes)   b+='<div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;box-shadow:0 2px 8px rgba(124,58,237,.5)">\uD83D\uDD12 RESERVADO</div>';
        else if(p.oferta&&p.badgeTexto) b+='<div style="background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;box-shadow:0 2px 8px rgba(239,68,68,.5)">'+esc(p.badgeTexto)+'</div>';
        b+='</div>';
        return b;
      }())
    +(hasDiscount?'<div style="position:absolute;bottom:8px;right:8px;z-index:10;background:#10b981;color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px">Ahorras '+savingStr+'</div>':'')
    +'</div>'
    +'<div class="card-body">'
    +(p.cat?'<div class="card-cat">'+esc(p.cat)+'</div>':'')
    +'<div class="card-name">'+esc(p.n)+'</div>'
    +'<div style="font-size:11px;color:#f59e0b;font-weight:600">🚢 Próximamente</div>'
    +(function(){
      if(p.badgeTexto === 'RESERVADO' || p.reservado === true) return '<div style="margin:4px 0 2px;font-size:10px;font-weight:700;color:#7c3aed">🔒 Agotado en preventa</div>';
      var qr=p.qty_reservada||0;
      var ts=qr+(p.stk||0);
      if(qr<=0 || ts<=0) return '';
      var pct=Math.min(Math.round(qr/ts*100),100);
      if(pct>=100) return '<div style="margin:4px 0 2px;font-size:10px;font-weight:700;color:#7c3aed">🔒 Agotado en preventa</div>';
      var text = '🔥 Reservando rápido';
      if(pct > 80) text = '⚡ Últimas unidades disponibles';
      else if(pct > 50) text = '🔥 Más del 50% reservado';
      var barBg='rgba(124,58,237,.15)', barFg=pct>70?'linear-gradient(90deg,#f59e0b,#ef4444)':'linear-gradient(90deg,#f59e0b,#7c3aed)';
      return '<div style="margin:4px 0 2px">'
        +'<div style="font-size:10px;color:#e8b84b;font-weight:600;margin-bottom:3px">'+text+'</div>'
        +'<div style="height:6px;border-radius:3px;background:'+barBg+';overflow:hidden">'
        +'<div style="width:'+pct+'%;height:100%;border-radius:3px;background:'+barFg+';transition:width .5s"></div>'
        +'</div></div>';
    }())
    +'<div class="prices">'
    +(showPrice?'<div class="price-row main"><span class="lbl">'+(hasDiscount?'Preventa':'Precio')+'</span><span class="val" style="color:#f59e0b">'+fPrice(pvPrice,MON,ALM)+'</span></div>':'<div class="price-row main"><span class="lbl">Precio</span><span class="val" style="color:var(--text-dim);font-size:12px">Consultar</span></div>')
    +(hasDiscount?'<div class="price-row"><span class="lbl" style="font-size:10px;color:var(--text-dim)">Precio normal</span><span class="val" style="font-size:11px;text-decoration:line-through;color:var(--text-dim)">'+fPrice(normPrice,MON,ALM)+'</span></div>':'')
    +'</div>'
    +(moq>1?'<div style="font-size:10px;color:var(--text-dim);margin-bottom:4px">M\u00ednimo '+moq+' uds</div>':'')
    +'<div class="qty-row">'
    +'<div class="qty-ctrl">'
    +'<button class="qty-btn" onmousedown="_lpStart('+pidx+',-1)" ontouchstart="_lpStart('+pidx+',-1)" onmouseup="_lpStop()" onmouseleave="_lpStop()" ontouchend="_lpStop()" type="button">\u2212</button>'
    +'<span class="qty-disp" id="qd-tr-'+cardId+'" contenteditable="true" inputmode="numeric" onblur="_qdBlur(this,'+pidx+')" onclick="_qdClick(this)" onfocus="_qdFocus(this)" onkeydown="_qdKeydown(event,this,'+pidx+')" style="cursor:text;outline:none">'+qty+'</span>'
    +'<button class="qty-btn" onmousedown="_lpStart('+pidx+',1)" ontouchstart="_lpStart('+pidx+',1)" onmouseup="_lpStop()" onmouseleave="_lpStop()" ontouchend="_lpStop()" type="button">+</button>'
    +'</div>'
    +(_isRes
        ?'<button class="add-btn" style="background:rgba(124,58,237,.18);color:#7c3aed;border-color:rgba(124,58,237,.4);cursor:not-allowed;opacity:.85" disabled type="button">\uD83D\uDD12 Reservado</button>'
        :'<button class="add-btn'+(cartItem?' added':'')+'" id="addbtn-tr-'+cardId+'" onclick="addToCartIdx('+pidx+')" type="button">'+(cartItem?'\u2713 Agregado':'+ Reservar')+'</button>'
    )
    +'</div>'
    +'</button></div>'
    +'</div></div>';
}
function cardHTML(p){
  var stk = (p.stk_alm&&p.stk_alm[ALM])||0;
  var _transit = p.enTransito && p.enTransito[ALM];
  var stkLabel = _transit ? '<span style="color:#f59e0b;font-weight:600">\uD83D\uDEA2 Pr\u00f3ximamente</span>'
               : stk > 0 ? '<span class="stock-ok">\u2713 Disponible</span>'
               : '<span style="color:#e84b4b">\u2717 Sin stock en '+ALM+'</span>';
  var cartItem = CART[p.n];
  var qty = cartItem ? cartItem.qty : 1;
  // Mayorista si qty >= MIN_MAY (10 uds por defecto)
  var MIN_MAY = p.min_may || 10;
  var isMay = qty >= MIN_MAY && p.maj > 0;
  var priceMin = (ALM==='Placetas'&&p.min_placetas!=null)?p.min_placetas:(p.min||0);
  var priceMaj = (ALM==='Placetas'&&p.maj_placetas!=null)?p.maj_placetas:((p.maj||p.min)||0);
  var hasEscala = p.escala && p.escala.length > 0;
  var escalaPrice = hasEscala ? (getEscalaPrice(p,qty) || p.escala[0].precio) : null;
  var price = hasEscala ? escalaPrice : (isMay ? priceMaj : priceMin);
  var cardId = p.id||p.n.replace(/[^a-zA-Z0-9]/g,'_');
  var pidx = PRODS.indexOf(p);
  var _isRes = (p.badgeTexto === 'RESERVADO' || p.reservado === true);
  // Override stkLabel for reserved products (regardless of transit)
  if(_isRes) stkLabel = '<span style="color:#7c3aed;font-weight:600">🔒 Reservado</span>';
  return '<div class="card" id="card-'+cardId+'" data-pidx="'+pidx+'">' 
    +'<div class="card-img" style="position:relative">'
    +(p.img ? '<img src="'+p.img+'" alt="'+esc(p.n)+'" onerror="this.style.display=\'none\'">' : '<div class="placeholder"><span>&#127959;</span><span>'+esc(p.n.split(' ').slice(0,2).join(' '))+'</span></div>')
    +(function(){
        var b='<div style="position:absolute;top:8px;left:8px;z-index:10;display:flex;flex-direction:column;gap:4px">';
        if(_transit) b+='<div style="background:#f59e0b;color:#1a1f2e;font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,.4)">EN TRANSITO</div>';
        if(_isRes)   b+='<div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;box-shadow:0 2px 8px rgba(124,58,237,.5)">\uD83D\uDD12 RESERVADO</div>';
        else if(!_transit&&p.oferta&&p.badgeTexto) b+='<div style="background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;box-shadow:0 2px 8px rgba(239,68,68,.5)">'+esc(p.badgeTexto)+'</div>';
        b+='</div>';
        return b;
      }())
    +'</div>'
    +'<div class="card-body">'
    +(p.cat?'<div class="card-cat">'+esc(p.cat)+'</div>':'')
    +'<div class="card-name">'+esc(p.n)+'</div>'
    +'<div class="card-stock">'+stkLabel+'</div>'
    +(function(){
      if(!_transit) return '';
      if(p.badgeTexto === 'RESERVADO' || p.reservado === true) return '<div style="margin:2px 0;font-size:10px;font-weight:700;color:#7c3aed">🔒 Agotado en preventa</div>';
      var qr=p.qty_reservada||0;
      var ts=qr+(p.stk||0);
      if(qr<=0 || ts<=0) return '';
      var pct=Math.min(Math.round(qr/ts*100),100);
      if(pct>=100) return '<div style="margin:2px 0;font-size:10px;font-weight:700;color:#7c3aed">🔒 Agotado en preventa</div>';
      var text = '🔥 Reservando rápido';
      if(pct > 80) text = '⚡ Últimas unidades disponibles';
      else if(pct > 50) text = '🔥 Más del 50% reservado';
      var barBg='rgba(124,58,237,.15)', barFg=pct>70?'linear-gradient(90deg,#f59e0b,#ef4444)':'linear-gradient(90deg,#f59e0b,#7c3aed)';
      return '<div style="margin:2px 0">'
        +'<div style="font-size:10px;color:#e8b84b;font-weight:600;margin-bottom:3px">'+text+'</div>'
        +'<div style="height:6px;border-radius:3px;background:'+barBg+';overflow:hidden">'
        +'<div style="width:'+pct+'%;height:100%;border-radius:3px;background:'+barFg+';transition:width .5s"></div>'
        +'</div></div>';
    }())
    +'<div class="prices">'
    +(function(){
      if(hasEscala){
        var rows = (priceMin>0?'<div class="price-row"><span class="lbl" style="font-size:10px">Minorista (1-'+(MIN_MAY-1)+' uds)</span><span class="val" style="font-size:12px;color:var(--text-dim)">'+fPrice(priceMin,MON,ALM)+'</span></div>':'')
          + p.escala.map(function(r,i){
              var lbl = r.desde+(r.hasta?'-'+r.hasta:'+')+ ' uds';
              var active = qty>=r.desde&&(r.hasta==null||qty<=r.hasta);
              return '<div class="price-row" data-escala-idx="'+i+'" data-desde="'+r.desde+'" data-hasta="'+(r.hasta||'')+'"><span class="lbl" style="font-size:10px">'+lbl+'</span><span class="val escala-val" style="font-size:12px;'+(active?'color:var(--accent)':'color:var(--text-dim)')+'">'+fPrice(r.precio,MON,ALM)+'</span></div>';
            }).join('');
        return rows;
      }
      var _pOfe=ALM==='Placetas'?(p.precioOfertaPlacetas||p.precioOfertaHabana||null):(p.precioOfertaHabana||null);
      var _isOferta=p.oferta&&_pOfe!=null&&_pOfe>0;
      var _origPrice=isMay?(priceMaj||priceMin):(priceMin||priceMaj);
      if(_isOferta) return '<div class="price-row main">'
        +'<span class="lbl">Precio</span>'
        +'<span style="display:flex;align-items:baseline;gap:6px">'
          +'<span class="val" style="color:#ef4444">'+fPrice(_pOfe,MON,ALM)+'</span>'
          +'<span style="font-size:11px;text-decoration:line-through;color:var(--text-dim)">'+fPrice(_origPrice,MON,ALM)+'</span>'
        +'</span></div>';
      return (p.maj>0&&p.min>0&&p.maj!==p.min
        ? '<div class="price-row" data-minmaj="min"><span class="lbl" style="font-size:10px">Minorista (1-'+(MIN_MAY-1)+' uds)</span><span class="val minmaj-val" data-tipo="min" style="font-size:12px'+(isMay?';color:var(--text-dim)':';color:var(--accent)')+'">'+fPrice(priceMin,MON,ALM)+'</span></div>'
          +'<div class="price-row" data-minmaj="maj"><span class="lbl" style="font-size:10px">Mayorista (+'+MIN_MAY+' uds)</span><span class="val minmaj-val" data-tipo="maj" style="font-size:12px'+(isMay?';color:var(--accent)':';color:var(--text-dim)')+'">'+fPrice(priceMaj,MON,ALM)+'</span></div>'
        : '<div class="price-row main"><span class="lbl">Precio</span><span class="val">'+fPrice(price||priceMaj||priceMin,MON,ALM)+'</span></div>');
    })()
    + '<div style="border-top:1px solid var(--border);margin:6px 0 4px"></div>'
    + ['USD','EUR','CUP','CUPT'].filter(function(m){return m!==MON;}).map(function(m){
        var _pOfeE=ALM==='Placetas'?(p.oferta&&(p.precioOfertaPlacetas||p.precioOfertaHabana)):( p.oferta&&p.precioOfertaHabana);
        var refPrice=(_pOfeE&&_pOfeE>0)?_pOfeE:(priceMin||(hasEscala?p.escala[0].precio:priceMaj)||0);
        return '<div class="price-row" data-equiv="'+m+'"><span class="lbl" style="font-size:10px;color:var(--text-dim)">'+m+'</span><span class="equiv-val" data-mon="'+m+'" style="font-size:11px;color:var(--text-dim)">'+fPrice(refPrice,m,ALM)+'</span></div>';
      }).join('')
    +'</div>'
    +(stk>0||_transit?
      '<div class="qty-row">'
      +'<div class="qty-ctrl">'
      +'<button class="qty-btn" onmousedown="_lpStart('+pidx+',-1)" ontouchstart="_lpStart('+pidx+',-1)" onmouseup="_lpStop()" onmouseleave="_lpStop()" ontouchend="_lpStop()" type="button">−</button>'
      +'<span class="qty-disp" id="qd-'+cardId+'" contenteditable="true" inputmode="numeric" onblur="_qdBlur(this,'+pidx+')" onclick="_qdClick(this)" onfocus="_qdFocus(this)" onkeydown="_qdKeydown(event,this,'+pidx+')" style="cursor:text;outline:none">'+qty+'</span>'
      +'<button class="qty-btn" onmousedown="_lpStart('+pidx+',1)" ontouchstart="_lpStart('+pidx+',1)" onmouseup="_lpStop()" onmouseleave="_lpStop()" ontouchend="_lpStop()" type="button">+</button>'
      +'</div>'
      +(_isRes
        ?'<button class="add-btn" style="background:rgba(124,58,237,.18);color:#7c3aed;border-color:rgba(124,58,237,.4);cursor:not-allowed;opacity:.85" disabled type="button">🔒 Reservado</button>'
        :'<button class="add-btn'+(cartItem?' added':'')+'" id="addbtn-'+cardId+'" onclick="addToCartIdx('+pidx+')" type="button">'+(cartItem?'✓ Agregado':'+ Agregar')+'</button>'
      )
      +'</div>':'')
    +'</div>'
    +'</div>';
}

function encargoCardHTML(p){
  var cartItem = CART[p.n];
  var qty = cartItem ? cartItem.qty : (p.moq || 1);
  var cardId = p.id||p.n.replace(/[^a-zA-Z0-9]/g,'_');
  if(PRODS.indexOf(p) < 0) PRODS.push(p);
  var pidx = PRODS.indexOf(p);
  
  var transito = p.tiempo_transito;
  var price = p.min || p.maj || 0;
  
  return '<div class="card" id="card-'+cardId+'" data-pidx="'+pidx+'" style="border:1px solid rgba(59,130,246,.35)">' 
    +'<div class="card-img" style="position:relative">'
    +(p.img ? '<img src="'+p.img+'" alt="'+esc(p.n)+'" onerror="this.style.display=\'none\'">' : '<div class="placeholder"><span>&#127959;</span><span>'+esc(p.n.split(' ').slice(0,2).join(' '))+'</span></div>')
    +'<div style="position:absolute;top:8px;left:8px;z-index:10;display:flex;flex-direction:column;gap:4px">'
    +'<div style="background:#3b82f6;color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,.4)">🚢 POR IMPORTACIÓN</div>'
    +'</div>'
    +'</div>'
    +'<div class="card-body">'
    +(p.cat?'<div class="card-cat">'+esc(p.cat)+'</div>':'')
    +'<div class="card-name">'+esc(p.n)+'</div>'
    +'<div style="margin:8px 0;padding:8px;background:rgba(59,130,246,0.05);border:1px solid rgba(59,130,246,0.15);border-radius:6px;font-size:11px;color:var(--text-secondary)">'
    +'<div style="font-weight:700;color:#3b82f6;margin-bottom:4px;display:flex;align-items:center;justify-content:space-between;">'
    +'<div style="display:flex;align-items:center;gap:4px;"><span style="font-size:12px">💰</span> Esquema de Pagos:</div>'
    +'<span style="font-size:9px;background:#3b82f6;color:white;padding:2px 6px;border-radius:4px;letter-spacing:0.5px;font-weight:800;">PAGO EN EL EXTERIOR</span>'
    +'</div>'
    +'<div id="calc-esq-'+cardId+'">' + renderEsquemaCalculado(p.esquema_pago, price, qty) + '</div>'
    +(transito ? '<div style="display:flex;align-items:flex-start;gap:6px;padding-top:8px;margin-top:8px;border-top:1px solid rgba(59,130,246,0.15)">'
               + '<span style="font-size:12px">⏳</span>'
               + '<div><div style="font-weight:700;color:#3b82f6;margin-bottom:1px">Tiempo de tránsito:</div>'
               + esc(transito)+'</div></div>' : '')
    +(p.ficha_tecnica ? '<div style="margin-top:8px;text-align:center"><button onclick="openFichaModal('+pidx+')" style="background:rgba(59,130,246,0.1);color:#3b82f6;border:1px solid rgba(59,130,246,0.3);padding:6px 12px;border-radius:4px;font-size:11px;font-weight:800;cursor:pointer;width:100%">📄 Ver Ficha Técnica</button></div>' : '')
    +'</div>'
    +'<div class="prices">'
    +(p.precio_mercado && p.precio_mercado > price ? 
        '<div style="font-size:12px;color:var(--text-tertiary);text-decoration:line-through">Precio Mercado: '+fPrice(p.precio_mercado,MON,ALM)+'</div>'
      + '<div class="price-row main"><span class="lbl">Precio Importación</span><span class="val" style="color:#10b981">'+fPrice(price,MON,ALM)+'</span></div>'
      + '<div style="font-size:11px;color:#fff;background:#10b981;padding:4px 8px;border-radius:4px;display:inline-block;margin-top:4px;font-weight:700">Ahorro por unidad: '+fPrice(p.precio_mercado - price,MON,ALM)+'</div>'
      + '<div id="ahorro-tot-'+cardId+'" style="font-size:12px;color:#10b981;padding-top:6px;font-weight:800;letter-spacing:-0.2px">Ganancia Potencial: '+fPrice((p.precio_mercado - price)*qty,MON,ALM)+'</div>'
      : '<div class="price-row main"><span class="lbl">Precio ref.</span><span class="val">'+fPrice(price,MON,ALM)+'</span></div>')
    +'</div>'
    +'<div class="qty-row" style="margin-top:10px">'
    +'<div class="qty-ctrl">'
    +'<button class="qty-btn" onmousedown="_lpStart('+pidx+',-1)" ontouchstart="_lpStart('+pidx+',-1)" onmouseup="_lpStop()" onmouseleave="_lpStop()" ontouchend="_lpStop()" type="button">−</button>'
    +'<span class="qty-disp" id="qd-'+cardId+'" contenteditable="true" inputmode="numeric" onblur="_qdBlur(this,'+pidx+')" onclick="_qdClick(this)" onfocus="_qdFocus(this)" onkeydown="_qdKeydown(event,this,'+pidx+')" style="cursor:text;outline:none">'+qty+'</span>'
    +'<button class="qty-btn" onmousedown="_lpStart('+pidx+',1)" ontouchstart="_lpStart('+pidx+',1)" onmouseup="_lpStop()" onmouseleave="_lpStop()" ontouchend="_lpStop()" type="button">+</button>'
    +'</div>'
    +'<button class="add-btn'+(cartItem?' added':'')+'" id="addbtn-'+cardId+'" onclick="addToCartIdx('+pidx+')" type="button">'+(cartItem?'✓ Agregado':'+ Encargar')+'</button>'
    +'</div>'
    +'</div>'
    +'</div>';
}

function renderEsquemaCalculado(esquemaStr, price, qty) {
  if (!esquemaStr) return '<div style="color:var(--text-dim)">Pago escalado / A convenir</div>';
  var parts = esquemaStr.split(/[|\n]/).map(function(s){ return s.trim(); }).filter(Boolean);
  if (parts.length === 0) return '<div style="color:var(--text-dim)">Pago escalado / A convenir</div>';
  
  var total = price * qty;
  var html = '<div style="display:flex;flex-direction:column;gap:4px">';
  parts.forEach(function(part) {
    var match = part.match(/^(\d+(?:\.\d+)?)%\s*(.*)$/);
    if (match) {
      var pct = parseFloat(match[1]);
      var amount = total * (pct / 100);
      var desc = match[2];
      html += '<div style="display:flex;flex-direction:column;background:rgba(59,130,246,0.02);padding:4px 8px;border-radius:4px;border:1px solid rgba(59,130,246,0.15)">'
           + '<div style="font-weight:800;color:#3b82f6;font-size:11px;display:flex;justify-content:space-between">'
           + '<span>'+pct+'%</span> <span style="color:var(--text-main)">'+fPrice(amount, MON, ALM)+'</span>'
           + '</div>'
           + '<div style="font-size:10px;color:var(--text-tertiary);line-height:1.2;margin-top:2px">'+esc(desc)+'</div>'
           + '</div>';
    } else {
      html += '<div style="font-size:11px;color:var(--text-secondary)">' + esc(part) + '</div>';
    }
  });
  html += '</div>';
  return html;
}

function esc(s){ return (s||'').replace(/['"<>&]/g,function(c){return {'\'':'&#39;','"':'&quot;','<':'&lt;','>':'&gt;','&':'&amp;'}[c];}); }

// ── CART ──────────────────────────────────────────────────
function getQtyInpIdx(idx){ return document.querySelector('.qty-inp[data-idx="'+idx+'"]'); }
function _getCardId(p){ return p.id ? String(p.id) : p.n.replace(/[^a-zA-Z0-9]/g,'_'); }
function _getQtyDisp(idx){
  var p=PRODS[idx]; if(!p) return null;
  return document.getElementById('qd-'+_getCardId(p));
}
function _getQtyVal(idx){
  var sp=_getQtyDisp(idx); return sp ? parseInt(sp.textContent)||1 : 1;
}
// Long-press state
var _lpTimer=null, _lpInterval=null;
// Qty display tap-to-edit helpers
function _qdSelectAll(el){
  var range = document.createRange();
  range.selectNodeContents(el);
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}
function _qdClick(el){ el.focus(); _qdSelectAll(el); }
function _qdFocus(el){ setTimeout(function(){ _qdSelectAll(el); }, 0); }
function _qdKeydown(e, el, idx){
  if(e.key==='Enter'){ e.preventDefault(); el.blur(); return; }
  // Only allow digits and control keys
  if(e.key.length===1 && !/[0-9]/.test(e.key)) e.preventDefault();
}
function _qdBlur(el, idx){
  var v = parseInt(el.textContent)||1;
  var p = PRODS[idx]; if(!p) return;
  var isT = p.enTransito && p.enTransito[ALM];
  var moq = isT ? (p.moq||1) : 1;
  v = Math.max(moq, v);
  // Cap at available stock (including transit products)
  var maxStk = (p.stk_alm && p.stk_alm[ALM] != null) ? p.stk_alm[ALM] : (p.stk||0);
  if(maxStk > 0) v = Math.min(v, maxStk);
  el.textContent = v;
  var cardId = p.id ? String(p.id) : p.n.replace(/[^a-zA-Z0-9]/g,'_');
  updCardPrices(cardId, p, v);
}
function chgQtyIdx(idx, d){
  var p = PRODS[idx]; if(!p) return;
  var cardId = p.id ? String(p.id) : p.n.replace(/[^a-zA-Z0-9]/g,'_');
  var sp = document.getElementById('qd-'+cardId) || document.getElementById('qd-tr-'+cardId);
  if(!sp) return;
  var isT = p.enTransito && p.enTransito[ALM];
  var moq = (isT || p.por_encargo) ? (p.moq||1) : 1;
  var v = parseInt(sp.textContent)||moq;
  v = d > 0 ? v + 1 : Math.max(moq, v - 1);
  // Cap at available stock (skip for import products — no stock limit)
  if(d > 0 && !p.por_encargo){
    var maxStk = (p.stk_alm && p.stk_alm[ALM] != null) ? p.stk_alm[ALM] : (p.stk||0);
    if(maxStk > 0) v = Math.min(v, maxStk);
  }
  sp.textContent = v;
  updCardPrices(cardId, p, v);
}
function _lpStart(idx, d){
  chgQtyIdx(idx, d);
  _lpTimer = setTimeout(function(){
    _lpInterval = setInterval(function(){ chgQtyIdx(idx, d); }, 80);
  }, 400);
}
function _lpStop(){
  if(_lpTimer)  { clearTimeout(_lpTimer);   _lpTimer=null;   }
  if(_lpInterval){ clearInterval(_lpInterval); _lpInterval=null; }
}
function updCardPrices(cardId, p, qty){
  var card = document.getElementById('card-'+cardId) || document.getElementById('card-tr-'+cardId);
  if(!card) return;
  // Find active escala price
  var activePrice = null;
  if(p.escala && p.escala.length){
    var sorted = p.escala.slice().sort(function(a,b){return b.desde-a.desde;});
    for(var i=0;i<sorted.length;i++){
      var r=sorted[i];
      if(qty>=r.desde&&(r.hasta==null||r.hasta===''||qty<=r.hasta)){
        activePrice=parseFloat(r.precio); break;
      }
    }
    // Highlight escala rows
    card.querySelectorAll('[data-escala-idx]').forEach(function(row){
      var desde=parseInt(row.dataset.desde)||0;
      var hasta=row.dataset.hasta===''?null:parseInt(row.dataset.hasta);
      var isActive=qty>=desde&&(hasta==null||qty<=hasta);
      var val=row.querySelector('.escala-val');
      if(val) val.style.color=isActive?'var(--accent)':'var(--text-dim)';
    });
  } else {
    // Min/maj: highlight based on qty
    var MIN_MAY_loc = typeof MIN_MAY!=='undefined'?MIN_MAY:10;
    var isMaj = qty >= MIN_MAY_loc;
    activePrice = isMaj ? (p.maj||p.min||0) : (p.min||p.maj||0);
    card.querySelectorAll('[data-minmaj]').forEach(function(row){
      var tipo = row.dataset.minmaj;
      var isActive = (tipo==='maj' && isMaj) || (tipo==='min' && !isMaj);
      var val = row.querySelector('.minmaj-val');
      if(val) val.style.color = isActive ? 'var(--accent)' : 'var(--text-dim)';
    });
  }
  if(activePrice==null) return;
  var _ofeP=p.oferta?(ALM==='Placetas'?(p.precioOfertaPlacetas||p.precioOfertaHabana||null):(p.precioOfertaHabana||null)):null;
  var _equivRef=(_ofeP&&_ofeP>0)?_ofeP:activePrice;
  card.querySelectorAll('[data-equiv]').forEach(function(row){
    var mon=row.dataset.equiv;
    var el=row.querySelector('.equiv-val');
    if(el) el.textContent=fPrice(_equivRef,mon,ALM);
  });
  
  var calcEsq = document.getElementById('calc-esq-'+cardId);
  if (calcEsq && p.por_encargo) {
    calcEsq.innerHTML = renderEsquemaCalculado(p.esquema_pago, _equivRef, qty);
  }
  
  var ahorroTot = document.getElementById('ahorro-tot-'+cardId);
  if (ahorroTot && p.precio_mercado && p.precio_mercado > _equivRef) {
    ahorroTot.textContent = 'Ganancia Potencial: ' + fPrice((p.precio_mercado - _equivRef)*qty, MON, ALM);
  }
}
function addToCartIdx(idx){
  var p = PRODS[idx]; if(!p) return;
  var cardId = p.id ? String(p.id) : p.n.replace(/[^a-zA-Z0-9]/g,'_');
  var sp = document.getElementById('qd-'+cardId) || document.getElementById('qd-tr-'+cardId);
  var isT = p.enTransito && p.enTransito[ALM];
  var moq = (isT || p.por_encargo) ? (p.moq||1) : 1;
  var qty = sp ? Math.max(moq, parseInt(sp.textContent)||moq) : moq;
  
  // Skip stock limit check for import products
  if(!p.por_encargo){
    var maxStk = (p.stk_alm && p.stk_alm[ALM] != null) ? p.stk_alm[ALM] : (p.stk||0);
    if(qty > maxStk) {
      qty = Math.max(0, maxStk);
      if(sp) sp.textContent = qty;
      if(typeof showToast==='function') showToast("Stock máximo alcanzado: " + maxStk);
    }
    if(qty <= 0) {
      if(typeof showToast==='function') showToast("Producto sin stock disponible");
      return;
    }
  }
  
  CART[p.n] = {prod:p, qty:qty};
  var btn = document.getElementById('addbtn-'+cardId) || document.getElementById('addbtn-tr-'+cardId);
  if(btn){ btn.textContent = p.por_encargo ? '✓ Encargado' : ((p.enTransito&&p.enTransito[ALM]) ? '✓ Reservado' : '✓ Agregado'); btn.classList.add('added'); }
  updCart(); saveCartState();
}
function getQtyInp(name){ return document.querySelector('.qty-inp[data-name="'+name+'"]'); }
function getQty(name){
  var p = PRODS.find(function(x){return x.n===name;});
  var idx = p ? PRODS.indexOf(p) : -1;
  var inp = idx>=0 ? getQtyInpIdx(idx) : null;
  return inp ? parseInt(inp.value)||1 : 1;
}
function chgQty(name, d){
  var p = PRODS.find(function(x){return x.n===name;});
  if(p) chgQtyIdx(PRODS.indexOf(p), d);
}
function reRenderCard(name){
  var p = PRODS.find(function(x){return x.n===name;});
  if(!p) return;
  var cardId = p.id ? String(p.id) : p.n.replace(/[^a-zA-Z0-9]/g,'_');
  var card = document.getElementById('card-'+cardId);
  if(!card) return;
  if(CART[name]){
    var inp = getQtyInp(name);
    if(inp) CART[name].qty = parseInt(inp.value)||1;
  }
  card.outerHTML = cardHTML(p);
}
function setQty(name, v){
  var inp = getQtyInp(name);
  if(inp) inp.value = Math.max(1, parseInt(v)||1);
}
function addToCart(name){
  var p = PRODS.find(function(x){return x.n===name;});
  if(!p) return;
  var qty = getQty(name);
  CART[name] = {prod:p, qty:qty};
  var cardId = p.id ? String(p.id) : p.n.replace(/[^a-zA-Z0-9]/g,'_');
  var btn = document.getElementById('addbtn-'+cardId);
  if(btn){ btn.textContent='✓ Agregado'; btn.classList.add('added'); }
  updCart(); saveCartState();
}
function removeFromCart(name){
  delete CART[name];
  saveCartState();
  updCart();
  renderCart();
  render();
}
function updCart(){
  var items = Object.values(CART);
  var count = items.reduce(function(a,i){return a+i.qty;},0);
  var float = document.getElementById('cart-float');
  var cnt = document.getElementById('cart-count');
  float.style.display = items.length ? 'block' : 'none';
  if(cnt) cnt.textContent = count;
}
function openCart(){
  var modal = document.getElementById('cart-modal');
  modal.classList.add('open');
  renderCart();
}
function closeCart(){ document.getElementById('cart-modal').classList.remove('open'); }
function closeCartOutside(e){ if(e.target===document.getElementById('cart-modal')) closeCart(); }

function getEscalaPrice(p, qty){
  if(!p.escala || !p.escala.length) return null;
  var match = null;
  var sorted = p.escala.slice().sort(function(a,b){return b.desde-a.desde;});
  for(var i=0;i<sorted.length;i++){
    var r=sorted[i];
    if(qty >= r.desde && (r.hasta==null || r.hasta==='' || qty <= r.hasta)){
      match = r.precio; break;
    }
  }
  // Fallback: if no range matches but escala exists, use first range price
  if(match==null && p.escala.length) match = p.escala[0].precio;
  return match;
}

function getCartPrice(i){
  var p = i.prod;
  var isPlac = ALM === 'Placetas';
  var min = (isPlac && p.min_placetas!=null) ? p.min_placetas : (p.min||0);
  var maj = (isPlac && p.maj_placetas!=null) ? p.maj_placetas : (p.maj||0);
  var MIN_MAY = p.min_may || 10;
  var isMay = i.qty >= MIN_MAY && maj > 0;
  var isTransit = p.enTransito && p.enTransito[ALM];
  
  if(isTransit) {
    var baseTPrice = isMay ? (maj||min||0) : (min||maj||0);
    var pvPrice = null;
    if (p.preventa_min != null) {
      pvPrice = p.preventa_min;
    } else if (RATES.DTO_PREVENTA > 0) {
      pvPrice = Number((baseTPrice * (1 - RATES.DTO_PREVENTA/100)).toFixed(4));
    }
    if (pvPrice != null) return {price:pvPrice, isMay:false, MIN_MAY:MIN_MAY, isTransit:true};
  }
  
  var ofertaPrice = p.oferta ? (isPlac ? (p.precioOfertaPlacetas||p.precioOfertaHabana||null) : (p.precioOfertaHabana||null)) : null;
  if(ofertaPrice!=null && ofertaPrice>0) return {price:ofertaPrice, isMay:false, MIN_MAY:MIN_MAY, isTransit:false, isOferta:true};
  var escalaPrice = getEscalaPrice(p, i.qty);
  var basePrice = escalaPrice!=null ? escalaPrice : (isMay ? (maj||min||0) : (min||maj||0));
  return {price:basePrice, isMay:isMay, MIN_MAY:MIN_MAY, isTransit:false, hasEscala:escalaPrice!=null};
}
function updCartQty(name, val){
  if(!CART[name]) return;
  var p = CART[name].prod;
  var isTransit = p.enTransito && p.enTransito[ALM];
  var minQty = isTransit ? (p.moq||1) : 1;
  var qty = Math.max(minQty, parseInt(val)||minQty);
  var maxStk = (p.stk_alm && p.stk_alm[ALM] != null) ? p.stk_alm[ALM] : (p.stk||0);
  if(qty > maxStk) {
    qty = Math.max(0, maxStk);
    if(typeof showToast==='function') showToast("Stock máximo alcanzado: " + maxStk);
  }
  CART[name].qty = qty;
  renderCart(); updCart(); saveCartState();
}
function renderCart(){
  var items = Object.values(CART);
  var el = document.getElementById('cart-items');
  var totEl = document.getElementById('cart-total-val');
  if(!items.length){ el.innerHTML='<div style="color:var(--text-dim);font-size:13px;padding:16px 0">Sin productos agregados</div>'; totEl.textContent='0,00'; return; }
  var total = 0;
  el.innerHTML = items.map(function(i){
    var r = getCartPrice(i);
    var lineTotal = r.price * i.qty;
    total += lineTotal;
    var isTransitProd = i.prod.enTransito && i.prod.enTransito[ALM];
    var tag = isTransitProd
      ? '<span style="font-size:9px;background:#f59e0b;color:#1a1f2e;padding:1px 6px;border-radius:4px;margin-left:6px;font-weight:700">Preventa</span>'
      : (i.prod.maj>0 ? (r.isMay
        ? '<span style="font-size:9px;background:var(--accent2);color:#fff;padding:1px 6px;border-radius:4px;margin-left:6px">Mayorista</span>'
        : '<span style="font-size:9px;color:var(--text-dim);padding:1px 4px;border-radius:4px;margin-left:6px">Min·'+r.MIN_MAY+'+→May</span>') : '');
    return '<div class="cart-item">'
      +'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px">'
      +'<div class="cart-item-name" style="flex:1">'+esc(i.prod.n)+tag+'</div>'
      +'<button class="cart-item-rm" onclick="removeFromCart(\''+esc(i.prod.n)+'\')">✕</button>'
      +'</div>'
      +'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">'
      +'<div style="display:flex;align-items:center;gap:6px">'
      +'<div class="qty-ctrl" style="border-radius:8px">'
      +'<button class="qty-btn" onclick="updCartQty(\''+esc(i.prod.n)+'\',' +Math.max((isTransitProd?(i.prod.moq||1):1),i.qty-1)+ ')" style="width:40px;height:40px;font-size:20px">\u2212</button>'
      +'<input class="qty-inp" type="number" min="1" value="'+i.qty+'" onchange="updCartQty(\''+esc(i.prod.n)+'\',this.value)" style="width:52px;height:40px;font-size:15px">'
      +'<button class="qty-btn" onclick="updCartQty(\''+esc(i.prod.n)+'\',' +(i.qty+1)+ ')" style="width:40px;height:40px;font-size:20px">+</button>'
      +'</div>'
      +'<span style="font-size:12px;color:var(--text-dim)">× '+fPrice(r.price,CART_MON,ALM)+'</span>'
      +'</div>'
      +'<span class="cart-item-price" style="font-size:16px">'+fPrice(lineTotal,CART_MON)+'</span>'
      +'</div>'
      +'</div>';
  }).join('');
  // Main total in selected currency
  totEl.textContent = fPrice(total, CART_MON);
  // Multi-currency badges (clickable — cambian la moneda activa)
  var altEl = document.getElementById('cart-tot-currencies');
  if(altEl){
    var mons = ['USD','EUR','CUP','CUPT'];
    altEl.innerHTML = mons.map(function(m){
      var v = fromUSD(total, m, ALM);
      var sym = MON_SYM[m];
      var dec = MON_DEC[m];
      var isSel = m === CART_MON;
      return '<span class="tot-pill'+(isSel?' sel':'')+'" style="cursor:pointer" onclick="setMonCart(\''+m+'\')">'+
        sym + ' ' + fN(v, dec) + ' ' + m +
        '</span>';
    }).join('');
  }
}

function setMonCart(m){
  CART_MON = m; // solo afecta al carrito, no a la tienda
  saveCartState();
  renderCart();
}

function sendWA(){
  var items = Object.values(CART);
  if(!items.length){ alert('Agrega productos al pedido primero'); return; }
  var hasEncargo = items.some(function(i){ return i.prod.por_encargo; });
  var lines = items.map(function(i){
    var r = getCartPrice(i);
    var ln = '• '+i.qty+'× '+i.prod.n+' @ '+fPrice(r.price, CART_MON)+' → '+fPrice(r.price*i.qty, CART_MON)+(r.isMay?' (May)':' (Min)');
    if (i.prod.por_encargo) {
      var totalItem = r.price * i.qty;
      var eParts = (i.prod.esquema_pago||'').split(/[|\n]/).map(function(s){ return s.trim(); }).filter(Boolean);
      var esqLines = [];
      eParts.forEach(function(part){
        var match = part.match(/^(\d+(?:\.\d+)?)%\s*(.*)$/);
        if(match) {
          esqLines.push(match[1]+'% ('+fPrice(totalItem*(parseFloat(match[1])/100), CART_MON)+') ' + match[2]);
        } else {
          esqLines.push(part);
        }
      });
      ln += '\n  ↳ 🚢 Importación - Esquema de Pago:\n      · ' + (esqLines.length ? esqLines.join('\n      · ') : 'Pago escalado / A convenir');
      if (i.prod.tiempo_transito) ln += '\n  ↳ ⏳ Tiempo estimado: ' + i.prod.tiempo_transito;
    }
    return ln;
  });
  var total = items.reduce(function(a,i){
    return a + getCartPrice(i).price * i.qty;
  },0);
  var nota   = (document.getElementById('cart-note')?.value||'').trim();
  var nombre = (document.getElementById('cart-nombre')?.value||'').trim();
  var tel    = (document.getElementById('cart-tel')?.value||'').trim();
  if(!nombre){ document.getElementById('cart-nombre').style.borderColor='#e84b4b'; document.getElementById('cart-nombre').focus(); return; }
  if(!tel){ document.getElementById('cart-tel').style.borderColor='#e84b4b'; document.getElementById('cart-tel').focus(); return; }
  var msg = '\uD83C\uDFF7\uFE0F *' + (hasEncargo ? 'Pedido de Importación' : 'Pedido') + ' \u2014 '+ALM+'*\n\n'
    + '\uD83D\uDC64 *'+nombre+'*'+(tel?' \u00b7 \uD83D\uDCDE '+tel:'')+'\n\n'
    + lines.join('\n') + '\n\n'
    + '\uD83D\uDCB0 *Total: '+fPrice(total,CART_MON)+'*\n'
    + '\uD83D\uDCCD Almac\u00e9n: *'+ALM+'*\n'
    + (nota?'\uD83D\uDCDD '+nota+'\n':'')
    + '\n_Solicito confirmaci\u00f3n de disponibilidad y precio final._';
  var phone = WA[ALM] || WA.Habana;
  // Notify Telegram group
  var tgMsg = '\uD83D\uDED2 <b>Pedido cat\u00e1logo — '+ALM+'</b>\n'
    + '\uD83D\uDC64 <b>'+nombre+'</b>'+(tel?' · \uD83D\uDCDE '+tel:'')+'\n\n'
    + items.map(function(i){var r=getCartPrice(i);return '• '+i.qty+'\u00d7 '+i.prod.n+' @ '+fPrice(r.price,CART_MON)+' \u2192 '+fPrice(r.price*i.qty,CART_MON);}).join('\n')
    + '\n\n\uD83D\uDCB0 <b>Total: '+fPrice(items.reduce(function(a,i){return a+getCartPrice(i).price*i.qty;},0),CART_MON)+'</b>'
    + (nota?'\n\uD83D\uDCDD '+nota:'');
  tgSend(tgMsg, ALM);
  window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(msg), '_blank');
}

function openFichaModal(pidx){
  var p = PRODS[pidx];
  if(!p || !p.ficha_tecnica) return;
  var html = esc(p.ficha_tecnica).split('\n').map(function(line){
    if(!line.trim()) return '';
    var idx = line.indexOf(':');
    if(idx !== -1) {
      return '<tr><td style="padding:8px 0;font-weight:700;color:var(--text-main);border-bottom:1px solid var(--border);width:40%">' + line.substring(0, idx).trim() + '</td><td style="padding:8px 0 8px 12px;border-bottom:1px solid var(--border)">' + line.substring(idx+1).trim() + '</td></tr>';
    }
    return '<tr><td colspan="2" style="padding:8px 0;border-bottom:1px solid var(--border)">' + line.trim() + '</td></tr>';
  }).join('');
  document.getElementById('ficha-content').innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:13px;line-height:1.5">' + html + '</table>';
  document.getElementById('ficha-modal').style.display = 'flex';
}
function closeFicha(e){
  if(e && e.target !== document.getElementById('ficha-modal') && e.target.tagName !== 'BUTTON') return;
  document.getElementById('ficha-modal').style.display = 'none';
}

// ── START ─────────────────────────────────────────────────
init();
