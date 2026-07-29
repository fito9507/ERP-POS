


const COLORES=[
  {bg:'var(--color-background-info)',tc:'var(--color-text-info)',id:'info'},
  {bg:'var(--color-background-warning)',tc:'var(--color-text-warning)',id:'warn'},
  {bg:'var(--color-background-success)',tc:'var(--color-text-success)',id:'succ'},
  {bg:'var(--color-background-danger)',tc:'var(--color-text-danger)',id:'dang'},
  {bg:'var(--color-background-secondary)',tc:'var(--color-text-secondary)',id:'sec'},
];
var PRODS_NAMES = [];
function _getProdNames(alm){
  return PRODS.filter(function(p){
    if(p.activo===false) return false;
    if(!alm) return true;
    // Include if has stock in this almacen
    var stk = p.stk_alm&&p.stk_alm[alm]!=null ? p.stk_alm[alm] : (p.stk||0);
    // Include if in transit for this almacen
    var inTransit = p.enTransito&&p.enTransito[alm];
    return stk > 0 || inTransit;
  }).sort(function(a,b){return a.n.localeCompare(b.n, undefined, {numeric: true});}).map(function(p){return p.n;});
}
const ICON={efectivo:'💵',arancel:'📋',flete:'🚛',estiba:'📦',interes:'📈',viaje:'🚗',otro:'•'};
const HINTS={efectivo:'Cash, transferencia, FM...',arancel:'Aranceles, impuestos aduana',flete:'Flete marítimo o terrestre',estiba:'Carga, descarga',interes:'Intereses de financiación',viaje:'Viajes, desplazamientos',otro:''};

// ── DATOS ─────────────────────────────────────────────────
let CLIENTES=[];
// Load clientes from localStorage
(function(){
  try{
    var _c=JSON.parse(localStorage.getItem('erp_clientes_cache')||'[]');
    if(_c&&_c.length){ CLIENTES=_c;
      nextCid=_c.reduce(function(a,c){var n=parseInt((c.id||'c0').replace('c',''));return Math.max(a,n);},0)+1;
      nextFid=_c.reduce(function(a,c){return c.folios?c.folios.reduce(function(b,f){var n=parseInt(f.id||'0');return Math.max(b,n);},a):a;},0)+1;
      nextAid=_c.reduce(function(a,c){return c.folios?c.folios.reduce(function(b,f){return f.abonos?f.abonos.reduce(function(d,ab){var n=parseInt((ab.id||'a0').replace('a',''));return Math.max(d,n);},b):b;},a):a;},0)+1;
    }
  }catch(e){}
})();;
let nextCid=1,nextFid=1,nextAid=1;
let colorSel='info';
let activoCli=null; // id cliente activo
let nfLineas=[];
let cajaOn=false,equivManual=false;
let folioFiltro='todos';

// ── CALCULOS ──────────────────────────────────────────────
function totF(f){return (f.lineas||f.productos||[]).reduce((a,l)=>a+toUSD((l.q||l.cantidad||0)*(l.precio||l.price||0),l.mon||'USD'),0);}
function pagF(f){return (f.abonos||[]).reduce((a,ab)=>a+(ab.equivUSD||0),0);}
function pdtF(f){return Math.max(0,totF(f)-pagF(f));}
function estF(f){const p=pdtF(f);if(p<0.01)return'pagado';if(pagF(f)<0.01)return'pendiente';return'parcial';}
function totCli(c){return c.folios.reduce((a,f)=>a+totF(f),0);}
function pagCli(c){return c.folios.reduce((a,f)=>a+pagF(f),0);}
function pdtCli(c){return Math.max(0,totCli(c)-pagCli(c));}
const EC={pagado:'bg',pendiente:'br',parcial:'ba'};
const EL={pagado:'Pagado',pendiente:'Pendiente',parcial:'Parcial'};
function getColor(id){return COLORES.find(c=>c.id===id)||COLORES[0];}

// ── NAV PRINCIPAL ─────────────────────────────────────────
function navTo(pg,btn){
  document.querySelectorAll('#mod-clientes .page').forEach(p=>p.classList.remove('act'));
  document.getElementById(pg).classList.add('act');
  document.querySelectorAll('#mod-clientes .nav button').forEach(b=>b.classList.remove('act'));
  if(btn)btn.classList.add('act');
  if(pg==='lista'){activoCli=null;renderLista();}
  if(pg==='ficha'&&activoCli)renderFicha();
}

// ── FICHA NAV ─────────────────────────────────────────────
function fichaNavTo(pg){
  ['f-cuenta','f-folios','f-abonar','f-nuevo-folio'].forEach(id=>document.getElementById(id).classList.remove('act'));
  document.getElementById(pg).classList.add('act');
  document.querySelectorAll('#ficha-nav button').forEach(b=>b.classList.remove('act'));
  document.getElementById('fn-'+pg.replace('f-','')).classList.add('act');
  const c=CLIENTES.find(x=>x.id===activoCli);if(!c)return;
  if(pg==='f-cuenta')renderFichaCuenta(c);
  if(pg==='f-folios')renderFichaFolios(c);
  if(pg==='f-abonar')renderFichaAbonar(c);
  if(pg==='f-nuevo-folio')renderFichaNF(c);
}

function abrirCliente(cid){
  activoCli=cid;
  // mostrar página ficha
  document.querySelectorAll('.wrap>.page').forEach(p=>p.classList.remove('act'));
  document.getElementById('ficha').classList.add('act');
  document.querySelectorAll('#mod-clientes .nav button').forEach(b=>b.classList.remove('act'));
  renderFicha();
}

function eliminarCliente(cid){
  var c=CLIENTES.find(function(x){return x.id===cid;});
  if(!c)return;
  if(!confirm('¿Eliminar cliente "'+c.nombre+'"? Sus folios y abonos también se eliminarán.'))return;
  CLIENTES=CLIENTES.filter(function(x){return x.id!==cid;});
  offlineSaveClientes();
  // Delete from Supabase
  if(_supaOnline&&typeof supaReq!=='undefined'){
    supaReq('DELETE','abonos?cliente_id=eq.'+cid).catch(function(e){});
    supaReq('DELETE','folios?cliente_id=eq.'+cid).catch(function(e){});
    supaReq('DELETE','clientes?id=eq.'+cid).catch(function(e){});
  }
  showToast('Cliente eliminado: '+c.nombre);
  navTo('lista',document.querySelectorAll('#main-nav button')[0]);
}

function renderFicha(){
  const c=CLIENTES.find(x=>x.id===activoCli);if(!c)return;
  const col=getColor(c.color);
  // nav de la ficha
  var _isAdmCli=typeof S!=='undefined'&&S.user&&USERS[S.user]&&USERS[S.user].rol==='admin';
  document.getElementById('ficha-nav').innerHTML=`
    <button class="btn-sm" onclick="navTo('lista',document.querySelectorAll('#main-nav button')[0])" style="margin-right:6px">← Clientes</button>
    <button id="fn-cuenta" class="act" onclick="fichaNavTo('f-cuenta')">Cuenta</button>
    <button id="fn-folios" onclick="fichaNavTo('f-folios')">Folios</button>
    <button id="fn-abonar" onclick="fichaNavTo('f-abonar')">+ Abonar</button>
    <button id="fn-nuevo-folio" onclick="fichaNavTo('f-nuevo-folio')">+ Nueva venta</button>
    ${(_isAdmCli||c.owner===(S&&S.user))?`<button class="btn-sm" onclick="editarCliente('${c.id}')" style="margin-left:auto">\u270f\ufe0f Editar</button>`:''}
    ${_isAdmCli?`<button class="btn-sm" onclick="eliminarCliente('${c.id}')" style="color:var(--color-text-danger)">🗑 Eliminar</button>`:''}`;
  fichaNavTo('f-cuenta');
}

// ── LISTA ─────────────────────────────────────────────────
function renderLista(){
  const isAdminUser=(typeof S!=='undefined'&&S.user&&USERS[S.user]&&USERS[S.user].rol==='admin');
  const visClientes=isAdminUser?CLIENTES:CLIENTES.filter(c=>!c.owner||c.owner===S.user);
  const totDeuda=visClientes.reduce((a,c)=>a+totCli(c),0);
  const totPdte=visClientes.reduce((a,c)=>a+pdtCli(c),0);
  const totPag=totDeuda-totPdte;
  const nActivos=visClientes.filter(c=>c.folios.some(f=>estF(f)!=='pagado')).length;
  document.getElementById('lista-metrics').innerHTML=`
    <div class="metric"><div class="lbl">Clientes</div><div class="val">${visClientes.length}</div><div class="sub">${nActivos} con deuda activa</div></div>
    <div class="metric"><div class="lbl">Deuda total</div><div class="val">${fN(totDeuda)}</div><div class="sub">USD equiv.</div></div>
    <div class="metric"><div class="lbl">Total abonado</div><div class="val" style="color:var(--color-text-success)">${fN(totPag)}</div><div class="sub">USD equiv.</div></div>
    <div class="metric"><div class="lbl">Pendiente global</div><div class="val" style="color:var(--color-text-danger)">${fN(totPdte)}</div><div class="sub">USD equiv.</div></div>`;

  document.getElementById('clientes-grid').innerHTML=visClientes.map(c=>{
  const tot=totCli(c),pag=pagCli(c),pdt=pdtCli(c);
    const credito=pag>tot+0.01?pag-tot:0; // saldo a favor
    const pct=tot>0?Math.round(pag/tot*100):0;
    const col=getColor(c.color);
    const nFolios=c.folios.length;
    const nPdte=c.folios.filter(f=>estF(f)!=='pagado'&&f.tipo!=='credito_anticipado').length;
    const totActivo=c.folios.filter(f=>estF(f)!=='pagado').reduce((a,f)=>a+totF(f),0);
    const pctActivo=totActivo>0?Math.round((Math.max(0, totActivo-pdt))/totActivo*100):(credito>0?100:100);
    var _badge;
    if(credito>0){
      _badge='<span class="badge" style="background:rgba(34,197,94,.18);color:#4ade80;border:1px solid rgba(74,222,128,.3)">💰 '+fN(credito)+' USD</span>';
    } else if(nPdte>0){
      _badge='<span class="badge br">'+nPdte+' pdte</span>';
    } else {
      _badge='<span class="badge bg">Liquidado</span>';
    }
    return `<div class="cli-card" onclick="abrirCliente('${c.id}')">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div class="cli-avatar" style="background:${col.bg};color:${col.tc}">${c.nombre[0].toUpperCase()}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:500">${c.nombre}</div>
          <div style="font-size:11px;color:var(--color-text-secondary)">${c.alm}${c.tel?' · '+c.tel:''}</div>
        </div>
        ${_badge}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;gap:8px">
        <span style="color:var(--color-text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="Facturado: ${fN(tot)}">Facturado: ${fN(parseFloat(tot.toFixed(2)))}</span>
        ${credito>0
          ? `<span style="color:#4ade80;font-weight:500;white-space:nowrap;text-align:right">+${fN(parseFloat(credito.toFixed(2)))} USD a favor</span>`
          : `<span style="color:var(--color-text-danger);font-weight:500;white-space:nowrap;text-align:right">Pdte: ${fN(parseFloat(pdt.toFixed(2)))} / ${fN(parseFloat(totActivo.toFixed(2)))} USD</span>`
        }
      </div>
      <div class="pay-bar"><div class="pay-bar-fill" style="width:${pctActivo}%;${credito>0?'background:linear-gradient(90deg,#22c55e,#4ade80)':''}"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--color-text-tertiary)">
        <span>${credito>0?'Crédito a favor':(nPdte>0?pctActivo+'% de deuda actual':'100% liquidado')}</span><span>${nFolios} folio(s)</span>
      </div>
      ${c.notas?`<div style="font-size:11px;color:var(--color-text-tertiary);margin-top:6px;border-top:.5px solid var(--color-border-tertiary);padding-top:6px">${c.notas}</div>`:''}
    </div>`;
  }).join('');
}

// ── FICHA — CUENTA ────────────────────────────────────────
function renderFichaCuenta(c){
  const tot=totCli(c),pag=pagCli(c),pdt=pdtCli(c),pct=tot>0?Math.round(pag/tot*100):0;
  const credito=pag>tot+0.01?pag-tot:0;
  const totActivo=c.folios.filter(f=>estF(f)!=='pagado').reduce((a,f)=>a+totF(f),0);
  const pctActivo=totActivo>0?Math.round((Math.max(0, totActivo-pdt))/totActivo*100):(credito>0?100:100);
  const col=getColor(c.color);
  const all=[];c.folios.forEach(f=>(f.abonos||[]).forEach(a=>all.push({...a,folio:f.id})));
  all.sort((a,b)=>b.fecha.localeCompare(a.fecha));
  document.getElementById('f-cuenta-body').innerHTML=`
    <div class="card" style="padding:14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div class="cli-avatar" style="width:50px;height:50px;font-size:20px;background:${col.bg};color:${col.tc}">${c.nombre[0].toUpperCase()}</div>
        <div style="flex:1">
          <div style="font-size:17px;font-weight:500">${c.nombre}</div>
          <div style="font-size:11px;color:var(--color-text-secondary)">${c.alm}${c.tel?' · '+c.tel:''}${c.notas?' · '+c.notas:''}</div>
        </div>
        <button class="btn-sm" onclick="fichaNavTo('f-abonar')">+ Registrar abono</button>
      </div>
    </div>
    <div class="g4" style="margin-bottom:10px">
      <div class="metric"><div class="lbl">Total facturado</div><div class="val">${fN(parseFloat(tot.toFixed(2)))}</div><div class="sub">USD · ${c.folios.length} folio(s)</div></div>
      <div class="metric"><div class="lbl">Abonado</div><div class="val" style="color:var(--color-text-success)">${fN(parseFloat(pag.toFixed(2)))}</div><div class="sub">USD equiv.</div></div>
      ${credito>0
        ? `<div class="metric"><div class="lbl">Crédito a favor</div><div class="val" style="color:#4ade80">+${fN(parseFloat(credito.toFixed(2)))}</div><div class="sub">USD adelantado</div></div>`
        : `<div class="metric"><div class="lbl">Pendiente</div><div class="val" style="color:var(--color-text-danger)">${fN(parseFloat(pdt.toFixed(2)))}</div><div class="sub">USD equiv.</div></div>`
      }
      <div class="metric"><div class="lbl">Progreso</div><div class="val">${credito>0?'✓':pctActivo+'%'}</div><div class="sub">${credito>0?'Con crédito':'de deuda actual'}</div></div>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span class="lbl" style="margin:0">Progreso deuda actual</span><span style="font-weight:500">${pctActivo}%</span>
      </div>
      <div class="pay-bar"><div class="pay-bar-fill" style="width:${pctActivo}%"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--color-text-secondary)">
        <span>Deuda activa: ${fN(parseFloat(totActivo.toFixed(2)))} USD</span><span>Pendiente: ${fN(parseFloat(pdt.toFixed(2)))} USD</span>
      </div>
    </div>
    <div class="card">
      <h3>Historial de abonos</h3>
      ${all.length?all.map(a=>`
        <div class="abono-row">
          <div class="abono-icon">${ICON[a.concepto]||'•'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:500">${a.desc}</div>
            <div style="font-size:10px;color:var(--color-text-tertiary);margin-top:2px">
              ${fD(a.fecha)} · Folio ${a.folio}${(()=>{var _t=a.tasa||(a.mon!=='USD'&&a.equivUSD>0&&a.monto>0?(a.mon==='EUR'?a.equivUSD/a.monto:a.monto/a.equivUSD):null);return _t?' · tasa '+fN(_t,_t<10?2:0):'';})()}
              ${a.cajaTipo==='efectivo'?'· <span style="color:var(--color-text-success)">💵 Efectivo → '+a.caja+'</span>':''}
              ${a.cajaTipo==='compensacion'?'· <span style="color:var(--color-text-info)">🔄 Compensación ('+a.concepto+')</span>':''}
            </div>
          </div>
          <div style="text-align:right;white-space:nowrap">
            <div style="font-size:13px;font-weight:500;color:var(--color-text-success)">+${fN(a.monto,dFor(a.mon))} ${a.mon}</div>
            ${a.mon!=='USD'?`<div style="font-size:10px;color:var(--color-text-tertiary)">≈${fN(a.equivUSD)} USD</div>`:''}
          </div>
        </div>`).join('')
      :'<div style="color:var(--color-text-tertiary);font-size:12px;text-align:center;padding:12px">Sin abonos</div>'}
    </div>`;
}

// ── FICHA — FOLIOS ────────────────────────────────────────
function renderFichaFolios(c){
  const data=folioFiltro==='todos'?c.folios:c.folios.filter(f=>estF(f)===folioFiltro);
  document.getElementById('f-folios-body').innerHTML=`
    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
      <button class="btn-sm" onclick="folioFiltro='todos';renderFichaFolios(CLIENTES.find(x=>x.id==='${c.id}'))">Todos</button>
      <button class="btn-sm" onclick="folioFiltro='pendiente';renderFichaFolios(CLIENTES.find(x=>x.id==='${c.id}'))">Pendiente</button>
      <button class="btn-sm" onclick="folioFiltro='parcial';renderFichaFolios(CLIENTES.find(x=>x.id==='${c.id}'))">Parcial</button>
      <button class="btn-sm" onclick="folioFiltro='pagado';renderFichaFolios(CLIENTES.find(x=>x.id==='${c.id}'))">Pagado</button>
    </div>
    ${data.map(f=>{
      const tot=totF(f),pag=pagF(f),pdt=pdtF(f),est=estF(f),pct=tot>0?Math.round(pag/tot*100):0;
      return `<div class="folio-card">
        <div class="folio-hdr" onclick="toggleBody('fb-${c.id}-${f.id}')">
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
              <span style="font-size:13px;font-weight:500">Folio ${f.id}</span>
              <span class="badge ${EC[est]}">${EL[est]}</span>
              <span style="font-size:11px;color:var(--color-text-secondary)">${fD(f.fecha)} · ${f.alm}</span>
              ${(typeof S!=='undefined'&&S.user&&USERS[S.user]&&USERS[S.user].rol==='admin')?`<button style="border:none;background:none;cursor:pointer;font-size:15px;margin-left:auto;padding:0" onclick="event.stopPropagation();elimFolioCli('${c.id}','${f.id}')" title="Eliminar Folio y Venta">🗑️</button>`:''}
            </div>
            <div style="font-size:11px;color:var(--color-text-secondary)">${f.desc}</div>
            <div class="pay-bar" style="width:200px;margin:5px 0 2px"><div class="pay-bar-fill" style="width:${pag>tot?100:pct}%;${pag>tot?'background:linear-gradient(90deg,#22c55e,#4ade80)':''}"></div></div>
            <div style="font-size:10px;color:var(--color-text-secondary)">${pag>tot?'Crédito a favor':pct+'%'} · ${f.lineas.length} productos · ${f.abonos.length} abonos</div>
          </div>
          <div style="text-align:right;flex-shrink:0;padding-left:12px">
            <div style="font-size:15px;font-weight:500">${fN(parseFloat(tot.toFixed(2)))} USD</div>
            ${pag>tot+0.01 
              ? `<div style="font-size:12px;color:#4ade80;font-weight:500">A favor: ${fN(parseFloat((pag-tot).toFixed(2)))} USD</div>` 
              : `<div style="font-size:12px;color:var(--color-text-danger);font-weight:500">Pdte: ${fN(parseFloat(pdt.toFixed(2)))} USD</div>`
            }
          </div>
        </div>
        <div class="folio-body" id="fb-${c.id}-${f.id}">
          <div style="padding:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <h4 style="margin:0">Productos</h4>
              <button class="btn-sm" onclick="event.stopPropagation();addLF('${c.id}','${f.id}')">+ línea</button>
            </div>
            <div class="prod-row hdr"><span>Producto</span><span style="text-align:right">Cant.</span><span style="text-align:right">P.unit.</span><span>Mon.</span><span style="text-align:right">Total</span><span></span></div>
            <div id="pl-${c.id}-${f.id}">${renderPL(c,f)}</div>
            <div style="display:flex;justify-content:flex-end;gap:16px;font-size:12px;margin-top:6px">
              <span>Total: <strong>${fN(parseFloat(tot.toFixed(2)))} USD</strong></span>
              <span style="color:var(--color-text-success)">Abonado: <strong>${fN(parseFloat(pag.toFixed(2)))} USD</strong></span>
              ${pag>tot+0.01
                ? `<span style="color:#4ade80">A favor: <strong>${fN(parseFloat((pag-tot).toFixed(2)))} USD</strong></span>`
                : `<span style="color:var(--color-text-danger)">Pdte: <strong>${fN(parseFloat(pdt.toFixed(2)))} USD</strong></span>`
              }
            </div>
          </div>
          <div class="sep" style="margin:0"></div>
          <div style="padding:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <h4 style="margin:0">Abonos</h4>
              <div style="display:flex;gap:6px">
                ${c.folios.some(x => pagF(x) > totF(x) + 0.01 && x.id !== f.id) && pdt > 0.01 ? `<button class="btn-sm" style="border-color:#4ade80;color:#4ade80" onclick="cruzarSaldoFolio('${c.id}','${f.id}')">🔄 Usar saldo a favor</button>` : ''}
                <button class="btn-sm" style="border-color:var(--color-text-success);color:var(--color-text-success)" onclick="irAbonar('${c.id}','${f.id}')">+ Abonar</button>
              </div>
            </div>
            ${f.abonos.length?f.abonos.map(a=>`
              <div class="abono-row">
                <div class="abono-icon" style="font-size:12px">${ICON[a.concepto]||'•'}</div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px">${a.desc}${a.enCaja?` <span class="badge-caja">🏦 ${a.caja}</span>`:''}</div>
                  <div style="font-size:10px;color:var(--color-text-tertiary)">${fD(a.fecha)}${a.tasa?' · tasa '+fN(a.tasa,0):''}</div>
                </div>
                <div style="text-align:right;white-space:nowrap">
                  <div style="font-size:12px;font-weight:500;color:var(--color-text-success)">${fN(a.monto,dFor(a.mon))} ${a.mon}</div>
                  ${a.mon!=='USD'?`<div style="font-size:10px;color:var(--color-text-tertiary)">≈${fN(parseFloat(a.equivUSD.toFixed(2)))} USD</div>`:''}
                </div>
                ${(typeof S!=='undefined'&&S.user&&USERS[S.user]&&USERS[S.user].rol==='admin')?`<button style="border:none;background:none;cursor:pointer;color:var(--color-text-tertiary);font-size:14px;padding:0 4px" onclick="elimA('${c.id}','${f.id}','${a.id}')">×</button>`:''}
              </div>`).join('')
            :'<div style="color:var(--color-text-tertiary);font-size:12px;padding:6px 0">Sin abonos</div>'}
          </div>
        </div>
      </div>`;
    }).join('')||`<div class="card" style="text-align:center;color:var(--color-text-tertiary);padding:20px">Sin folios "${folioFiltro}"</div>`}`;
}
function renderPL(c,f){
  return f.lineas.map((l,i)=>`
    <div class="prod-row">
      <span style="font-size:11px">${l.prod}</span>
      <span><input type="number" class="qi" value="${l.q}" min="0" step="1" onclick="event.stopPropagation()" onchange="event.stopPropagation();updLQ('${c.id}','${f.id}',${i},this.value)"></span>
      <span><input type="number" class="pi" value="${l.precio}" step="0.01" onclick="event.stopPropagation()" onchange="event.stopPropagation();updLP('${c.id}','${f.id}',${i},this.value)"></span>
      <span style="font-size:11px">${l.mon}</span>
      <span style="text-align:right;font-weight:500">${fN(parseFloat(toUSD(l.q*l.precio,l.mon).toFixed(2)))}</span>
      <span>${l.q!==l.qO||l.precio!==l.pO?`<span class="badge ba" style="font-size:9px;cursor:pointer" onclick="restL('${c.id}','${f.id}',${i})">mod</span>`:''}
        <button style="border:none;background:none;cursor:pointer;color:var(--color-text-tertiary);font-size:13px" onclick="elimL('${c.id}','${f.id}',${i})">×</button>
      </span>
    </div>`).join('');
}
function updLQ(cid,fid,i,v){const c=CLIENTES.find(x=>x.id===cid);const f=c?.folios.find(x=>x.id===fid);if(!f)return;f.lineas[i].q=parseFloat(v)||0;if(typeof syncSaveFolio==='function')syncSaveFolio(cid,f);if(typeof offlineSaveClientes==='function')offlineSaveClientes();document.getElementById(`pl-${cid}-${fid}`).innerHTML=renderPL(c,f);renderFichaFolios(c);}
function updLP(cid,fid,i,v){const c=CLIENTES.find(x=>x.id===cid);const f=c?.folios.find(x=>x.id===fid);if(!f)return;f.lineas[i].precio=parseFloat(v)||0;if(typeof syncSaveFolio==='function')syncSaveFolio(cid,f);if(typeof offlineSaveClientes==='function')offlineSaveClientes();document.getElementById(`pl-${cid}-${fid}`).innerHTML=renderPL(c,f);renderFichaFolios(c);}
function restL(cid,fid,i){const c=CLIENTES.find(x=>x.id===cid);const f=c?.folios.find(x=>x.id===fid);if(!f)return;f.lineas[i].q=f.lineas[i].qO;f.lineas[i].precio=f.lineas[i].pO;if(typeof syncSaveFolio==='function')syncSaveFolio(cid,f);if(typeof offlineSaveClientes==='function')offlineSaveClientes();renderFichaFolios(c);}
function elimL(cid,fid,i){
  const c=CLIENTES.find(x=>x.id===cid);
  const f=c?.folios.find(x=>x.id===fid);
  if(!f)return;
  var l=f.lineas[i];
  
  var prod=PRODS.find(p=>p.n===l.prod||p.n===l.n);
  if(prod){
    prod.stk=(prod.stk||0)+l.q;
    if(f.alm){
      if(!prod.stk_alm)prod.stk_alm={};
      prod.stk_alm[f.alm]=(prod.stk_alm[f.alm]||0)+l.q;
      if(typeof syncStockAlmacen==='function'&&prod.supaId){
        syncStockAlmacen(prod.supaId,f.alm,prod.stk_alm[f.alm]);
      }
    }
  }

  f.lineas.splice(i,1);
  if(typeof syncSaveFolio==='function')syncSaveFolio(cid,f);
  if(typeof offlineSaveClientes==='function')offlineSaveClientes();

  var ventas = VENTAS.filter(v=>(v.notas||v.nota||v.desc||'').includes('Folio '+fid));
  if(ventas.length === 1) {
    var v = ventas[0];
    v.prods = f.lineas.map(ln => ln.q+'× '+ln.prod).join(', ');
    v.totalUSD = f.lineas.reduce((a,ln) => a + toUSD(ln.q * ln.precio, ln.mon), 0);
    if(f.lineas.length === 0) {
      VENTAS = VENTAS.filter(x => x.id !== v.id);
      if(typeof _supaOnline!=='undefined' && _supaOnline) { supaReq('DELETE','ventas?id=eq.'+(v.supaId||v.id)).catch(e=>{}); }
    } else {
      if(typeof _supaOnline!=='undefined' && _supaOnline) { supaReq('PATCH','ventas?id=eq.'+(v.supaId||v.id), {prods:v.prods, total_usd:v.totalUSD}).catch(e=>{}); }
    }
    offlineSaveVentas();
    if(typeof renderVentas==='function') renderVentas();
  }

  if(typeof renderProds==='function') renderProds();
  renderFichaFolios(c);
}
function addLF(cid,fid){const c=CLIENTES.find(x=>x.id===cid);const f=c?.folios.find(x=>x.id===fid);if(!f)return;f.lineas.push({prod:_getProdNames()[0]||"",q:1,precio:20,mon:'USD',qO:1,pO:20});if(typeof syncSaveFolio==='function')syncSaveFolio(cid,f);if(typeof offlineSaveClientes==='function')offlineSaveClientes();renderFichaFolios(c);}
function elimFolioCli(cid,fid){
  if(!confirm('¿Eliminar este folio completo? Esto devolverá el stock a los productos y borrará la venta del libro de ventas.')) return;
  const c=CLIENTES.find(x=>x.id===cid);
  const idx=c?.folios.findIndex(x=>x.id===fid);
  if(idx==null||idx<0) return;
  var f=c.folios[idx];
  var targetVenta=VENTAS.find(v=>(v.notas||v.nota||v.desc||'').includes('Folio '+fid));
    if(targetVenta){
    eliminarV(targetVenta.id, true);
  } else {
    if(f.lineas){
      f.lineas.forEach(l=>{
        var prod=PRODS.find(p=>p.n===l.prod||p.n===l.n);
        if(prod){
          prod.stk=(prod.stk||0)+l.q;
          if(f.alm){
            if(!prod.stk_alm)prod.stk_alm={};
            prod.stk_alm[f.alm]=(prod.stk_alm[f.alm]||0)+l.q;
            if(typeof syncStockAlmacen==='function'&&prod.supaId){
              syncStockAlmacen(prod.supaId,f.alm,prod.stk_alm[f.alm]);
            }
          }
        }
      });
      if(typeof renderProds==='function') renderProds();
    }
  }
  // Recalculate idx since eliminarV might have deleted it
  const realIdx=c.folios.findIndex(x=>x.id===fid);
  if(realIdx>=0) {
    c.folios.splice(realIdx,1);
    offlineSaveClientes();
  }
  if(typeof supaReq!=='undefined'&&_supaOnline){
    supaReq('DELETE','folios?id=eq.'+fid).catch(e=>{});
    supaReq('DELETE','abonos?folio_id=eq.'+fid).catch(e=>{});
  } else {
    enqueue({method:'DELETE',path:'folios?id=eq.'+fid});
    enqueue({method:'DELETE',path:'abonos?folio_id=eq.'+fid});
  }
  renderFichaFolios(c);
  showToast('Folio y venta eliminados con éxito');
}
function cruzarSaldoFolio(cid, fid) {
  const c = CLIENTES.find(x => x.id === cid);
  if(!c) return;
  const targetF = c.folios.find(x => x.id === fid);
  if(!targetF) return;
  
  let pdt = pdtF(targetF);
  if(pdt < 0.01) return;

  const overpaidFolios = c.folios.filter(f => pagF(f) > totF(f) + 0.01 && f.id !== fid);
  if(overpaidFolios.length === 0) {
    showToast('No hay folios con saldo a favor para cruzar.');
    return;
  }

  if(!confirm('¿Traspasar saldo a favor desde otros folios para cubrir la deuda pendiente de '+fN(pdt)+' USD?')) return;

  let traspasado = 0;
  for(let i=0; i<overpaidFolios.length && pdt > 0.01; i++) {
    const fOver = overpaidFolios[i];
    const disp = pagF(fOver) - totF(fOver);
    const monto = Math.min(pdt, disp);
    
    const negAb = {
      id: 'a'+(nextAid++), fecha: today(), concepto: 'efectivo',
      desc: 'Traspaso hacia Folio '+fid,
      monto: -monto, mon: 'USD', tasa: null, equivUSD: -monto,
      enCaja: false, caja: null, cajaTipo: null
    };
    fOver.abonos.push(negAb);
    
    const posAb = {
      id: 'a'+(nextAid++), fecha: today(), concepto: 'efectivo',
      desc: 'Traspaso desde Folio '+fOver.id,
      monto: monto, mon: 'USD', tasa: null, equivUSD: monto,
      enCaja: false, caja: null, cajaTipo: null
    };
    targetF.abonos.push(posAb);
    
    pdt -= monto;
    traspasado += monto;
    
    if(typeof syncSaveAbono==='function'){
      syncSaveAbono(c.id, fOver.id, negAb);
      syncSaveAbono(c.id, targetF.id, posAb);
    }
  }
  
  if(typeof offlineSaveClientes==='function') offlineSaveClientes();
  renderFichaFolios(c);
  showToast('Se traspasaron '+fN(traspasado)+' USD con éxito.');
}
function toggleBody(id){document.getElementById(id)?.classList.toggle('open');}
async function elimA(cid,fid,aid){
  if(typeof S!=='undefined'&&S.user&&USERS[S.user]&&USERS[S.user].rol!=='admin'){
    showToast('⚠ Solo el admin puede eliminar abonos');return;
  }
  const c=CLIENTES.find(x=>x.id===cid);
  const f=c?.folios.find(x=>x.id===fid);
  if(!f)return;
  const abono=f.abonos.find(a=>a.id===aid);
  if(!confirm('¿Eliminar este abono'+(abono?' de '+fN(abono.monto,dFor(abono.mon))+' '+abono.mon:'')+'?'))return;

  // 1. Remove from local
  f.abonos=f.abonos.filter(a=>a.id!==aid);
  offlineSaveClientes();

  // 2. Delete from Supabase abonos table
  if(_supaOnline&&typeof supaReq!=='undefined'){
    supaReq('DELETE','abonos?id=eq.'+encodeURIComponent(aid)).catch(function(e){console.warn('delete abono:',e);});
  }

  // 3. If it was efectivo, reverse the mov_cajas entry
  if(abono&&abono.enCaja&&abono.caja&&abono.cajaTipo==='efectivo'){
    // Find matching mov_cajas entry in _cajasMovs
    var movIdx=_cajasMovs.findIndex(function(m){
      return m.caja_destino===abono.caja
        && m.tipo==='deposito'
        && Math.abs(parseFloat(m.monto_destino||0)-parseFloat(abono.monto||0))<0.02;
    });
    if(movIdx>=0){
      var movId=_cajasMovs[movIdx].id;
      _cajasMovs.splice(movIdx,1);
      if(_supaOnline&&movId){
        supaReq('DELETE','mov_cajas?id=eq.'+movId).catch(function(e){console.warn('delete mov_cajas:',e);});
      }
    } else {
      // No exact match — create a reversal retiro entry
      var retiro={
        tipo:'retiro', fecha:today(),
        notas:'Anulación abono '+c.nombre,
        usuario:(typeof S!=='undefined'&&S.user)||'Admin',
        caja_origen:abono.caja,
        monto_origen:abono.monto,
        monto_destino:abono.monto,
        tasa_usada:null
      };
      _cajasMovs.unshift(retiro);
      if(_supaOnline&&typeof supaReq!=='undefined'){
        supaReq('POST','mov_cajas',retiro).then(async function(r){
          if(r.ok){var d=await r.json();if(d&&d[0])_cajasMovs[0]=d[0];}
        }).catch(function(e){console.warn('retiro anulacion:',e);});
      }
    }
    showToast('Abono eliminado — caja actualizada');
  } else {
    showToast('Abono eliminado');
  }

  // 4. Delete movimientos_ig entry for this abono (Cobro/Compensación cliente)
  if(abono&&_supaOnline&&typeof supaReq!=='undefined'){
    // Find by description containing client name and amount
    var _igDesc=(abono.cajaTipo==='efectivo'?'Cobro':'Compensación')+' cliente — '+c.nombre;
    supaReq('DELETE','movimientos_ig?descripcion=like.*'+encodeURIComponent(c.nombre)+'*&fecha=eq.'+abono.fecha)
      .catch(function(e){console.warn('delete ig abono:',e);});
    // Also remove from local MOVS
    MOVS=MOVS.filter(function(m){
      return !(m.desc&&m.desc.indexOf(c.nombre)>=0&&
               Math.abs(m.equivUSD-(abono.equivUSD||0))<0.02&&
               m.fecha===abono.fecha);
    });
    try{localStorage.setItem('erp_movs',JSON.stringify(MOVS.slice(0,500)));}catch(e){}
  }

  renderFichaFolios(c);
  renderFichaCuenta(c);
}
function irAbonar(cid,fid){
  fichaNavTo('f-abonar');
  setTimeout(()=>{const s=document.getElementById('a-folio-'+cid);if(s)s.value=fid;},60);
}

// ── FICHA — ABONAR ────────────────────────────────────────
function renderFichaAbonar(c){
  const tot=totCli(c),pag=pagCli(c),pdt=pdtCli(c),pct=tot>0?Math.round(pag/tot*100):0;
  document.getElementById('f-abonar-body').innerHTML=`
  <div style="max-width:520px">
  <div class="card" style="margin-bottom:10px;padding:10px 12px;display:flex;align-items:center;gap:12px;background:var(--color-background-secondary);border-radius:var(--border-radius-md)">
    <div style="flex:1">
      <div style="font-size:11px;color:var(--color-text-secondary)">Deuda pendiente</div>
      <div style="font-size:20px;font-weight:700;color:var(--color-text-danger)">${fN(pdt)} USD</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;color:var(--color-text-secondary)">Total / Abonado</div>
      <div style="font-size:13px">${fN(tot)} / <span style="color:var(--color-text-success)">${fN(pag)}</span> USD</div>
    </div>
    <div style="width:50px;height:50px;border-radius:50%;background:conic-gradient(var(--color-text-success) ${pct}%,var(--color-background-tertiary) 0);display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <div style="width:38px;height:38px;border-radius:50%;background:var(--color-background-secondary);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600">${pct}%</div>
    </div>
  </div>

  <div class="card">
    <h3 style="margin-bottom:14px">Registrar abono — ${c.nombre}</h3>
    <div style="display:flex;flex-direction:column;gap:12px">

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><label class="lbl">Fecha</label>
          <input type="date" id="a-fecha-${c.id}" value="${today()}" style="width:100%"></div>
        <div><label class="lbl">Folio</label>
          <select id="a-folio-${c.id}" style="width:100%">
            <option value="">Abono general</option>
            ${c.folios.map(f=>`<option value="${f.id}">F${f.id} — ${fN(pdtF(f))} USD</option>`).join('')}
          </select></div>
      </div>

      <div><label class="lbl">Concepto</label>
        <select id="a-concepto-${c.id}" style="width:100%" onchange="document.getElementById('a-hint-${c.id}').textContent=({'efectivo':'Cash, FM...','arancel':'Aranceles, aduana','flete':'Flete marítimo/terrestre','estiba':'Carga, descarga','interes':'Intereses','viaje':'Viajes','otro':''}[this.value]||'')">
          <option value="efectivo">Efectivo / transferencia</option>
          <option value="arancel">Aranceles / impuestos</option>
          <option value="flete">Flete / transporte</option>
          <option value="estiba">Estiba / descarga</option>
          <option value="interes">Intereses</option>
          <option value="viaje">Viaje / desplazamiento</option>
          <option value="otro">Otro</option>
        </select></div>

      <div><label class="lbl">Descripción <span id="a-hint-${c.id}" style="color:var(--color-text-info);font-size:10px"></span></label>
        <input type="text" id="a-desc-${c.id}" placeholder="Ej: Cash Placetas, Aranceles container #3..." style="width:100%"></div>

      <div style="display:grid;grid-template-columns:1fr 80px;gap:8px">
        <div><label class="lbl">Monto</label>
          <input type="number" id="a-monto-${c.id}" step="0.01" placeholder="0"
            oninput="calcEquivCli('${c.id}')" style="width:100%;font-size:16px;font-weight:600"></div>
        <div><label class="lbl">Moneda</label>
          <select id="a-mon-${c.id}" onchange="resetOnMonChangeCli('${c.id}')" style="width:100%">
            <option>USD</option><option>EUR</option><option>CUP</option><option>CUPT</option>
          </select></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><label class="lbl">Tasa (opcional)</label>
          <input type="number" id="a-tasa-${c.id}" step="0.01" placeholder="auto"
            oninput="calcEquivCli('${c.id}')" style="width:100%"></div>
        <div><label class="lbl">Equiv. USD</label>
          <input type="number" id="a-equiv-${c.id}" step="0.01"
            style="width:100%;font-size:15px;font-weight:600;background:var(--color-background-secondary)"
            oninput="window['em_${c.id}']=true;updPrevCli('${c.id}')"></div>
      </div>

      <div class="caja-section" id="cajasec-${c.id}" style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:10px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div><label class="lbl">Tipo de abono</label>
            <select id="a-cajatipo-${c.id}" onchange="updCajaExplicaCli('${c.id}')" style="width:100%">
              <option value="efectivo">💵 Efectivo</option>
              <option value="compensacion">🔄 Compensación</option>
            </select></div>
          <div id="cajasec-cta-${c.id}"><label class="lbl">Cuenta</label>
            <select id="a-caja-${c.id}" onchange="updCajaExplicaCli('${c.id}')" style="width:100%">
              ${_getCajasForMon(document.getElementById('a-mon-${c.id}')?.value||'USD', c.almacen||'').map(k=>'<option>'+k+'</option>').join('')}
            </select></div>
        </div>
        <div style="font-size:11px" id="cajaex-${c.id}"></div>
      </div>

      <div id="a-prev-${c.id}" class="prev-bar" style="display:none"></div>

      <button class="btn btn-p" onclick="registrarAbonoCli('${c.id}')"
        style="width:100%;padding:14px;font-size:14px">Registrar abono</button>
    </div>
  </div>
  </div>`;
  window['em_'+c.id]=false;
  window['cajaon_'+c.id]=false;
}

// Al cambiar moneda: limpiar tasa y equiv para que recalcule desde cero
function resetOnMonChangeCli(cid){
  var tasaEl=document.getElementById('a-tasa-'+cid);
  var equivEl=document.getElementById('a-equiv-'+cid);
  if(tasaEl){ tasaEl.value=''; tasaEl.placeholder='auto'; }
  if(equivEl){ equivEl.value=''; }
  window['em_'+cid]=false;
  calcEquivCli(cid);
}
// Actualiza solo la barra de preview usando el equiv actual (manual o auto)
function updPrevCli(cid){
  const monto=parseFloat(document.getElementById('a-monto-'+cid).value)||0;
  const mon=document.getElementById('a-mon-'+cid).value;
  const equiv=parseFloat(document.getElementById('a-equiv-'+cid).value)||0;
  // Recalcular la tasa implícita a partir del equiv manual
  if(monto>0&&equiv>0&&mon!=='USD'){
    var tasaImplied=(mon==='EUR')?(equiv/monto):(monto/equiv);
    var tasaEl=document.getElementById('a-tasa-'+cid);
    if(tasaEl){
      // Mostrar la tasa calculada como valor en el campo
      tasaEl.value=tasaImplied.toFixed(2);
    }
  }
  const c=CLIENTES.find(x=>x.id===cid);if(!c)return;
  const pdt=pdtCli(c);
  const prev=document.getElementById('a-prev-'+cid);
  if(monto>0&&equiv>0){
    prev.style.display='block';prev.style.background='var(--color-background-success)';prev.style.color='var(--color-text-success)';
    prev.innerHTML='Abono: <strong>'+fN(monto,dFor(mon))+' '+mon+'</strong> = <strong>'+fN(equiv)+' USD</strong> · Pdte tras abono: <strong>'+fN(Math.max(0,pdt-equiv))+' USD</strong>';
  } else prev.style.display='none';
}
function calcEquivCli(cid){
  const monto=parseFloat(document.getElementById('a-monto-'+cid).value)||0;
  const mon=document.getElementById('a-mon-'+cid).value;
  const tasaEl=document.getElementById('a-tasa-'+cid);
  const tasaManual=parseFloat(tasaEl.value)||0;
  const equivEl=document.getElementById('a-equiv-'+cid);
  let equiv;
  if(window['em_'+cid]){
    // Usuario editó equiv directamente — respetar ese valor
    equiv=parseFloat(equivEl.value)||0;
  } else if(mon!=='USD'){
    if(tasaManual>0){
      equiv=(mon==='EUR')?(monto*tasaManual):(monto/tasaManual);
    } else {
      equiv=toUSD(monto,mon);
    }
    equivEl.value=equiv>0?equiv.toFixed(4):'';
    // Mostrar tasa efectiva en placeholder
    if(!tasaManual&&monto>0&&equiv>0){
      tasaEl.placeholder=(mon==='EUR')?(equiv/monto).toFixed(4):(monto/equiv).toFixed(2);
    }
  } else {
    equiv=monto;
    equivEl.value=equiv>0?equiv.toFixed(4):'';
  }
  // Refresh caja options filtered by moneda
  var cajaSel=document.getElementById('a-caja-'+cid);
  if(cajaSel){
    var _cli=CLIENTES.find(x=>x.id===cid);
    var alm=_cli?_cli.almacen:'';
    var opts=_getCajasForMon(mon,alm);
    var cur=cajaSel.value;
    cajaSel.innerHTML=opts.map(k=>'<option'+(k===cur?' selected':'')+'>'+k+'</option>').join('');
    if(!opts.includes(cur)&&opts.length)cajaSel.value=opts[0];
  }
  updPrevCli(cid);
}
function toggleCajaCli(cid){ /* legacy no-op */ }
function updCajaExplicaCli(cid){
  var tipo=document.getElementById('a-cajatipo-'+cid)?.value;
  var caja=document.getElementById('a-caja-'+cid)?.value;
  var el=document.getElementById('cajaex-'+cid);
  var ctaWrap=document.getElementById('cajasec-cta-'+cid);
  if(!el)return;
  if(tipo==='efectivo'){
    if(ctaWrap)ctaWrap.style.display='';
    el.textContent='✓ El dinero entra en '+caja+' y reduce la deuda. Se registra en I/G como Cobro cliente.';
    el.style.color='var(--color-text-success)';
  } else {
    if(ctaWrap)ctaWrap.style.display='none';
    el.textContent='✓ El cliente cubrió un gasto de la empresa (arancel, flete, etc.). Se registra en I/G y reduce la deuda. No mueve caja física.';
    el.style.color='var(--color-text-info)';
  }
}
function registrarAbonoCli(cid){
  const c=CLIENTES.find(x=>x.id===cid);if(!c)return;
  const fid=document.getElementById('a-folio-'+cid).value;
  const fecha=document.getElementById('a-fecha-'+cid).value||today();
  const concepto=document.getElementById('a-concepto-'+cid).value;
  const desc=document.getElementById('a-desc-'+cid).value;
  const monto=parseFloat(document.getElementById('a-monto-'+cid).value)||0;
  const mon=document.getElementById('a-mon-'+cid).value;
  const tasaManual=parseFloat(document.getElementById('a-tasa-'+cid).value)||0;
  const equivRaw=parseFloat(document.getElementById('a-equiv-'+cid).value)||0;
  // Calcular equivUSD: prioridad: 1) equiv editado manualmente, 2) tasa manual, 3) tasa automática
  let equivUSD;
  if(window['em_'+cid] && equivRaw>0){
    equivUSD=equivRaw;
  } else if(tasaManual>0 && mon!=='USD'){
    equivUSD=(mon==='EUR')?(monto*tasaManual):(monto/tasaManual);
  } else {
    equivUSD=toUSD(monto,mon);
  }
  const cajaTipo=document.getElementById('a-cajatipo-'+cid)?.value||'efectivo';
  const enCaja=cajaTipo==='efectivo';
  const caja=enCaja?(document.getElementById('a-caja-'+cid)?.value||null):null;
  if(!monto){alert('Introduce el monto');return;}
  if(!desc){alert('Añade una descripción');return;}
  // Validate caja moneda matches abono moneda
  if(enCaja&&caja){
    // Look up the real moneda from _cajasData instead of guessing from the name
    var _cajaDef = typeof _cajasData!=='undefined' ? _cajasData.find(function(c){return c.nombre===caja;}) : null;
    var cajaMoneda = _cajaDef ? _cajaDef.moneda : caja.split(' ')[0];
    if(cajaMoneda && cajaMoneda!==mon){
      alert('⚠ Error: estás intentando depositar '+mon+' en una caja de '+cajaMoneda+' ('+caja+'). Selecciona una cuenta que coincida con la moneda del abono.');
      return;
    }
  }
  // Validate monto doesn't exceed pendiente
  var _targetCheck=fid?c.folios.find(function(f){return f.id===fid;}):c.folios.find(function(f){return estF(f)!=='pagado';});
  if(!_targetCheck&&c.folios.length)_targetCheck=c.folios[0];
  if(_targetCheck){
    var _pdt=pdtF(_targetCheck);
    if(equivUSD>_pdt+0.01){
      if(!confirm('El abono ('+fN(equivUSD)+' USD) supera el pendiente ('+fN(_pdt)+' USD). ¿Continuar?'))return;
    }
  }
  const _tasaEf=mon==='USD'?null:(tasaManual||(equivUSD>0?(mon==='EUR'?equivUSD/monto:monto/equivUSD):null));
  const abono={id:'a'+(nextAid++),fecha,concepto,desc,monto,mon,tasa:_tasaEf?parseFloat(parseFloat(_tasaEf).toFixed(4)):null,equivUSD:parseFloat(equivUSD.toFixed(4)),enCaja,caja,cajaTipo};
  let target=fid?c.folios.find(f=>f.id===fid):c.folios.find(f=>estF(f)!=='pagado');
  if(!target&&c.folios.length)target=c.folios[0];
  var _isNewFolio = false;
  if(!target){
    // Sin folios: crear folio de crédito anticipado automáticamente
    var _creditoFolio={
      id:'f-credito-'+Date.now(),
      ref:'Crédito anticipado',
      fecha:fecha,
      tipo:'credito_anticipado',
      productos:[],
      totalUSD:0,
      abonos:[]
    };
    c.folios.push(_creditoFolio);
    target=_creditoFolio;
    _isNewFolio = true;
  }
  target.abonos.push(abono);
  ['a-monto-','a-desc-','a-tasa-','a-equiv-'].forEach(p=>{const e=document.getElementById(p+cid);if(e)e.value='';});
  document.getElementById('a-prev-'+cid).style.display='none';
  window['em_'+cid]=false;
  offlineSaveClientes();
  // Always create I/G trace regardless of type
  (function(){
    var igTipo = cajaTipo==='efectivo' ? 'Cobro cliente' : 'Compensación cliente';
    var igSentido = 'ingreso';
    var igCta = caja || (c.almacen ? 'USD '+c.almacen : 'USD Habana');
    var igMov = {
      id: igNextId++, fecha: fecha, tipo: igTipo,
      desc: igTipo+' — '+c.nombre+' — '+desc,
      monto: equivUSD, mon: 'USD', equivUSD: equivUSD,
      cta: igCta, sentido: igSentido, notas: '',
      vend: (typeof S!=='undefined'&&S.user)||''
    };
    MOVS.push(igMov);
    // Always write — _supaWrite handles online/offline queuing
    _supaWrite('POST','movimientos_ig',{
      fecha:fecha,tipo:igTipo,descripcion:igMov.desc,
      monto:parseFloat(parseFloat(equivUSD).toFixed(4)),moneda:'USD',
      equiv_usd:parseFloat(parseFloat(equivUSD).toFixed(4)),
      cuenta:igCta,vendedor:(typeof S!=='undefined'&&S.user)||'',notas:''
    });
  })();
  // Add to caja if efectivo — via mov_cajas (same schema as admRegistrarMovCaja)
  if(enCaja&&caja){
    var _cajaMov={
      tipo:'deposito',
      fecha:fecha,
      notas:'Abono '+c.nombre+' — '+desc,
      usuario:(typeof S!=='undefined'&&S.user)||'Admin',
      caja_destino:caja,
      monto_origen:monto,      // monto real en la moneda de la caja
      monto_destino:monto,     // monto real en la moneda de la caja
      tasa_usada:tasaManual||null
    };
    _cajasMovs.unshift(_cajaMov); // optimistic local update
    _supaWrite('POST','mov_cajas',_cajaMov);
    var _newSaldo=typeof _getSaldoCaja==='function'?_getSaldoCaja(caja):null;
    if(_newSaldo!==null) showToast('✓ Caja '+caja+': '+fN(_newSaldo,2));
  }
  (async function(){
    if (_isNewFolio) {
      await syncSaveFolio(cid, target);
    }
    await syncSaveAbono(cid, target.id, abono);
  })();

  // Telegram notification for abono
  (function(){
    var _cliAlm = c.almacen || (c.folios&&c.folios.length?c.folios[c.folios.length-1].alm:'') || 'Habana';
    var _tgIcon = cajaTipo==='efectivo' ? '💵' : '🔄';
    var _tgMsg = _tgIcon+' <b>Abono '+cajaTipo+'</b>\n'
      +'👤 '+c.nombre+'\n'
      +'💰 <b>'+fN(monto,dFor(mon))+' '+mon+'</b>'+(mon!=='USD'?' ≈ '+fN(equivUSD)+' USD':'')+'\n'
      +(desc?'📝 '+desc+'\n':'')
      +(caja?'🏦 '+caja+'\n':'')
      +'🏪 '+_cliAlm
      +_tgCliBalance(c.nombre);
    tgSend(_tgMsg, _cliAlm, 'venta');
  })();

  showToast(`Abono registrado (${cajaTipo}) — ${fN(monto,dFor(mon))} ${mon} ≈ ${fN(equivUSD)} USD`);
  renderFichaCuenta(c);fichaNavTo('f-cuenta');
}

// ── FICHA — NUEVA VENTA ───────────────────────────────────
function renderFichaNF(c){
  document.getElementById('f-nf-body').innerHTML=`
  <div style="max-width:580px"><div class="card">
    <h3>Nueva venta a crédito — ${c.nombre}</h3>
    <div style="display:flex;flex-direction:column;gap:9px">
      <div class="g3">
        <div><label class="lbl">Fecha</label><input type="date" id="nf-fecha-${c.id}" value="${today()}"></div>
        <div><label class="lbl">Almacén</label><select id="nf-alm-${c.id}" onchange="renderNFLCli('${c.id}')"><option>Placetas</option><option>Habana</option><option>España</option></select></div>
        <div><label class="lbl">Moneda ref.</label><select id="nf-mon-${c.id}"><option>USD</option><option>EUR</option><option>CUP</option></select></div>
      </div>
      <div><label class="lbl">Descripción</label><input type="text" id="nf-desc-${c.id}" placeholder="Ej: Container #4 — perfiles"></div>
      <div id="nfl-${c.id}"></div>
      <button class="btn-sm" onclick="addNFLCli('${c.id}')" style="align-self:flex-start">+ añadir producto</button>
      <div class="sep"></div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="lbl" style="margin:0">Total:</span>
        <span id="nf-tot-${c.id}" style="font-size:16px;font-weight:500">0.00 USD</span>
      </div>
      <div class="g2">
        <div><label class="lbl">Abono inicial</label><input type="number" id="nf-ini-${c.id}" step="0.01" placeholder="0" oninput="updNFTotCli('${c.id}')"></div>
        <div><label class="lbl">Moneda abono</label><select id="nf-imon-${c.id}" onchange="updNFTotCli('${c.id}')"><option>USD</option><option>EUR</option><option>CUP</option><option>CUPT</option></select></div>
      </div>
      <div id="nf-prev-${c.id}" style="display:none" class="prev-bar"></div>
      <button class="btn btn-p" onclick="crearFolioCli('${c.id}')">Crear folio</button>
    </div>
  </div></div>`;
  window['nfl_'+c.id]=[];
  addNFLCli(c.id);
}
function _getPrecioNF(p, alm, qty){
  var isPlac = alm==='Placetas';
  var maj = (isPlac && p.maj_placetas!=null) ? p.maj_placetas : (p.maj||p.min||0);
  var min = (isPlac && p.min_placetas!=null) ? p.min_placetas : (p.min||p.maj||0);
  var q = qty || 1;
  var isTransit = p.enTransito && p.enTransito[alm];
  if(isTransit && p.preventa_min != null) return p.preventa_min;

  if(p.escala && p.escala.length){
    var sorted = p.escala.slice().sort(function(a,b){return b.desde-a.desde;});
    for(var i=0;i<sorted.length;i++){
      var r=sorted[i];
      if(q>=r.desde&&(r.hasta==null||r.hasta===''||q<=r.hasta)) return parseFloat(r.precio)||maj||min;
    }
    return parseFloat(p.escala[0].precio)||maj||min;
  }
  
  var basePrice = maj||min;
  if(isTransit && RATES.DTO_PREVENTA > 0) return Number((basePrice * (1 - RATES.DTO_PREVENTA/100)).toFixed(4));
  return basePrice;
}
function addNFLCli(cid){
  if(!window['nfl_'+cid])window['nfl_'+cid]=[];
  var _almNF=document.getElementById('nf-alm-'+cid)?.value||'';
  var _firstProd=_getProdNames(_almNF)[0]||'';
  var _firstP=PRODS.find(function(x){return x.n===_firstProd;});
  var _firstPrice=_firstP?_getPrecioNF(_firstP,_almNF):0;
  window['nfl_'+cid].push({prod:_firstProd,q:1,precio:_firstPrice,mon:'USD'});
  renderNFLCli(cid);
}
function renderNFLCli(cid){
  const lineas=window['nfl_'+cid]||[];
  const c=document.getElementById('nfl-'+cid);if(!c)return;
  c.innerHTML=lineas.map((l,i)=>`
    <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center;flex-wrap:wrap">
      <select style="flex:2;min-width:140px;font-size:11px" onchange="var _v=event.target.value;window['nfl_${cid}'][${i}].prod=_v;var _ap=PRODS.find(function(x){return x.n===_v;});if(_ap){var _almC=document.getElementById('nf-alm-${cid}')?.value||'';window['nfl_${cid}'][${i}].precio=_getPrecioNF(_ap,_almC)||0;}renderNFLCli('${cid}')">
        ${_getProdNames(document.getElementById('nf-alm-'+cid)?.value||'').map(p=>`<option value="${p.replace(/"/g,'&quot;')}" ${p===l.prod?'selected':''}>${p}</option>`).join('')}
      </select>
      <input type="number" value="${l.q}" min="1" style="width:60px;font-size:11px;padding:4px 6px" oninput="var _p=PRODS.find(function(x){return x.n===window['nfl_${cid}'][${i}].prod;});var _alm=document.getElementById('nf-alm-${cid}')?.value||'';var _stkF=_p?(_p.stk_alm&&_p.stk_alm[_alm]!=null?_p.stk_alm[_alm]:(_p.stk||0)):0;var _max=_p?_stkF:9999;var _v=parseInt(this.value)||1;if(_v>_max){this.value=_max;_v=_max;}window['nfl_${cid}'][${i}].q=_v;if(_p&&!window['nfl_${cid}'][${i}]._manualPrice){var _np=_getPrecioNF(_p,_alm,_v);window['nfl_${cid}'][${i}].precio=_np;var _pInp=this.parentNode.querySelector('input[type=number]:nth-of-type(2)');if(_pInp)_pInp.value=_np;}updNFTotCli('${cid}')">
      <input type="number" value="${l.precio}" step="0.01" style="width:76px;font-size:11px;padding:4px 6px" oninput="window['nfl_${cid}'][${i}].precio=parseFloat(this.value)||0;window['nfl_${cid}'][${i}]._manualPrice=true;updNFTotCli('${cid}')">
      <select style="width:64px;font-size:11px;padding:4px 6px" onchange="window['nfl_${cid}'][${i}].mon=this.value;updNFTotCli('${cid}')">
        <option>USD</option><option>EUR</option><option>CUP</option>
      </select>
      <button class="btn-sm" style="color:var(--color-text-danger)" onclick="window['nfl_${cid}'].splice(${i},1);renderNFLCli('${cid}')">×</button>
    </div>`).join('')||'<div style="color:var(--color-text-tertiary);font-size:12px">Añade productos</div>';
  updNFTotCli(cid);
}
function updNFTotCli(cid){
  const lineas=window['nfl_'+cid]||[];
  const _almNFC=document.getElementById('nf-alm-'+cid)?.value||S.alm||'';
  const tot=lineas.reduce((a,l)=>a+toUSD(l.q*l.precio,l.mon,_almNFC),0);
  const el=document.getElementById('nf-tot-'+cid);if(el)el.textContent=fN(tot)+' USD';
  const ini=parseFloat(document.getElementById('nf-ini-'+cid)?.value)||0;
  const iniMon=document.getElementById('nf-imon-'+cid)?.value||'USD';
  const iniUSD=toUSD(ini,iniMon,_almNFC);
  const pdt=Math.max(0,tot-iniUSD);
  const prev=document.getElementById('nf-prev-'+cid);
  if(prev&&tot>0){prev.style.display='block';prev.style.background='var(--color-background-info)';prev.style.color='var(--color-text-info)';prev.textContent=`Venta: ${fN(tot)} USD${ini>0?` · Abono inicial: ${fN(ini,dFor(iniMon))} ${iniMon}`:''} · Deuda pdte: ${fN(pdt)} USD`;}
  else if(prev)prev.style.display='none';
}
function crearFolioCli(cid){
  const c=CLIENTES.find(x=>x.id===cid);if(!c)return;
  const lineas=window['nfl_'+cid]||[];
  if(!lineas.length){alert('Añade al menos un producto');return;}
  const fecha=document.getElementById('nf-fecha-'+cid)?.value||today();
  const alm=document.getElementById('nf-alm-'+cid)?.value||'Placetas';
  const mon=document.getElementById('nf-mon-'+cid)?.value||'USD';
  const desc=document.getElementById('nf-desc-'+cid)?.value||'Nueva venta';
  const ini=parseFloat(document.getElementById('nf-ini-'+cid)?.value)||0;
  const iniMon=document.getElementById('nf-imon-'+cid)?.value||'USD';
  const abonos=ini>0?[{id:'a'+(nextAid++),fecha,concepto:'efectivo',desc:'Abono inicial',monto:ini,mon:iniMon,tasa:null,equivUSD:parseFloat(toUSD(ini,iniMon).toFixed(2)),enCaja:false,caja:null,cajaTipo:null}]:[];
  const fid=String(nextFid++);
  // Validate stock before creating
  var stockError = null;
  lineas.forEach(function(l){
    var p=PRODS.find(function(x){return x.n===l.prod;});
    if(!p){stockError='Producto no encontrado: '+l.prod;return;}
    var disponible=(p.stk_alm&&p.stk_alm[alm]!=null)?p.stk_alm[alm]:(p.stk||0);
    if(l.q>disponible) stockError='Stock insuficiente: '+l.prod+' (disponible: '+disponible+', pedido: '+l.q+')';
  });
  if(stockError){alert(stockError);return;}

  var newFolio={id:fid,fecha,alm,mon,desc,lineas:lineas.map(l=>({...l,qO:l.q,pO:l.precio})),abonos};
  c.folios.push(newFolio);
  // Discount stock
  lineas.forEach(function(l){
    var p=PRODS.find(function(x){return x.n===l.prod;});
    if(p&&alm){
      p.stk=Math.max(0,(p.stk||0)-l.q);
      if(p.stk_alm&&p.stk_alm[alm]!=null) p.stk_alm[alm]=Math.max(0,(p.stk_alm[alm]||0)-l.q);
      if(typeof syncStockUpdate==='function') syncStockUpdate([{n:l.prod,q:l.q}],alm);
    }
  });
  window['nfl_'+cid]=[];
  // Register as venta
  var _ventaFolio={
    id:venNextId++, fecha:fecha,
    vend:(typeof S!=='undefined'&&S.user)||'Admin',
    alm:alm, cli:c.nombre, tipo:'Mayorista', mon:mon,
    prods:lineas.map(function(l){return l.q+'× '+l.prod;}).join(', '),
    totalUSD:lineas.reduce(function(a,l){return a+toUSD(l.q*l.precio,l.mon);},0),
    comPct:0, comUSD:0, estCom:'No aplica',
    nota:'Folio '+fid+' — '+desc,
    pagos:[], vueltos:[]
  };
  VENTAS.unshift(_ventaFolio);
  offlineSaveVentas();
  offlineSaveClientes();
  (async function(){
    try{
      await syncSaveCliente(c);
      await syncSaveFolio(c.id, newFolio);
      for(var _ab of (newFolio.abonos||[])){ await syncSaveAbono(c.id, newFolio.id, _ab); }
      await syncSaveVenta(_ventaFolio);
      offlineSaveVentas();
    }catch(e){console.warn('folio sync:',e);}
  })();
  if((TG_ON||TG_TOKEN)){
    var _tgEsc=function(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');};
    var _fP=lineas.map(function(l){return '  • '+l.q+'x '+_tgEsc(l.prod)+' @ $'+fN(l.precio)+' = $'+fN(l.q*l.precio);}).join('\n');
    var _fT=lineas.reduce(function(a,l){return a+toUSD(l.q*l.precio,l.mon);},0);
    tgSend('\uD83D\uDCC4 <b>Venta cr\u00e9dito (Folio '+fid+')</b>\n\uD83D\uDC64 '+_tgEsc(c.nombre)+' \u2022 '+alm+'\n\uD83D\uDCE6 <b>Productos:</b>\n'+_fP+'\n\uD83D\uDCB5 <b>$'+fN(_fT)+'</b>\n\uD83D\uDCDD '+_tgEsc(desc)+_tgCliBalance(c.nombre),alm,'venta');
  }
  showToast(`Folio ${fid} creado para ${c.nombre}`);
  folioFiltro='todos';fichaNavTo('f-folios');
}

// ── NUEVO CLIENTE ─────────────────────────────────────────
function showModal(){
  colorSel='info';renderColores();
  document.getElementById('modal-cli-titulo').textContent='Nuevo cliente';
  var _b=document.getElementById('modal-cli-btn');
  _b.textContent='Crear cliente'; _b.setAttribute('onclick','crearCliente()');
  ['nc-nombre','nc-tel','nc-notas'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});
  document.getElementById('modal-cli').classList.add('show');
}

function editarCliente(cid){
  var c=CLIENTES.find(function(x){return x.id===cid;}); if(!c) return;
  colorSel=c.color||'info'; renderColores();
  document.getElementById('nc-nombre').value=c.nombre||'';
  document.getElementById('nc-tel').value=c.tel||'';
  document.getElementById('nc-alm').value=c.alm||'Habana';
  document.getElementById('nc-notas').value=c.notas||'';
  document.getElementById('modal-cli-titulo').textContent='Editar cliente';
  var _b=document.getElementById('modal-cli-btn');
  _b.textContent='Guardar cambios'; _b.setAttribute('onclick',"guardarEdicionCliente('"+cid+"')");
  document.getElementById('modal-cli').classList.add('show');
}

function guardarEdicionCliente(cid){
  var c=CLIENTES.find(function(x){return x.id===cid;}); if(!c) return;
  var nombre=document.getElementById('nc-nombre').value.trim();
  if(!nombre){alert('El nombre es obligatorio');return;}
  c.nombre=nombre;
  c.tel=document.getElementById('nc-tel').value;
  c.alm=document.getElementById('nc-alm').value;
  c.color=colorSel;
  c.notas=document.getElementById('nc-notas').value;
  hideModal();
  offlineSaveClientes();
  syncSaveCliente(c);
  if(typeof renderLista==='function')try{renderLista();}catch(e){}
  if(typeof activoCli!=='undefined'&&activoCli===cid&&typeof renderFicha==='function')try{renderFicha();}catch(e){}
  showToast('\u2713 Cliente actualizado');
}
function hideModal(){document.getElementById('modal-cli').classList.remove('show');}
function renderColores(){
  document.getElementById('nc-colores').innerHTML=COLORES.map(col=>`
    <div onclick="colorSel='${col.id}';renderColores()"
      style="width:28px;height:28px;border-radius:50%;background:${col.bg};cursor:pointer;border:2px solid ${colorSel===col.id?col.tc:'transparent'};display:flex;align-items:center;justify-content:center">
      ${colorSel===col.id?`<span style="color:${col.tc};font-size:14px">✓</span>`:''}
    </div>`).join('');
}
function crearCliente(){
  const nombre=document.getElementById('nc-nombre').value.trim();
  if(!nombre){alert('El nombre es obligatorio');return;}
  CLIENTES.push({
    id:'c'+nextCid++,nombre,
    tel:document.getElementById('nc-tel').value,
    alm:document.getElementById('nc-alm').value,
    color:colorSel,
    notas:document.getElementById('nc-notas').value,
    owner: (typeof S!=='undefined'&&S.user)||'Admin',
    folios:[]
  });
  ['nc-nombre','nc-tel','nc-notas'].forEach(id=>document.getElementById(id).value='');
  // Sync to Supabase
  (function(c){
    if(typeof supaReq!=='undefined'&&_supaOnline){
      supaReq('POST','clientes?on_conflict=id',{
        id:c.id,nombre:c.nombre,telefono:c.tel||'',
        almacen:c.alm||'',notas:c.notas||'',owner:c.owner||'Admin'
      }).catch(function(e){console.warn('cliente sync:',e);});
    }
  })(CLIENTES[CLIENTES.length-1]);
  hideModal();renderLista();
  offlineSaveClientes();
  (async function(){
    await syncSaveCliente(CLIENTES[CLIENTES.length-1]);
    if(_supaOnline) showToast('✓ Cliente guardado en Supabase');
  })();
  showToast('Cliente '+nombre+' creado');
}


renderColores();renderLista();

