

























var CATS = JSON.parse(localStorage.getItem('erp_cats')||'["Chapas","Perfiles","Soldadura","Accesorios"]');
function saveCats(){try{localStorage.setItem('erp_cats',JSON.stringify(CATS));}catch(e){}}









// ═══ MÓDULO ADMIN v2 ═══
let adminTab = 'productos';
let editingUser = null;
let editingProd = null;

const ADMIN_COLORES = [
  {bg:'var(--color-background-info)',    tc:'var(--color-text-info)',    lbl:'Azul'},
  {bg:'var(--color-background-warning)', tc:'var(--color-text-warning)', lbl:'Amarillo'},
  {bg:'var(--color-background-success)', tc:'var(--color-text-success)', lbl:'Verde'},
  {bg:'var(--color-background-danger)',  tc:'var(--color-text-danger)',  lbl:'Rojo'},
];

function adminInit() {
  Object.keys(USERS).forEach(function(name) {
    if (!USERS[name].rol)     USERS[name].rol     = (name === 'Admin') ? 'admin' : 'vendedor';
    if (!USERS[name].almacen) USERS[name].almacen = '';
    if (!USERS[name].activo)  USERS[name].activo  = true;
  });
  if (!USERS['Admin']) {
    USERS['Admin'] = {pin:'0000', color:'var(--color-background-success)', tc:'var(--color-text-success)', rol:'admin', almacen:'', activo:true};
  }
  PRODS.forEach(function(p) {
    if (!p.stk_alm) {
      var total = p.stk || 0;
      p.stk_alm = {
        Habana:     Math.round(total * 0.3),
        Placetas:   Math.round(total * 0.6),
        Xportprise: total - Math.round(total * 0.3) - Math.round(total * 0.6)
      };
    }
    if (!p.stk_min) p.stk_min = 10;
  });
}

function isAdmin() {
  return typeof S !== 'undefined' && S.user && USERS[S.user] && USERS[S.user].rol === 'admin';
}

function renderAdmin() {
  var el = document.getElementById('admin-root');
  if (!el) { console.warn('admin-root not found'); return; }

  if (!isAdmin()) {
    el.innerHTML = '<div style="text-align:center;padding:48px 20px;color:var(--color-text-tertiary)">'
      + '<div style="font-size:36px;margin-bottom:12px">🔒</div>'
      + '<div style="font-size:14px;font-weight:600;margin-bottom:6px">Acceso restringido</div>'
      + '<div style="font-size:12px">Inicia sesión como Admin para acceder.</div>'
      + '</div>';
    return;
  }

  var tabsHtml = '<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">'
    + '<button class="adm-tab' + (adminTab === 'productos' ? ' act' : '') + '" onclick="setAdminTab(\'productos\')">📦 Productos y Stock</button>'
    + '<button class="adm-tab' + (adminTab === 'usuarios'   ? ' act' : '') + '" onclick="setAdminTab(\'usuarios\')">👤 Usuarios</button>'
    + '<button class="adm-tab' + (adminTab === 'categorias' ? ' act' : '') + '" onclick="setAdminTab(\'categorias\')">🏷️ Categorías</button>'
    + '<button class="adm-tab' + (adminTab === 'tasas'  ? ' act' : '') + '" onclick="setAdminTab(\'tasas\')">💱 Tasas</button>'
    + '<button class="adm-tab' + (adminTab === 'cajas'  ? ' act' : '') + '" onclick="setAdminTab(\'cajas\')">💰 Cajas</button>'
    + '<button class="adm-tab' + (adminTab === 'comisiones' ? ' act' : '') + '" onclick="setAdminTab(\'comisiones\')">🏆 Comisiones</button>'
    + '<button class="adm-tab' + (adminTab === 'contenedores' ? ' act' : '') + '" onclick="setAdminTab(\'contenedores\')">🚢 Contenedores</button>'
    + '</div>'
    + '<div id="admin-content"></div>';

  el.innerHTML = tabsHtml;
  renderAdminContent();
}

function setAdminTab(tab) {
  adminTab = tab;
  editingUser = null;
  editingProd = null;
  renderAdmin();
}

function renderAdminContent() {
  if (editingProd === null || editingProd >= 0) { window.clonedProdData = null; }
  if      (adminTab === 'productos') renderAdminProductos();
  else if (adminTab === 'usuarios')  renderAdminUsuarios();
  else if (adminTab === 'tasas')     renderAdminTasas();
  else if (adminTab === 'cajas')     renderAdminCajas();
  else if (adminTab === 'comisiones') renderAdminComisiones();
  else if (adminTab === 'contenedores') renderAdminContenedores();
  else if (adminTab === 'categorias') {
    var el=document.getElementById('admin-content');if(!el)return;
    el.innerHTML='<div style="font-size:14px;font-weight:600;margin-bottom:12px">🏷️ Categorías</div><div id="cat-manager-content"></div>';
    renderCatManager();
  }
}

// ── ADMIN CONTENEDORES ────────────────────────────────────────
var _cntDetalle = null; // id del contenedor en detalle, null = lista

function renderAdminContenedores() {
  var el = document.getElementById('admin-content'); if (!el) return;
  if (_cntDetalle) { _renderCntDetalle(_cntDetalle); return; }

  var estadoCol = {recibido:'var(--color-text-success)', en_transito:'var(--color-text-info)', retrasado:'var(--color-text-danger)'};
  var estadoIco = {recibido:'✅', en_transito:'🚢', retrasado:'⚠️'};
  var estadoLbl = {recibido:'Recibido', en_transito:'En tránsito', retrasado:'Retrasado'};

  var cardsHtml = CONTENEDORES.length ? CONTENEDORES.map(function(c){
    var movsCnt = STOCK_MOVS.filter(function(m){return m.contenedor===c.id&&m.tipo==='entrada';}).length;
    var resCnt  = (typeof S!=='undefined'&&S.reservas?S.reservas:[]).filter(function(r){return r.contenedor===c.id&&r.activa;}).length;
    var estC = estadoCol[c.estado]||'var(--color-text-secondary)';
    var estI = estadoIco[c.estado]||'📦';
    var estL = estadoLbl[c.estado]||c.estado;
    return '<div class="adm-card" style="cursor:pointer;border:1px solid var(--color-border-secondary)" onclick="_cntDetalle=\''+c.id+'\';renderAdminContenedores()">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">'
      +'<div><div style="font-weight:700;font-size:13px">'+c.id+'</div>'
      +(c.nombre&&c.nombre!==c.id?'<div style="font-size:11px;color:var(--color-text-secondary)">'+c.nombre+'</div>':'')
      +'</div>'
      +'<div style="font-size:11px;font-weight:600;color:'+estC+'">'+estI+' '+estL+'</div>'
      +'</div>'
      +(c.eta?'<div style="font-size:11px;color:var(--color-text-tertiary);margin-bottom:8px">ETA: '+fD(c.eta)+'</div>':'')
      +'<div style="display:flex;gap:10px;font-size:11px">'
      +'<span>📥 '+movsCnt+' entrada'+(movsCnt===1?'':'s')+'</span>'
      +'<span>📋 '+resCnt+' reserva'+(resCnt===1?'':'s')+'</span>'
      +'</div>'
      +'<div style="display:flex;gap:6px;margin-top:10px" onclick="event.stopPropagation()">'
      +'<button class="adm-btn" style="font-size:11px;padding:3px 8px" onclick="_editCnt(\''+c.id+'\')">✏️ Editar</button>'
      +'<button class="adm-btn" style="font-size:11px;padding:3px 8px;color:var(--color-text-danger)" onclick="_delCnt(\''+c.id+'\')">✕</button>'
      +'</div>'
      +'</div>';
  }).join('') : '<div style="text-align:center;padding:30px;color:var(--color-text-tertiary);font-size:12px">Sin contenedores. Crea uno abajo.</div>';

  el.innerHTML = '<div style="font-size:14px;font-weight:700;margin-bottom:16px">🚢 Contenedores</div>'
    +'<div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:14px">Asocia entradas de stock y reservas a un contenedor para rastrear qué pedidos van en cada envío.</div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin-bottom:20px">'+cardsHtml+'</div>'
    +'<div class="adm-card" id="cnt-form-wrap">'
    +'<div style="font-size:13px;font-weight:600;margin-bottom:12px" id="cnt-form-title">➕ Nuevo contenedor</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:500px">'
    +'<div style="grid-column:1/-1"><label class="adm-lbl-f"># Contenedor *</label><input class="adm-inp" id="cnt-id-inp" placeholder="CNT-2026-A"></div>'
    +'<div style="grid-column:1/-1"><label class="adm-lbl-f">Nombre descriptivo</label><input class="adm-inp" id="cnt-nombre-inp" placeholder="Container julio España"></div>'
    +'<div><label class="adm-lbl-f">Estado</label><select class="adm-inp" id="cnt-estado-sel">'
    +'<option value="en_transito">🚢 En tránsito</option>'
    +'<option value="retrasado">⚠️ Retrasado</option>'
    +'<option value="recibido">✅ Recibido</option>'
    +'</select></div>'
    +'<div><label class="adm-lbl-f">ETA (fecha estimada)</label><input class="adm-inp" type="date" id="cnt-eta-inp"></div>'
    +'<div style="grid-column:1/-1"><label class="adm-lbl-f">Notas</label><input class="adm-inp" id="cnt-notas-inp" placeholder="Forwarder, puerto, referencia..."></div>'
    +'</div>'
    +'<input type="hidden" id="cnt-edit-id" value="">'
    +'<div style="display:flex;gap:8px;margin-top:14px">'
    +'<button class="adm-btn adm-btn-p" onclick="_saveCnt()">✓ Guardar contenedor</button>'
    +'<button class="adm-btn" id="cnt-cancel-btn" style="display:none" onclick="_cancelEditCnt()">Cancelar</button>'
    +'</div></div>';
}

function _saveCnt() {
  var id   = (document.getElementById('cnt-id-inp')||{}).value.trim().toUpperCase();
  var nombre = (document.getElementById('cnt-nombre-inp')||{}).value.trim();
  var estado = (document.getElementById('cnt-estado-sel')||{}).value||'en_transito';
  var eta  = (document.getElementById('cnt-eta-inp')||{}).value||'';
  var notas= (document.getElementById('cnt-notas-inp')||{}).value.trim();
  var editId = (document.getElementById('cnt-edit-id')||{}).value||'';
  if(!id){showToast('⚠ El # de contenedor es obligatorio');return;}
  if(!editId && CONTENEDORES.find(function(c){return c.id===id;})){showToast('⚠ Ya existe ese # de contenedor');return;}
  if(editId){
    var idx=CONTENEDORES.findIndex(function(c){return c.id===editId;});
    if(idx>=0)CONTENEDORES[idx]={id:id,nombre:nombre||id,estado:estado,eta:eta,notas:notas};
  } else {
    CONTENEDORES.push({id:id,nombre:nombre||id,estado:estado,eta:eta,notas:notas});
  }
  _saveContenedores();
  showToast('✓ Contenedor '+id+' guardado');
  renderAdminContenedores();
}

function _editCnt(id) {
  var c=CONTENEDORES.find(function(x){return x.id===id;});if(!c)return;
  renderAdminContenedores(); // reset form
  setTimeout(function(){
    var fi=document.getElementById('cnt-id-inp');
    var fn=document.getElementById('cnt-nombre-inp');
    var fe=document.getElementById('cnt-estado-sel');
    var feta=document.getElementById('cnt-eta-inp');
    var fno=document.getElementById('cnt-notas-inp');
    var feid=document.getElementById('cnt-edit-id');
    var ftit=document.getElementById('cnt-form-title');
    var fcancel=document.getElementById('cnt-cancel-btn');
    if(fi)fi.value=c.id;
    if(fn)fn.value=c.nombre||'';
    if(fe)fe.value=c.estado||'en_transito';
    if(feta)feta.value=c.eta||'';
    if(fno)fno.value=c.notas||'';
    if(feid)feid.value=c.id;
    if(ftit)ftit.textContent='✏️ Editar: '+c.id;
    if(fcancel)fcancel.style.display='';
  },0);
}

function _cancelEditCnt(){
  var feid=document.getElementById('cnt-edit-id');
  if(feid)feid.value='';
  renderAdminContenedores();
}

function _delCnt(id){
  if(!confirm('¿Eliminar contenedor '+id+'? Las entradas y reservas asociadas perderán esta referencia.'))return;
  CONTENEDORES=CONTENEDORES.filter(function(c){return c.id!==id;});
  _saveContenedores();
  showToast('Contenedor '+id+' eliminado');
  renderAdminContenedores();
}

function _renderCntDetalle(cntId){
  var el=document.getElementById('admin-content');if(!el)return;
  var c=CONTENEDORES.find(function(x){return x.id===cntId;});
  if(!c){_cntDetalle=null;renderAdminContenedores();return;}
  var estadoCol={recibido:'var(--color-text-success)',en_transito:'var(--color-text-info)',retrasado:'var(--color-text-danger)'};
  var estadoIco={recibido:'✅',en_transito:'🚢',retrasado:'⚠️'};
  var estadoLbl={recibido:'Recibido',en_transito:'En tránsito',retrasado:'Retrasado'};
  var estC=estadoCol[c.estado]||'var(--color-text-secondary)';
  var movs=STOCK_MOVS.filter(function(m){return m.contenedor===cntId&&m.tipo==='entrada';});
  var reservas=(typeof S!=='undefined'&&S.reservas?S.reservas:[]).filter(function(r){return r.contenedor===cntId;});

  // Resumen por producto de entradas
  var prodMap={};
  movs.forEach(function(m){
    if(!prodMap[m.producto])prodMap[m.producto]=0;
    prodMap[m.producto]+=m.cantidad;
  });

  var movsHtml=Object.keys(prodMap).length
    ?'<div class="adm-table-wrap"><table class="adm-table"><thead><tr><th>Producto</th><th style="text-align:right">Uds entradas</th></tr></thead><tbody>'
      +Object.keys(prodMap).sort().map(function(pn){
        return '<tr><td style="font-size:12px">'+pn+'</td><td style="text-align:right;font-weight:600">'+fN(prodMap[pn],0)+'</td></tr>';
      }).join('')
      +'</tbody></table></div>'
    :'<div style="color:var(--color-text-tertiary);font-size:12px;padding:14px 0">Sin entradas de stock registradas para este contenedor.</div>';

  var resHtml=reservas.length
    ?'<div class="adm-table-wrap"><table class="adm-table"><thead><tr><th>Cliente</th><th>Vendedor</th><th>Almacén</th><th>Fecha</th><th>Productos</th><th style="text-align:right">Total</th><th>Estado</th></tr></thead><tbody>'
      +reservas.map(function(r){
        return '<tr>'
          +'<td style="font-size:12px">'+(r.cli||'Walk-in')+(r.nota?'<br><span style="color:var(--color-text-tertiary);font-size:10px">'+r.nota+'</span>':'')+'</td>'
          +'<td style="font-size:11px">'+r.user+'</td>'
          +'<td style="font-size:11px">'+r.alm+'</td>'
          +'<td style="font-size:11px">'+r.fecha+'</td>'
          +'<td style="font-size:11px;color:var(--color-text-secondary)">'+r.lineas.map(function(l){return l.q+'× '+l.n;}).join(', ')+'</td>'
          +'<td style="text-align:right;font-weight:600">'+fN(r.totalUSD)+' USD</td>'
          +'<td style="font-size:11px">'+( r.activa?'<span style="color:var(--color-text-info)">Activa</span>':'<span style="color:var(--color-text-tertiary)">Cerrada</span>' )+'</td>'
          +'</tr>';
      }).join('')
      +'</tbody></table></div>'
    :'<div style="color:var(--color-text-tertiary);font-size:12px;padding:14px 0">Sin reservas asociadas a este contenedor.</div>';

  el.innerHTML='<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">'
    +'<button class="adm-btn" onclick="_cntDetalle=null;renderAdminContenedores()">← Volver</button>'
    +'<div><div style="font-size:16px;font-weight:800">'+c.id+'</div>'
    +(c.nombre&&c.nombre!==c.id?'<div style="font-size:12px;color:var(--color-text-secondary)">'+c.nombre+'</div>':'')
    +'</div>'
    +'<div style="margin-left:auto;font-size:13px;font-weight:700;color:'+estC+'">'+estadoIco[c.estado]+' '+estadoLbl[c.estado]+'</div>'
    +'</div>'
    +(c.eta?'<div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:6px">📅 ETA: <strong>'+fD(c.eta)+'</strong></div>':'')
    +(c.notas?'<div style="font-size:11px;color:var(--color-text-tertiary);margin-bottom:16px">📝 '+c.notas+'</div>':'')
    +'<div style="display:flex;gap:8px;margin-bottom:20px">'
    +'<div class="adm-card" style="text-align:center;min-width:100px"><div class="adm-lbl">Entradas</div><div class="adm-val" style="color:var(--color-text-success)">'+movs.length+'</div></div>'
    +'<div class="adm-card" style="text-align:center;min-width:100px"><div class="adm-lbl">Reservas</div><div class="adm-val" style="color:var(--color-text-info)">'+reservas.filter(function(r){return r.activa;}).length+'</div></div>'
    +'<div class="adm-card" style="text-align:center;min-width:100px"><div class="adm-lbl">Productos</div><div class="adm-val">'+Object.keys(prodMap).length+'</div></div>'
    +'</div>'
    +'<div style="font-size:13px;font-weight:600;margin-bottom:8px">📥 Entradas de stock</div>'
    +movsHtml
    +'<div style="font-size:13px;font-weight:600;margin:16px 0 8px">📋 Reservas</div>'
    +resHtml;
}

// ── COMISIONES ADMIN ─────────────────────────────────────────
async function renderAdminComisiones(){
  var el=document.getElementById('admin-content');if(!el)return;
  await loadComReglas();
  var vendedores=Object.keys(USERS).filter(function(u){return USERS[u].rol==='vendedor'&&USERS[u].activo!==false;});
  var prods=PRODS.filter(function(p){return p.activo!==false;}).map(function(p){return p.n;});
  var cats=[...new Set(PRODS.map(function(p){return p.cat||'';}).filter(Boolean))];
  var alms=['Habana','Placetas','Xportprise'];

  var rulesHtml=COM_REGLAS.map(function(r,i){
    return '<tr>'      +'<td>'+r.vendedor+'</td>'      +'<td>'+(r.producto||'—')+'</td>'      +'<td>'+(r.categoria||'—')+'</td>'      +'<td>'+(r.almacen||'Todos')+'</td>'      +'<td style="color:var(--color-text-warning);font-weight:600">'+r.pct+'%</td>'      +'<td><button class="adm-btn" style="padding:2px 8px;font-size:11px" onclick="delComRegla('+r.id+')">✕</button></td>'      +'</tr>';
  }).join('');

  el.innerHTML='<div style="font-size:14px;font-weight:600;margin-bottom:16px">🏆 Reglas de Comisión</div>'    +'<div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:12px">Prioridad: Producto > Categoría > Almacén > Global. Regla más específica gana.</div>'    +'<div class="card" style="margin-bottom:16px">'    +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:12px">'    +'<div><label class="lbl">Vendedor</label>'    +'<select id="cr-vend" style="width:100%"><option value="*">Todos</option>'    +vendedores.map(function(v){return '<option>'+v+'</option>';}).join('')+'</select></div>'    +'<div><label class="lbl">Producto (opcional)</label>'    +'<select id="cr-prod" style="width:100%"><option value="">— Cualquiera —</option>'    +prods.map(function(p){return '<option>'+p+'</option>';}).join('')+'</select></div>'    +'<div><label class="lbl">Categoría (opcional)</label>'    +'<select id="cr-cat" style="width:100%"><option value="">— Cualquiera —</option>'    +cats.map(function(c){return '<option>'+c+'</option>';}).join('')+'</select></div>'    +'<div><label class="lbl">Almacén (opcional)</label>'    +'<select id="cr-alm" style="width:100%"><option value="">Todos</option>'    +alms.map(function(a){return '<option>'+a+'</option>';}).join('')+'</select></div>'    +'<div><label class="lbl">% Comisión</label>'    +'<input type="number" id="cr-pct" step="0.1" min="0" max="100" value="4" style="width:100%"></div>'    +'</div>'    +'<button class="btn btn-p" onclick="addComRegla()">+ Añadir regla</button>'    +'</div>'    +'<div class="card">'    +'<table style="width:100%;border-collapse:collapse;font-size:12px">'    +'<thead><tr style="color:var(--color-text-secondary)"><th style="text-align:left;padding:6px 4px">Vendedor</th><th style="text-align:left;padding:6px 4px">Producto</th><th style="text-align:left;padding:6px 4px">Categoría</th><th style="text-align:left;padding:6px 4px">Almacén</th><th style="text-align:left;padding:6px 4px">%</th><th></th></tr></thead>'    +'<tbody id="com-reglas-body">'+rulesHtml+'</tbody>'    +'</table>'    +(COM_REGLAS.length===0?'<div style="text-align:center;padding:20px;color:var(--color-text-tertiary);font-size:12px">Sin reglas. Añade una arriba.</div>':'')
    +'</div>';
}

async function addComRegla(){
  var vend=document.getElementById('cr-vend').value;
  var prod=document.getElementById('cr-prod').value;
  var cat=document.getElementById('cr-cat').value;
  var alm=document.getElementById('cr-alm').value;
  var pct=parseFloat(document.getElementById('cr-pct').value)||0;
  if(!vend||pct<=0){showToast('⚠ Selecciona vendedor y % válido');return;}
  var row={vendedor:vend,producto:prod||null,categoria:cat||null,almacen:alm||null,pct:pct};
  try{
    var r=await supaReq('POST','com_reglas',row);
    if(r.ok){showToast('✓ Regla añadida');await renderAdminComisiones();}
    else{showToast('Error al guardar');}
  }catch(e){showToast('Error: '+e.message);}
}

async function delComRegla(id){
  if(!confirm('¿Eliminar esta regla?'))return;
  try{
    await supaReq('DELETE','com_reglas?id=eq.'+id);
    showToast('✓ Regla eliminada');
    await renderAdminComisiones();
  }catch(e){showToast('Error: '+e.message);}
}

function renderMiComision(){
  var el=document.getElementById('liq-micomision-root');if(!el)return;
  var vend=S.user;
  var misVentas=VENTAS.filter(function(v){return v.vend===vend&&v.estCom!=='No aplica';});
  var pendiente=misVentas.filter(function(v){return v.estCom==='Pendiente';}).reduce(function(a,v){return a+v.comUSD;},0);
  var pagado=misVentas.filter(function(v){return v.estCom==='Pagada'||v.estCom==='Liquidada (Pdte)';}).reduce(function(a,v){return a+v.comUSD;},0);
  var total=pendiente+pagado;

  // Render metrics box only
  el.innerHTML='<div style="padding:4px;margin-bottom:12px">'
    +'<div style="font-size:16px;font-weight:700;margin-bottom:16px">🏆 Mi Comisión</div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">'
    +'<div class="card" style="text-align:center;margin:0">'
    +'<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:4px">ACUMULADA</div>'
    +'<div style="font-size:22px;font-weight:800;color:var(--color-text-warning)">$'+fN(total)+'</div>'
    +'</div>'
    +'<div class="card" style="text-align:center;margin:0">'
    +'<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:4px">PENDIENTE</div>'
    +'<div style="font-size:22px;font-weight:800;color:var(--color-text-danger)">$'+fN(pendiente)+'</div>'
    +'</div>'
    +'<div class="card" style="text-align:center;margin:0">'
    +'<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:4px">COBRADA</div>'
    +'<div style="font-size:22px;font-weight:800;color:var(--color-text-success)">$'+fN(pagado)+'</div>'
    +'</div>'
    +'</div>'
    +'</div>';
}


// ── PRODUCTOS ──────────────────────────────────────────────
function renderAdminProductos() {
  var el = document.getElementById('admin-content');
  if (!el) return;

  if (editingProd !== null) { renderFormProducto(); return; }

  var inp = document.getElementById('adm-prod-q');
  if (inp) window._admProdQ = inp.value;
  var q = (window._admProdQ || '').toLowerCase();

  var catInp = document.getElementById('adm-prod-cat');
  if (catInp) window._admProdCat = catInp.value;
  var selectedCat = window._admProdCat || '';

  var totalStk = PRODS.reduce(function(a, p) { return a + (p.stk || 0); }, 0);
  var bajoStk  = PRODS.filter(function(p) { return (p.stk || 0) <= (p.stk_min || 10); }).length;

  var rows = PRODS.filter(function(p) {
    if (selectedCat && p.cat !== selectedCat) return false;
    return !q || p.n.toLowerCase().indexOf(q) >= 0;
  });
  rows.sort(function(a, b) {
    return (a.n || '').localeCompare(b.n || '', undefined, { sensitivity: 'base', numeric: true });
  });

  var html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">'
    + '<div class="adm-card"><div class="adm-lbl">Productos</div><div class="adm-val">' + PRODS.length + '</div></div>'
    + '<div class="adm-card"><div class="adm-lbl">Unidades totales</div><div class="adm-val">' + fN(totalStk, 0) + '</div></div>'
    + '<div class="adm-card"><div class="adm-lbl">Stock bajo</div><div class="adm-val" style="color:var(--color-text-warning)">' + bajoStk + '</div></div>'
    + '</div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">'
    + '<div style="display:flex;gap:8px;flex:1;max-width:460px;flex-wrap:wrap">'
    + '<input class="adm-inp" id="adm-prod-q" placeholder="Buscar producto..." oninput="_dRender(renderAdminProductos)" style="flex:1;min-width:180px" value="' + q + '">'
    + '<select class="adm-inp" id="adm-prod-cat" onchange="renderAdminProductos()" style="flex:1;min-width:150px">'
    + '<option value="">Todas las categorías</option>'
    + (function(){
        var _cats = getCategorias();
        return _cats.map(function(c){
          return '<option' + (selectedCat === c ? ' selected' : '') + ' value="' + c + '">' + c + '</option>';
        }).join('');
      })()
    + '</select>'
    + '</div>'
    + '<button class="adm-btn adm-btn-p" onclick="editingProd=-1;renderAdminContent()">+ Nuevo producto</button>'
    + '</div>'
    + '<div id="prod-sel-bar" style="display:none;padding:8px 10px;background:var(--color-background-secondary);border-radius:var(--border-radius-md);margin-bottom:8px;flex-wrap:wrap;align-items:center;gap:8px">'
    + '<span id="prod-sel-count" style="font-size:12px;font-weight:600;color:var(--color-text-info)">0 sel.</span>'
    + '<button class="adm-btn-sm" onclick="admSelProdToggle(true,\'activo\')">⛔ Des. POS</button>'
    + '<button class="adm-btn-sm" onclick="admSelProdToggle(false,\'activo\')">✅ Act. POS</button>'
    + '<button class="adm-btn-sm" onclick="admSelProdToggle(true,\'enStock\')">🚫 Ocultar Stk</button>'
    + '<button class="adm-btn-sm" onclick="admSelProdToggle(false,\'enStock\')">📦 Mostrar Stk</button>'
    + '<button class="adm-btn-sm" onclick="admSelProdToggle(true,\'enWeb\')">🚫 Ocultar Web</button>'
    + '<button class="adm-btn-sm" onclick="admSelProdToggle(false,\'enWeb\')">🌐 Mostrar Web</button>'
    + '<button class="adm-btn-sm" style="margin-left:auto" onclick="admDeselProds()">✕</button>'
    + '</div>'
    + '<div class="adm-table-wrap"><table class="adm-table"><thead><tr>'
    + '<th style="width:20px"><input type="checkbox" id="prod-chk-all" onchange="admChkAllProds(this.checked)"></th>'
    + '<th>Producto</th><th style="text-align:right">Min</th><th style="text-align:right">May</th>'
    + '<th style="text-align:right">DDP</th><th style="text-align:right">Stock</th>'
    + '<th style="text-align:right">Mín</th><th style="text-align:center">POS</th><th style="text-align:center">Stk</th><th style="text-align:center">Web</th><th></th>'
    + '</tr></thead><tbody>';

  rows.forEach(function(p) {
    var idx = PRODS.indexOf(p);
    var bajo = (p.stk || 0) <= (p.stk_min || 10);
    html += '<tr' + (bajo ? ' class="bajo"' : '') + (p.activo===false ? ' style="opacity:.45"' : '') + '>'
      + '<td style="text-align:center"><input type="checkbox" class="prod-chk" data-idx="'+idx+'" style="width:15px;height:15px"></td>'
      + '<td style="font-size:12px">' + p.n + (p.cat ? '<div style="font-size:9px;color:var(--color-text-tertiary);margin-top:1px">' + p.cat + '</div>' : '') + '</td>'
      + '<td style="text-align:right">' + (p.min != null ? fN(p.min) : '—') + '</td>'
      + '<td style="text-align:right">' + (p.maj != null ? fN(p.maj) : '—') + '</td>'
      + '<td style="text-align:right;font-size:11px;color:var(--color-text-secondary)">' + (p.ddp != null ? fN(p.ddp) : '—') + '</td>'
      + '<td style="text-align:right;font-weight:600' + (bajo ? ';color:var(--color-text-warning)' : '') + '">' + fN(p.stk || 0, 0) + '</td>'
      + '<td style="text-align:right;font-size:11px;color:var(--color-text-tertiary)">' + (p.stk_min || 10) + '</td>'
      + '<td style="text-align:center"><button class="btn-sm" style="font-size:12px;padding:2px 6px" onclick="admToggleProd('+idx+',\'activo\')" title="POS">'+(p.activo===false?'⛔':'✅')+'</button></td>'
      + '<td style="text-align:center"><button class="btn-sm" style="font-size:12px;padding:2px 6px" onclick="admToggleProd('+idx+',\'enStock\')" title="Stock">'+(p.enStock===false?'🚫':'📦')+'</button></td>'
      + '<td style="text-align:center"><button class="btn-sm" style="font-size:12px;padding:2px 6px" onclick="admToggleProd('+idx+',\'enWeb\')" title="Web">'+(p.enWeb===false?'🚫':'🌐')+'</button></td>'
      + '<td style="white-space:nowrap">'
      + '<button class="adm-btn-sm" onclick="editingProd=' + idx + ';renderAdminContent()">✏️</button> '
      + '<button class="adm-btn-sm" onclick="admCloneProd(' + idx + ')" title="Clonar">📋</button> '
      + '<button class="adm-btn-sm" onclick="admElimProd(' + idx + ')" style="color:var(--color-text-danger)">×</button>'
      + '</td></tr>';
  });

  html += '</tbody></table></div>';
  el.innerHTML = html;
  // Attach change listeners for sel bar
  document.querySelectorAll('.prod-chk').forEach(function(c){
    c.addEventListener('change', admUpdSelBar);
  });
}
function admAddEscalaRow(){
  var container = document.getElementById('ep-escala-rows');
  if(!container) return;
  var div = document.createElement('div');
  div.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:6px;align-items:center';
  div.innerHTML = '<input class="adm-inp ep-esc-desde" type="number" placeholder="Desde" min="1" step="1">'
    +'<input class="adm-inp ep-esc-hasta" type="number" placeholder="\u221e" min="1" step="1">'
    +'<input class="adm-inp ep-esc-precio" type="number" placeholder="Precio" step="0.01">'
    +'<button type="button" onclick="this.closest(\'div\').remove()" style="background:transparent;border:1px solid var(--color-border-danger);color:var(--color-text-danger);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px">\u2715</button>';
  container.appendChild(div);
}

function renderFormProducto() {
  var el = document.getElementById('admin-content');
  if (!el) return;
  var isNew = (editingProd === -1);
  var p = isNew 
    ? (window.clonedProdData 
        ? {
            n: window.clonedProdData.n + ' (Copia)',
            cat: window.clonedProdData.cat||'',
            activo: window.clonedProdData.activo!==false,
            enStock: window.clonedProdData.enStock!==false,
            enWeb: window.clonedProdData.enWeb!==false,
            enTransito: window.clonedProdData.enTransito ? JSON.parse(JSON.stringify(window.clonedProdData.enTransito)) : {Habana:false, Placetas:false, Xportprise:false},
            min: window.clonedProdData.min,
            maj: window.clonedProdData.maj,
            escala: window.clonedProdData.escala ? JSON.parse(JSON.stringify(window.clonedProdData.escala)) : [],
            ddp: window.clonedProdData.ddp,
            oferta: window.clonedProdData.oferta===true,
            badgeTexto: window.clonedProdData.badgeTexto==='RESERVADO' ? '' : (window.clonedProdData.badgeTexto||''),
            precioOfertaHabana: window.clonedProdData.precioOfertaHabana,
            precioOfertaPlacetas: window.clonedProdData.precioOfertaPlacetas,
            min_placetas: window.clonedProdData.min_placetas,
            maj_placetas: window.clonedProdData.maj_placetas,
            stk_min: window.clonedProdData.stk_min||10,
            preventa_min: window.clonedProdData.preventa_min,
            moq: window.clonedProdData.moq||1,
            preventa_maj: window.clonedProdData.preventa_maj,
            img: window.clonedProdData.img||'',
            stk: 0,
            stk_alm: {Habana:0, Placetas:0, Xportprise:0}
          }
        : {n:'', min:null, maj:null, ddp:null, stk:0, stk_alm:{Habana:0,Placetas:0,Xportprise:0}, stk_min:10}
      )
    : PRODS[editingProd];

  // Stock managed via Movimientos de Stock module

  el.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">'
    + '<button class="adm-btn" onclick="editingProd=null;renderAdminContent()">← Volver</button>'
    + '<span style="font-size:14px;font-weight:600">' + (isNew ? 'Nuevo producto' : 'Editar: ' + p.n) + '</span>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:560px">'
    + '<div style="grid-column:1/-1"><label class="adm-lbl-f">Nombre *</label>'
    + '<input class="adm-inp" id="ep-n" value="' + (p.n || '').replace(/"/g,'&quot;') + '" placeholder="Nombre del producto"></div>'
    + '<div style="grid-column:1/-1"><label class="adm-lbl-f">Categor\u00eda</label>'
    + (function(){var _cats=getCategorias();var o='<option value="">(Sin categoría)</option>'+_cats.map(function(c){return '<option'+(p.cat===c?' selected':'')+' value="'+c+'">'+c+'</option>';}).join('');return '<select class="adm-inp" id="ep-cat">'+o+'</select>';})()+'</div>'
    + '<div style="display:flex;align-items:center;gap:12px;padding:6px 0;grid-column:1/-1">'
    + '<label class="adm-lbl-f" style="margin:0;flex:1">Activo en POS</label>'
    + '<input type="checkbox" id="ep-activo"' + (p.activo!==false?' checked':'') + ' style="width:18px;height:18px;cursor:pointer">'
    + '</div>'
    + '<div style="display:flex;align-items:center;gap:12px;padding:6px 0;grid-column:1/-1">'
    + '<label class="adm-lbl-f" style="margin:0;flex:1">Visible en Stock</label>'
    + '<input type="checkbox" id="ep-en-stock"' + (p.enStock!==false?' checked':'') + ' style="width:18px;height:18px;cursor:pointer">'
    + '</div>'
    + '<div style="display:flex;align-items:center;gap:12px;padding:6px 0;grid-column:1/-1">'
    + '<label class="adm-lbl-f" style="margin:0;flex:1">Visible en la Web (Catálogo)</label>'
    + '<input type="checkbox" id="ep-en-web"' + (p.enWeb!==false?' checked':'') + ' style="width:18px;height:18px;cursor:pointer">'
    + '</div>'
    + '<div style="display:flex;align-items:center;gap:12px;padding:6px 0;grid-column:1/-1;border-top:1px solid var(--color-border-tertiary);margin-top:4px;padding-top:10px">'
    + '<label class="adm-lbl-f" style="margin:0;flex:1">Venta por Encargo (Importación)</label>'
    + '<input type="checkbox" id="ep-por-encargo"' + (p.por_encargo?' checked':'') + ' style="width:18px;height:18px;cursor:pointer" onchange="document.getElementById(\'ep-esquema-row\').style.display=this.checked?\'block\':\'none\'">'
    + '</div>'
    + '<div id="ep-esquema-row" style="grid-column:1/-1;padding-bottom:10px;display:' + (p.por_encargo?'block':'none') + '">'
    + '<div style="background:rgba(59,130,246,0.05);border:1px solid rgba(59,130,246,0.2);padding:12px;border-radius:8px;display:grid;gap:10px">'
    + '<div class="adm-lbl" style="color:#3b82f6;font-weight:700">🚢 Opciones de Importación</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    + '<div style="display:grid;gap:4px">'
    + '<label style="font-size:11px;font-weight:600">Esquema de Pagos</label>'
    + '<input class="adm-inp" id="ep-esquema-pago" value="' + (p.esquema_pago||'') + '" placeholder="Ej: 50% al reservar...">'
    + '</div>'
    + '<div style="display:grid;gap:4px">'
    + '<label style="font-size:11px;font-weight:600">Tiempo de Tránsito / Entrega</label>'
    + '<input class="adm-inp" id="ep-tiempo-transito" value="' + (p.tiempo_transito||'') + '" placeholder="Ej: 45 a 60 días">'
    + '</div>'
    + '<div style="display:grid;gap:4px">'
    + '<div style="display:grid;gap:4px;grid-column:1/-1">' + '<label style="font-size:11px;font-weight:600">Nombre Puerto / Destino CIF</label>' + '<input class="adm-inp" type="text" id="ep-nombre-puerto" value="' + (p.nombre_puerto||'') + '" placeholder="Ej: Mariel">' + '</div>'
    + '<label style="font-size:11px;font-weight:600">Precio CIF - Puerto Cuba (USD)</label>'
    + '<input class="adm-inp" type="number" id="ep-precio-cif" value="' + (p.cif!=null?p.cif:'') + '" placeholder="Ej: 95" step="0.01">'
    + '</div>'
    + '<div style="display:grid;gap:4px">'
    + '<label style="font-size:11px;font-weight:600">Precio DDP - Nacionalizado (USD)</label>'
    + '<input class="adm-inp" type="number" id="ep-precio-ddp-imp" value="' + (p.ddp!=null?p.ddp:'') + '" placeholder="Ej: 115" step="0.01">'
    + '</div>'
    + '<div style="display:grid;gap:4px">'
    + '<label style="font-size:11px;font-weight:600">Precio en Mercado Local (USD)</label>'
    + '<input class="adm-inp" type="number" id="ep-precio-mercado" value="' + (p.precio_mercado!=null?p.precio_mercado:'') + '" placeholder="Ej: 250">'
    + '</div>'
    + '<div style="display:grid;gap:4px;grid-column:1/-1">'
    + '<label style="font-size:11px;font-weight:600">Ficha Técnica / Descripción</label>'
    + '<textarea class="adm-inp" id="ep-ficha-tecnica" style="height:80px;resize:vertical" placeholder="Puedes pegar todas las características técnicas aquí (Potencia, Dimensiones, Peso, etc.) usando varios renglones...">' + (p.ficha_tecnica||'') + '</textarea>'
    + '</div>'
    + '</div>'
    + '</div>'
    + '</div>'
    + '<div style="grid-column:1/-1;padding:8px 0 4px">'    + '<div style="font-size:11px;font-weight:700;color:var(--color-text-secondary);margin-bottom:8px">🚢 En tránsito por almacén</div>'    + '<div style="display:flex;gap:16px;flex-wrap:wrap">'    + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px"><input type="checkbox" id="ep-transito-hab"' + (p.enTransito&&p.enTransito.Habana?' checked':'') + ' style="width:15px;height:15px"> Habana</label>'    + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px"><input type="checkbox" id="ep-transito-plac"' + (p.enTransito&&p.enTransito.Placetas?' checked':'') + ' style="width:15px;height:15px"> Placetas</label>'    + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px"><input type="checkbox" id="ep-transito-xport"' + (p.enTransito&&p.enTransito.Xportprise?' checked':'') + ' style="width:15px;height:15px"> Xportprise</label>'    + '</div></div>'
    + '<div><label class="adm-lbl-f">Precio Minorista (USD)</label>'
    + '<input class="adm-inp" type="number" id="ep-min" value="' + (p.min != null ? p.min : '') + '" step="0.0001" placeholder="—"></div>'
    + '<div><label class="adm-lbl-f">Precio Mayorista base (USD)</label>'    + '<input class="adm-inp" type="number" id="ep-maj" value="' + (p.maj != null ? p.maj : '') + '" step="0.0001" placeholder="—"></div>'    + '<div style="grid-column:1/-1">'    + '<div style="font-size:12px;font-weight:700;margin-bottom:6px;color:var(--color-text-secondary)">📊 Escala de precios mayorista (opcional)</div>'    + '<div style="font-size:11px;color:var(--color-text-tertiary);margin-bottom:8px">Precios por rangos de cantidad. Si vacío usa el precio mayorista base.</div>'    + '<div id="ep-escala-rows" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">'    + (function(){        var rows = p.escala&&p.escala.length ? p.escala : [];        return rows.map(function(r,i){          return '<div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:6px;align-items:center">'            +'<input class="adm-inp ep-esc-desde" type="number" value="'+r.desde+'" placeholder="Desde" min="1" step="1">'            +'<input class="adm-inp ep-esc-hasta" type="number" value="'+(!r.hasta?'':''+r.hasta)+'" placeholder="∞" min="1" step="1">'            +'<input class="adm-inp ep-esc-precio" type="number" value="'+r.precio+'" placeholder="Precio" step="0.0001">'            +'<button type="button" onclick="this.closest(\'div\').remove()" style="background:transparent;border:1px solid var(--color-border-danger);color:var(--color-text-danger);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px">✕</button>'            +'</div>';        }).join('');      })()    + '</div>'    + '<button type="button" onclick="admAddEscalaRow()" class="adm-btn" style="font-size:12px;padding:4px 10px">+ Añadir rango</button>'    + '</div>'
    + '<div><label class="adm-lbl-f">Coste DDP (USD)</label>'
    + '<input class="adm-inp" type="number" id="ep-ddp" value="' + (p.ddp != null ? p.ddp : '') + '" step="0.0001" placeholder="—"></div>'
    + '<div style="grid-column:1/-1;background:rgba(245,158,11,.07);border:1.5px solid rgba(245,158,11,.32);border-radius:10px;padding:12px;margin-top:4px">'
    + '<div style="font-size:11px;font-weight:700;color:#d97706;margin-bottom:10px">&#x1F3F7; Badge de oferta</div>'
    + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">'
    + '<label class="adm-lbl-f" style="margin:0;flex:1">Marcar en oferta</label>'
    + '<input type="checkbox" id="ep-oferta"' + (p.oferta?' checked':'') + ' style="width:18px;height:18px;cursor:pointer" onchange="document.getElementById(\'ep-badge-row\').style.display=this.checked?\'block\':\'none\'">'
    + '</div>'
    + '<div id="ep-badge-row" style="display:' + (p.oferta?'block':'none') + '">'
    + '<label class="adm-lbl-f">Texto del badge (max 20 caracteres)</label>'
    + '<input class="adm-inp" id="ep-badge-texto" value="' + (p.badgeTexto||'Oferta') + '" placeholder="Oferta" maxlength="20" style="max-width:200px;margin-bottom:10px">'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
    + '<div><label class="adm-lbl-f">Precio oferta Habana (USD)</label>'
    + '<input class="adm-inp" type="number" id="ep-pofe-hab" value="' + (p.precioOfertaHabana!=null?p.precioOfertaHabana:'') + '" step="0.0001" placeholder="—"></div>'
    + '<div><label class="adm-lbl-f">Precio oferta Placetas (USD)</label>'
    + '<input class="adm-inp" type="number" id="ep-pofe-plac" value="' + (p.precioOfertaPlacetas!=null?p.precioOfertaPlacetas:'') + '" step="0.0001" placeholder="= Habana"></div>'
    + '</div></div>'
    + '</div>'
    + '<div style="grid-column:1/-1;background:rgba(124,58,237,.07);border:1.5px solid rgba(124,58,237,.28);border-radius:10px;padding:12px;margin-top:4px">'
    + '<div style="font-size:11px;font-weight:700;color:#7c3aed;margin-bottom:10px">🔒 Badge Reservado</div>'
    + '<div style="display:flex;align-items:center;gap:12px">'
    + '<label class="adm-lbl-f" style="margin:0;flex:1">Marcar como Reservado (visible en catálogo y POS)</label>'
    + '<input type="checkbox" id="ep-reservado"' + (p.reservado?' checked':'') + ' style="width:18px;height:18px;cursor:pointer">'
    + '</div>'
    + '</div>'
    + '<div style="grid-column:1/-1;border-top:1px solid var(--color-border-tertiary);padding-top:12px;margin-top:4px">'    + '<div style="font-size:12px;font-weight:700;margin-bottom:10px;color:var(--color-text-secondary)">🏪 Precios Placetas (opcional)</div>'    + '<div style="font-size:11px;color:var(--color-text-tertiary);margin-bottom:8px">Si está vacío usa el precio de Habana. Rellena solo si Placetas tiene precio diferente.</div>'    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'    + '<div><label class="adm-lbl-f">Min. Placetas (USD)</label>'    + '<input class="adm-inp" type="number" id="ep-min-plac" value="' + (p.min_placetas != null ? p.min_placetas : '') + '" step="0.0001" placeholder="= Habana"></div>'    + '<div><label class="adm-lbl-f">May. Placetas (USD)</label>'    + '<input class="adm-inp" type="number" id="ep-maj-plac" value="' + (p.maj_placetas != null ? p.maj_placetas : '') + '" step="0.0001" placeholder="= Habana"></div>'    + '</div></div>'    + '<div><label class="adm-lbl-f">Stock mínimo alerta</label>'
    + '<input class="adm-inp" type="number" id="ep-stk-min" value="' + (p.stk_min || 10) + '" min="0" step="1"></div>'

    + '<div style="grid-column:1/-1;border-top:1px solid var(--color-border-tertiary);padding-top:12px;margin-top:4px">'
    + '<div style="font-size:12px;font-weight:700;margin-bottom:10px;color:#f59e0b">🏷 Precio preventa (solo en tránsito)</div>'
    + '<div style="font-size:11px;color:var(--color-text-tertiary);margin-bottom:8px">Precio especial de reserva. Si vacío usa el precio normal.</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    + '<div><label class="adm-lbl-f">Preventa (USD)</label>'
    + '<input class="adm-inp" type="text" id="ep-preventa-min" value="' + (p.preventa_min != null ? p.preventa_min : '') + '" placeholder="USD o %" onblur="var v=this.value.trim();if(v.endsWith(\'%\')){var b=parseFloat(document.getElementById(\'ep-min\').value)||parseFloat(document.getElementById(\'ep-maj\').value)||0;if(b>0){var pct=parseFloat(v);if(!isNaN(pct)){var s=v.startsWith(\'+\')?1:-1;this.value=Number((b*(1+s*Math.abs(pct)/100)).toFixed(4)).toString();}}}else if(v!==\'\'&&!isNaN(parseFloat(v))){this.value=Number(parseFloat(v).toFixed(4)).toString();}"></div>'
    + '<div><label class="adm-lbl-f">MOQ preventa (mín. reserva)</label>'
    + '<input class="adm-inp" type="number" id="ep-moq" value="' + (p.moq || 1) + '" min="1" step="1" placeholder="1"></div>'
    + '</div>'
    + '</div>'

    + '</div>'
    + '<div style="margin-top:8px;padding:10px;background:var(--color-background-secondary);border-radius:var(--border-radius-md)">'
    + '<div style="font-size:11px;color:var(--color-text-tertiary)">💡 El stock se gestiona desde el módulo <strong>Stock → Nuevo movimiento</strong></div>'
    + '<div style="font-size:12px;margin-top:4px">Stock actual: <strong>' + fN(p.stk||0,0) + ' uds</strong> (Habana: '+(p.stk_alm&&p.stk_alm.Habana||0)+' · Placetas: '+(p.stk_alm&&p.stk_alm.Placetas||0)+' · Xportprise: '+(p.stk_alm&&p.stk_alm.Xportprise||0)+')</div>'
    + '</div>'
    + '<div style="margin-top:14px;padding:14px;background:var(--color-background-secondary);border-radius:var(--border-radius-md)">'
    + '<div style="font-size:12px;font-weight:600;margin-bottom:10px">🖼️ Foto del producto (catálogo público)</div>'
    + (p.img ? '<img src="'+p.img+'" style="width:100%;max-width:240px;border-radius:8px;margin-bottom:10px;display:block" onerror="this.style.display=\'none\'">' : '')
    + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
    + '<input type="file" id="ep-img-file" accept="image/*" style="display:none" onchange="admUploadImg(this,' + (isNew?-1:editingProd) + ')">'
    + '<button class="adm-btn" onclick="document.getElementById(\'ep-img-file\').click()" id="btn-upload-img">📷 Subir foto</button>'
    + '<span id="img-upload-status" style="font-size:11px;color:var(--color-text-secondary)">'+(p.img?'✓ Foto guardada':'Sin foto')+'</span>'
    + '</div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;margin-top:20px">'
    + '<button class="adm-btn adm-btn-p" onclick="admGuardarProd(' + (isNew ? -1 : editingProd) + ')">' + (isNew ? 'Crear producto' : 'Guardar cambios') + '</button>'
    + '<button class="adm-btn" onclick="editingProd=null;renderAdminContent()">Cancelar</button>'
    + '</div>';
}

function admGuardarProd(idx) {
  var n = (document.getElementById('ep-n').value || '').trim();
  if (!n) { showToast('El nombre es obligatorio'); return; }
  var min = parseFloat(document.getElementById('ep-min').value);
  var maj = parseFloat(document.getElementById('ep-maj').value);
  var escala = [];
  document.querySelectorAll('#ep-escala-rows > div').forEach(function(row){
    var desde = parseInt(row.querySelector('.ep-esc-desde').value);
    var hastaEl = row.querySelector('.ep-esc-hasta').value;
    var hasta = hastaEl ? parseInt(hastaEl) : null;
    var precio = parseFloat(row.querySelector('.ep-esc-precio').value);
    if(!isNaN(desde) && !isNaN(precio)) escala.push({desde:desde, hasta:hasta, precio:precio});
  });
  escala = escala.length ? escala.sort(function(a,b){return a.desde-b.desde;}) : null;
  var ddp = parseFloat(document.getElementById('ep-precio-ddp-imp')?.value ?? document.getElementById('ep-ddp')?.value);
  var cifV = document.getElementById('ep-precio-cif')?.value||'';
  var cif = cifV!==''&&!isNaN(parseFloat(cifV)) ? parseFloat(cifV) : null;
  var stk_min = parseInt(document.getElementById('ep-stk-min').value) || 10;
  var moq = parseInt(document.getElementById('ep-moq')?.value) || 1;
  var min_placetas_v = document.getElementById('ep-min-plac')?.value;
  var preventa_min_v = (document.getElementById('ep-preventa-min')?.value||'').trim();
  if(preventa_min_v.endsWith('%')){
     var b=parseFloat(document.getElementById('ep-min').value)||parseFloat(document.getElementById('ep-maj').value)||0;
     var p_pct=parseFloat(preventa_min_v);
     if(b>0 && !isNaN(p_pct)){
        var s=preventa_min_v.startsWith('+')?1:-1;
        preventa_min_v = (b*(1+s*Math.abs(p_pct)/100)).toFixed(2);
     }
  }
  var preventa_min = preventa_min_v!==''&&!isNaN(parseFloat(preventa_min_v))?parseFloat(preventa_min_v):null;
  var preventa_maj = null;
  var maj_placetas_v = document.getElementById('ep-maj-plac')?.value;
  var min_placetas = min_placetas_v!=='' && !isNaN(parseFloat(min_placetas_v)) ? parseFloat(min_placetas_v) : null;
  var maj_placetas = maj_placetas_v!=='' && !isNaN(parseFloat(maj_placetas_v)) ? parseFloat(maj_placetas_v) : null;
  // Stock preserved from existing product (managed via movements)
  var existingProd = idx === -1 ? null : PRODS[idx];
  var stk_alm = existingProd ? (existingProd.stk_alm || {Habana:0,Placetas:0,Xportprise:0}) : {Habana:0,Placetas:0,Xportprise:0};
  var stk = existingProd ? (existingProd.stk || 0) : 0;
  var cat = (document.getElementById('ep-cat')?.value||'').trim();
  var activo = document.getElementById('ep-activo') ? document.getElementById('ep-activo').checked : true;
  var enStock = document.getElementById('ep-en-stock') ? document.getElementById('ep-en-stock').checked : true;
  var enWeb = document.getElementById('ep-en-web') ? document.getElementById('ep-en-web').checked : true;
  var enTransito = {
    Habana: document.getElementById('ep-transito-hab') ? document.getElementById('ep-transito-hab').checked : false,
    Placetas: document.getElementById('ep-transito-plac') ? document.getElementById('ep-transito-plac').checked : false,
    Xportprise: document.getElementById('ep-transito-xport') ? document.getElementById('ep-transito-xport').checked : false
  };
  var anyTransito = enTransito.Habana||enTransito.Placetas||enTransito.Xportprise;
  // Preserve existing img URL (upload handled separately)
  var existingImg = existingProd ? (existingProd.img||'') : '';
  // Oferta / badge
  var oferta = !!(document.getElementById('ep-oferta') && document.getElementById('ep-oferta').checked);
  var badgeTexto = (document.getElementById('ep-badge-texto')?.value||'').trim();
  var pOfeHabV = document.getElementById('ep-pofe-hab')?.value||'';
  var pOfePlacV = document.getElementById('ep-pofe-plac')?.value||'';
  var precioOfertaHabana = pOfeHabV!==''&&!isNaN(parseFloat(pOfeHabV))?parseFloat(pOfeHabV):null;
  var precioOfertaPlacetas = pOfePlacV!==''&&!isNaN(parseFloat(pOfePlacV))?parseFloat(pOfePlacV):null;
  // Reservado badge
  var reservado = !!(document.getElementById('ep-reservado') && document.getElementById('ep-reservado').checked);
  var por_encargo = !!(document.getElementById('ep-por-encargo') && document.getElementById('ep-por-encargo').checked);
  var esquema_pago = (document.getElementById('ep-esquema-pago')?.value||'').trim();
  var tiempo_transito = (document.getElementById('ep-tiempo-transito')?.value||'').trim();
  var pMercadoV = document.getElementById('ep-precio-mercado')?.value;
  var precio_mercado = pMercadoV!==''&&!isNaN(parseFloat(pMercadoV)) ? parseFloat(pMercadoV) : null;
  var ficha_tecnica = (document.getElementById('ep-ficha-tecnica')?.value||'').trim();
  var nombre_puerto = (document.getElementById('ep-nombre-puerto')?.value||'').trim();

  var prod = { n:n, stk:stk, stk_alm:stk_alm, stk_min:stk_min, moq:moq, cat:cat, activo:activo, enStock:enStock, enWeb:enWeb, enTransito:enTransito, min_placetas:min_placetas, maj_placetas:maj_placetas, preventa_min:preventa_min, preventa_maj:preventa_maj, escala:escala,
    img: existingImg,
    min: isNaN(min) ? null : min,
    maj: isNaN(maj) ? null : maj,
    ddp: isNaN(ddp) ? null : ddp,
    cif: cif,
    oferta: oferta, badgeTexto: badgeTexto,
    precioOfertaHabana: precioOfertaHabana, precioOfertaPlacetas: precioOfertaPlacetas,
    reservado: reservado, por_encargo: por_encargo, esquema_pago: esquema_pago, tiempo_transito: tiempo_transito, precio_mercado: precio_mercado, ficha_tecnica: ficha_tecnica, nombre_puerto: nombre_puerto };
  if (idx === -1) { PRODS.push(prod); showToast('Producto creado: ' + n); }
  else {
    // Preserve supaId so PATCH uses correct id (avoids duplicate on rename)
    if(existingProd&&existingProd.supaId) prod.supaId = existingProd.supaId;
    PRODS[idx] = prod;
    showToast('Actualizado: ' + n);
  }
  // Sync to Supabase immediately
  if (typeof syncSaveProducto === 'function') {
    syncSaveProducto(idx === -1 ? PRODS[PRODS.length-1] : PRODS[idx])
      .then(function(ok){ if(ok) showToast('✓ Guardado en Supabase'); })
      .catch(function(e){ console.warn('sync prod:', e); });
  }
  editingProd = null;
  renderAdminProductos();
}

async function admUploadImg(input, idx){
  var file = input.files[0];
  if(!file) return;
  if(file.size > 5*1024*1024){ showToast('La imagen no puede superar 5MB'); return; }
  var status = document.getElementById('img-upload-status');
  var btn = document.getElementById('btn-upload-img');
  if(status) status.textContent = '⏳ Subiendo...';
  if(btn) btn.disabled = true;
  try{
    // Upload to Supabase Storage bucket 'productos'
    var ext = file.name.split('.').pop().toLowerCase()||'jpg';
    var fname = 'prod_'+(Date.now())+'_'+(Math.random().toString(36).slice(2))+'.'+ext;
    var uploadResp = await fetch(SUPA_URL+'/storage/v1/object/productos/'+fname, {
      method:'POST',
      headers:{
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer '+SUPA_KEY,
        'Content-Type': file.type,
        'x-upsert': 'true'
      },
      body: file
    });
    if(!uploadResp.ok){
      var err = await uploadResp.text();
      throw new Error(err);
    }
    var imgUrl = SUPA_URL+'/storage/v1/object/public/productos/'+fname;
    // Update product in memory
    if(idx>=0 && PRODS[idx]){ PRODS[idx].img = imgUrl; }
    // Save to Supabase productos table
    if(idx>=0 && PRODS[idx] && PRODS[idx].supaId){
      await supaReq('PATCH','productos?id=eq.'+PRODS[idx].supaId,{imagen_url:imgUrl});
    }
    if(status) status.textContent = '✓ Foto guardada';
    if(btn) btn.textContent = '📷 Cambiar foto';
    // Show preview
    var preview = document.createElement('img');
    preview.src = imgUrl;
    preview.style.cssText = 'width:100%;max-width:240px;border-radius:8px;margin-bottom:10px;display:block';
    var uploadSection = btn.parentElement.parentElement;
    var existing = uploadSection.querySelector('img');
    if(existing) existing.src = imgUrl;
    else uploadSection.insertBefore(preview, uploadSection.firstChild);
    showToast('✓ Foto subida correctamente');
  }catch(e){
    console.warn('upload img:', e);
    if(status) status.textContent = '✗ Error al subir — '+e.message;
    showToast('Error subiendo foto: '+e.message);
  }finally{
    if(btn) btn.disabled = false;
  }
}

async function admElimProd(idx) {
  var p = PRODS[idx];
  if (!p) return;
  if (!confirm('¿Eliminar "' + p.n + '"? Esta acción no se puede deshacer.')) return;
  // Delete from Supabase first
  if (_supaOnline && p.supaId) {
    var r = await supaReq('DELETE', 'productos?id=eq.'+p.supaId);
    if (!r.ok) { showToast('Error al eliminar en Supabase'); return; }
    // Also delete stock_almacen rows
    supaReq('DELETE', 'stock_almacen?producto_id=eq.'+p.supaId).catch(function(e){console.warn(e);});
  }
  PRODS.splice(idx, 1);
  offlineSaveProds();
  showToast('✓ Producto eliminado');
  renderAdminProductos();
}
function admToggleProd(idx, field){
  var p=PRODS[idx]; if(!p) return;
  if(field==='activo') p.activo=p.activo===false?true:false;
  else if(field==='enStock') p.enStock=p.enStock===false?true:false;
  else if(field==='enWeb') p.enWeb=p.enWeb===false?true:false;
  offlineSaveProds();
  if(typeof syncSaveProducto==='function') syncSaveProducto(p);
  renderAdminProductos();
  showToast((field==='activo'?(p.activo?'✅ Activado en POS':'⛔ Desactivado de POS'):
            (field==='enStock'?(p.enStock?'📦 Visible en Stock':'🚫 Oculto de Stock'):
            (p.enWeb?'🌐 Visible en la Web':'🚫 Oculto de la Web')))+': '+p.n);
}
function admCloneProd(idx) {
  var orig = PRODS[idx];
  if (!orig) return;
  window.clonedProdData = orig;
  editingProd = -1;
  renderAdminContent();
  showToast('✓ Plantilla cargada desde ' + orig.n);
}
function admGetSelProds(){
  return [...document.querySelectorAll('.prod-chk:checked')].map(function(c){return parseInt(c.dataset.idx);});
}
function admUpdSelBar(){
  var sel=admGetSelProds();
  var bar=document.getElementById('prod-sel-bar');
  var cnt=document.getElementById('prod-sel-count');
  if(bar){bar.style.display=sel.length?'flex':'none';}
  if(cnt)cnt.textContent=sel.length+' seleccionado'+(sel.length!==1?'s':'');
}
function admChkAllProds(checked){
  document.querySelectorAll('.prod-chk').forEach(function(c){c.checked=checked;});
  admUpdSelBar();
}
function admDeselProds(){
  document.querySelectorAll('.prod-chk').forEach(function(c){c.checked=false;});
  var all=document.getElementById('prod-chk-all');if(all)all.checked=false;
  admUpdSelBar();
}
async function admSelProdToggle(disable, field){
  var idxs=admGetSelProds();
  if(!idxs.length){showToast('Selecciona productos primero');return;}
  idxs.forEach(function(idx){
    var p=PRODS[idx]; if(!p) return;
    if(field==='activo') p.activo=!disable;
    else if(field==='enStock') p.enStock=!disable;
    else if(field==='enWeb') p.enWeb=!disable;
  });
  offlineSaveProds();
  // Save to Supabase in parallel
  await Promise.all(idxs.map(function(idx){
    return typeof syncSaveProducto==='function'?syncSaveProducto(PRODS[idx]):Promise.resolve();
  }));
  admDeselProds();
  renderAdminProductos();
  showToast('✓ '+idxs.length+' producto'+(idxs.length!==1?'s':'')+' actualizados');
}

// ── USUARIOS ──────────────────────────────────────────────
function renderAdminUsuarios() {
  var el = document.getElementById('admin-content');
  if (!el) return;
  if (editingUser !== null) { renderFormUsuario(); return; }

  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">'
    + '<span style="font-size:13px;font-weight:600">' + Object.keys(USERS).length + ' usuario(s)</span>'
    + '<button class="adm-btn adm-btn-p" onclick="editingUser=\'__new__\';renderAdminContent()">+ Nuevo usuario</button>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">';

  Object.keys(USERS).forEach(function(name) {
    var u = USERS[name];
    html += '<div class="adm-card" style="border-left:3px solid ' + (u.tc || 'var(--color-border-secondary)') + '">'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
      + '<div style="width:36px;height:36px;border-radius:50%;background:' + (u.color || 'var(--color-background-secondary)') + ';color:' + (u.tc || 'var(--color-text-primary)') + ';display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px">' + name[0] + '</div>'
      + '<div><div style="font-size:13px;font-weight:600">' + name + '</div>'
      + '<div style="font-size:10px;color:var(--color-text-tertiary)">' + (u.rol === 'admin' ? '👑 Admin' : '🧑 Vendedor') + (u.almacen ? ' · ' + u.almacen : '') + '</div>'
      + '</div></div>'
      + '<div style="display:flex;gap:6px">'
      + '<button class="adm-btn-sm" onclick="editingUser=\'' + name + '\';renderAdminContent()" style="flex:1">✏️ Editar</button>'
      + (name !== 'Admin' ? '<button class="adm-btn-sm" onclick="admElimUser(\'' + name + '\')" style="color:var(--color-text-danger)">×</button>' : '')
      + '</div></div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function renderFormUsuario() {
  var el = document.getElementById('admin-content');
  if (!el) return;
  var isNew = (editingUser === '__new__');
  var nombre = isNew ? '' : editingUser;
  var u = isNew ? {pin:'', rol:'vendedor', almacen:'', color:ADMIN_COLORES[0].bg, tc:ADMIN_COLORES[0].tc, modulos:['pos','stock','ventas','clientes']} : (USERS[nombre] || {});

  var coloresHtml = '';
  ADMIN_COLORES.forEach(function(c, i) {
    coloresHtml += '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px">'
      + '<input type="radio" name="eu-color" value="' + i + '" ' + (u.color === c.bg ? 'checked' : '') + '>'
      + '<div style="width:22px;height:22px;border-radius:50%;background:' + c.bg + ';border:2px solid ' + c.tc + '"></div>'
      + c.lbl + '</label>';
  });

  var almsHtml = '<option value="">Sin asignar</option>';
  ['Habana','Placetas','Xportprise'].forEach(function(a) {
    almsHtml += '<option' + (u.almacen === a ? ' selected' : '') + '>' + a + '</option>';
  });

  el.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">'
    + '<button class="adm-btn" onclick="editingUser=null;renderAdminContent()">← Volver</button>'
    + '<span style="font-size:14px;font-weight:600">' + (isNew ? 'Nuevo usuario' : 'Editar: ' + nombre) + '</span>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:480px">'
    + '<div style="grid-column:1/-1"><label class="adm-lbl-f">Nombre *</label>'
    + '<input class="adm-inp" id="eu-nombre" value="' + nombre + '" placeholder="Nombre del usuario"' + (!isNew ? ' readonly style="opacity:.6"' : '') + '>'
    + (!isNew ? '<div style="font-size:10px;color:var(--color-text-tertiary);margin-top:3px">El nombre no se puede cambiar</div>' : '')
    + '</div>'
    + '<div><label class="adm-lbl-f">PIN (4 dígitos) *</label>'
    + '<input class="adm-inp" id="eu-pin" type="password" maxlength="4" value="' + (u.pin || '') + '" placeholder="••••"></div>'
    + '<div><label class="adm-lbl-f">Rol</label>'
    + '<select class="adm-inp" id="eu-rol"><option value="vendedor"' + (u.rol !== 'admin' ? ' selected' : '') + '>Vendedor</option><option value="admin"' + (u.rol === 'admin' ? ' selected' : '') + '>Admin</option></select></div>'
    + '<div style="grid-column:1/-1"><label class="adm-lbl-f">Almacén por defecto</label>'
    + '<select class="adm-inp" id="eu-alm">' + almsHtml + '</select></div>'
    + '<div style="grid-column:1/-1;display:flex;align-items:center;gap:12px;padding:6px 0"><label class="adm-lbl-f" style="margin:0;flex:1">Puede realizar ventas en POS</label><input type="checkbox" id="eu-puede-vender"' + (u.puedeVender!==false?' checked':'') + ' style="width:18px;height:18px;cursor:pointer"></div>'
    + '<div style="grid-column:1/-1;display:flex;align-items:center;gap:12px;padding:6px 0"><label class="adm-lbl-f" style="margin:0;flex:1">Vendedor a comisión</label><input type="checkbox" id="eu-a-comision"' + (u.aComision!==false?' checked':'') + ' style="width:18px;height:18px;cursor:pointer"></div>'
    + '<div style="grid-column:1/-1"><label class="adm-lbl-f" style="margin-bottom:8px;display:block">Color</label>'
    + '<div style="display:flex;gap:10px;flex-wrap:wrap">' + coloresHtml + '</div></div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;margin-top:20px">'
    + '<button class="adm-btn adm-btn-p" onclick="admGuardarUser(\'' + (isNew ? '__new__' : nombre) + '\')">' + (isNew ? 'Crear usuario' : 'Guardar cambios') + '</button>'
    + '<button class="adm-btn" onclick="editingUser=null;renderAdminContent()">Cancelar</button>'
    + '</div>';
}

function admGuardarUser(key) {
  var isNew = (key === '__new__');
  var nombre = isNew ? (document.getElementById('eu-nombre').value || '').trim() : key;
  if (!nombre) { showToast('El nombre es obligatorio'); return; }
  if (isNew && USERS[nombre]) { showToast('Ya existe un usuario con ese nombre'); return; }
  var pin = (document.getElementById('eu-pin').value || '').trim();
  if (!pin || pin.length !== 4 || !/^\d+$/.test(pin)) { showToast('El PIN debe tener 4 dígitos'); return; }
  var rol     = document.getElementById('eu-rol').value || 'vendedor';
  var almacen = document.getElementById('eu-alm').value || '';
  var colorEl = document.querySelector('input[name="eu-color"]:checked');
  var colorIdx = colorEl ? parseInt(colorEl.value) : 0;
  var colorDef = ADMIN_COLORES[colorIdx] || ADMIN_COLORES[0];
  var modulos = getSelectedModulos();
  if(rol==='admin') modulos = Object.keys(MOD_LABELS);
  else if(!modulos.length) modulos = ['pos','stock','ventas','clientes'];
  var puedeVender=document.getElementById('eu-puede-vender')?document.getElementById('eu-puede-vender').checked:true;
  var aComision=document.getElementById('eu-a-comision')?document.getElementById('eu-a-comision').checked:true;
  USERS[nombre]={pin:pin,rol:rol,almacen:almacen,color:colorDef.bg,tc:colorDef.tc,activo:true,modulos:modulos,puedeVender:puedeVender,aComision:aComision};
  saveUsers();syncSaveUser(nombre,USERS[nombre]);renderLoginCards();
  showToast(isNew?'Usuario creado: '+nombre:'Actualizado: '+nombre);
  editingUser=null;renderAdminUsuarios();
}

function admElimUser(nombre) {
  if (nombre === 'Admin') { showToast('No se puede eliminar Admin'); return; }
  if (!confirm('¿Eliminar usuario "' + nombre + '"?')) return;
  delete USERS[nombre];
  saveUsers();syncDeleteUser(nombre);renderLoginCards();
  showToast('Usuario eliminado: '+nombre);
  renderAdminUsuarios();
}



function admFiltrarProds(q) {
  window._admProdQ = q || '';
  renderAdminProductos();
}








function getCategorias(){
  var cats=new Set(PRODS.filter(function(p){return p.cat;}).map(function(p){return p.cat;}));
  // Also load from CATS (erp_cats) and erp_categorias
  try{JSON.parse(localStorage.getItem('erp_cats')||'[]').forEach(function(c){cats.add(c);});}catch(e){}
  try{JSON.parse(localStorage.getItem('erp_categorias')||'[]').forEach(function(c){cats.add(c);});}catch(e){}
  if(typeof CATS!=='undefined') CATS.forEach(function(c){cats.add(c);});
  return Array.from(cats).sort();
}
// admAddCat defined below
function admRemoveCat(cat){
  if(!confirm('Eliminar categoria: '+cat+'?'))return;
  var arr=getCategorias().filter(function(c){return c!==cat;});
  try{localStorage.setItem('erp_categorias',JSON.stringify(arr));}catch(e){}
  renderCatManager();
}
function renderCatManager(){
  var el=document.getElementById('cat-manager-content');if(!el)return;
  var cats=getCategorias();
  var h='<div style="display:flex;gap:8px;margin-bottom:10px">';
  h+='<input class="adm-inp" id="new-cat-inp" placeholder="Nueva categoría..." style="flex:1" onkeydown="if(event.key==\'Enter\')admAddCat()">';
  h+='<button class="adm-btn adm-btn-p" onclick="admAddCat()">+ Añadir</button></div>';
  h+='<div style="display:flex;flex-wrap:wrap;gap:6px">';
  if(cats.length)cats.forEach(function(c){
    h+='<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;background:var(--color-background-secondary);border-radius:100px;font-size:12px">'+c;
    h+='<span onclick="admRemoveCat(\''+c+'\')" style="cursor:pointer;color:var(--color-text-danger);font-size:15px">×</span></span>';
  });
  else h+='<span style="font-size:12px;color:var(--color-text-tertiary)">Sin categorías</span>';
  el.innerHTML=h+'</div>';
}

function renderAdminCats() {
  var el = document.getElementById('admin-content');
  if (!el) return;
  var html = '<div style="max-width:480px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
    + '<span style="font-size:13px;font-weight:600">' + CATS.length + ' categorías</span>'
    + '</div>'
    + '<div style="display:flex;gap:8px;margin-bottom:14px">'
    + '<input class="adm-inp" id="new-cat-inp" placeholder="Nueva categoría..." style="flex:1"'
    + ' onkeydown="if(event.key===\'Enter\')admAddCat()">'
    + '<button class="adm-btn adm-btn-p" onclick="admAddCat()">+ Añadir</button>'
    + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:6px">';
  CATS.forEach(function(c, i) {
    html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--color-background-secondary);border-radius:var(--border-radius-md)">'
      + '<span style="flex:1;font-size:13px">' + c + '</span>'
      + '<button class="adm-btn-sm" onclick="admDelCat(' + i + ')" style="color:var(--color-text-danger)">×</button>'
      + '</div>';
  });
  html += '</div></div>';
  el.innerHTML = html;
  setTimeout(function(){var inp=document.getElementById('new-cat-inp');if(inp)inp.focus();},50);
}
function admAddCat() {
  var inp = document.getElementById('new-cat-inp');
  var val = (inp ? inp.value : '').trim();
  if (!val) return;
  if (CATS.indexOf(val) >= 0) { showToast('Ya existe'); return; }
  CATS.push(val);
  saveCats();
  showToast('Categoría añadida: ' + val);
  renderAdminCats();
}
function admDelCat(i) {
  if (!confirm('¿Eliminar categoría "' + CATS[i] + '"?')) return;
  CATS.splice(i, 1);
  saveCats();
  renderAdminCats();
}















// admGuardarTasas defined below

function admPreviewTasas() {
  var cup  = parseFloat(document.getElementById('t-cup')?.value) || RATES.CUP;
  var eurC = parseFloat(document.getElementById('t-eur-cup')?.value) || (RATES.CUP/RATES.EUR);
  var cupt = parseFloat(document.getElementById('t-cupt')?.value) || RATES.CUPT;
  var pe = document.getElementById('prev-cup'); if(pe) pe.textContent = fN(cup,0);
  var pe2 = document.getElementById('prev-eur'); if(pe2) pe2.textContent = fN(eurC,0);
  var pe3 = document.getElementById('prev-cupt'); if(pe3) pe3.textContent = fN(cupt,0);
}

function admGuardarTasas() {
  // Read adjustment inputs (generated by _tasaRow with IDs tadj-usd, tadj-eur, tadj-cupt)
  var aUSD  = parseFloat(document.getElementById('tadj-usd')?.value)  || 0;
  var aEUR  = parseFloat(document.getElementById('tadj-eur')?.value)  || 0;
  var aCUPT = parseFloat(document.getElementById('tadj-cupt')?.value) || 0;

  // Get market base rates
  var mkt = {};
  try { mkt = JSON.parse(localStorage.getItem('erp_rates_mkt') || '{}'); } catch(e) {}
  var mUSD  = mkt.CUP  || RATES.CUP;
  var mEUR  = mkt.CUP && mkt.EUR ? parseFloat((mkt.CUP/mkt.EUR).toFixed(2)) : parseFloat((RATES.CUP/RATES.EUR).toFixed(2));
  var mCUPT = mkt.CUPT || RATES.CUPT;

  // Apply: final = market + adjustment
  var finalUSD  = mUSD  + aUSD;
  var finalEUR  = mEUR  + aEUR;
  var finalCUPT = mCUPT + aCUPT;

  if (finalUSD  > 0) RATES.CUP  = finalUSD;
  if (finalEUR  > 0) RATES.EUR  = parseFloat((finalUSD / finalEUR).toFixed(6));
  if (finalCUPT > 0) RATES.CUPT = finalCUPT;
  // RATES_EURUSD = EUR per USD = finalEUR/finalUSD = CUP_EUR/CUP_USD
  RATES_EURUSD = parseFloat((finalEUR/finalUSD).toFixed(2));
  if(!(RATES_EURUSD > 0.5 && RATES_EURUSD < 5)) RATES_EURUSD = 1.12;
  try { localStorage.setItem('erp_eurusd', RATES_EURUSD.toString()); } catch(e) {}

  // Also read CUPT2 adj (informational row, no action needed)
  var aCUPT2 = parseFloat(document.getElementById('tadj-cupt2')?.value) || 0;
  // Save adjustments for next render
  try { localStorage.setItem('erp_rates_adj', JSON.stringify({USD:aUSD, EUR:aEUR, CUPT:aCUPT, CUPT2:aCUPT2})); } catch(e) {}
  // Save eurusd adj too so panel doesn't reset
  var aEurUsd = parseFloat(document.getElementById('eurusd-adj')?.value) || 0;
  try { localStorage.setItem('erp_eurusd_adj', aEurUsd.toString()); } catch(e) {}

  var dtoPrev = parseFloat(document.getElementById('dto-preventa')?.value) || 0;
  RATES.DTO_PREVENTA = dtoPrev;
  
  var waPlac = document.getElementById('wa-placetas')?.value;
  if (waPlac) RATES.WA_PLACETAS = waPlac;

  try { localStorage.setItem('erp_rates', JSON.stringify({USD:1,EUR:RATES.EUR,CUP:RATES.CUP,CUPT:RATES.CUPT,DTO_PREVENTA:dtoPrev,WA_PLACETAS:RATES.WA_PLACETAS,ts:Date.now()})); } catch(e) {}

  // Save to Supabase
  if (_supaOnline) {
    supaReq('POST','tasas?on_conflict=moneda',{moneda:'USD',valor:RATES.CUP,tasa_mkt:mUSD,ajuste:aUSD}).catch(function(e){});
    supaReq('POST','tasas?on_conflict=moneda',{moneda:'EUR',valor:finalEUR,tasa_mkt:mkt.EUR||finalEUR,ajuste:aEUR}).catch(function(e){});
    supaReq('POST','tasas?on_conflict=moneda',{moneda:'CUPT',valor:RATES.CUPT,tasa_mkt:mCUPT,ajuste:aCUPT}).catch(function(e){});
    supaReq('POST','tasas?on_conflict=moneda',{moneda:'USDEUR',valor:RATES_EURUSD,tasa_mkt:parseFloat((mEUR/mUSD).toFixed(4)),ajuste:parseFloat((RATES_EURUSD-(mEUR/mUSD)).toFixed(4))}).catch(function(e){});
    supaReq('POST','tasas?on_conflict=moneda',{moneda:'DTO_PREVENTA',valor:dtoPrev,tasa_mkt:0,ajuste:0}).catch(function(e){});
    if (waPlac) supaReq('POST','tasas?on_conflict=moneda',{moneda:'WA_PLACETAS',valor:(parseFloat(waPlac)/1000000),tasa_mkt:0,ajuste:0}).catch(function(e){});
  }

  showToast('✓ Tasas aplicadas — USD ' + fN(finalUSD,0) + ' · EUR ' + fN(finalEUR,0) + ' · MLC ' + fN(finalCUPT,0) + ' CUP');
  renderAdminTasas();
}







function renderAdminTasas() {
  var el = document.getElementById('admin-content');
  if (!el) return;
  // Try to fetch fresh rates in background (non-blocking)
  var _hasMkt = false;
  try { var _tm = JSON.parse(localStorage.getItem('erp_rates_mkt')||'{}'); _hasMkt = !!_tm.CUP; } catch(e) {}
  if (false && !_hasMkt && typeof fetchTasasElToque === 'function') {
    fetchTasasElToque(true).then(function(){ 
      var _hasMkt2 = false;
      try { var _tm2 = JSON.parse(localStorage.getItem('erp_rates_mkt')||'{}'); _hasMkt2=!!_tm2.CUP; } catch(e) {}
      if (_hasMkt2) renderAdminTasas();
    }).catch(function(){});
    // Show with current RATES while waiting
    try { localStorage.setItem('erp_rates_mkt', JSON.stringify({CUP:RATES.CUP,EUR:RATES.EUR,CUPT:RATES.CUPT})); } catch(e) {}
  }

  // Load saved adjustments
  var adj = {};
  try { adj = JSON.parse(localStorage.getItem('erp_rates_adj') || '{}'); } catch(e) {}

  // Load pure market rates (from elToque, before adjustment)
  var mkt = {};
  try { mkt = JSON.parse(localStorage.getItem('erp_rates_mkt') || '{}'); } catch(e) {}

  // If no market cache, use current RATES minus stored adj
  var mUSD  = mkt.CUP  || RATES.CUP;
  var mEUR  = mkt.EUR || parseFloat((RATES.CUP / RATES.EUR).toFixed(2));
  var mCUPT = mkt.CUPT || RATES.CUPT;

  var aUSD  = adj.USD  || 0;
  var aEUR  = adj.EUR  || 0;
  var aCUPT = adj.CUPT || 0;

  var age = '';
  try {
    var rc = JSON.parse(localStorage.getItem('erp_rates') || '{}');
    if (rc.ts) age = Math.round((Date.now()-rc.ts)/60000) + ' min';
  } catch(e) {}

  el.innerHTML = '<div style="max-width:560px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
    + '<h3 style="margin:0">💱 Tasas de cambio</h3>'
    + '<button class="adm-btn adm-btn-p" onclick="fetchElToqueAndSave()" style="font-size:12px">🔄 Actualizar elToque</button>'
    + '</div>'
    + '<div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:16px">'
    + 'TRMI elToque · auto cada 1 hora' + (age ? ' · hace <b>' + age + '</b>' : '') + '</div>'
    + _tasaRow('USD / CUP', mUSD,  'CUP por 1 USD',  'usd',  aUSD,  mUSD  + aUSD)
    + _tasaRow('EUR / CUP', mEUR,  'CUP por 1 EUR',  'eur',  aEUR,  mEUR  + aEUR)
    + _tasaRow('MLC / CUP', mCUPT, 'CUP por 1 MLC',  'cupt', aCUPT, mCUPT + aCUPT)
    + '<div class="card" style="margin-bottom:12px;opacity:.7">'
    + '<div style="font-size:13px;font-weight:600;margin-bottom:8px">CUPT / CUP <span style="font-size:10px;color:var(--color-text-tertiary);font-weight:400">— solo lectura, configurable por almacén abajo</span></div>'
    + '<div style="display:flex;align-items:center;gap:16px">'
    + '<div style="text-align:center;min-width:70px"><div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:2px">BASE</div>'
    + '<div style="font-size:20px;font-weight:700;color:var(--color-text-secondary)">' + fN(mUSD+aUSD,0) + '</div></div>'
    + '<div style="font-size:13px;color:var(--color-text-tertiary);flex:1">= USD/CUP + % extra configurado por almacén en la tabla inferior</div>'
    + '</div></div>'
    + '<button class="adm-btn adm-btn-p" onclick="admGuardarTasas()" style="width:100%;padding:12px;font-size:14px;margin-top:4px">💾 Aplicar tasas finales</button>'
    + (function(){
        // RATES_EURUSD = USD por 1 EUR (e.g. 1.12)
        // Also try localStorage cache
        // USD/EUR = CUP_EUR / CUP_USD = mEUR/mUSD (e.g. 590/525 = 1.124)
        var _auto = (mEUR > 0 && mUSD > 0) ? parseFloat((mEUR/mUSD).toFixed(4)) : 1.12;
        if(!(_auto > 0.5 && _auto < 5)) _auto = 1.12;
        RATES_EURUSD = _auto;
        try{ localStorage.setItem('erp_eurusd', _auto.toString()); }catch(e){}
        var _adj = parseFloat(localStorage.getItem('erp_eurusd_adj')||'0');
        var _final = parseFloat((_auto + _adj).toFixed(4));
        var bS = 'width:40px;height:40px;border:1px solid var(--color-border-secondary);border-radius:6px;background:var(--color-background-secondary);cursor:pointer;font-size:18px;touch-action:manipulation';
        return '<div class="card" style="margin-top:12px">'
          + '<div style="font-size:13px;font-weight:600;margin-bottom:12px">USD / EUR <span style="font-size:10px;color:var(--color-text-tertiary);font-weight:400">(USD por 1 EUR)</span></div>'
          + '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">'
          + '<div style="text-align:center;min-width:60px">'
          + '<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:2px">TRMI</div>'
          + '<div id="eurusd-trmi" style="font-size:22px;font-weight:700;color:var(--color-text-secondary)">'+fN(_auto,4)+'</div>'
          + '</div>'
          + '<div style="font-size:18px;color:var(--color-text-tertiary)">+</div>'
          + '<div style="flex:1;text-align:center">'
          + '<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:4px">AJUSTE</div>'
          + '<div style="display:flex;align-items:center;gap:6px;justify-content:center">'
          + '<button style="'+bS+'" onclick="var e=document.getElementById(\'eurusd-adj\');e.value=(parseFloat(e.value)-0.01).toFixed(2);_updEurUsd()">-</button>'
          + '<input type="number" id="eurusd-adj" value="'+parseFloat(_adj||0).toFixed(4)+'" step="0.01" oninput="_updEurUsd()" style="width:80px;text-align:center;font-size:18px;font-weight:600;height:40px">'
          + '<button style="'+bS+'" onclick="var e=document.getElementById(\'eurusd-adj\');e.value=(parseFloat(e.value)+0.01).toFixed(2);_updEurUsd()">+</button>'
          + '</div></div>'
          + '<div style="font-size:18px;color:var(--color-text-tertiary)">=</div>'
          + '<div style="text-align:center;min-width:60px">'
          + '<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:2px">FINAL</div>'
          + '<div id="eurusd-fin" style="font-size:24px;font-weight:800;color:var(--color-text-success)">'+fN(_final,2)+'</div>'
          + '</div></div></div>';
      })()
    + '<div class="card" style="margin-top:12px">'
    + '<div style="font-size:13px;font-weight:600;margin-bottom:12px">Descuento Preventa Global (%) <span style="font-size:10px;color:var(--color-text-tertiary);font-weight:400">(Se aplica al stock en tránsito. Ignorado si se define un precio de preventa específico)</span></div>'
    + '<div style="display:flex;align-items:center;gap:16px;">'
    + '<input type="number" id="dto-preventa" value="'+(RATES.DTO_PREVENTA||0)+'" style="width:100px;text-align:center;font-size:18px;font-weight:600;height:40px;border-radius:6px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary)">'
    + '<span style="font-size:14px;color:var(--color-text-secondary);font-weight:600">% descuento</span>'
    + '</div>'
    + '</div>'
    + '<div class="card" style="margin-top:12px">'
    + '<div style="font-size:13px;font-weight:600;margin-bottom:12px">WhatsApp Pedidos Placetas <span style="font-size:10px;color:var(--color-text-tertiary);font-weight:400">(Catálogo)</span></div>'
    + '<div style="display:flex;align-items:center;gap:16px;">'
    + '<input type="number" id="wa-placetas" value="'+(RATES.WA_PLACETAS||5353425247)+'" style="width:160px;text-align:center;font-size:18px;font-weight:600;height:40px;border-radius:6px;border:1px solid var(--color-border-secondary);background:var(--color-background-secondary);color:var(--color-text-primary)">'
    + '</div>'
    + '</div>'
    + '<h3 style="margin:16px 0 10px">Ajustes por almacén</h3>'
    + _renderAlmAdjTable()
    + '<button class="adm-btn adm-btn-p" onclick="admGuardarAjustesAlm()" style="width:100%;padding:10px;margin-top:8px">💾 Guardar ajustes almacén</button>'
    + '</div>';
}

function _tasaRow(label, mkt, note, key, adj, fin) {
  var btnStyle = 'width:40px;height:40px;border:1px solid var(--color-border-secondary);border-radius:6px;background:var(--color-background-secondary);cursor:pointer;font-size:18px;touch-action:manipulation;flex-shrink:0';
  return '<div class="card" style="margin-bottom:12px">'
    + '<div style="font-size:13px;font-weight:600;margin-bottom:12px">' + label + '</div>'
    + '<div style="display:flex;align-items:center;gap:10px">'
    // TRMI
    + '<div style="text-align:center;min-width:70px">'
    + '<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:2px">TRMI</div>'
    + '<div style="font-size:20px;font-weight:700;color:var(--color-text-secondary)">' + fN(mkt,0) + '</div>'
    + '</div>'
    + '<div style="font-size:16px;color:var(--color-text-tertiary)">+</div>'
    // AJUSTE
    + '<div style="text-align:center;flex:1">'
    + '<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:4px">AJUSTE</div>'
    + '<div style="display:flex;align-items:center;gap:4px">'
    + '<button style="' + btnStyle + '" onclick="_adjChange(\'' + key + '\',-1)">−</button>'
    + '<input type="number" id="tadj-' + key + '" value="' + adj + '" oninput="_adjChange(\'' + key + '\',0)" style="flex:1;min-width:50px;text-align:center;font-size:16px;font-weight:600;height:40px">'
    + '<button style="' + btnStyle + '" onclick="_adjChange(\'' + key + '\',+1)">+</button>'
    + '</div></div>'
    + '<div style="font-size:16px;color:var(--color-text-tertiary)">=</div>'
    // FINAL
    + '<div style="text-align:center;min-width:70px">'
    + '<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:2px">FINAL</div>'
    + '<div id="tfin-' + key + '" style="font-size:24px;font-weight:800;color:var(--color-text-success)">' + fN(fin,0) + '</div>'
    + '</div>'
    + '</div></div>';
}

function _adjChange(key, delta) {
  var inp = document.getElementById('tadj-' + key);
  if (!inp) return;
  if (delta !== 0) inp.value = (parseFloat(inp.value) || 0) + delta;
  // Update final display
  var mkt = {};
  try { mkt = JSON.parse(localStorage.getItem('erp_rates_mkt') || '{}'); } catch(e) {}
  var mktMap = {
    usd:  mkt.CUP  || RATES.CUP,
    eur:  mkt.EUR || parseFloat((RATES.CUP/RATES.EUR).toFixed(2)),
    cupt: mkt.CUPT || RATES.CUPT
  };
  var adj = parseFloat(inp.value) || 0;
  var fin = document.getElementById('tfin-' + key);
  if (fin) fin.textContent = fN((mktMap[key] || 0) + adj, 0);
}




function _renderAlmAdjTable() {
  var alms = ['Habana','Placetas','Xportprise'];
  var mons = ['USD','EUR','MLC','CUPT'];
  var monsLabel = {USD:'USD/CUP',EUR:'EUR/CUP',MLC:'MLC/CUP',CUPT:'CUPT %+'};

  // Base rates (TRMI + global adj)
  var mkt = {};
  try { mkt = JSON.parse(localStorage.getItem('erp_rates_mkt') || '{}'); } catch(e) {}
  var adj = {};
  try { adj = JSON.parse(localStorage.getItem('erp_rates_adj') || '{}'); } catch(e) {}
  var baseUSD  = (mkt.CUP  || RATES.CUP)  + (adj.USD  || 0);
  var baseEUR  = (mkt.EUR || parseFloat((RATES.CUP/RATES.EUR).toFixed(2))) + (adj.EUR  || 0);
  var baseMLC  = (mkt.CUPT || RATES.CUPT) + (adj.CUPT || 0);
  var base = {USD: baseUSD, EUR: baseEUR, MLC: baseMLC, CUPT: 0}; // CUPT base=0, value IS the %, CUP ref=baseUSD

  var h = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">'
    + '<thead><tr>'
    + '<th style="text-align:left;padding:8px;color:var(--color-text-tertiary);border-bottom:1px solid var(--color-border-tertiary)">Almacén</th>'
    + mons.map(function(m){
        var lbl = monsLabel[m]||m;
        var baseVal = m==='CUPT' ? 'base CUP: '+fN(baseUSD,0) : 'base: '+fN(base[m]||0,0);
        return '<th style="text-align:center;padding:8px;color:var(--color-text-tertiary);border-bottom:1px solid var(--color-border-tertiary)" colspan="2">'
          + lbl + '<br><span style="font-size:10px;font-weight:400">'+baseVal+'</span></th>';
      }).join('')
    + '</tr>'
    + '<tr>'
    + '<th></th>'
    + mons.map(function(m){ var label=m==='CUPT'?'%':'+/−'; return '<th style="font-size:10px;color:var(--color-text-tertiary);padding:2px 4px;font-weight:400">'+label+'</th><th style="font-size:10px;color:var(--color-text-success);padding:2px 4px;font-weight:600">FINAL</th>'; }).join('')
    + '</tr>'
    + '</thead><tbody>';

  alms.forEach(function(alm){
    h += '<tr style="border-bottom:1px solid var(--color-border-tertiary)">';
    h += '<td style="padding:8px;font-weight:600">'+alm+'</td>';
    mons.forEach(function(mon){
      var almAdj = (RATES_ALM[alm]&&RATES_ALM[alm][mon]!=null)?RATES_ALM[alm][mon]:(mon==='CUPT'?10:0);
      var isCUPT = mon==='CUPT';
      var finalVal = isCUPT ? almAdj : (base[mon]||0)+almAdj;
      var finalVal_cup = baseUSD + ((RATES_ALM[alm]&&RATES_ALM[alm]['USD'])||0); // CUP final for this almacen
      var cupt_result = finalVal_cup * (1 + almAdj/100);
      var finalTxt = isCUPT ? fN(almAdj,0)+'% ('+fN(cupt_result,0)+')' : fN(finalVal,0);
      h += '<td style="padding:4px 6px"><input type="number" id="alm-adj-'+alm+'-'+mon+'" value="'+almAdj+'" step="1"'
        + ' oninput="_updAlmFinal(this,\''+alm+'\',\''+mon+'\',' + (base[mon]||0) + ','+baseUSD+')"'
        + ' style="width:70px;text-align:center;font-size:13px;height:34px"></td>';
      h += '<td id="alm-fin-'+alm+'-'+mon+'" style="padding:4px 8px;text-align:center;font-weight:700;color:var(--color-text-success);font-size:15px">'+finalTxt+'</td>';
    });
    h += '</tr>';
  });

  h += '</tbody></table></div>';
  return h;
}

function _updAlmFinal(inp, alm, mon, base, baseUSD) {
  var fin = document.getElementById('alm-fin-'+alm+'-'+mon);
  if(!fin) return;
  var v = parseFloat(inp.value)||0;
  if(mon==='CUPT'){
    var adjUSD = (RATES_ALM[alm]&&RATES_ALM[alm]['USD'])||0;
    var cupFinal = (baseUSD||0) + adjUSD;
    fin.textContent = fN(v,0)+'% ('+fN(cupFinal*(1+v/100),0)+')';
  } else {
    fin.textContent = fN((base||0)+v, 0);
  }
}

async function admGuardarAjustesAlm() {
  var alms=['Habana','Placetas','Xportprise'], mons=['USD','EUR','MLC','CUPT'];
  var rows=[];
  alms.forEach(function(alm){
    mons.forEach(function(mon){
      var el=document.getElementById('alm-adj-'+alm+'-'+mon);
      var adj=el?parseFloat(el.value)||0:0;
      if(!RATES_ALM[alm])RATES_ALM[alm]={};
      RATES_ALM[alm][mon]=adj;
      rows.push({almacen:alm,moneda:mon,ajuste:adj});
    });
  });
  var euEl=document.getElementById('eurusd-adj');
  if(euEl){
    var _euAdj=parseFloat(euEl.value)||0;
    var _euAuto=RATES_EURUSD > 0.1 ? RATES_EURUSD : parseFloat((1/RATES.EUR).toFixed(4));
    var _euFinal=parseFloat((_euAuto+_euAdj).toFixed(4));
    if(_euFinal > 0.1) RATES_EURUSD=_euFinal;
    try{localStorage.setItem('erp_eurusd',RATES_EURUSD.toString());}catch(e){}
    try{localStorage.setItem('erp_eurusd_adj',_euAdj.toString());}catch(e){}
    if(_supaOnline) supaReq('POST','tasas?on_conflict=moneda',{moneda:'USDEUR',valor:RATES_EURUSD,tasa_mkt:_euAuto,ajuste:_euAdj}).catch(function(e){});
  }
  if(_supaOnline){
    for(var i=0;i<rows.length;i++){
      await supaReq('POST','tasas_almacen?on_conflict=almacen,moneda',rows[i]).catch(function(e){console.warn(e);});
    }
    showToast('Ajustes por almacén guardados');
  } else {
    try{localStorage.setItem('erp_rates_alm',JSON.stringify(RATES_ALM));}catch(e){}
    showToast('Ajustes guardados localmente');
  }
}






function _updEurUsd() {
  // Use stored RATES_EURUSD directly — avoid DOM text parsing locale issues
  var auto = RATES_EURUSD > 0.1 ? RATES_EURUSD
           : (RATES.EUR > 0 ? parseFloat((1/RATES.EUR).toFixed(4)) : 1.12);
  var adj  = parseFloat(document.getElementById('eurusd-adj')?.value||'0');
  var fin  = document.getElementById('eurusd-fin');
  if(fin) fin.textContent = fN(parseFloat((auto+adj).toFixed(4)),2);
}



// ═══════════════════════════════════════════════════════════════
// MÓDULO CAJAS ADMIN — saldo_inicial + movimientos
// ═══════════════════════════════════════════════════════════════
var _cajasData = [];
var _cajasMovs = (function(){try{return JSON.parse(localStorage.getItem('erp_cajas_movs')||'[]');}catch(e){return[];}})();
var _cajasTab  = 'resumen'; // resumen | movimiento | historial | gestionar

async function loadCajasData() {
  try {
    if (_supaOnline) {
      var rc = await supaReq('GET', 'cajas?order=almacen.asc,moneda.asc');
      if (rc.ok) {
        var d = await rc.json()||[];
        window._cajasDataAll = d; // all cajas including archived
        _cajasData = d.filter(function(c){return c.activa!==false;});
        if(!_cajasData.length) _cajasData = _cajasFromLocal();
      }
      var rm = await supaReq('GET', 'mov_cajas?order=created_at.desc&limit=2000');
      if (rm.ok) {
        _cajasMovs = await rm.json() || [];
        // Always overwrite localStorage with Supabase data (clears stale cache)
        try{localStorage.setItem('erp_cajas_movs',JSON.stringify(_cajasMovs.slice(0,500)));}catch(e){}
      }
    } else {
      _cajasData = _cajasFromLocal();
    }
  } catch(e) { console.warn('loadCajasData:', e); _cajasData = _cajasFromLocal(); }
}

function _cajasFromLocal() {
  return Object.keys(CUENTAS_BASE||{}).map(function(n){
    var p=n.split(' '); return {id:n,nombre:n,moneda:p[0]||'USD',almacen:p.slice(1).join(' ')||'General',saldo_inicial:0,activa:true};
  });
}

function _getSaldoCaja(cajaId) {
  var caja = _cajasData.find(function(c){return c.id==cajaId||c.nombre==cajaId;});
  if (!caja) return 0;
  var saldo = parseFloat(caja.saldo_inicial||0);
  var nombre = caja.nombre;
  _cajasMovs.forEach(function(m){
    var orig = (m.caja_origen||'').trim();
    var dest = (m.caja_destino||'').trim();
    var esOrigen  = orig===nombre || orig==caja.id || m.caja_origen_id==caja.id;
    var esDestino = dest===nombre || dest==caja.id || m.caja_destino_id==caja.id;
    if (esOrigen)  saldo -= parseFloat(m.monto_origen||0);
    if (esDestino) saldo += parseFloat(m.monto_destino||0);
  });
  if (Math.abs(saldo) < 0.005) return 0;
  return parseFloat(saldo.toFixed(4));
}

async function renderAdminCajas() {
  var el = document.getElementById('admin-content');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--color-text-tertiary)">⏳ Cargando cajas...</div>';
  await loadCajasData();

  var tabDefs = [
    {k:'resumen',    l:'📊 Resumen'},
    {k:'movimiento', l:'➕ Movimiento'},
    {k:'historial',  l:'📋 Historial'},
    {k:'gestionar',  l:'⚙️ Gestionar'},
  ];
  var tabs = '<div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">'
    + tabDefs.map(function(t){
        return '<button class="adm-tab'+(_cajasTab===t.k?' act':'')+'" onclick="_setCajasTab(\''+t.k+'\')">'+t.l+'</button>';
      }).join('')
    + '</div>';

  var content = '';
  if      (_cajasTab === 'resumen')    content = _renderResumenCajas();
  else if (_cajasTab === 'movimiento') content = _renderNuevoMovCaja();
  else if (_cajasTab === 'historial')  content = _renderHistorialMovCajas();
  else                                  content = _renderGestionarCajas();

  el.innerHTML = tabs + content;
}

function _setCajasTab(tab) { _cajasTab = tab; renderAdminCajas(); }
function _getCajaNombres() { return _cajasData.map(function(c){return c.nombre;}); }
function _getMonedaFromCaja(nombre) {
  var c = _cajasData.find(function(x){return x.nombre===nombre;});
  return c ? c.moneda : (nombre.split(' ')[0]||'USD');
}

// ── RESUMEN ─────────────────────────────────────────────────
function _renderResumenCajas() {
  if (!_cajasData.length) return '<div style="text-align:center;padding:40px;color:var(--color-text-tertiary)">Sin cajas — crea una en ⚙️ Gestionar</div>';

  // Group by almacen
  var byAlm = {};
  _cajasData.forEach(function(c){
    if (!byAlm[c.almacen]) byAlm[c.almacen] = [];
    byAlm[c.almacen].push(c);
  });

  var html = '';
  Object.keys(byAlm).forEach(function(alm){
    html += '<div style="font-size:12px;font-weight:600;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px">'+alm+'</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin-bottom:8px">';
    byAlm[alm].forEach(function(c){
      var saldo = _getSaldoCaja(c.nombre);
      var color = saldo >= 0 ? 'var(--color-text-success)' : 'var(--color-text-danger)';
      var monIcon = {USD:'$',EUR:'€',CUP:'₱',CUPT:'\u20b1'}[c.moneda]||'';
      html += '<div class="card" style="text-align:center;padding:14px 10px">'
        + '<div style="font-size:11px;color:var(--color-text-tertiary);margin-bottom:4px">'+c.nombre+'</div>'
        + '<div style="font-size:11px;font-weight:600;color:var(--color-text-secondary);margin-bottom:8px">'+monIcon+' '+c.moneda+'</div>'
        + '<div style="font-size:clamp(13px,3vw,20px);font-weight:800;color:'+color+';word-break:break-all;line-height:1.2">'+fN(saldo,2)+'</div>'
        + '<div style="font-size:10px;color:var(--color-text-tertiary);margin-top:4px">saldo actual</div>'
        + '</div>';
    });
    html += '</div>';
  });
  return html;
}

// ── NUEVO MOVIMIENTO ─────────────────────────────────────────
function _getTasaDefault(monOrig, monDest) {
  if (monOrig === monDest) return 1;
  if (monDest==='CUP'  && monOrig==='USD') return RATES.CUP;
  if (monDest==='CUP'  && monOrig==='EUR') return parseFloat((RATES.CUP/RATES.EUR).toFixed(2));
  if (monDest==='CUPT' && monOrig==='USD') return RATES.CUPT;
  if (monDest==='CUPT' && monOrig==='EUR') return parseFloat((RATES.CUPT/RATES.EUR).toFixed(2));

  // Al revés (Nacional -> Divisa), devolvemos la misma tasa natural (ej: 330 en vez de 0.003)
  if (monOrig==='CUP'  && monDest==='USD') return RATES.CUP;
  if (monOrig==='CUP'  && monDest==='EUR') return parseFloat((RATES.CUP/RATES.EUR).toFixed(2));
  if (monOrig==='CUPT' && monDest==='USD') return RATES.CUPT;
  if (monOrig==='CUPT' && monDest==='EUR') return parseFloat((RATES.CUPT/RATES.EUR).toFixed(2));

  if (monOrig==='USD'  && monDest==='EUR') return RATES.EUR;
  if (monOrig==='EUR'  && monDest==='USD') return parseFloat((1/RATES.EUR).toFixed(4));
  return 1;
}

function _renderNuevoMovCaja() {
  var cajas = _getCajaNombres();
  // Agrupar por moneda (orden fijo, monedas nuevas al final)
  var _monOrden=['USD','EUR','CUP','CUPT'];
  var _porMon={};
  cajas.forEach(function(n){
    var m=(typeof _getMonedaFromCaja==='function'?_getMonedaFromCaja(n):n.split(' ')[0])||'USD';
    (_porMon[m]=_porMon[m]||[]).push(n);
  });
  var _mons=_monOrden.filter(function(m){return _porMon[m];})
    .concat(Object.keys(_porMon).filter(function(m){return _monOrden.indexOf(m)<0;}).sort());
  var opts=_mons.map(function(m){
    return '<optgroup label="'+m+'">'+_porMon[m].sort().map(function(n){return '<option>'+n+'</option>';}).join('')+'</optgroup>';
  }).join('');
  var bS    = 'width:38px;height:38px;border:1px solid var(--color-border-secondary);border-radius:6px;background:var(--color-background-secondary);cursor:pointer;font-size:15px;touch-action:manipulation;flex-shrink:0';

  return '<div class="card" style="max-width:560px"><div style="display:grid;gap:14px">'
    // Tipo
    + '<div><label class="adm-lbl-f">Tipo de movimiento</label>'
    + '<select class="adm-inp" id="mc-tipo" onchange="_onMcTipoChange()">'
    + '<option value="transferencia">🔄 Transferencia entre cajas</option>'
    + '<option value="cambio">💱 Cambio de divisa</option>'
    + '<option value="deposito">📥 Depósito externo</option>'
    + '<option value="retiro">📤 Retiro</option>'
    + '</select></div>'
    // Cajas
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    + '<div id="mc-origen-wrap"><label class="adm-lbl-f" id="mc-origen-lbl">Caja origen</label>'
    + '<select class="adm-inp" id="mc-origen" onchange="_onMcCajaChange()">'+opts+'</select></div>'
    + '<div id="mc-destino-wrap"><label class="adm-lbl-f">Caja destino</label>'
    + '<select class="adm-inp" id="mc-destino" onchange="_onMcCajaChange()">'+opts+'</select></div>'
    + '</div>'
    // Monto
    + '<div><label class="adm-lbl-f">Monto <span id="mc-mon-orig-lbl" style="color:var(--color-text-success);font-weight:700"></span></label>'
    + '<input class="adm-inp" type="number" id="mc-monto" step="0.01" placeholder="0.00" oninput="_calcMcDestino()" style="font-size:20px;font-weight:600;height:46px">'
    + '<div id="mc-saldo-error" style="display:none;color:var(--color-text-danger);font-size:11px;font-weight:600;margin-top:4px">⚠️ Monto superior al saldo disponible</div>'
    + '</div>'
    // Balance preview
    + '<div id="mc-balance-preview" style="display:none;border:1px solid var(--color-border-secondary);border-radius:8px;padding:10px;background:var(--color-background-secondary)">'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    + '<div id="mc-bal-orig"></div>'
    + '<div id="mc-bal-dest"></div>'
    + '</div>'
    + '</div>'
    // Tasa (cambio only)
    + '<div id="mc-tasa-wrap" style="display:none">'
    + '<label class="adm-lbl-f">Tasa de cambio <span id="mc-tasa-hint" style="font-size:11px;color:var(--color-text-tertiary)"></span></label>'
    + '<div style="display:flex;align-items:center;gap:6px">'
    + '<button style="'+bS+'" onclick="_adjMcTasa(-1)">−</button>'
    + '<button style="'+bS+';font-size:11px" onclick="_adjMcTasa(-0.01)">-.01</button>'
    + '<input class="adm-inp" type="number" id="mc-tasa" step="0.01" oninput="_calcMcDestino()" style="flex:1;text-align:center;font-size:16px;font-weight:600;height:38px">'
    + '<button style="'+bS+';font-size:11px" onclick="_adjMcTasa(0.01)">+.01</button>'
    + '<button style="'+bS+'" onclick="_adjMcTasa(1)">+</button>'
    + '</div></div>'
    // Resultado destino
    + '<div id="mc-dest-wrap" style="display:none">'
    + '<label class="adm-lbl-f">Resultado <span id="mc-mon-dest-lbl" style="color:var(--color-text-success);font-weight:700"></span></label>'
    + '<input class="adm-inp" type="number" id="mc-monto-dest" step="0.01" placeholder="0.00" oninput="_onMcDestManual()" style="font-size:20px;font-weight:600;height:46px">'
    + '</div>'
    // Fecha y notas
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    + '<div><label class="adm-lbl-f">Fecha</label><input class="adm-inp" type="date" id="mc-fecha" value="'+today()+'"></div>'
    + '<div><label class="adm-lbl-f">Notas</label><input class="adm-inp" type="text" id="mc-notas" placeholder="Referencia..."></div>'
    + '</div>'
    + '<button class="adm-btn adm-btn-p" onclick="admRegistrarMovCaja()" style="padding:12px;font-size:14px">✓ Registrar movimiento</button>'
    + '</div></div>';
}

function _onMcTipoChange() {
  var tipo = document.getElementById('mc-tipo')?.value;
  var dw=document.getElementById('mc-destino-wrap'), tw=document.getElementById('mc-tasa-wrap');
  var ddw=document.getElementById('mc-dest-wrap'),   ol=document.getElementById('mc-origen-lbl');
  if (tipo==='deposito') {
    dw.style.display='none'; tw.style.display='none'; ddw.style.display='none'; ol.textContent='Caja destino';
  } else if (tipo==='retiro') {
    dw.style.display='none'; tw.style.display='none'; ddw.style.display='none'; ol.textContent='Caja origen';
  } else if (tipo==='transferencia') {
    dw.style.display=''; tw.style.display='none'; ddw.style.display=''; ol.textContent='Caja origen';
  } else {
    dw.style.display=''; tw.style.display=''; ddw.style.display=''; ol.textContent='Caja origen';
  }
  _onMcCajaChange();
}

function _onMcCajaChange() {
  var tipo=document.getElementById('mc-tipo')?.value;
  var origSel=document.getElementById('mc-origen');
  var destSel=document.getElementById('mc-destino');
  var orig=origSel?.value||'';
  var monO=_getMonedaFromCaja(orig);
  var moEl=document.getElementById('mc-mon-orig-lbl');
  var hiEl=document.getElementById('mc-tasa-hint');
  if(moEl) moEl.textContent=monO;

  // Rebuild destino options filtered by tipo
  if (destSel && (tipo==='transferencia' || tipo==='cambio')) {
    var prevDest = destSel.value;
    var allCajas = _cajasData.filter(function(c){ return c.activa; });
    var filteredCajas;
    if (tipo==='transferencia') {
      // Only same currency, different caja
      filteredCajas = allCajas.filter(function(c){ return c.moneda===monO && c.nombre!==orig; });
    } else {
      // cambio: only different currency
      filteredCajas = allCajas.filter(function(c){ return c.moneda!==monO; });
    }
    
    var porMon={};
    filteredCajas.forEach(function(c){
      var m = c.moneda || 'USD';
      if(!porMon[m]) porMon[m] = [];
      porMon[m].push(c.nombre);
    });
    var monOrden = ['USD','EUR','CUP','CUPT'];
    var mons = monOrden.filter(function(m){return porMon[m];})
      .concat(Object.keys(porMon).filter(function(m){return monOrden.indexOf(m)<0;}).sort());
    
    destSel.innerHTML = mons.map(function(m){
      return '<optgroup label="'+m+'">' + porMon[m].sort().map(function(n){
        return '<option'+(n===prevDest?' selected':'')+'>'+n+'</option>';
      }).join('') + '</optgroup>';
    }).join('');
    
    if (!destSel.value && filteredCajas.length) destSel.value = filteredCajas[0].nombre;
  }

  var dest=destSel?.value||'';
  var monD=_getMonedaFromCaja(dest);
  var mdEl=document.getElementById('mc-mon-dest-lbl');
  if(mdEl) mdEl.textContent=monD;
  if (tipo==='cambio') {
    var tasa=_getTasaDefault(monO,monD);
    var tEl=document.getElementById('mc-tasa'); if(tEl) tEl.value=tasa;
  }
  _calcMcDestino();
}

function _adjMcTasa(delta) {
  var e=document.getElementById('mc-tasa'); if(!e) return;
  e.value=parseFloat(((parseFloat(e.value)||0)+delta).toFixed(6));
  _calcMcDestino();
}

function _calcMcDestino() {
  var tipo=document.getElementById('mc-tipo')?.value;
  var monto=parseFloat(document.getElementById('mc-monto')?.value)||0;
  var tasa=parseFloat(document.getElementById('mc-tasa')?.value)||1;
  var destEl=document.getElementById('mc-monto-dest');
  var hiEl=document.getElementById('mc-tasa-hint');
  var orig=document.getElementById('mc-origen')?.value||'';
  var dest=document.getElementById('mc-destino')?.value||'';
  var monO=_getMonedaFromCaja(orig), monD=_getMonedaFromCaja(dest);
  
  var isOrigNac = (monO==='CUP'||monO==='CUPT');
  var isDestNac = (monD==='CUP'||monD==='CUPT');
  var divOp = (isOrigNac && !isDestNac);

  if(hiEl) {
    if (divOp) hiEl.textContent = tasa + ' ' + monO + ' = 1 ' + monD;
    else hiEl.textContent = '1 ' + monO + ' = ' + tasa + ' ' + monD;
  }

  if (!destEl) return;
  var montoDest = monto;
  if (tipo==='transferencia') {
    destEl.value=fN(monto,2);
  } else if (tipo==='cambio') {
    if (divOp && tasa>0) montoDest = monto/tasa;
    else montoDest = monto*tasa;
    destEl.value=fN(montoDest,2);
  }
  // Update balance preview
  _updateBalancePreview(tipo, orig, dest, monto, montoDest, monO, monD);
}

function _updateBalancePreview(tipo, orig, dest, monto, montoDest, monO, monD) {
  var preview = document.getElementById('mc-balance-preview');
  var balOrig = document.getElementById('mc-bal-orig');
  var balDest = document.getElementById('mc-bal-dest');
  var errEl = document.getElementById('mc-saldo-error');
  var btn = document.querySelector('[onclick="admRegistrarMovCaja()"]');
  if (!preview) return;

  var dO = monO==='CUP'||monO==='CUPT' ? 0 : 2;
  var dD = monD==='CUP'||monD==='CUPT' ? 0 : 2;

  if (!monto || monto <= 0) {
    preview.style.display = 'none';
    if (errEl) errEl.style.display = 'none';
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    return;
  }
  preview.style.display = 'block';

  var saldoOrig = typeof _getSaldoCaja==='function' ? _getSaldoCaja(orig) : 0;
  var saldoDest = typeof _getSaldoCaja==='function' ? _getSaldoCaja(dest) : 0;
  var excede = false;

  if (tipo === 'deposito') {
    // Only destination changes (orig acts as dest)
    saldoOrig = typeof _getSaldoCaja==='function' ? _getSaldoCaja(orig) : 0;
    var nuevoOrig = saldoOrig + monto;
    balOrig.innerHTML = '<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:2px">' + orig + '</div>'
      + '<div style="display:flex;align-items:center;gap:6px">'
      + '<span style="font-size:13px;color:var(--color-text-secondary)">' + fN(saldoOrig, dO) + '</span>'
      + '<span style="color:var(--color-text-success)">→</span>'
      + '<span style="font-size:15px;font-weight:700;color:var(--color-text-success)">' + fN(nuevoOrig, dO) + ' ' + monO + '</span>'
      + '</div>';
    balDest.innerHTML = '';
  } else if (tipo === 'retiro') {
    var nuevoOrig = saldoOrig - monto;
    excede = nuevoOrig < -0.005;
    balOrig.innerHTML = '<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:2px">' + orig + '</div>'
      + '<div style="display:flex;align-items:center;gap:6px">'
      + '<span style="font-size:13px;color:var(--color-text-secondary)">' + fN(saldoOrig, dO) + '</span>'
      + '<span style="color:var(--color-text-danger)">→</span>'
      + '<span style="font-size:15px;font-weight:700;color:' + (excede ? 'var(--color-text-danger)' : 'var(--color-text-warning)') + '">' + fN(nuevoOrig, dO) + ' ' + monO + '</span>'
      + '</div>';
    balDest.innerHTML = '';
  } else {
    // transferencia or cambio
    var nuevoOrig = saldoOrig - monto;
    var nuevoDest = saldoDest + (tipo==='transferencia' ? monto : montoDest);
    excede = nuevoOrig < -0.005;
    balOrig.innerHTML = '<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:2px">📤 ' + orig + '</div>'
      + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
      + '<span style="font-size:13px;color:var(--color-text-secondary)">' + fN(saldoOrig, dO) + '</span>'
      + '<span style="color:var(--color-text-danger)">→</span>'
      + '<span style="font-size:15px;font-weight:700;color:' + (excede ? 'var(--color-text-danger)' : 'var(--color-text-warning)') + '">' + fN(nuevoOrig, dO) + ' ' + monO + '</span>'
      + '</div>';
    balDest.innerHTML = '<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:2px">📥 ' + dest + '</div>'
      + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
      + '<span style="font-size:13px;color:var(--color-text-secondary)">' + fN(saldoDest, dD) + '</span>'
      + '<span style="color:var(--color-text-success)">→</span>'
      + '<span style="font-size:15px;font-weight:700;color:var(--color-text-success)">' + fN(nuevoDest, dD) + ' ' + monD + '</span>'
      + '</div>';
  }
  // Show/hide error and disable button
  if (errEl) errEl.style.display = excede ? 'block' : 'none';
  if (btn) { btn.disabled = excede; btn.style.opacity = excede ? '0.4' : '1'; }
}

function _onMcDestManual() {
  var monto=parseFloat(document.getElementById('mc-monto')?.value)||0;
  var dest=parseFloat(document.getElementById('mc-monto-dest')?.value)||0;
  var tEl=document.getElementById('mc-tasa'), hiEl=document.getElementById('mc-tasa-hint');
  var orig=document.getElementById('mc-origen')?.value||'';
  var dc=document.getElementById('mc-destino')?.value||'';
  var monO=_getMonedaFromCaja(orig), monD=_getMonedaFromCaja(dc);
  
  var isOrigNac = (monO==='CUP'||monO==='CUPT');
  var isDestNac = (monD==='CUP'||monD==='CUPT');
  var divOp = (isOrigNac && !isDestNac);

  if (monto>0 && tEl) {
    var t;
    if (divOp && dest>0) t = parseFloat((monto/dest).toFixed(4));
    else t = parseFloat((dest/monto).toFixed(6));
    
    tEl.value=t;
    if(hiEl) {
      if (divOp) hiEl.textContent = t + ' ' + monO + ' = 1 ' + monD;
      else hiEl.textContent = '1 ' + monO + ' = ' + t + ' ' + monD;
    }
  }
}

async function admRegistrarMovCaja() {
  var tipo=document.getElementById('mc-tipo')?.value;
  var orig=document.getElementById('mc-origen')?.value;
  var dest=document.getElementById('mc-destino')?.value;
  var monto=parseFloat(document.getElementById('mc-monto')?.value)||0;
  var montoDest=parseFloat(document.getElementById('mc-monto-dest')?.value)||monto;
  var tasa=parseFloat(document.getElementById('mc-tasa')?.value)||null;
  var fecha=document.getElementById('mc-fecha')?.value||today();
  var notas=document.getElementById('mc-notas')?.value||'';
  var usuario=(typeof S!=='undefined'&&S.user)||'Admin';

  if (!monto) { showToast('Introduce el monto'); return; }

  // Validate balance
  var cajaOrigenCheck = (tipo==='deposito') ? null : orig;
  if (cajaOrigenCheck) {
    var saldoDisp = typeof _getSaldoCaja==='function' ? _getSaldoCaja(cajaOrigenCheck) : 0;
    if (monto > saldoDisp + 0.005) {
      showToast('⚠️ Saldo insuficiente en ' + cajaOrigenCheck + ' (' + fN(saldoDisp,2) + ')');
      return;
    }
  }

  if (tipo === 'transferencia') {
    if (_getMonedaFromCaja(orig) !== _getMonedaFromCaja(dest)) {
      showToast('Para transferir, ambas cajas deben tener la misma moneda. Usa "Cambio de divisa".');
      return;
    }
  }

  var cajaOrig = (tipo==='deposito') ? null : orig;
  var cajaDest = (tipo==='retiro')   ? null : (tipo==='deposito'?orig:dest);

  var row = {
    tipo:tipo, fecha:fecha, notas:notas, usuario:usuario,
    caja_origen:  cajaOrig,
    caja_destino: cajaDest,
    monto_origen:  monto,
    monto_destino: (tipo==='transferencia')?monto:(tipo==='cambio'?montoDest:monto),
    tasa_usada: tasa
  };

  if (_supaOnline) {
    var r=await supaReq('POST','mov_cajas',row);
    if (r.ok) {
      showToast('\u2713 Movimiento registrado');
      _cajasMovs.unshift(row);

      // --- Also write to movimientos_ig so it shows in Libro I/G ---
      var _monO = _getMonedaFromCaja(orig||dest);
      var _monD = tipo==='cambio' ? _getMonedaFromCaja(dest) : _monO;
      var _RATES_USD = {USD:1, EUR:1/RATES.EUR, CUP:1/RATES.CUP, CUPT:1/RATES.CUPT};

      if (tipo === 'deposito') {
        // Ingreso a la caja
        supaReq('POST','movimientos_ig',{
          fecha:fecha, tipo:'Ingreso no-venta',
          descripcion: (notas||'Depósito externo') + ' → ' + orig,
          monto: monto, moneda: _monO,
          equiv_usd: parseFloat((monto*(_RATES_USD[_monO]||1)).toFixed(4)),
          cuenta: orig, vendedor: usuario, notas: notas
        }).catch(function(e){console.warn('ig deposito:',e);});
      } else if (tipo === 'retiro') {
        // Gasto desde la caja
        supaReq('POST','movimientos_ig',{
          fecha:fecha, tipo:'Gasto operativo',
          descripcion: (notas||'Retiro') + ' ← ' + orig,
          monto: monto, moneda: _monO,
          equiv_usd: parseFloat((monto*(_RATES_USD[_monO]||1)).toFixed(4)),
          cuenta: orig, vendedor: usuario, notas: notas
        }).catch(function(e){console.warn('ig retiro:',e);});
      } else if (tipo === 'transferencia') {
        // Salida de origen
        supaReq('POST','movimientos_ig',{
          fecha:fecha, tipo:'Transferencia entre cuentas',
          descripcion: (notas||'Transferencia') + ' (salida)',
          monto: monto, moneda: _monO,
          equiv_usd: parseFloat((monto*(_RATES_USD[_monO]||1)).toFixed(4)),
          cuenta: orig, vendedor: usuario, notas: notas
        }).catch(function(e){console.warn('ig transferencia salida:',e);});
        // Entrada a destino
        supaReq('POST','movimientos_ig',{
          fecha:fecha, tipo:'Transferencia entre cuentas',
          descripcion: (notas||'Transferencia') + ' (entrada)',
          monto: monto, moneda: _monD,
          equiv_usd: parseFloat((monto*(_RATES_USD[_monD]||1)).toFixed(4)),
          cuenta: dest, vendedor: usuario, notas: notas
        }).catch(function(e){console.warn('ig transferencia entrada:',e);});
      } else if (tipo === 'cambio') {
        // Cambio de divisa: salida en moneda origen
        supaReq('POST','movimientos_ig',{
          fecha:fecha, tipo:'Transferencia entre cuentas',
          descripcion: (notas||'Cambio de divisa') + ' (salida ' + _monO + ')',
          monto: monto, moneda: _monO,
          equiv_usd: parseFloat((monto*(_RATES_USD[_monO]||1)).toFixed(4)),
          cuenta: orig, vendedor: usuario, notas: notas
        }).catch(function(e){console.warn('ig cambio salida:',e);});
        // Entrada en moneda destino
        supaReq('POST','movimientos_ig',{
          fecha:fecha, tipo:'Transferencia entre cuentas',
          descripcion: (notas||'Cambio de divisa') + ' (entrada ' + _monD + ')',
          monto: montoDest, moneda: _monD,
          equiv_usd: parseFloat((montoDest*(_RATES_USD[_monD]||1)).toFixed(4)),
          cuenta: dest, vendedor: usuario, notas: notas
        }).catch(function(e){console.warn('ig cambio entrada:',e);});
      }
      // Reload I/G if visible
      if(typeof syncLoadMovsIG==='function') syncLoadMovsIG().catch(function(){});

      ['mc-monto','mc-monto-dest','mc-notas'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});
      _setCajasTab('resumen');
    } else { showToast('Error al guardar'); }
  } else {
    _cajasMovs.unshift(row);
    showToast('\u2713 Guardado localmente');
    _setCajasTab('resumen');
  }
}

// ── HISTORIAL ────────────────────────────────────────────────
let _cajasHistFiltro = '';
window.updCajasHistFiltro = function(val) {
  _cajasHistFiltro = val;
  var el = document.getElementById('cajas-hist-list');
  if(el) el.innerHTML = _getHistorialListHtml();
};

function _renderHistorialMovCajas() {
  var filtroHtml = '<div style="margin-bottom:12px"><input type="text" class="adm-inp" placeholder="🔍 Buscar por concepto, fecha, caja, moneda o usuario..." value="'+_cajasHistFiltro+'" oninput="updCajasHistFiltro(this.value)" style="width:100%;background:var(--color-background-primary)"></div>';
  return filtroHtml + '<div id="cajas-hist-list">' + _getHistorialListHtml() + '</div>';
}

function _getHistorialListHtml() {
  var tipoIcon  = {transferencia:'🔄',cambio:'💱',deposito:'📥',retiro:'📤'};
  var tipoColor = {transferencia:'var(--color-text-info)',cambio:'var(--color-text-warning)',deposito:'var(--color-text-success)',retiro:'var(--color-text-danger)'};
  
  var arr = _cajasMovs;
  if(_cajasHistFiltro.trim()){
    var q = _cajasHistFiltro.toLowerCase();
    arr = arr.filter(function(m){
      var txt = (m.tipo+' '+(m.caja_origen||'')+' '+(m.caja_destino||'')+' '+(m.notas||'')+' '+(m.fecha||'')+' '+(m.usuario||'')).toLowerCase();
      return txt.indexOf(q)>=0;
    });
  }

  if (!arr.length) return '<div style="text-align:center;padding:40px;color:var(--color-text-tertiary)">Sin movimientos que coincidan</div>';
  
  return '<div style="display:flex;flex-direction:column;gap:8px">'
    + arr.slice(0,100).map(function(m){
        return '<div class="card" style="padding:10px 14px">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">'
          + '<div style="display:flex;align-items:center;gap:8px">'
          + '<span style="font-size:18px">'+(tipoIcon[m.tipo]||'📋')+'</span>'
          + '<div>'
          + '<div style="font-size:13px;font-weight:600;color:'+(tipoColor[m.tipo]||'')+'">'+m.tipo.charAt(0).toUpperCase()+m.tipo.slice(1)+'</div>'
          + '<div style="font-size:11px;color:var(--color-text-secondary)">'+(m.caja_origen||'—')+(m.caja_destino?' → '+m.caja_destino:'')+'</div>'
          + (m.notas?'<div style="font-size:11px;color:var(--color-text-tertiary)">'+m.notas+'</div>':'')
          + '</div></div>'
          + '<div style="text-align:right">'
          + '<div style="font-size:15px;font-weight:700">'+fN(m.monto_origen,2)+(m.tipo==='cambio'?' → '+fN(m.monto_destino,2):'')+'</div>'
          + (m.tasa_usada?'<div style="font-size:10px;color:var(--color-text-tertiary)">tasa: '+m.tasa_usada+'</div>':'')
          + '<div style="font-size:10px;color:var(--color-text-tertiary)">'+(m.fecha||'')+' · '+(m.usuario||'')+'</div>'
          + '</div></div></div>';
      }).join('')
    + '</div>';
}

// ── GESTIONAR CAJAS ──────────────────────────────────────────
function _renderGestionarCajas() {
  var monedas = ['USD','EUR','CUP','CUPT'];
  var almacenes = ['Habana','Placetas','Xportprise','USA','General'];
  return '<div>'
    + '<div class="card" style="margin-bottom:14px">'
    + '<h3 style="margin-bottom:12px">➕ Nueva caja</h3>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
    + '<div><label class="adm-lbl-f">Nombre</label><input class="adm-inp" id="caja-nc-nombre" placeholder="Ej: USD Zelle"></div>'
    + '<div><label class="adm-lbl-f">Moneda</label><select class="adm-inp" id="caja-nc-moneda">'
    + monedas.map(function(m){return '<option>'+m+'</option>';}).join('')
    + '</select></div>'
    + '<div><label class="adm-lbl-f">Almacén</label><select class="adm-inp" id="caja-nc-almacen">'
    + almacenes.map(function(a){return '<option>'+a+'</option>';}).join('')
    + '</select></div>'
    + '<div><label class="adm-lbl-f">Saldo inicial</label><input class="adm-inp" type="number" id="caja-nc-saldo" placeholder="0.00" step="0.01"></div>'
    + '</div>'
    + '<button class="adm-btn adm-btn-p" onclick="admCrearCaja()">Crear caja</button>'
    + '</div>'
    + '<div class="card">'
    + '<h3 style="margin-bottom:12px">Cajas activas</h3>'
    + '<div style="display:flex;flex-direction:column;gap:6px">'
    + _cajasData.filter(function(c){return c.activa;}).map(function(c){
        var saldo = _getSaldoCaja(c.nombre);
        var cid = 'caja-edit-'+c.id;
        return '<div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);margin-bottom:4px">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px">'
          + '<div>'
          + '<span style="font-weight:600">'+c.nombre+'</span>'
          + '<span style="margin-left:8px;font-size:11px;color:var(--color-text-tertiary)">'+c.moneda+' · '+c.almacen+'</span>'
          + '</div>'
          + '<div style="display:flex;align-items:center;gap:12px">'
          + '<span style="font-size:14px;font-weight:700;color:'+(saldo>=0?'var(--color-text-success)':'var(--color-text-danger)')+'">'+fN(saldo,2)+'</span>'
          + '<button class="btn-sm" onclick="admToggleEditCaja(\''+c.id+'\')" style="color:var(--color-text-info);font-size:11px">Editar</button>'
          + '<button class="btn-sm" onclick="admDesactivarCaja(\''+c.id+'\')" style="color:var(--color-text-danger);font-size:11px">Archivar</button>'
          + '</div>'
          + '</div>'
          + '<div id="'+cid+'" style="display:none;padding:10px 12px;border-top:1px solid var(--color-border-secondary)">'
          + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;align-items:flex-end">'
          + '<div><label class="adm-lbl-f" style="font-size:10px">Nombre</label><input class="adm-inp" id="'+cid+'-nombre" value="'+c.nombre+'" style="height:34px;font-size:13px"></div>'
          + '<div><label class="adm-lbl-f" style="font-size:10px">Moneda</label><select class="adm-inp" id="'+cid+'-moneda" style="height:34px;font-size:13px">'
          + ['USD','EUR','CUP','CUPT'].map(function(m){return '<option'+(m===c.moneda?' selected':'')+'>'+m+'</option>';}).join('')
          + '</select></div>'
          + '<div><label class="adm-lbl-f" style="font-size:10px">Almacén</label><select class="adm-inp" id="'+cid+'-almacen" style="height:34px;font-size:13px">'
          + ['Habana','Placetas','Xportprise','USA','General'].map(function(a){return '<option'+(a===c.almacen?' selected':'')+'>'+a+'</option>';}).join('')
          + '</select></div>'
          + '<button class="adm-btn adm-btn-p" onclick="admGuardarEditCaja(\''+c.id+'\',\''+c.nombre+'\')" style="padding:6px 12px;font-size:12px;height:34px">✓ Guardar</button>'
          + '</div>'
          + '</div>'
          + '</div>';
      }).join('')
    + '</div></div>'
    // Archived cajas section
    + '<div class="card" style="margin-top:12px">'
    + '<h3 style="margin-bottom:12px;color:var(--color-text-secondary)">📦 Cajas archivadas</h3>'
    + (function(){
        var archivadas = typeof _cajasDataAll!=='undefined' ? _cajasDataAll.filter(function(c){return !c.activa;}) : [];
        if(!archivadas.length) return '<div style="font-size:12px;color:var(--color-text-tertiary);padding:8px 0">Sin cajas archivadas</div>';
        return '<div style="display:flex;flex-direction:column;gap:6px">'
          + archivadas.map(function(c){
            return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--color-background-secondary);border-radius:var(--border-radius-md);opacity:.6">'
              + '<div><span style="font-weight:600">'+c.nombre+'</span>'
              + '<span style="margin-left:8px;font-size:11px;color:var(--color-text-tertiary)">'+c.moneda+' · '+c.almacen+'</span></div>'
              + '<button class="btn-sm" onclick="admDesarchivarCaja(\''+c.id+'\')" style="color:var(--color-text-success);font-size:11px">Desarchivar</button>'
              + '</div>';
          }).join('')
          + '</div>';
      })()
    + '</div></div>';
}

async function admDesarchivarCaja(id) {
  if(_supaOnline){
    var r=await supaReq('PATCH','cajas?id=eq.'+id,{activa:true});
    if(r.ok){
      // Reload all cajas including inactive
      await loadCajasData();
      showToast('✓ Caja reactivada');
      renderAdminCajas();
    } else { showToast('Error al desarchivar'); }
  }
}

async function admCrearCaja() {
  var nombre  = document.getElementById('caja-nc-nombre')?.value.trim();
  var moneda  = document.getElementById('caja-nc-moneda')?.value;
  var almacen = document.getElementById('caja-nc-almacen')?.value;
  var saldo   = parseFloat(document.getElementById('caja-nc-saldo')?.value)||0;
  if (!nombre) { showToast('Introduce el nombre'); return; }
  if (_supaOnline) {
    var r=await supaReq('POST','cajas',{nombre:nombre,moneda:moneda,almacen:almacen,saldo_inicial:saldo,activa:true});
    if (r.ok) {
      var d=await r.json(); var caja=d&&d[0]?d[0]:{id:Date.now(),nombre:nombre,moneda:moneda,almacen:almacen,saldo_inicial:saldo,activa:true};
      _cajasData.push(caja);
      showToast('✓ Caja creada: '+nombre);
      renderAdminCajas();
    } else {
      var err=await r.text();
      showToast(err.includes('unique')?'Ya existe una caja con ese nombre':'Error al crear caja');
    }
  } else { showToast('Sin conexión'); }
}

async function admEditarCaja(id) {
  var caja = _cajasData.find(function(c) { return c.id === id; });
  if (!caja) return;
  
  var nuevoNombre = prompt('Nuevo nombre para la caja:', caja.nombre);
  if (nuevoNombre === null) return;
  nuevoNombre = nuevoNombre.trim();
  if (!nuevoNombre) { showToast('El nombre no puede estar vacío'); return; }

  var nuevaMoneda = prompt('Nueva moneda (USD, EUR, CUP, CUPT):', caja.moneda);
  if (nuevaMoneda === null) return;
  nuevaMoneda = nuevaMoneda.trim().toUpperCase();
  if (['USD','EUR','CUP','CUPT'].indexOf(nuevaMoneda) < 0) {
    showToast('Moneda inválida. Debe ser USD, EUR, CUP o CUPT');
    return;
  }

  if (nuevoNombre === caja.nombre && nuevaMoneda === caja.moneda) return;

  if (_supaOnline) {
    if (nuevoNombre !== caja.nombre) {
      if (!confirm('Atención: Si cambias el nombre, se intentarán actualizar los movimientos previos asociados. ¿Continuar?')) return;
    }
    
    var r = await supaReq('PATCH', 'cajas?id=eq.'+id, { nombre: nuevoNombre, moneda: nuevaMoneda });
    if (r.ok) {
      if (nuevoNombre !== caja.nombre) {
        // Update historical records asynchronously
        supaReq('PATCH', 'mov_cajas?caja_origen=eq.'+encodeURIComponent(caja.nombre), { caja_origen: nuevoNombre });
        supaReq('PATCH', 'mov_cajas?caja_destino=eq.'+encodeURIComponent(caja.nombre), { caja_destino: nuevoNombre });
        supaReq('PATCH', 'movimientos_ig?cuenta=eq.'+encodeURIComponent(caja.nombre), { cuenta: nuevoNombre });
      }
      showToast('✓ Caja actualizada');
      await loadCajasData();
      renderAdminCajas();
    } else {
      var err = await r.text();
      showToast(err.includes('unique') ? 'Ese nombre ya existe' : 'Error al actualizar caja');
    }
  } else {
    showToast('Sin conexión');
  }
}

function admToggleEditCaja(id) {
  var panel = document.getElementById('caja-edit-'+id);
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? '' : 'none';
}

async function admGuardarEditCaja(id, nombreAnterior) {
  var cid = 'caja-edit-'+id;
  var nuevoNombre = (document.getElementById(cid+'-nombre')?.value||'').trim();
  var nuevaMoneda = document.getElementById(cid+'-moneda')?.value;
  var nuevoAlmacen = document.getElementById(cid+'-almacen')?.value;

  if (!nuevoNombre) { showToast('El nombre no puede estar vacío'); return; }

  if (!_supaOnline) { showToast('Sin conexión'); return; }

  var r = await supaReq('PATCH', 'cajas?id=eq.'+id, { nombre: nuevoNombre, moneda: nuevaMoneda, almacen: nuevoAlmacen });
  if (r.ok) {
    if (nuevoNombre !== nombreAnterior) {
      // Update historical records referencing the old name
      supaReq('PATCH', 'mov_cajas?caja_origen=eq.'+encodeURIComponent(nombreAnterior), { caja_origen: nuevoNombre });
      supaReq('PATCH', 'mov_cajas?caja_destino=eq.'+encodeURIComponent(nombreAnterior), { caja_destino: nuevoNombre });
      supaReq('PATCH', 'movimientos_ig?cuenta=eq.'+encodeURIComponent(nombreAnterior), { cuenta: nuevoNombre });
    }
    showToast('✓ Caja actualizada');
    await loadCajasData();
    renderAdminCajas();
  } else {
    var err = await r.text();
    showToast(err.includes('unique') ? 'Ese nombre ya existe' : 'Error al actualizar');
  }
}

async function admDesactivarCaja(id) {
  if (!confirm('¿Archivar esta caja?')) return;
  if (_supaOnline) {
    var r=await supaReq('PATCH','cajas?id=eq.'+id,{activa:false});
    if (r.ok) { _cajasData=_cajasData.filter(function(c){return c.id!=id;}); showToast('Caja archivada'); renderAdminCajas(); }
  }
}



