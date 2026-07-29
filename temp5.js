


// Commission rules loaded from Supabase com_reglas
var COM_REGLAS = []; // [{vendedor,producto,categoria,almacen,pct}]
try { var _cr = localStorage.getItem('erp_com_reglas'); if(_cr) COM_REGLAS = JSON.parse(_cr); } catch(e){}
var COM_DEF = {Keiler:{Habana:4,Placetas:1.5},Padre:{Habana:4,Placetas:1.5}}; // fallback

async function loadComReglas(){
  try{
    var r=await supaReq('GET','com_reglas?select=*&order=id.asc');
    if(r.ok){ 
      COM_REGLAS=await r.json(); 
      try { localStorage.setItem('erp_com_reglas', JSON.stringify(COM_REGLAS)); } catch(e){}
    }
  }catch(e){ console.warn('loadComReglas:',e); }
}

// Get commission % for a vendedor+producto+almacen
// Priority: vendedor+producto > vendedor+categoria > vendedor+almacen > vendedor global
function getComPct(vend, prod, cat, alm){
  var rules=COM_REGLAS.filter(function(r){return r.vendedor===vend||r.vendedor==='*';});
  // Most specific first
  var byProd=rules.find(function(r){return r.producto&&r.producto===prod&&(!r.almacen||r.almacen===alm);});
  if(byProd) return byProd.pct;
  var byCat=rules.find(function(r){return r.categoria&&r.categoria===cat&&(!r.almacen||r.almacen===alm);});
  if(byCat) return byCat.pct;
  var byAlm=rules.find(function(r){return !r.producto&&!r.categoria&&r.almacen===alm;});
  if(byAlm) return byAlm.pct;
  var global=rules.find(function(r){return !r.producto&&!r.categoria&&!r.almacen;});
  if(global) return global.pct;
  
  // fallback to COM_DEF if no custom rules apply
  return (COM_DEF[vend]&&COM_DEF[vend][alm])||0;
}
let liquidaciones=(function(){try{const d=localStorage.getItem('erp_liquidaciones');return d?JSON.parse(d):[];}catch(e){return [];}})();

// ── DATA ─────────────────────────────────────────────────
let VENTAS=[];  // cargado desde Supabase
let venNextId = 1000; // starts high to avoid Supabase ID collisions

// Ticket number system: HAB05-001
var _ticketSeq = JSON.parse(localStorage.getItem('erp_ticket_seq')||'{}');
function genTicket(alm){
  var _almCode = {Habana:'HAB',Placetas:'PLA',Xportprise:'XPR'}[alm]||(alm||'GEN').slice(0,3).toUpperCase();
  var _now = new Date();
  var _mm = String(_now.getMonth()+1).padStart(2,'0');
  var _key = _almCode+_mm;
  if(!_ticketSeq[_key]) _ticketSeq[_key]=0;
  _ticketSeq[_key]++;
  try{localStorage.setItem('erp_ticket_seq',JSON.stringify(_ticketSeq));}catch(e){}
  return _key+'-'+String(_ticketSeq[_key]).padStart(3,'0');
}

// IDs visibles actualmente en la tabla
let visibleIds=[];


// ── NAV ───────────────────────────────────────────────────
function navTo_ven(pg,btn){
  document.querySelectorAll('#mod-ventas .page').forEach(p=>p.classList.remove('act'));
  document.getElementById(pg).classList.add('act');
  document.querySelectorAll('#mod-ventas .nav button').forEach(b=>b.classList.remove('act'));
  btn.classList.add('act');
  if(pg==='ventas')renderVentas();
  if(pg==='comisiones')renderCom();
  if(pg==='liquidacion'){
    renderMiComision();
    var _isV=typeof S!=='undefined'&&S.user&&USERS[S.user]&&USERS[S.user].rol==='vendedor';
    var _aCom=_isV&&USERS[S.user]&&USERS[S.user].aComision!==false;
    var fbar=document.querySelector('#liquidacion .fbar');
    if(fbar) fbar.style.display=(_isV&&_aCom)?'none':'';
    var out=document.getElementById('liq-out');
    if(out) out.style.display=(_isV&&_aCom)?'none':'';
    setRangeLiq();renderLiq();refreshLiqHist();
    var hw=document.getElementById('liq-hist-wrap');if(hw&&liquidaciones.length)hw.style.display='block';
  }
  if(pg==='nueva'){document.getElementById('nv-fecha').value=today();updNvCom();}

  if(pg==='micaja') renderMiCaja();
}

// ── FECHAS ────────────────────────────────────────────────
async function retroAsignarTickets(){
  var sinTicket = VENTAS.filter(function(v){ return !v.ticket; });
  if(!sinTicket.length){ alert('\u2705 Todas las ventas ya tienen ticket asignado.'); return; }
  if(!confirm('Se asignarán tickets a '+sinTicket.length+' venta(s) sin número. ¿Continuar?')) return;
  // Ordenar por fecha asc + supaId asc (las más antiguas primero)
  sinTicket.sort(function(a,b){
    var dc=a.fecha.localeCompare(b.fecha);
    return dc!==0?dc:(a.supaId||0)-(b.supaId||0);
  });
  var codigos={Habana:'HAB',Placetas:'PLA',Xportprise:'XPR'};
  var ok=0, err=0;
  for(var i=0;i<sinTicket.length;i++){
    var v=sinTicket[i];
    var almCod=codigos[v.alm]||(v.alm||'GEN').slice(0,3).toUpperCase();
    var fechaObj=new Date(v.fecha);
    var mm=String(fechaObj.getMonth()+1).padStart(2,'0');
    var key=almCod+mm;
    if(!_ticketSeq[key])_ticketSeq[key]=0;
    _ticketSeq[key]++;
    var nuevoTicket=key+'-'+String(_ticketSeq[key]).padStart(3,'0');
    // Update local
    v.ticket=nuevoTicket;
    // Build new notas: prepend ticket bracket
    var notaActual=v.nota||'';
    var horaTag=v.hora?'['+v.hora+']':'';
    var nuevaNota='['+nuevoTicket+']'+horaTag+(notaActual?' '+notaActual:'');
    // Update Supabase
    if(_supaOnline && v.supaId){
      try{
        var r=await supaReq('PATCH','ventas?id=eq.'+v.supaId,{notas:nuevaNota});
        if(r.ok){ok++;}else{err++;}
      }catch(e){err++;}
    } else { ok++; }
  }
  try{localStorage.setItem('erp_ticket_seq',JSON.stringify(_ticketSeq));}catch(e){}
  offlineSaveVentas();
  renderVentas();
  alert('\u2705 Tickets asignados: '+ok+(err?' \u26a0\ufe0f Errores: '+err:''));
}
function setRange(r){
  const d=new Date(),fmt=x=>x.toISOString().slice(0,10);
  let desde,hasta=fmt(d);
  if(r==='hoy')desde=fmt(d);
  else if(r==='semana'){const s=new Date(d);s.setDate(d.getDate()-((d.getDay()||7)-1));desde=fmt(s);}
  else if(r==='mes')desde=fmt(new Date(d.getFullYear(),d.getMonth(),1));
  else{desde='2025-01-01';hasta='2026-12-31';}
  document.getElementById('f-desde').value=desde;
  document.getElementById('f-hasta').value=hasta;
  renderVentas();
}
function setRangeCom(r){
  const d=new Date(),fmt=x=>x.toISOString().slice(0,10);
  if(r==='semana'){const s=new Date(d);s.setDate(d.getDate()-((d.getDay()||7)-1));document.getElementById('c-desde').value=fmt(s);document.getElementById('c-hasta').value=fmt(d);}
  else{document.getElementById('c-desde').value=fmt(new Date(d.getFullYear(),d.getMonth(),1));document.getElementById('c-hasta').value=fmt(d);}
  renderCom();
}
function setRangeLiq(){
  const d=new Date(),fmt=x=>x.toISOString().slice(0,10);
  const s=new Date(d);s.setDate(d.getDate()-((d.getDay()||7)-1));
  document.getElementById('l-desde').value=fmt(s);
  document.getElementById('l-hasta').value=fmt(d);
}
function limpiarFiltros(){
  ['f-desde','f-hasta','f-prod'].forEach(id=>document.getElementById(id).value='');
  ['f-vend','f-alm','f-tipo','f-mon','f-estcom','f-caja'].forEach(id=>{var e=document.getElementById(id);if(e)e.value='';});
  renderVentas();
}

// ── FILTRO ────────────────────────────────────────────────
function filtrar_ven(){
  const desde=document.getElementById('f-desde').value;
  const hasta=document.getElementById('f-hasta').value;
  const vend=document.getElementById('f-vend').value;
  const alm=document.getElementById('f-alm').value;
  const tipo=document.getElementById('f-tipo').value;
  const mon=document.getElementById('f-mon').value;
  const estcom=document.getElementById('f-estcom').value;
  const caja=(document.getElementById('f-caja')?.value||'');
  const prod=(document.getElementById('f-prod').value||'').toLowerCase();
  return VENTAS.filter(v=>{
    if(desde&&v.fecha<desde)return false;
    if(hasta&&v.fecha>hasta)return false;
    if(vend&&v.vend!==vend)return false;
    if(alm&&v.alm!==alm)return false;
    if(tipo&&v.tipo!==tipo)return false;
    if(mon&&!(v.mon===mon||(v.pagos&&v.pagos.some(function(p){return p.mon===mon;}))))return false;
    if(caja&&!(v.pagos&&v.pagos.some(function(p){return (p.caja||p.mon+' '+v.alm)===caja;})))return false;
    if(estcom&&v.estCom!==estcom)return false;
    if(prod&&!v.prods.toLowerCase().includes(prod))return false;
    return true;
  }).sort((a,b)=>{
    var dc=b.fecha.slice(0,10).localeCompare(a.fecha.slice(0,10));
    if(dc!==0)return dc;
    var hc=(b.hora||'').localeCompare(a.hora||'');
    if(hc!==0)return hc;
    // supaId es el auto-increment de Supabase — más fiable que id local
    return (b.supaId||b.id||0)-(a.supaId||a.id||0);
  });
}

// ── RENDER VENTAS ─────────────────────────────────────────
function renderVentas(){
  var _isVend=typeof S!=='undefined'&&S.user&&USERS[S.user]&&USERS[S.user].rol==='vendedor';
  var _aComision=_isVend&&USERS[S.user]&&USERS[S.user].aComision!==false;
  var _showCom=!_isVend||_aComision;

  // Rebuild caja filter — from _cajasData or from ventas pagos
  var _fcSel=document.getElementById('f-caja');
  if(_fcSel){
    var _curC=_fcSel.value;
    // Get caja names from actual ventas pagos (most reliable)
    var _cajasFromVentas=[...new Set(VENTAS.flatMap(function(v){
      return (v.pagos&&v.pagos.length)?v.pagos.map(function(p){return p.caja||p.mon+' '+v.alm;}):[(v.mon||'USD')+' '+(v.alm||'')];
    }))].filter(Boolean).sort();
    // Also add from _cajasData if loaded
    if(typeof _cajasData!=='undefined'&&_cajasData.length){
      _cajasData.filter(function(c){return c.activa;}).forEach(function(c){
        if(_cajasFromVentas.indexOf(c.nombre)<0) _cajasFromVentas.push(c.nombre);
      });
      _cajasFromVentas.sort();
    }
    _fcSel.innerHTML='<option value="">Todas</option>'+_cajasFromVentas.map(function(n){return '<option'+(n===_curC?' selected':'')+'>'+n+'</option>';}).join('');
  }
  // Rebuild vendedor filter from active USERS
  var _fvSel=document.getElementById('f-vend');
  if(_fvSel){
    var _curV=_fvSel.value;
    var _vendores=Object.keys(USERS).filter(function(k){return USERS[k]&&USERS[k].activo!==false&&USERS[k].rol!=='admin';});
    _fvSel.innerHTML='<option value="">Todos</option>'+_vendores.map(function(v){return '<option'+(v===_curV?' selected':'')+'>'+v+'</option>';}).join('');
  }
  var _mc=document.getElementById('btn-micaja-nav');if(_mc)_mc.style.display=_isVend?'':'none';
  var _mcom=document.getElementById('btn-micom-nav');
  if(_mcom)_mcom.style.display=_aComision?'':'none';
  var _bc=document.getElementById('btn-com-nav');if(_bc)_bc.style.display=_isVend?'none':'';
  var _bl=document.getElementById('btn-liq-nav');if(_bl)_bl.style.display=(_isVend&&!_aComision)?'none':'';
  // com columns: show for admin and sellers with commission
  ['th-com1','th-com2','th-com3'].forEach(function(id){var e=document.getElementById(id);if(e)e.style.display=_showCom?'table-cell':'none';}); 
  var _thChk=document.getElementById('th-chkall');if(_thChk)_thChk.style.display=_isVend?'none':'';
  var _selBar=document.getElementById('sel-bar');if(_selBar&&_isVend)_selBar.classList.remove('show');
  var _admBar=document.getElementById('adm-com-bar');if(_admBar)_admBar.style.display=_isVend?'none':'flex';
  var _estcomWrap=document.getElementById('f-estcom-wrap');if(_estcomWrap)_estcomWrap.style.display=_showCom?'':'none';

  const data=filtrar_ven();
  visibleIds=data.map(v=>v.id);

  // métricas (solo ventas que SÍ tienen comisión)
  const conCom=data.filter(v=>v.estCom!=='No aplica');
  const totUSD=data.reduce((a,v)=>a+v.totalUSD,0);
  const totCom=conCom.reduce((a,v)=>a+v.comUSD,0);
  const pdte=conCom.filter(v=>v.estCom==='Pendiente').reduce((a,v)=>a+v.comUSD,0);
  document.getElementById('v-metrics').innerHTML=`
    <div class="metric"><div class="lbl">Venta total USD</div><div class="val">${fN(totUSD)}</div><div class="sub">${data.length} ops</div></div>
    <div class="metric"><div class="lbl">Equiv. EUR</div><div class="val">${fN(fromUSD(totUSD,'EUR'))}</div><div class="sub">equiv.</div></div>
    <div class="metric"><div class="lbl">Equiv. CUP</div><div class="val">${fN(fromUSD(totUSD,'CUP'),0)}</div><div class="sub">equiv.</div></div>
    ${_isVend?'':'<div class="metric"><div class="lbl">Com. total</div><div class="val" style="color:var(--color-text-warning)">'+(fN(totCom))+'</div><div class="sub">USD (con com.)</div></div><div class="metric"><div class="lbl">Com. pendiente</div><div class="val" style="color:var(--color-text-danger)">'+fN(pdte)+'</div><div class="sub">USD sin liquidar</div></div>'}
  `;

  document.getElementById('v-count-lbl').textContent=`Ventas filtradas — ${data.length} resultados`;

  // tabla
  const estClsMap={Pagada:'bg',Pendiente:'ba','No aplica':'bn'};
  document.getElementById('v-body').innerHTML=data.length?data.map(v=>`
    <tr id="vrow-${v.id}">
      <td style="${_isVend?'display:none':''}"><input type="checkbox" class="row-chk" data-id="${v.id}"></td>
      <td style="white-space:nowrap">
        <div style="font-size:11px">${fD(v.fecha)} ${v.hora?'<span style="color:var(--color-text-secondary);font-weight:500">'+v.hora+'</span>':''}</div>
        ${v.ticket?'<div style="font-size:9px;color:var(--color-text-tertiary);opacity:.8;margin-top:2px">'+v.ticket+'</div>':''}
      </td>
      <td><span class="chip" style="background:${v.vend==='Keiler'?'var(--color-background-info)':'var(--color-background-warning)'};color:${v.vend==='Keiler'?'var(--color-text-info)':'var(--color-text-warning)'};font-size:10px;padding:2px 6px">${v.vend}</span></td>
      <td style="font-size:11px">${v.alm}</td>
      <td style="font-size:11px;color:var(--color-text-secondary);max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.cli}</td>
      <td><span class="badge ${v.tipo==='Mayorista'?'bg':'bb'}" style="font-size:9px">${v.tipo==='Mayorista'?'May':'Min'}</span></td>
      <td style="font-size:10px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--color-text-secondary)">${v.prods.replace(/ @ \$[\d.,]+/g,'')}</td>
      <td style="font-weight:600;text-align:right;white-space:nowrap">${fN(v.totalUSD)}</td>
      <td style="font-size:10px;color:var(--color-text-info);max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(function(){var pp=v.pagos&&v.pagos.length?v.pagos:[{caja:v.mon+' '+(v.alm||'')}];return[...new Set(pp.map(function(p){return p.caja||p.mon;}))].join(', ');}())}">${(function(){
        var pp=v.pagos&&v.pagos.length?v.pagos:[{caja:v.mon+' '+(v.alm||'')}];
        return [...new Set(pp.map(function(p){return p.caja||p.mon;}))].join(', ');
      }())}</td>
      ${!_showCom?'':(_isVend ? `<td style="white-space:nowrap;text-align:center">${v.comPct}%</td>
      <td style="text-align:right;font-weight:500;white-space:nowrap;color:var(--color-text-warning)">${fN(v.comUSD)}</td>
      <td style="white-space:nowrap"><span class="badge ${v.estCom==='Pagada'?'bg':v.estCom==='No aplica'?'bn':'ba'}">${v.estCom}</span></td>`
      : `<td style="white-space:nowrap"><input type="number" class="com-inp" value="${v.comPct}" step="0.5" min="0" max="100" onchange="updComPct(${v.id},this.value)" title="Editar %" style="width:60px;padding:4px;font-size:11px"></td>
      <td style="text-align:right;font-weight:500;white-space:nowrap;color:var(--color-text-warning)">${fN(v.comUSD)}</td>
      <td style="white-space:nowrap">${renderEstComCell(v)}</td>`)}
      <td style="font-size:11px;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--color-text-secondary)">${v.nota||''}</td>
      <td style="white-space:nowrap"><button class="btn-sm" onclick="verVenta(${v.id})" style="padding:3px 6px">👁</button>${_isVend?'':'<button class="btn-sm" onclick="eliminarV('+v.id+')" style="color:var(--color-text-danger);padding:3px 6px">×</button>'}</td>
    </tr>`).join(''):`<tr><td colspan="13" style="text-align:center;color:var(--color-text-tertiary);padding:16px">Sin resultados</td></tr>`;

  // foot totales
  const totCom2=data.filter(v=>v.estCom!=='No aplica').reduce((a,v)=>a+v.comUSD,0);
  // cols before Total USD: vendedor=6(fecha,vend,alm,cli,tipo,prods) admin=7(+chk)
  var _footSpan = _isVend ? 6 : 7;
  document.getElementById('v-foot').innerHTML=data.length?`<tr class="sum-row">
    <td colspan="${_footSpan}" style="font-weight:600">Total (${data.length} venta${data.length!==1?'s':''})</td>
    <td style="text-align:right;font-weight:700;padding-right:8px">${fN(totUSD)}</td>
    <td colspan="${_isVend?3:6}"></td>
  </tr>`:'';

  // vincular checkboxes con JS puro (no inline)
  document.querySelectorAll('.row-chk').forEach(chk=>{
    chk.addEventListener('change',e=>{
      updSelBar();
      // sync header checkbox
      const all=document.querySelectorAll('.row-chk');
      const checked=[...all].filter(c=>c.checked);
      const hdr=document.getElementById('chk-all');
      hdr.indeterminate=checked.length>0&&checked.length<all.length;
      hdr.checked=checked.length===all.length&&all.length>0;
    });
  });

  // reset header checkbox
  const hdr=document.getElementById('chk-all');
  hdr.checked=false;hdr.indeterminate=false;
  updSelBar();
}

// ── CHECKBOX HEADER ───────────────────────────────────────
// Vinculado una sola vez en init
function initChkAll(){
  const hdr=document.getElementById('chk-all');
  hdr.addEventListener('change',function(){
    document.querySelectorAll('.row-chk').forEach(c=>c.checked=this.checked);
    updSelBar();
  });
}

function updSelBar(){
  const checked=[...document.querySelectorAll('.row-chk')].filter(c=>c.checked);
  const bar=document.getElementById('sel-bar');
  const n=checked.length;
  bar.classList.toggle('show',n>0);
  document.getElementById('sel-count').textContent=n+' seleccionada'+(n!==1?'s':'');
}
function deselAll(){
  document.querySelectorAll('.row-chk').forEach(c=>c.checked=false);
  const hdr=document.getElementById('chk-all');
  hdr.checked=false;hdr.indeterminate=false;
  updSelBar();
}
function getSelIds(){
  return [...document.querySelectorAll('.row-chk:checked')].map(c=>parseInt(c.dataset.id));
}

// ── ACCIONES ──────────────────────────────────────────────
async function updComPct(id,val){
  const v=VENTAS.find(x=>x.id===id);if(!v)return;
  v.comPct=parseFloat(val)||0;
  v.comUSD=parseFloat((v.totalUSD*v.comPct/100).toFixed(2));
  v.comDetalle = {};
  var netCobrado = {};
  var pagos = v.pagos || [];
  var vueltos = v.vueltos || [];
  if(pagos.length===0) {
    netCobrado[v.mon] = v.totalUSD;
  } else {
    pagos.forEach(function(p){ netCobrado[p.mon] = (netCobrado[p.mon]||0) + p.m; });
    vueltos.forEach(function(x){ netCobrado[x.mon] = (netCobrado[x.mon]||0) - x.m; });
  }
  Object.keys(netCobrado).forEach(function(m){
    if(netCobrado[m] > 0) v.comDetalle[m] = parseFloat((netCobrado[m] * (v.comPct / 100)).toFixed(4));
  });
  renderVentas();
  if(typeof syncSaveVenta==='function') syncSaveVenta(v);
}
async function setEstCom(id,est){
  const v=VENTAS.find(x=>x.id===id);if(!v)return;
  v.estCom=est;
  if(est==='No aplica'){v.comPct=0;v.comUSD=0;v.comDetalle={};}
  renderVentas();
  if(typeof syncSaveVenta==='function') syncSaveVenta(v);
}

// ── Revertir venta: devuelve stock + cajas ────────────────
function _revertirVenta(v){
  if(!v) return;
  // 1. Devolver stock
  if(v.prods && typeof PRODS!=='undefined'){
    var lineas=[];
    // Parse prods string: "2× Perfil Angular, 1× Chapa..."
    var parts=(v.prods||'').split(',');
    parts.forEach(function(p){
      var m=p.trim().match(/^(\d+)×\s*(.+)/);
      if(m){lineas.push({q:parseInt(m[1]),n:m[2].split(' @ $')[0].trim()});}
    });
    lineas.forEach(function(l){
      var prod=PRODS.find(function(p){return p.n===l.n;});
      if(prod){
        prod.stk=(prod.stk||0)+l.q;
        if(!prod.stk_alm) prod.stk_alm={};
        if(v.alm) prod.stk_alm[v.alm]=(prod.stk_alm[v.alm]||0)+l.q;
        // Persist to Supabase
        if(v.alm&&typeof syncStockAlmacen==='function'){
          var newStk=prod.stk_alm[v.alm]||0;
          if(prod.supaId){
            // Have supaId — update directly
            syncStockAlmacen(prod.supaId, v.alm, newStk);
          } else if(_supaOnline){
            // No supaId — fetch id from Supabase first then update
            supaReq('GET','productos?nombre=eq.'+encodeURIComponent(prod.n)+'&select=id').then(function(r){
              if(r.ok) return r.json();
            }).then(function(d){
              if(d&&d[0]&&d[0].id){
                prod.supaId=d[0].id;
                syncStockAlmacen(prod.supaId, v.alm, newStk);
              }
            }).catch(function(e){console.warn('revertir supaId lookup:',e);});
          }
        }
      }
    });
    if(lineas.length) offlineSaveProds();
  }
  // 2. Revertir mov_cajas: retiro de cada pago cobrado
  if(v.pagos&&v.pagos.length&&typeof _cajasMovs!=='undefined'){
    v.pagos.forEach(function(p){
      var caja=p.caja||(p.mon+' '+(v.alm||''));
      var retiro={
        tipo:'retiro', fecha:v.fecha||today(),
        notas:'Anulación venta '+v.id,
        usuario:(typeof S!=='undefined'&&S.user)||'Admin',
        caja_origen:caja, caja_destino:null,
        monto_origen:p.m, monto_destino:p.m, tasa_usada:null
      };
      _cajasMovs.unshift(retiro);
      if(typeof _supaWrite==='function') _supaWrite('POST','mov_cajas',retiro);
    });
    // 2b. Revertir vueltos: el vuelto fue un retiro al vender, ahora se devuelve a caja
    var _vts=v.vueltos;
    if(typeof _vts==='string'){try{_vts=JSON.parse(_vts);}catch(e){_vts=[];}}
    if(Array.isArray(_vts)&&_vts.length){
      _vts.forEach(function(vt){
        if(!vt||!vt.m||vt.m<=0) return;
        var cajaV=vt.caja||(vt.mon+' '+(v.alm||''));
        var depV={
          tipo:'deposito', fecha:v.fecha||today(),
          notas:'Anulacion venta '+v.id+' (vuelto)',
          usuario:(typeof S!=='undefined'&&S.user)||'Admin',
          caja_origen:null, caja_destino:cajaV,
          monto_origen:vt.m, monto_destino:vt.m, tasa_usada:null
        };
        _cajasMovs.unshift(depV);
        if(typeof _supaWrite==='function') _supaWrite('POST','mov_cajas',depV);
      });
    }
    try{localStorage.setItem('erp_cajas_movs',JSON.stringify(_cajasMovs.slice(0,500)));}catch(e){}
  }
  // 3. Revertir folio: vaciar lineas o eliminar folio
  var match = (v.notas||v.nota||v.desc||'').match(/Folio ([\w-]+)/);
  if(match) {
    var fid = match[1];
    var cli = typeof CLIENTES!=='undefined' ? CLIENTES.find(c => c.folios && c.folios.some(f => f.id === fid)) : null;
    if(cli) {
      var fidx = cli.folios.findIndex(f => f.id === fid);
      if(fidx >= 0) {
        var f = cli.folios[fidx];
        if(f.lineas && f.lineas.length > 0) {
          var linesToSubtract = [];
          var parts=(v.prods||'').split(',');
          parts.forEach(function(p){
            var m=p.trim().match(/^(\d+)×\s*(.+)/);
            if(m){linesToSubtract.push({q:parseInt(m[1]),n:m[2].split(' @ $')[0].trim()});}
          });
          linesToSubtract.forEach(function(vl) {
            var idx = f.lineas.findIndex(l => l.prod === vl.n);
            if(idx >= 0) {
              f.lineas[idx].q -= vl.q;
              if (f.lineas[idx].q <= 0) f.lineas.splice(idx, 1);
            }
          });
        }
        if(!f.abonos || f.abonos.length === 0) {
          cli.folios.splice(fidx, 1); // Delete completely if no abonos
          if(typeof _supaOnline!=='undefined'&&_supaOnline) { if(typeof supaReq==='function') supaReq('DELETE','folios?id=eq.'+fid).catch(e=>{}); }
          else { if(typeof enqueue==='function') enqueue({method:'DELETE',path:'folios?id=eq.'+fid}); }
        } else {
          if(typeof syncSaveFolio==='function') syncSaveFolio(cli.id, f);
        }
        if(typeof offlineSaveClientes==='function') offlineSaveClientes();
        if(typeof _dRecalcReservas==='function') _dRecalcReservas();
      }
    }
  }
}
function eliminarV(id, skipConfirm){
  if(!skipConfirm && !confirm('¿Eliminar esta venta?'))return;
  var v=VENTAS.find(x=>x.id===id);
  _revertirVenta(v);
  VENTAS=VENTAS.filter(x=>x.id!==id);
  offlineSaveVentas();
  if(_supaOnline){
    // Use supaId (UUID) for Supabase DELETE, fallback to local id
    var _sid=v&&v.supaId?v.supaId:id;
    supaReq('DELETE','ventas?id=eq.'+_sid).then(function(r){
      if(!r.ok) r.text().then(function(t){console.warn('delete venta failed:',t);});
      renderVentas();
    }).catch(function(e){console.warn(e); renderVentas();});
  } else {
    renderVentas();
  }
  showToast('Venta eliminada — stock y caja revertidos');
}
function eliminarSel(){
  var ids=getSelIds();
  if(!ids.length){showToast('Nada seleccionado');return;}
  if(!confirm('¿Eliminar '+ids.length+' venta'+(ids.length>1?'s':'')+' seleccionada'+(ids.length>1?'s':'')+' ? Esta acción no se puede deshacer.'))return;
  // Revert stock + cajas for each
  // Collect supaIds BEFORE filtering
  var _supaIds={};
  ids.forEach(function(id){
    var v=VENTAS.find(function(x){return x.id===id;});
    if(v){_supaIds[id]=v.supaId||id; _revertirVenta(v);}
  });
  VENTAS=VENTAS.filter(function(v){return !ids.includes(v.id);});
  offlineSaveVentas();
  if(_supaOnline){
    Promise.all(ids.map(function(id){
      var _sid=_supaIds[id]||id;
      return supaReq('DELETE','ventas?id=eq.'+_sid).then(function(r){
        if(!r.ok) r.text().then(function(t){console.warn('del venta:',t);});
      }).catch(function(e){console.warn('del venta:',e);});
    })).then(function(){
      // Don't reload from Supabase — use local state (already filtered above)
      deselAll();
      renderVentas();
    });
  } else {
    deselAll();
    renderVentas();
  }
  showToast('🗑 '+ids.length+' venta'+(ids.length>1?'s':'')+' eliminada'+(ids.length>1?'s':'')+' — stock y cajas revertidos');
}
function cambiarEstadoSel(est){
  const ids=getSelIds();
  ids.forEach(id=>{
    const v=VENTAS.find(x=>x.id===id);if(!v)return;
    v.estCom=est;
    if(est==='No aplica'){v.comPct=0;v.comUSD=0;}
  });
  renderVentas();
  showToast(`${ids.length} ventas → ${est}`);
}
function aplicarComGlobal(){
  const pct=parseFloat(document.getElementById('com-global').value)||4;
  const ids=getSelIds().length>0?getSelIds():visibleIds;
  ids.forEach(id=>{
    const v=VENTAS.find(x=>x.id===id);if(!v||v.estCom==='No aplica')return;
    v.comPct=pct;v.comUSD=parseFloat((v.totalUSD*pct/100).toFixed(2));
  });
  renderVentas();
  showToast(`${pct}% aplicado a ${ids.length} ventas`);
}
function exportVentasCSV(){
  const data=filtrar_ven();
  let csv='Fecha;Producto;Cantidad;Almacén;Tipo de Venta;Precio Unitario;Moneda;Total en Moneda\n';
  data.forEach(v=>{
    var fechaParts = v.fecha.split('-');
    var fDate = fechaParts.length === 3 ? `${fechaParts[2]}/${fechaParts[1]}/${fechaParts[0]}` : v.fecha;

    // Determine real payment currency from v.pagos
    var pagos = v.pagos || [];
    var monedas_pago = [];
    pagos.forEach(function(p){ if(p.mon && monedas_pago.indexOf(p.mon)===-1) monedas_pago.push(p.mon); });
    var mon_cobro = monedas_pago.length > 0 ? monedas_pago[0] : (v.mon || 'USD');
    var mon_label = monedas_pago.length > 0 ? monedas_pago.join('/') : (v.mon || 'USD');

    var rx = /(\d+)[x×]\s+([\s\S]+?)(?:\s+@\s+\$([\d,.-]+))?(?=(?:,\s*\d+[x×]|$))/g;
    var matches = Array.from(v.prods.matchAll(rx));

    if(matches.length > 0) {
      var allHavePrice = matches.every(m => m[3]);
      var dec = (mon_cobro==='CUP'||mon_cobro==='CUPT') ? 0 : 2;

      if (allHavePrice) {
        // All products have individual prices — use them
        matches.forEach(match => {
          var qty = match[1];
          var prod = match[2].trim().replace(/"/g, '""');
          var priceUSD = parseFloat(match[3].replace(/\./g, '').replace(',', '.'));
          var totalUSD = parseInt(qty, 10) * priceUSD;
          var priceInMon = (typeof fromUSD==='function') ? fromUSD(priceUSD, mon_cobro, v.alm) : priceUSD;
          var totalInMon = (typeof fromUSD==='function') ? fromUSD(totalUSD, mon_cobro, v.alm) : totalUSD;
          var priceStr = priceInMon.toLocaleString('es-ES', {minimumFractionDigits:dec, maximumFractionDigits:dec});
          var totalStr = totalInMon.toLocaleString('es-ES', {minimumFractionDigits:dec, maximumFractionDigits:dec});
          csv += `${fDate};"${prod}";${qty};${v.alm||''};${v.tipo||''};"${priceStr}";${mon_label};"${totalStr}"\n`;
        });
      } else {
        // Products without individual prices — split total equally among products
        var usdPerProd = v.totalUSD / matches.length;
        matches.forEach(match => {
          var qty = match[1];
          var prod = match[2].trim().replace(/"/g, '""');
          var qInt = parseInt(qty, 10);
          var priceUSD = qInt > 0 ? (usdPerProd / qInt) : 0;
          var totalUSD = usdPerProd;
          var priceInMon = (typeof fromUSD==='function') ? fromUSD(priceUSD, mon_cobro, v.alm) : priceUSD;
          var totalInMon = (typeof fromUSD==='function') ? fromUSD(totalUSD, mon_cobro, v.alm) : totalUSD;
          var priceStr = priceInMon.toLocaleString('es-ES', {minimumFractionDigits:dec, maximumFractionDigits:dec});
          var totalStr = totalInMon.toLocaleString('es-ES', {minimumFractionDigits:dec, maximumFractionDigits:dec});
          csv += `${fDate};"${prod}";${qty};${v.alm||''};${v.tipo||''};"${priceStr}";${mon_label};"${totalStr}"\n`;
        });
      }
      return;
    }

    // Fallback: truly unparseable — output as single row
    var dec2 = (mon_cobro==='CUP'||mon_cobro==='CUPT') ? 0 : 2;
    var totalInMon2 = (typeof fromUSD==='function') ? fromUSD(v.totalUSD, mon_cobro, v.alm) : v.totalUSD;
    var prodsClean = (v.prods||'').replace(/"/g, '""');
    csv += `${fDate};"${prodsClean}";1;${v.alm||''};${v.tipo||''};"${fN(totalInMon2, dec2)}";${mon_label};"${fN(totalInMon2, dec2)}"\n`;
  });
  
  var bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  var blob = new Blob([bom, csv], {type: 'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='registro_ventas.csv';
  a.click();
}

// ── COMISIONES ────────────────────────────────────────────
function renderCom(){
  const desde=document.getElementById('c-desde').value;
  const hasta=document.getElementById('c-hasta').value;
  const vend=document.getElementById('c-vend').value;
  const alm=document.getElementById('c-alm').value;
  const data=VENTAS.filter(v=>{
    if(desde&&v.fecha<desde)return false;
    if(hasta&&v.fecha>hasta)return false;
    if(vend&&v.vend!==vend)return false;
    if(alm&&v.alm!==alm)return false;
    return true;
  }).filter(v=>v.estCom!=='No aplica');
  const totCom=data.reduce((a,v)=>a+v.comUSD,0);
  var isPdteR=function(v){return v.estCom==='Pendiente'||v.estCom==='Liquidada (Pdte)'||(!v.estCom&&v.comUSD>0);};
  const pdte=data.filter(isPdteR).reduce((a,v)=>a+v.comUSD,0);
  document.getElementById('c-metrics').innerHTML=`
    <div class="metric"><div class="lbl">Com. total</div><div class="val" style="color:var(--color-text-warning)">${fN(totCom)}</div><div class="sub">USD</div></div>
    <div class="metric"><div class="lbl">Pendiente</div><div class="val" style="color:var(--color-text-danger)">${fN(pdte)}</div><div class="sub">USD</div></div>
    <div class="metric"><div class="lbl">Pagada</div><div class="val" style="color:var(--color-text-success)">${fN(totCom-pdte)}</div><div class="sub">USD</div></div>
    <div class="metric"><div class="lbl">Ventas totales</div><div class="val">${fN(data.reduce((a,v)=>a+v.totalUSD,0))}</div><div class="sub">USD</div></div>`;
  const grupos={};
  data.forEach(v=>{
    const k=v.vend+'|'+v.alm+'|'+(v.comPct||0);
    if(!grupos[k])grupos[k]={vend:v.vend,alm:v.alm,pct:v.comPct||0,vUSD:0,comUSD:0,pdte:0};
    grupos[k].vUSD+=v.totalUSD;grupos[k].comUSD+=v.comUSD;
    if(isPdteR(v))grupos[k].pdte+=v.comUSD;
  });
  document.getElementById('c-grupos').innerHTML=Object.values(grupos).map(g=>`<tr>
    <td><strong>${g.vend}</strong></td><td>${g.alm}</td>
    <td><span class="badge bb">${g.pct}%</span></td>
    <td style="text-align:right">${fN(g.vUSD)}</td>
    <td style="text-align:right;color:var(--color-text-warning);font-weight:500">${fN(g.comUSD)}</td>
    <td style="text-align:right">${fN(fromUSD(g.comUSD,'EUR'))}</td>
    <td style="text-align:right">${fN(fromUSD(g.comUSD,'CUP'),0)}</td>
    <td><span class="badge ${g.pdte<0.01?'bg':'ba'}">${g.pdte<0.01?'Liquidado':fN(g.pdte)+' pdte.'}</span></td>
  </tr>`).join('')||'<tr><td colspan="8" style="color:var(--color-text-tertiary);text-align:center;padding:10px">Sin datos</td></tr>';
}

// ── LIQUIDACIÓN ───────────────────────────────────────────
function renderLiqCuentas(){
  var mon=document.getElementById('l-mon-pago')?.value||'CUP';
  var alm=document.getElementById('l-alm')?.value||'';
  var sel=document.getElementById('l-caja-pago'); if(!sel) return;
  var cajas=typeof _cajasData!=='undefined'?_cajasData:[];
  var opts=cajas.filter(function(c){return c.nombre&&c.nombre.toUpperCase().indexOf(mon)>=0&&(!alm||c.nombre.indexOf(alm)>=0);});
  if(!opts.length) opts=cajas.filter(function(c){return c.nombre&&c.nombre.toUpperCase().indexOf(mon)>=0;});
  if(!opts.length) opts=cajas;
  var cur=sel.value;
  sel.innerHTML=opts.map(function(c){return '<option'+(c.nombre===cur?' selected':'')+' value="'+c.nombre+'">'+c.nombre+'</option>';}).join('');
}
function renderLiq(){
  const desde=document.getElementById('l-desde').value;
  const hasta=document.getElementById('l-hasta').value;
  const alm=document.getElementById('l-alm').value;
  const targetMon=document.getElementById('l-mon-pago')?.value||'CUP';
  renderLiqCuentas();
  const cuentaPago=document.getElementById('l-caja-pago')?.value||'';
  const tasa=parseFloat(document.getElementById('l-tasa').value)||512.88;
  const oldAjuste=parseFloat(document.getElementById('liq-ajuste')?.value||0);
  const data=VENTAS.filter(v=>{
    if(desde&&v.fecha<desde)return false;
    if(hasta&&v.fecha>hasta)return false;
    if(alm&&v.alm!==alm)return false;
    if(v.estCom==='No aplica')return false;
    return true;
  });
  const semLabel=desde&&hasta?`${fD(desde)} – ${fD(hasta)}`:'(sin filtro)';
  const almLabel=alm||'Todos';
  
  // isPdte — declare FIRST before any usage
  var isPdte = function(v){ return !v.estCom||v.estCom===''||v.estCom==='Pendiente'||v.estCom==='Liquidada (Pdte)'||(v.comUSD>0&&v.estCom!=='Liquidada'&&v.estCom!=='No aplica'); };

  const totVentaUSD=data.reduce((a,v)=>a+v.totalUSD,0);
  const totComUSD=data.reduce((a,v)=>a+v.comUSD,0);
  var totComPdteUSD=data.filter(isPdte).reduce(function(a,v){return a+v.comUSD;},0);

  var ventaDetalleAcum = {};
  var comDetalleAcum   = {};

  data.filter(isPdte).forEach(function(v){
    var pct = v.comPct||0;
    var pagos = (v.pagos && v.pagos.length)
      ? v.pagos
      : [{mon: v.mon||'USD', monto: (v.mon==='USD'?v.totalUSD:fromUSD(v.totalUSD,v.mon||'USD'))}];
    pagos.forEach(function(p){
      var m = p.mon||'USD';
      var amt = p.monto!=null?p.monto:(p.m!=null?p.m:0);
      ventaDetalleAcum[m] = (ventaDetalleAcum[m]||0) + amt;
      comDetalleAcum[m]   = (comDetalleAcum[m]||0) + parseFloat((amt * pct / 100).toFixed(4));
    });
  });

  var t_EURUSD = typeof RATES_EURUSD!=='undefined'?RATES_EURUSD:1.08;
  function toTgt(monto, mon){
    if(mon===targetMon) return monto;
    var usd = mon==='USD'?monto : mon==='EUR'?monto*t_EURUSD : monto/tasa;
    if(targetMon==='USD') return usd;
    if(targetMon==='EUR') return usd/t_EURUSD;
    return usd*tasa;
  }
  var totalPago = Object.keys(comDetalleAcum).reduce(function(s,m){return s+toTgt(comDetalleAcum[m]||0,m);},0);
               
  document.getElementById('liq-out').innerHTML=`
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
      <div>
        <div style="font-size:11px;color:var(--color-text-secondary)">Liquidación Pendiente a Generar</div>
        <div style="font-size:14px;font-weight:500">${semLabel} · ${almLabel}</div>
      </div>
      <div style="text-align:right"><div class="lbl">Tasa CUP/USD</div><div style="font-weight:500">${fN(tasa,2)}</div></div>
    </div>
    
    <div class="liq-sec">
      <div class="liq-sec-h">DESGLOSE DE VENTAS Y COMISIONES POR MONEDA</div>
      ${(function(){
        var mons=['USD','EUR','CUP','CUPT'].filter(function(m){return (ventaDetalleAcum[m]||0)>0.001||(comDetalleAcum[m]||0)>0.001;});
        if(!mons.length) return '<div class="liq-r" style="color:var(--color-text-tertiary)">Sin ventas pendientes en este periodo</div>';
        return mons.map(function(m){
          var isCup=m==='CUP'||m==='CUPT'; var sym=m==='EUR'?'\u20ac':m==='USD'?'$':'\u20b1';
          return '<div class="liq-r"><span style="font-weight:600">'+m+'</span>'
            +'<span style="display:flex;gap:20px">'
            +'<span style="color:var(--color-text-secondary);font-size:12px">Vendido '+sym+' '+fN(ventaDetalleAcum[m]||0,isCup?0:2)+'</span>'
            +'<strong style="color:var(--color-text-warning)">Comisi\u00f3n: '+sym+' '+fN(comDetalleAcum[m]||0,isCup?0:2)+'</strong>'
            +'</span></div>';
        }).join('');
      })()}
    </div>
    
    <div class="liq-sec">
      <div class="liq-sec-h" style="background:var(--color-background-secondary);color:var(--color-text-secondary)">TOTALES GENERALES</div>
      <div class="liq-r"><span>Total ventas equiv. USD (Semana)</span><span style="font-weight:500">${fN(totVentaUSD)} USD</span></div>
      <div class="liq-r"><span>Comisión total equiv. USD (Semana)</span><span style="color:var(--color-text-warning);font-weight:500">${fN(totComUSD)} USD</span></div>
      <div class="liq-r tot"><span>Pago a liquidar (Convertido a ${targetMon})</span><span style="color:var(--color-text-danger)">${fN(totalPago, targetMon==='CUP'?0:2)} ${targetMon}</span></div>
    </div>
    <div class="sep"></div>
    <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:8px">
      <label style="font-size:12px;color:var(--color-text-secondary)">Ajuste / Redondeo (${targetMon}):</label>
      <input type="number" id="liq-ajuste" value="${oldAjuste}" style="width:80px;padding:4px 8px;font-size:12px;text-align:right;border:1px solid var(--color-border-secondary);border-radius:var(--border-radius-sm);background:var(--color-background-primary);color:var(--color-text-primary)" oninput="document.getElementById('liq-total-final').textContent=fN(${totalPago}+parseFloat(this.value||0),${targetMon==='CUP'?0:2})+' ${targetMon}'">
    </div>
    <div style="text-align:right;font-size:14px;font-weight:600;margin-bottom:16px">Total a Pagar: <span id="liq-total-final" style="color:var(--color-text-danger)">${fN(totalPago + oldAjuste, targetMon==='CUP'?0:2)} ${targetMon}</span></div>
    
    <div class="liq-sec" style="margin-top:16px;border-top:1px solid var(--color-border-primary);padding-top:16px;">
      <div class="liq-sec-h" style="margin-bottom:8px">VENTAS INCLUIDAS EN ESTA LIQUIDACIÓN</div>
      <div style="overflow-x:auto">
        <table class="adm-table" style="font-size:11px;width:100%">
          <thead>
            <tr>
              <th style="text-align:left;padding:6px">Fecha</th>
              <th style="text-align:left;padding:6px">Almacén</th>
              <th style="text-align:left;padding:6px">Productos</th>
              <th style="text-align:right;padding:6px">Total USD</th>
              <th style="text-align:center;padding:6px">% Com.</th>
              <th style="text-align:right;padding:6px">Com. USD</th>
            </tr>
          </thead>
          <tbody>
            ${data.filter(isPdte).map(v => `<tr>
              <td style="padding:6px;white-space:nowrap">${fD(v.fecha)}</td>
              <td style="padding:6px">${v.alm}</td>
              <td style="padding:6px;max-width:200px;white-space:normal">${v.prods}</td>
              <td style="padding:6px;text-align:right">${fN(v.totalUSD)}</td>
              <td style="padding:6px;text-align:center">${v.comPct}%</td>
              <td style="padding:6px;text-align:right;color:var(--color-text-warning);font-weight:500">${fN(v.comUSD)}</td>
            </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:8px">No hay ventas pendientes en este rango</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:16px">
      <button class="btn-sm" onclick="exportLiqCSV()">Exportar CSV</button>
      <button class="btn" onclick='guardarLiq("${desde}","${hasta}","${almLabel}",${totVentaUSD},${totComPdteUSD},${totalPago},"${targetMon}",${JSON.stringify(comDetalleAcum)},"${cuentaPago}")'>Crear Liquidación Pendiente</button>
    </div>
  </div>`;
}

function guardarLiq(desde,hasta,alm,vUSD,comUSD,totalPagoBase,mon,comDetalle,cuentaPago){
  var ajuste = parseFloat(document.getElementById('liq-ajuste')?.value||0);
  var totalPago = totalPagoBase + ajuste;

  const liq={
    id:'liq-'+Date.now(),
    semana:`${fD(desde)}–${fD(hasta)}`,
    desde,hasta,alm,vUSD,comUSD,totalCUP: totalPago, mon: mon, cuenta: cuentaPago||'',
    comDetalle: comDetalle,
    vend: typeof S!=='undefined'?S.user:'',
    estado:'Pendiente',
    fecha:today(),
    ventas: VENTAS.filter(v=>v.estCom==='Pendiente'&&(!desde||v.fecha>=desde)&&(!hasta||v.fecha<=hasta)&&(!alm||v.alm===alm)).map(v=>v.id)
  };
  
  VENTAS.forEach(v => {
    if(liq.ventas.includes(v.id)) {
      v.estCom = 'Liquidada (Pdte)';
      v.liqId = liq.id;
      if(typeof supaReq!=='undefined'&&_supaOnline) supaReq('PATCH','ventas?id=eq.'+v.supaId, {est_com: 'Liquidada (Pdte)'}).catch(e=>{});
    }
  });
  if(typeof offlineSaveVentas==='function') offlineSaveVentas();
  
  liquidaciones.unshift(liq);
  try{localStorage.setItem('erp_liquidaciones',JSON.stringify(liquidaciones));}catch(e){}
  if(typeof supaReq!=='undefined'&&_supaOnline){
    supaReq('POST','liquidaciones',{
      id:liq.id, vend:liq.vend, desde:liq.desde, hasta:liq.hasta,
      semana:liq.semana, almacen:liq.alm, v_usd:liq.vUSD,
      com_usd:liq.comUSD, com_cup:liq.totalCUP,
      estado:liq.estado, fecha:liq.fecha,
      cuenta: JSON.stringify(liq.comDetalle)
    }).catch(function(e){console.warn('liq sync:',e);});
  }
  const hw=document.getElementById('liq-hist-wrap');if(hw)hw.style.display='block';
  refreshLiqHist();renderLiq();showToast('Liquidación guardada como Pendiente ✓');
}

function refreshLiqHist(){
  var _isV=typeof S!=='undefined'&&S.user&&USERS[S.user]&&USERS[S.user].rol==='vendedor';
  document.getElementById('liq-hist').innerHTML=liquidaciones.map((l,i)=>{
    var vs = (l.ventas||[]).map(id=>VENTAS.find(v=>v.id===id)).filter(Boolean);
    var subRows = vs.length ? vs.map(v=>{
      var txt = (v.cart||[]).map(c=>`${c.qty}x ${c.n}`).join(', ');
      return `<tr class="liq-subrow-${i}" style="background:var(--color-bg-alt);font-size:12px;opacity:0.9;display:none">
        <td style="padding-left:20px;border-bottom:1px solid rgba(255,255,255,0.05)">↳ ${fD(v.fecha)}</td>
        <td style="border-bottom:1px solid rgba(255,255,255,0.05)">${v.alm}</td>
        <td style="text-align:right;color:var(--color-text-warning);border-bottom:1px solid rgba(255,255,255,0.05)">${fN(v.comUSD||0)} USD</td>
        <td colspan="2" style="font-size:11px;color:var(--color-text-secondary);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-bottom:1px solid rgba(255,255,255,0.05)" title="${txt.replace(/"/g,'&quot;')}">${txt}</td>
        <td style="border-bottom:1px solid rgba(255,255,255,0.05)">Venta: ${fN(v.totUSD)} USD</td>
        <td style="border-bottom:1px solid rgba(255,255,255,0.05);${_isV?'display:none':''}"></td>
      </tr>`;
    }).join('') : `<tr class="liq-subrow-${i}" style="background:var(--color-bg-alt);font-size:12px;opacity:0.9;display:none"><td colspan="${_isV?6:7}" style="padding-left:20px;border-bottom:1px solid rgba(255,255,255,0.05)">Sin detalles de ventas</td></tr>`;

    return `<tr onclick="var rows=document.querySelectorAll('.liq-subrow-${i}');var isHidden=rows[0]&&rows[0].style.display==='none';rows.forEach(r=>r.style.display=isHidden?'table-row':'none');var ic=this.querySelector('.toggle-ic');if(ic)ic.textContent=isHidden?'▼':'▶';" style="cursor:pointer;transition:background 0.2s" onmouseover="this.style.background='var(--color-bg-alt)'" onmouseout="this.style.background=''">
    <td><span class="toggle-ic" style="display:inline-block;width:16px;font-size:10px;color:var(--color-text-secondary)">▶</span>${l.semana}</td><td>${l.alm}</td>
    <td style="text-align:right;color:var(--color-text-warning);font-weight:bold">${fN(l.comUSD)} USD</td>
    <td style="text-align:right;font-weight:bold">${fN(l.totalCUP || l.comCUP || 0, l.mon==='CUP'?0:2)} ${l.mon||'CUP'}</td>
    <td style="font-size:11px;color:var(--color-text-secondary)">${l.cuenta&&!l.cuenta.startsWith('{')?l.cuenta:'—'}</td>
    <td><span class="badge ${l.estado==='Pagado'?'bg':'ba'}">${l.estado}</span></td>
    <td style="${_isV?'display:none':''}" onclick="event.stopPropagation()">
      ${!_isV && l.estado==='Pendiente'?`<button class="btn-sm btn-p" onclick="pagarLiq(${i})" style="margin-right:4px">Pagar</button>`:''}
      ${!_isV ? `<button class="btn-sm" style="color:var(--color-text-danger);border-color:var(--color-border-danger)" onclick="eliminarLiq(${i})">Borrar</button>` : ''}
    </td>
  </tr>
  ${subRows}`;
  }).join('');
  var thAcc = document.getElementById('th-liq-acc');
  if(thAcc) thAcc.style.display = _isV ? 'none' : '';
}

function pagarLiq(i) {
  var liq = liquidaciones[i];
  if(liq.estado === 'Pagado') return;
  var mon = liq.mon || 'CUP';
  var monto = liq.totalCUP || liq.comCUP || 0;
  var cajas = typeof _cajasData!=='undefined'?_cajasData:[];
  var cajasF = cajas.filter(function(c){ return c.nombre&&c.nombre.toUpperCase().indexOf(mon)>=0; });
  if(!cajasF.length) cajasF = cajas;
  // Pre-select cuenta if saved on liq
  var preSel = liq.cuenta || '';
  var cajaOpts = cajasF.map(function(c){
    return '<option'+(c.nombre===preSel?' selected':'')+' value="'+c.nombre+'">'+c.nombre+'</option>';
  }).join('');
  // Show modal
  var overlay = document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML='<div style="background:var(--color-background-primary);border-radius:12px;padding:24px;min-width:320px;max-width:420px;box-shadow:0 8px 32px rgba(0,0,0,.4)">'
    +'<div style="font-size:15px;font-weight:700;margin-bottom:16px">Pagar liquidación</div>'
    +'<div style="margin-bottom:12px"><div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:4px">Vendedor / Semana</div>'
    +'<div style="font-weight:500">'+liq.vend+' · '+liq.semana+'</div></div>'
    +'<div style="margin-bottom:16px"><div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:4px">Total a pagar</div>'
    +'<div style="font-size:20px;font-weight:700;color:var(--color-text-danger)">'+fN(monto,mon==='CUP'||mon==='CUPT'?0:2)+' '+mon+'</div></div>'
    +'<div style="margin-bottom:20px"><label style="font-size:12px;color:var(--color-text-secondary);display:block;margin-bottom:6px">Cuenta de pago</label>'
    +'<select id="pliq-caja" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary);font-size:13px">'+cajaOpts+'</select></div>'
    +'<div style="display:flex;gap:8px;justify-content:flex-end">'
    +'<button class="btn-sm" onclick="this.closest(\"[style*=fixed]\").remove()">Cancelar</button>'
    +'<button class="btn btn-p" onclick="confirmarPagarLiq('+i+',this)">Confirmar pago</button>'
    +'</div></div>';
  document.body.appendChild(overlay);
}

function confirmarPagarLiq(i, btn) {
  var liq = liquidaciones[i];
  var cta = document.getElementById('pliq-caja')?.value;
  if(!cta){showToast('Selecciona una cuenta','error');return;}
  btn.closest('[style*="fixed"]').remove();
  var mon = liq.mon || 'CUP';
  var monto = liq.totalCUP || liq.comCUP || 0;
  liq.estado = 'Pagado';
  liq.cuenta = cta;
  liq.fechaPago = today();
  // Descontar de la caja
  var cajaObj = typeof _cajasData!=='undefined'?_cajasData.find(function(c){return c.nombre===cta;}):null;
  if(cajaObj){
    cajaObj.saldo = (cajaObj.saldo||0) - monto;
    // Save mov_cajas
    var movCaja = {fecha:today(),tipo:'retiro',
      caja_origen:cta,caja_destino:null,
      monto_origen:monto,monto_destino:monto,
      tasa_usada:null,
      notas:'Comisión '+liq.vend+' '+liq.semana,
      usuario:(typeof S!=='undefined'&&S.user)||'Admin'};
    if(typeof _cajasMovs!=='undefined') _cajasMovs.unshift(movCaja);
    if(typeof _supaWrite==='function') _supaWrite('POST','mov_cajas',movCaja);
    else if(typeof supaReq!=='undefined'&&_supaOnline) supaReq('POST','mov_cajas',movCaja).catch(function(e){});
    if(typeof renderCajas==='function')try{renderCajas();}catch(e){}
  }
  // I/G movement
  if(typeof MOVS!=='undefined'){
    MOVS.unshift({id:Date.now(),fecha:today(),tipo:'Comision vendedor',
      desc:'Pago Liq. '+liq.vend+' '+liq.semana,
      vend:liq.vend,alm:liq.alm,monto:monto,mon:mon,
      equivUSD:parseFloat((mon==='CUP'?monto/(RATES.CUP||512.88):monto).toFixed(2)),
      cta:cta,sentido:'gasto',notas:'',ts:new Date().toISOString()});
    try{localStorage.setItem('erp_movs',JSON.stringify(MOVS));}catch(e){}
    if(typeof _supaWrite==='function') {
      _supaWrite('POST','movimientos_ig',{
        fecha:today(),tipo:'Comision vendedor',descripcion:'Pago Liq. '+liq.vend+' '+liq.semana,
        monto:parseFloat(parseFloat(monto).toFixed(4)),moneda:mon,
        equiv_usd:parseFloat((mon==='CUP'?monto/(RATES.CUP||512.88):monto).toFixed(4)),
        cuenta:cta, vendedor:liq.vend, notas:''
      });
    }
  }
  // Match ventas by date range + almacén + vendedor (liqId not always set)
  var liqDesde=liq.desde||''; var liqHasta=liq.hasta||''; var liqAlm=liq.alm||'';
  var ventasLiq=VENTAS.filter(function(v){
    if(v.liqId&&liq.id&&v.liqId===liq.id) return true; // exact match
    var dateOk = (!liqDesde||v.fecha>=liqDesde) && (!liqHasta||v.fecha<=liqHasta);
    var almOk  = !liqAlm||liqAlm==='Todos'||v.alm===liqAlm;
    var vendOk = !liq.vend||v.vend===liq.vend;
    var pdteOk = !v.estCom||v.estCom===''||v.estCom==='Pendiente'||v.estCom==='Liquidada (Pdte)';
    return dateOk&&almOk&&vendOk&&pdteOk;
  });

  // Deduct from each caja based on actual payment data
  var cajaDeductions={};
  ventasLiq.forEach(function(v){
    var pagos=(v.pagos&&v.pagos.length)?v.pagos:[{mon:v.mon||'CUP',caja:cta,m:(v.mon==='USD'?v.totalUSD:fromUSD(v.totalUSD,v.mon||'CUP'))}];
    pagos.forEach(function(p){
      var cajaNom=p.caja||cta;
      var amt=p.monto!=null?p.monto:(p.m!=null?p.m:0);
      var pct=v.comPct||0;
      var comAmt=parseFloat((amt*pct/100).toFixed(2));
      if(!cajaDeductions[cajaNom]) cajaDeductions[cajaNom]=0;
      cajaDeductions[cajaNom]+=comAmt;
    });
  });

  // Apply deductions to each caja via mov_cajas (same pattern as rest of app)
  var _movPromises = [];
  Object.keys(cajaDeductions).forEach(function(cajaNom){
    var comAmt = parseFloat(cajaDeductions[cajaNom].toFixed(2));
    if(comAmt <= 0) return;
    var cajaObj = typeof _cajasData!=='undefined'?_cajasData.find(function(c){return c.nombre===cajaNom;}):null;
    // Update local saldo
    if(cajaObj) cajaObj.saldo = parseFloat(((cajaObj.saldo||0) - comAmt).toFixed(2));
    // Register mov_cajas — this is the source of truth for saldo
    var movCaja = {
      fecha: today(),
      tipo: 'Pago comisión',
      caja_origen: cajaNom,
      caja_origen_id: cajaObj?cajaObj.id:null,
      caja_destino: null,
      caja_destino_id: null,
      monto_origen: comAmt,
      monto_destino: null,
      tasa_usada: RATES.CUP||512.88,
      notas: 'Comisión '+liq.vend+' '+(liq.semana||''),
      usuario: typeof S!=='undefined'?S.user:'',
      created_at: new Date().toISOString()
    };
    if(typeof supaReq!=='undefined'&&_supaOnline){
      _movPromises.push(
        supaReq('POST','mov_cajas',movCaja)
          .then(function(r){ if(r.ok&&cajaObj&&cajaObj.id){
            // Also patch caja saldo directly for immediate consistency
            supaReq('PATCH','cajas?id=eq.'+cajaObj.id,{saldo:cajaObj.saldo}).catch(function(e){});
          }})
          .catch(function(e){console.warn('mov_cajas liq:',e);})
      );
    }
  });
  Promise.all(_movPromises).then(function(){
    if(typeof loadCajasData==='function') loadCajasData().then(function(){
      if(typeof renderCajas==='function')try{renderCajas();}catch(e){}
    });
  });

  // Mark ventas as Pagada
  ventasLiq.forEach(function(v){
    v.estCom='Pagada';
    v.liqId=liq.id;
    if(typeof supaReq!=='undefined'&&_supaOnline&&v.supaId){
      supaReq('PATCH','ventas?id=eq.'+v.supaId,{est_com:'Pagada'}).catch(function(e){});
    }
  });
  if(typeof offlineSaveVentas==='function') offlineSaveVentas();
  if(typeof renderVentas==='function')try{renderVentas();}catch(e){}

  try{localStorage.setItem('erp_liquidaciones',JSON.stringify(liquidaciones));}catch(e){}
  if(typeof supaReq!=='undefined'&&_supaOnline){
    supaReq('PATCH','liquidaciones?id=eq.'+liq.id,{estado:'Pagado',cuenta:cta}).catch(function(e){});
  }
  refreshLiqHist();
  renderLiq();
  var cajasStr=Object.keys(cajaDeductions).map(function(k){return fN(cajaDeductions[k],0)+' de '+k;}).join(', ');
  showToast('✓ Liquidación pagada · '+ventasLiq.length+' ventas · '+cajasStr);
}

function eliminarLiq(i) {
  var liq = liquidaciones[i];
  var wasPaid = liq.estado==='Pagado';
  if(!confirm('¿Eliminar esta liquidación?'+(wasPaid?' El saldo será reintegrado a la caja.':''))) return;

  // Restore caja saldo if was paid
  if(wasPaid) {
    var liqDesde=liq.desde||''; var liqHasta=liq.hasta||''; var liqAlm=liq.alm||'';
    // Re-calculate per-caja deductions from ventas to reverse exactly
    var ventasLiq=VENTAS.filter(function(v){
      var dateOk=(!liqDesde||v.fecha>=liqDesde)&&(!liqHasta||v.fecha<=liqHasta);
      var almOk=!liqAlm||liqAlm==='Todos'||v.alm===liqAlm;
      var vendOk=!liq.vend||v.vend===liq.vend;
      return dateOk&&almOk&&vendOk&&(v.estCom==='Pagada'||v.liqId===liq.id);
    });
    var amt = liq.totalCUP || liq.comCUP || 0;
    var cajaNom = liq.cuenta;
    if(cajaNom && amt > 0) {
      var cajaObj=typeof _cajasData!=='undefined'?_cajasData.find(function(c){return c.nombre===cajaNom;}):null;
      if(cajaObj) cajaObj.saldo=parseFloat(((cajaObj.saldo||0)+amt).toFixed(2));
      var movRev={fecha:today(),tipo:'deposito',
        caja_origen:null,
        caja_destino:cajaNom,
        monto_origen:amt,monto_destino:amt,
        tasa_usada:null,
        notas:'Reversión liq. '+liq.vend+' '+(liq.semana||''),
        usuario:(typeof S!=='undefined'&&S.user)||'Admin'};
      if(typeof _cajasMovs!=='undefined') _cajasMovs.unshift(movRev);
      if(typeof _supaWrite==='function') _supaWrite('POST','mov_cajas',movRev);
      else if(typeof supaReq!=='undefined'&&_supaOnline) supaReq('POST','mov_cajas',movRev).catch(function(e){});
      if(typeof supaReq!=='undefined'&&_supaOnline&&cajaObj&&cajaObj.id) supaReq('PATCH','cajas?id=eq.'+cajaObj.id,{saldo:cajaObj.saldo}).catch(function(e){});
    }
    
    // Add Reversal to I/G to keep a record
    var _notasRev = 'Reversión liq. '+liq.vend+' '+(liq.semana||'');
    var _mon = liq.mon || 'CUP';
    var _equivUSD = parseFloat((_mon==='CUP'?amt/(RATES.CUP||512.88):amt).toFixed(2));
    if(typeof MOVS!=='undefined'){
      MOVS.unshift({id:Date.now(),fecha:today(),tipo:'Ingreso no-venta',
        desc:_notasRev,
        vend:liq.vend,alm:liq.alm,monto:amt,mon:_mon,
        equivUSD:_equivUSD,
        cta:cajaNom,sentido:'ingreso',notas:'',ts:new Date().toISOString()});
      try{localStorage.setItem('erp_movs',JSON.stringify(MOVS));}catch(e){}
    }
    if(typeof _supaWrite==='function'){
      _supaWrite('POST','movimientos_ig',{
        fecha:today(),tipo:'Ingreso no-venta',descripcion:_notasRev,
        monto:parseFloat(parseFloat(amt).toFixed(4)),moneda:_mon,
        equiv_usd:parseFloat((_mon==='CUP'?amt/(RATES.CUP||512.88):amt).toFixed(4)),
        cuenta:cajaNom, vendedor:liq.vend, notas:''
      });
    }

    // Revert ventas to Pendiente
    ventasLiq.forEach(function(v){
      v.estCom='Pendiente'; delete v.liqId;
      if(typeof supaReq!=='undefined'&&_supaOnline&&v.supaId)
        supaReq('PATCH','ventas?id=eq.'+v.supaId,{est_com:'Pendiente'}).catch(function(e){});
    });
    if(typeof renderCajas==='function')try{renderCajas();}catch(e){}
    if(typeof renderVentas==='function')try{renderVentas();}catch(e){}
  }

  liquidaciones.splice(i, 1);
  try{localStorage.setItem('erp_liquidaciones',JSON.stringify(liquidaciones));}catch(e){}
  if(typeof supaReq!=='undefined'&&_supaOnline){
    supaReq('DELETE','liquidaciones?id=eq.'+liq.id).catch(function(e){});
  }
  if(typeof offlineSaveVentas==='function') offlineSaveVentas();
  refreshLiqHist();
  renderLiq();
  showToast('Liquidación eliminada'+(wasPaid?' · saldo reintegrado':''));
}
function exportLiqCSV(){
  const desde=document.getElementById('l-desde').value;
  const hasta=document.getElementById('l-hasta').value;
  const alm=document.getElementById('l-alm').value;
  const data=VENTAS.filter(v=>{
    if(desde&&v.fecha<desde)return false;
    if(hasta&&v.fecha>hasta)return false;
    if(alm&&v.alm!==alm)return false;
    return true;
  });
  let csv='Fecha,Vendedor,Almacén,Tipo,Total USD,Moneda,% Com.,Com. USD,Estado\n';
  data.forEach(v=>{csv+=`${v.fecha},${v.vend},${v.alm},${v.tipo},${v.totalUSD},${v.mon},${v.comPct},${v.comUSD},${v.estCom}\n`;});
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='liquidacion.csv';a.click();
}

// ── NUEVA VENTA ───────────────────────────────────────────
function updNvCom(){
  const vend=document.getElementById('nv-vend')?.value||'Keiler';
  const alm=document.getElementById('nv-alm')?.value||'Habana';
  const defPct=(COM_DEF[vend]||{})[alm]||4;
  const pctEl=document.getElementById('nv-com-pct');
  if(!pctEl.value||pctEl.dataset.auto!=='false')pctEl.value=defPct;
  document.getElementById('nv-com-hint').textContent=`def. ${defPct}%`;
  const total=parseFloat(document.getElementById('nv-total')?.value)||0;
  const pct=parseFloat(pctEl.value)||0;
  document.getElementById('nv-com-usd').value=(total*pct/100).toFixed(2);
}
function registrarVenta(){
  const fecha=document.getElementById('nv-fecha').value||today();
  const vend=document.getElementById('nv-vend').value;
  const alm=document.getElementById('nv-alm').value;
  const cli=document.getElementById('nv-cli').value;
  const tipo=document.getElementById('nv-tipo').value;
  const mon=document.getElementById('nv-mon').value;
  const prods=document.getElementById('nv-prods').value||'—';
  const totalUSD=parseFloat(document.getElementById('nv-total').value)||0;
  const comPct=parseFloat(document.getElementById('nv-com-pct').value)||0;
  const comUSD=parseFloat((totalUSD*comPct/100).toFixed(2));
  const estCom=document.getElementById('nv-estcom').value;
  const nota=document.getElementById('nv-nota').value;
  if(!totalUSD){alert('Introduce el total en USD');return;}
  const v_new={id:venNextId++,fecha,vend,alm,cli,tipo,mon,prods,totalUSD,
    comPct:estCom==='No aplica'?0:comPct,
    comUSD:estCom==='No aplica'?0:comUSD,
    comDetalle:estCom==='No aplica'?{}:{[mon]:comUSD},
    estCom,nota};
  VENTAS.unshift(v_new);
  if(typeof syncSaveVenta==='function') syncSaveVenta(v_new);
  // Telegram notification
  (function(){
    var _tgCaja = v_new.caja||(v_new.mon&&v_new.alm?v_new.mon+' '+v_new.alm:v_new.mon||'');
    var _tgMsg='\uD83D\uDCCA <b>Venta manual</b>\n'
      +'\uD83D\uDC64 '+v_new.vend+' \u2022 '+v_new.alm+'\n'
      +'\uD83D\uDED2 '+v_new.cli+'\n'
      +'\uD83D\uDCB5 <b>'+fN(v_new.totalUSD)+' USD</b>\n'
      +'\uD83C\uDFE6 Cobro: '+_tgCaja+'\n'
      +(v_new.prods?'\uD83D\uDCE6 '+v_new.prods:'')
      +(v_new.nota?'\n\uD83D\uDCDD '+v_new.nota:'');
    if(typeof tgSend==='function') tgSend(_tgMsg, v_new.alm, 'venta');
  })();
  document.getElementById('nv-com-pct').value='';
  document.getElementById('nv-com-usd').value='';
  showToast('Venta registrada');
  document.querySelectorAll('.nav button')[0].click();
  setRange('todo');
}


// ── INIT ─────────────────────────────────────────────────
document.getElementById('f-desde').value='2025-01-01';
document.getElementById('f-hasta').value='2026-12-31';
document.getElementById('c-desde').value='2025-01-01';
document.getElementById('c-hasta').value='2026-12-31';
setRangeLiq();
initChkAll();
renderVentas();

async function renderMiCaja() {
  var el = document.getElementById('micaja-root');
  if (!el) return;
  var user = typeof S !== 'undefined' ? S.user : '';
  var alm  = USERS[user] ? USERS[user].almacen : '';
  if (!alm) { el.innerHTML = '<div style="padding:20px;text-align:center">Sin almacén asignado</div>'; return; }

  el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--color-text-tertiary)">⏳ Cargando caja...</div>';

  // Load fresh data — identical to renderCajas
  if (typeof loadCajasData === 'function') await loadCajasData();

  var RATES_USD = {USD:1, EUR:1/RATES.EUR, CUP:1/RATES.CUP, CUPT:1/RATES.CUPT};
  var monIcon   = {USD:'$', EUR:'€', CUP:'₱', CUPT:'\u20b1'};

  // Build cajas — EXACT same logic as renderCajas but forced to vendedor's alm
  var cajas = [];
  if (typeof _cajasData !== 'undefined' && _cajasData.length) {
    cajas = _cajasData
      .filter(function(c){ return c.activa && c.almacen === alm; })
      .map(function(c){
        var saldo = typeof _getSaldoCaja==='function' ? _getSaldoCaja(c.nombre) : parseFloat(c.saldo_inicial||0);
        // Add POS ventas not yet in mov_cajas (same dedup as renderCajas)
        var ventasEnCaja = (typeof VENTAS!=='undefined'?VENTAS:[])
          .filter(function(v){ return v.pagos && v.pagos.some(function(p){ return (p.caja||p.mon+' '+v.alm)===c.nombre; }); })
          .reduce(function(acc,v){
            (v.pagos||[]).forEach(function(p){
              if((p.caja||p.mon+' '+v.alm)===c.nombre){
                var alreadyCounted = _cajasMovs.some(function(m){
                  return m.notas==='Venta POS' && m.caja_destino===c.nombre &&
                    Math.abs(parseFloat(m.monto_destino)-p.m)<0.01;
                });
                if(!alreadyCounted) acc += (p.m||0);
              }
            });
            return acc;
          }, 0);
        saldo += ventasEnCaja;
        return { cta:c.nombre, mon:c.moneda, saldo:saldo, equivUSD:saldo*(RATES_USD[c.moneda]||1) };
      });
  } else {
    // Fallback offline
    cajas = Object.entries(CUENTAS_BASE)
      .filter(function(e){ return e[0].indexOf(alm)>=0; })
      .map(function(entry){
        var cta=entry[0], v=entry[1];
        var saldo=(v.ingV||0)+(v.ingIG||0)-(v.gasIG||0);
        return {cta:cta, mon:v.mon, saldo:saldo, equivUSD:saldo*(RATES_USD[v.mon]||1)};
      });
  }

  // Cards — same style as renderCajas
  var cardsHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:16px">';
  cajas.forEach(function(c){
    var pos   = c.saldo >= 0;
    var color = pos ? 'var(--color-text-success)' : 'var(--color-text-danger)';
    var dec   = (c.mon==='CUP'||c.mon==='CUPT') ? 0 : 2;
    var icon  = monIcon[c.mon]||'';
    // Show sub-name if caja name differs from "MON Alm" pattern (e.g. "USD Abanca" vs "USD Habana")
    // Extract sub-label: remove moneda prefix and almacen suffix
    var _ctaFull = (c.cta||'').toUpperCase();
    var _monPfx = (c.mon||'').toUpperCase()+' ';
    var _almSfx = (alm||'').toUpperCase();
    var _ctaShort = _ctaFull.startsWith(_monPfx) ? _ctaFull.slice(_monPfx.length) : _ctaFull;
    if(_ctaShort === _almSfx) _ctaShort = '';
    var _showLabel = _ctaShort.length > 0 && _ctaShort !== _almSfx;
    cardsHtml += '<div class="card" style="padding:14px 12px;text-align:center">'
      + '<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:4px;font-weight:600;letter-spacing:.05em">'+c.mon+(_showLabel?' · '+_ctaShort:'')+'</div>'
      + '<div style="font-size:clamp(13px,3vw,20px);font-weight:800;color:'+color+';word-break:break-all;line-height:1.2">'+icon+' '+fN(c.saldo,dec)+'</div>'
      + '<div style="font-size:10px;color:var(--color-text-tertiary);margin-top:5px">≈ '+fN(c.equivUSD,2)+' USD</div>'
      + '</div>';
  });
  cardsHtml += '</div>';

  if (!cajas.length) {
    cardsHtml = '<div style="padding:20px;text-align:center;color:var(--color-text-tertiary)">Sin cajas asignadas a '+alm+'</div>';
  }

  // Movements — filtered to this alm's cajas
  var ctaNames = cajas.map(function(c){ return c.cta; });
  var allMovs = (typeof _cajasMovs!=='undefined'?_cajasMovs:[])
    .filter(function(m){
      return ctaNames.indexOf(m.caja_origen)>=0 || ctaNames.indexOf(m.caja_destino)>=0;
    })
    .map(function(m){
      var esDest  = ctaNames.indexOf(m.caja_destino)>=0;
      var monto   = esDest ? parseFloat(m.monto_destino||0) : parseFloat(m.monto_origen||0);
      var cajaNom = esDest ? m.caja_destino : m.caja_origen;
      var ts      = m.created_at||m.fecha||'';
      return {
        _ts: ts, fecha: ts.substring(0,10),
        desc: m.notas||m.tipo||'Movimiento',
        sub:  cajaNom,
        monto: fN(monto, cajaNom&&(cajaNom.startsWith('CUP')||cajaNom.startsWith('CUPT'))?0:2),
        mon:  cajaNom ? cajaNom.split(' ')[0] : '',
        sentido: esDest ? 'ingreso' : 'gasto'
      };
    })
    .sort(function(a,b){ return b._ts.localeCompare(a._ts); });

  var movsHtml = '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
    + '<h3 style="margin:0">Movimientos</h3>'
    + '<button class="btn-sm" onclick="renderMiCaja()">🔄 Actualizar</button>'
    + '</div>';
  if (!allMovs.length) {
    movsHtml += '<div style="color:var(--color-text-tertiary);font-size:12px;text-align:center;padding:20px">Sin movimientos registrados</div>';
  } else {
    movsHtml += '<div style="display:flex;flex-direction:column;gap:2px">';
    allMovs.forEach(function(m){
      var col  = m.sentido==='ingreso' ? 'var(--color-text-success)' : 'var(--color-text-danger)';
      var sign = m.sentido==='ingreso' ? '+' : '−';
      movsHtml += '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:.5px solid var(--color-border-tertiary)">'
        + '<div><div style="font-size:12px">'+m.desc+'</div>'
        + '<div style="font-size:10px;color:var(--color-text-tertiary)">'+fD(m.fecha)+(m.sub?' · '+m.sub:'')+'</div></div>'
        + '<div style="font-size:13px;font-weight:600;color:'+col+';flex-shrink:0;margin-left:10px">'+sign+m.monto+' '+m.mon+'</div>'
        + '</div>';
    });
    movsHtml += '</div>';
  }
  movsHtml += '</div>';

  el.innerHTML = '<div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">'
    + '<div><h2 style="margin:0">Mi Caja — '+alm+'</h2>'
    + '<div style="font-size:12px;color:var(--color-text-secondary)">'+user+'</div></div>'
    + '</div>'
    + cardsHtml + movsHtml;
}

