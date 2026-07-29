




function goMod(id,title,btn){
  // Check permission
  var _modDef = typeof MOD_DEFS!=='undefined' ? MOD_DEFS.find(function(m){return m.id===id;}) : null;
  var modKey = _modDef ? _modDef.key : id.replace('mod-','');
  if(typeof S!=='undefined' && (!S.user || S.step === 0)){
    if(id !== 'mod-pos'){
      showToast('Debes iniciar sesión primero');
      return;
    }
  } else if(typeof S!=='undefined'&&S.user&&USERS[S.user]){
    const allowed = USERS[S.user].modulos||[];
    if(!allowed.includes(modKey)&&USERS[S.user].rol!=='admin'){
      showToast('Sin acceso a este módulo'); return;
    }
  }
  document.querySelectorAll('.module').forEach(m=>m.classList.remove('act'));
  const el=document.getElementById(id);
  if(el)el.classList.add('act');
  document.querySelectorAll('.sb-item').forEach(b=>b.classList.remove('act'));
  if(btn)btn.classList.add('act');
  document.getElementById('tb-title').textContent=title;
  document.getElementById('sidebar').classList.remove('mob-open');
  var _gtb=document.getElementById('topbar');
  if(_gtb)_gtb.style.display=(id==='mod-pos')?'none':'';
  if(id==='mod-ventas'&&typeof renderVentas==='function'){try{
    // Auto-filter for vendedor
    var _isVendV=typeof S!=='undefined'&&S.user&&USERS[S.user]&&USERS[S.user].rol==='vendedor';
    if(_isVendV){
      const fv=document.getElementById('f-vend');if(fv)fv.value=S.user;
      // Vendedor: go to Mi Caja tab, admin: go to ventas tab
      var _mcBtn=document.getElementById('btn-micaja-nav');
      if(_mcBtn&&_mcBtn.style.display!=='none'&&typeof navTo_ven==='function'){
        navTo_ven('micaja',_mcBtn);
      } else {
        var _firstVBtn=document.querySelector('#ven-nav button');
        if(_firstVBtn&&typeof navTo_ven==='function') _firstVBtn.click();
        else renderVentas();
      }
    } else {
      var _firstVBtn=document.querySelector('#ven-nav button');
      if(_firstVBtn) _firstVBtn.click();
      else renderVentas();
    }
  }catch(e){try{renderVentas();}catch(e2){}}}
  if(id==='mod-ig'&&typeof renderLibro==='function'){
    try{
      // Hide/show admin-only tabs based on role
      var _igVend=typeof S!=='undefined'&&S.user&&USERS[S.user]&&USERS[S.user].rol==='vendedor';
      ['ig-btn-cajas','ig-btn-deuda','ig-btn-cnt'].forEach(function(bid){var be=document.getElementById(bid);if(be)be.style.display=_igVend?'none':'';});
      // Load cajasData so filtrar_ig can filter by almacen
      (async function(){
        if(typeof loadCajasData==='function') await loadCajasData();
        // Load movimientos FIRST, then render
        if(_supaOnline&&typeof syncLoadMovsIG==='function') await syncLoadMovsIG();
        try{
          // Rebuild l-cta
          var _ligSel=document.getElementById('l-cta');
          if(_ligSel&&_cajasData.length){
            var _ligAlm=_igVend&&USERS[S.user]?USERS[S.user].almacen:'';
            var _globalAlms2=['USA','Xportprise','General','España'];
            var _ligCajas=_ligAlm?_cajasData.filter(function(c){return c.almacen===_ligAlm||_globalAlms2.indexOf(c.almacen)>=0;}):_cajasData;
            var _firstOpt=_igVend?'<option value="">Todas mis cuentas</option>':'<option value="">Todas</option>';
            _ligSel.innerHTML=_firstOpt+_ligCajas.map(function(c){return '<option value="'+c.nombre+'">'+c.nombre+'</option>';}).join('');
          }
          if(typeof updNuevo==='function') try{updNuevo();}catch(e){}
          var _ld=document.getElementById('ig-desde');
          var _lh=document.getElementById('ig-hasta');
          if(_ld&&!_ld.value){_ld.value='2025-01-01';}
          if(_lh&&!_lh.value){_lh.value='2026-12-31';}
          if(typeof navTo_ig==='function') navTo_ig('libro', document.querySelector('#ig-nav button'));
          else renderLibro();
        }catch(e){renderLibro();}
      })().catch(function(){renderLibro();});
    }catch(e){try{renderLibro();}catch(e2){}}
  }
  if(id==='mod-cli'&&typeof renderLista==='function'){try{
    var _cliFirstBtn=document.querySelector('#main-nav button');
    if(_cliFirstBtn) _cliFirstBtn.click();
    else renderLista();
  }catch(e){try{renderLista();}catch(e2){}}}
  if(id==='mod-admin'&&typeof renderAdmin==='function'){try{
    renderAdmin();
    setTimeout(function(){
      var _admFirstBtn=document.querySelector('#mod-admin .nav button, #mod-admin .adm-nav button');
      if(_admFirstBtn&&!_admFirstBtn.classList.contains('act')) _admFirstBtn.click();
    },50);
  }catch(e){console.error('renderAdmin error:',e);}}
  if(id==='mod-stock'&&typeof renderStock==='function'){try{
    var _stFirstBtn=document.querySelector('#mod-stock .nav button');
    if(_stFirstBtn&&!_stFirstBtn.classList.contains('act')) _stFirstBtn.click();
    else renderStock();
  }catch(e){try{renderStock();}catch(e2){}}}
  if(id==='mod-backup'&&typeof renderBackup==='function'){try{renderBackup();}catch(e){}}
  if(id==='mod-prestamos'&&typeof renderPrestamos==='function'){try{renderPrestamos();}catch(e){}}
}
function erpSetUser(name,bg,tc){
  if(typeof renderSteps==="function") try{renderSteps(S.step||0);}catch(e){}
  const av=document.getElementById('sb-av');if(av){av.textContent=name[0];av.style.background=bg;av.style.color=tc;}
  const un=document.getElementById('sb-uname');if(un)un.textContent=name;
  buildSidebar(name);
}

const MOD_DEFS=[
  {key:'pos',     id:'mod-pos',    icon:'🛒', label:'POS',               section:'Ventas'},
  {key:'ventas',  id:'mod-ventas', icon:'📊', label:'Ventas',section:null},
  {key:'stock',   id:'mod-stock',  icon:'📦', label:'Stock',              section:'Inventario'},
  {key:'clientes',id:'mod-cli',    icon:'👤', label:'Cuentas clientes',   section:'Clientes'},
  {key:'ig',      id:'mod-ig',     icon:'💰', label:'Ingresos / Gastos',  section:'Finanzas'},
  {key:'backup',  id:'mod-backup', icon:'💾', label:'Backup / Export',    section:'Sistema'},
  {key:'admin',   id:'mod-admin',  icon:'⚙️', label:'Administración',     section:null},
];

function buildSidebar(userName){
  const nav=document.getElementById('sb-nav');
  if(!nav)return;
  const u=USERS[userName];
  if(!u){nav.innerHTML='';return;}
  var allowed=(Array.isArray(u.modulos)&&u.modulos.length>0)?u.modulos.slice():(u.rol==='admin'?MOD_DEFS.map(m=>m.key):['pos','stock','ventas','clientes','ig']);
  // Vendedores always get ig (almacen-filtered view)
  if(u.rol==='vendedor' && allowed.indexOf('ig')<0) allowed.push('ig');
  let html='',lastSection='';
  MOD_DEFS.forEach(function(m){
    if(!allowed.includes(m.key))return;
    if(m.section&&m.section!==lastSection){
      html+='<div class="sb-section">'+m.section+'</div>';
      lastSection=m.section;
    }
    html+='<div class="sb-item" onclick="goMod(\''+m.id+'\',\''+m.label+'\',this)"><span class="sb-icon">'+m.icon+'</span><span class="sb-lbl">'+m.label+'</span></div>';
  });
  nav.innerHTML=html;
  // Activate first item
  const first=nav.querySelector('.sb-item');
  if(first)first.classList.add('act');
}
function toggleSidebar(){
  var sb = document.getElementById('sidebar');
  var btn = document.getElementById('sb-collapse-btn');
  var isCollapsed = sb.classList.toggle('collapsed');
  if(btn) btn.innerHTML = isCollapsed ? '&#xBB;' : '&#xAB;';
  try{ localStorage.setItem('erp_sb_collapsed', isCollapsed?'1':'0'); }catch(e){}
}
(function(){
  try{
    if(localStorage.getItem('erp_sb_collapsed')==='1'){
      var sb=document.getElementById('sidebar');
      var btn=document.getElementById('sb-collapse-btn');
      if(sb){sb.classList.add('collapsed');}
      if(btn){btn.innerHTML='&#xBB;';}
    }
  }catch(e){}
})();
function erpLogout(){
  if(typeof logout==='function')logout();
  document.getElementById('sidebar').classList.remove('mob-open');
  const av=document.getElementById('sb-av');
  if(av){av.textContent='?';av.style.background='var(--color-background-secondary)';av.style.color='var(--color-text-tertiary)';}
  document.getElementById('sb-uname').textContent='Sin sesión';
  const nav2=document.getElementById('sb-nav');
  if(nav2)nav2.innerHTML='<div style="padding:20px;text-align:center;color:var(--color-text-tertiary);font-size:12px">Inicia sesión</div>';
}

const USERS={Keiler:{pin:'1234',color:'var(--color-background-info)',tc:'var(--color-text-info)',rol:'vendedor',almacen:'Habana',modulos:['pos','stock','ventas','clientes','ig'],activo:true,puedeVender:true},Admin:{pin:'0000',color:'var(--color-background-success)',tc:'var(--color-text-success)',rol:'admin',almacen:'',modulos:['pos','stock','ventas','clientes','ig','admin','backup','prestamos'],activo:true,puedeVender:true}};
(function(){try{var _su=JSON.parse(localStorage.getItem('erp_users_cache')||'{}');Object.keys(_su).forEach(function(k){if(_su[k]&&_su[k].pin){var _u=_su[k];if((_u.rol||'vendedor')==='vendedor'&&Array.isArray(_u.modulos)&&_u.modulos.indexOf('ig')<0)_u.modulos.push('ig');USERS[k]=_u;}});}catch(e){}})();

function renderLoginCards(){
  var el=document.getElementById('user-cards-list');
  if(!el){setTimeout(renderLoginCards,50);return;}
  el.innerHTML=Object.keys(USERS).filter(function(k){
    return USERS[k]&&USERS[k].activo!==false;
  }).map(function(name){
    var u=USERS[name];
    var bg=u.color||'var(--color-background-secondary)';
    var tc=u.tc||'var(--color-text-primary)';
    var rol=u.rol==='admin'?'Administrador':'Vendedor';
    return '<div class="user-card" data-uname="'+name+'" onclick="selUser(this.getAttribute(\'data-uname\'),this)">'
      +'<div class="user-avatar" style="background:'+bg+';color:'+tc+'">'+name[0].toUpperCase()+'</div>'
      +'<div><div style="font-size:15px;font-weight:500">'+name+'</div>'
      +'<div style="font-size:11px;color:var(--color-text-secondary)">'+rol+'</div></div>'
      +'</div>';
  }).join('');
}
function saveUsers(){try{localStorage.setItem('erp_users_cache',JSON.stringify(USERS));}catch(e){}}
async function syncSaveUser(n,u){
  if(typeof supaReq==='undefined'||!_supaOnline){try{enqueue({method:'POST',path:'usuarios?on_conflict=nombre',body:{nombre:n,pin:u.pin,rol:u.rol||'vendedor',almacen:u.almacen||'',color:u.color||'',tc:u.tc||'',modulos:u.modulos||[],activo:u.activo!==false,puede_vender:u.puedeVender!==false,a_comision:u.aComision!==false}});}catch(e){}return;}
  try{await supaReq('POST','usuarios?on_conflict=nombre',{nombre:n,pin:u.pin,rol:u.rol||'vendedor',almacen:u.almacen||'',color:u.color||'',tc:u.tc||'',modulos:u.modulos||[],activo:u.activo!==false,puede_vender:u.puedeVender!==false,a_comision:u.aComision!==false});}catch(e){console.warn(e);}
}
async function syncDeleteUser(n){
  // Use activo=false to preserve FK references from ventas table
  if(typeof supaReq==='undefined'||!_supaOnline){
    enqueue({method:'PATCH',path:'usuarios?nombre=eq.'+encodeURIComponent(n),body:{activo:false}});
    return;
  }
  try{await supaReq('PATCH','usuarios?nombre=eq.'+encodeURIComponent(n),{activo:false});}catch(e){}
}
// Ensure ig module in all vendedor users (cached or fresh)
(function(){
  try{
    var _sc=localStorage.getItem('erp_users_cache');
    if(_sc){
      var _su=JSON.parse(_sc);
      var changed=false;
      Object.keys(_su).forEach(function(k){
        if(_su[k]&&_su[k].rol==='vendedor'){
          if(!Array.isArray(_su[k].modulos)) _su[k].modulos=['pos','stock','ventas','clientes','ig'];
          else if(_su[k].modulos.indexOf('ig')<0){_su[k].modulos.push('ig');changed=true;}
        }
      });
      if(changed) localStorage.setItem('erp_users_cache',JSON.stringify(_su));
    }
  }catch(e){}
})();

async function syncLoadUsers(){
  if(typeof supaReq==='undefined'||!_supaOnline)return;
  try{
    var r=await supaReq('GET','usuarios?select=*&activo=eq.true');
    if(!r.ok)return;
    var rows=await r.json();
    if(!rows||!rows.length)return;
    // Clear all non-hardcoded users first, then rebuild from Supabase
    var hardcoded=['Keiler','Admin'];
    Object.keys(USERS).forEach(function(k){
      if(hardcoded.indexOf(k)<0) delete USERS[k];
    });
    rows.forEach(function(row){
      var mods = Array.isArray(row.modulos)?row.modulos:(row.modulos||[]);
      // Vendedores always get ig access (almacen-filtered view)
      if((row.rol||'vendedor')==='vendedor' && mods.indexOf('ig')<0) mods.push('ig');
      USERS[row.nombre]={
        pin:row.pin,rol:row.rol||'vendedor',almacen:row.almacen||'',
        color:row.color||'',tc:row.tc||'',
        modulos:mods,
        activo:row.activo!==false,puedeVender:row.puede_vender!==false,
        aComision:row.a_comision!==false
      };
    });
    saveUsers();
    if(typeof renderLoginCards==='function')renderLoginCards();
    if(typeof S!=='undefined'&&S.user&&S.step>0&&typeof buildSidebar==='function')buildSidebar(S.user);
  }catch(e){console.warn('syncLoadUsers:',e);}
}

// ═══ CLIENTES SYNC ═══
async function _supaUpsert(table, idCol, idVal, body){
  try{
    var r=await supaReq('POST', table, body);
    if(r.ok) return true;
    var txt=await r.text();
    if(r.status===409||txt.indexOf('23505')>=0||txt.indexOf('duplicate')>=0){
      // Remove id from patch body to avoid conflicts
      var patchBody=Object.assign({},body);
      delete patchBody[idCol];
      var r2=await supaReq('PATCH', table+'?'+idCol+'=eq.'+encodeURIComponent(idVal), patchBody);
      if(r2.ok) return true;
      var txt2=await r2.text();
      console.warn('_supaUpsert PATCH '+table+':', r2.status, txt2);
      return false;
    }
    console.warn('_supaUpsert '+table+' error:', r.status, txt);
    return false;
  }catch(e){console.warn('_supaUpsert '+table+':', e); return false;}
}

async function syncSaveCliente(c){
  var body={id:c.id, nombre:c.nombre, telefono:c.tel||'',
    almacen:c.alm||'', color:c.color||'info',
    notas:c.notas||'', owner:c.owner||'Admin', activo:true};
  if(!_supaOnline||typeof supaReq==='undefined'){
    enqueue({method:'POST',path:'clientes?on_conflict=id',body:body});
    return;
  }
  await _supaUpsert('clientes','id',c.id,body);
}

async function syncSaveFolio(cliId, f){
  var body={id:f.id, cliente_id:cliId, fecha:f.fecha,
    almacen:f.alm||'', descripcion:f.desc||'', lineas:f.lineas||[]};
  if(f.mon) body.moneda=f.mon;
  if(!_supaOnline||typeof supaReq==='undefined'){
    enqueue({method:'POST',path:'folios?on_conflict=id',body:body});
    return;
  }
  await _supaUpsert('folios','id',f.id,body);
  // Recalculate reservations (debounced)
  _dRecalcReservas();
}

// ── Auto-RESERVADO: recalcula qty reservada desde folios ──
var _recalcTimer=null;
function _dRecalcReservas(){ clearTimeout(_recalcTimer); _recalcTimer=setTimeout(_recalcReservas, 2000); }

async function _recalcReservas(){
  if(typeof CLIENTES==='undefined'||typeof PRODS==='undefined') return;
  // 1. Sum all quantities per product name across ALL client folios
  var reservasPorProd = {};
  CLIENTES.forEach(function(cli){
    (cli.folios||[]).forEach(function(f){
      (f.lineas||[]).forEach(function(l){
        if(!l.prod) return;
        if(!reservasPorProd[l.prod]) reservasPorProd[l.prod] = 0;
        reservasPorProd[l.prod] += (l.q||0);
      });
    });
  });

  // 2. For each product in transit, update qty_reservada and badge_texto
  var updates = [];
  PRODS.forEach(function(p){
    var isTransit = p.enTransito && (p.enTransito.Habana || p.enTransito.Placetas || p.enTransito.Xportprise);
    if(!isTransit) return;

    var oldQtyRes = p.qty_reservada || 0;
    var oldBadge = p.badgeTexto || '';
    var newQtyRes = reservasPorProd[p.n] || 0;
    var totalStock = p.stk || 0;
    var newBadge = oldBadge;
    
    if (totalStock <= 0 && newQtyRes > 0) {
      // Si el stock restante es 0 y hay ventas, se agotó todo el contenedor -> Auto-Reservado
      newBadge = 'RESERVADO';
    } else if (totalStock > 0) {
      // Si queda stock disponible, NO está reservado al 100% -> Auto-Limpiar
      newBadge = '';
    }

    // Only sync if something changed
    if(newQtyRes !== oldQtyRes || newBadge !== oldBadge){
      p.qty_reservada = newQtyRes;
      p.badgeTexto = newBadge;
      if(!newBadge) p.reservado = false;
      else p.reservado = true;
      updates.push(p);
    }
  });

  // 3. Sync changed products to Supabase
  if(!updates.length) return;
  console.log('[Reservas] Actualizando '+updates.length+' productos');
  for(var i=0; i<updates.length; i++){
    var p = updates[i];
    var patchBody = {
      qty_reservada: p.qty_reservada,
      badge_texto: p.badgeTexto || null
    };
    if(p.supaId){
      await supaReq('PATCH','productos?id=eq.'+p.supaId, patchBody);
    } else {
      await supaReq('PATCH','productos?nombre=eq.'+encodeURIComponent(p.n), patchBody);
    }
  }
  console.log('[Reservas] ✓ Sincronizado');
}

async function syncSaveAbono(cliId, folioId, ab){
  var body={id:ab.id, folio_id:folioId, cliente_id:cliId,
    fecha:ab.fecha, concepto:ab.concepto||'',
    descripcion:ab.desc||'', monto:parseFloat((ab.monto||0).toFixed(4)),
    moneda:ab.mon||'USD', equiv_usd:parseFloat((ab.equivUSD||0).toFixed(4)),
    en_caja:ab.enCaja||false, caja:ab.caja||'', caja_tipo:ab.cajaTipo||''};
  if(!_supaOnline||typeof supaReq==='undefined'){
    enqueue({method:'POST',path:'abonos?on_conflict=id',body:body});
    return;
  }
  await _supaUpsert('abonos','id',ab.id,body);
}

async function syncLoadClientes(){
  if(!_supaOnline||typeof supaReq==='undefined') return;
  try{
    var rc = await supaReq('GET','clientes?select=*&order=nombre.asc');
    if(!rc.ok) return;
    var clis = await rc.json();
    if(!clis||!clis.length) return;

    var rf = await supaReq('GET','folios?select=*&order=fecha.asc');
    var foliosRows = rf.ok ? (await rf.json()||[]) : [];

    var ra = await supaReq('GET','abonos?select=*&order=fecha.asc');
    var abonosRows = ra.ok ? (await ra.json()||[]) : [];

    CLIENTES.length = 0;
    clis.forEach(function(row){
      var folios = foliosRows.filter(function(f){return f.cliente_id===row.id;}).map(function(f){
        var lineas = Array.isArray(f.lineas) ? f.lineas : (typeof f.lineas==='string' ? (function(){try{return JSON.parse(f.lineas);}catch(e){return [];}}()) : []);
        var abonos = abonosRows.filter(function(a){return a.folio_id===f.id;}).map(function(a){
          return {id:a.id,fecha:a.fecha,concepto:a.concepto,desc:a.descripcion,
            monto:parseFloat(a.monto||0),mon:a.moneda,equivUSD:parseFloat(a.equiv_usd||0),
            enCaja:a.en_caja,caja:a.caja,cajaTipo:a.caja_tipo};
        });
        return {id:f.id,fecha:f.fecha,alm:f.almacen,mon:f.moneda,
          desc:f.descripcion,lineas:lineas,abonos:abonos};
      });
      CLIENTES.push({
        id:row.id, nombre:row.nombre, tel:row.telefono||'',
        alm:row.almacen||'', color:row.color||'info',
        notas:row.notas||'', owner:row.owner||'Admin',
        folios:folios
      });
    });

    // Update ID counters
    nextCid = CLIENTES.reduce(function(a,c){var n=parseInt((c.id||'c0').replace('c',''));return isNaN(n)?a:Math.max(a,n);},0)+1;
    nextFid = CLIENTES.reduce(function(a,c){return (c.folios||[]).reduce(function(b,f){var n=parseInt(f.id||'0');return isNaN(n)?b:Math.max(b,n);},a);},0)+1;
    nextAid = CLIENTES.reduce(function(a,c){return (c.folios||[]).reduce(function(b,f){return (f.abonos||[]).reduce(function(d,ab){var n=parseInt((ab.id||'a0').replace('a',''));return isNaN(n)?d:Math.max(d,n);},b);},a);},0)+1;

    offlineSaveClientes();
    if(typeof renderLista==='function') try{renderLista();}catch(e){}
    console.log('Clientes loaded from Supabase:', CLIENTES.length);
  }catch(e){console.warn('syncLoadClientes:',e);}
}

async function syncPushAllClientes(){
  if(!_supaOnline||typeof supaReq==='undefined') return;
  for(var c of CLIENTES){
    await syncSaveCliente(c);
    for(var f of (c.folios||[])){
      await syncSaveFolio(c.id, f);
      for(var ab of (f.abonos||[])){
        await syncSaveAbono(c.id, f.id, ab);
      }
    }
  }
  showToast('✓ Clientes sincronizados con Supabase');
}

// ── PRESTAMOS / DEUDAS SYNC ────────────────────────────────────
async function syncLoadContenedores() {
  if (!_supaOnline || typeof supaReq !== 'function') return false;
  try {
    var r = await supaReq('GET', 'contenedores?select=*&order=created_at.desc');
    if (!r.ok) return false;
    var data = await r.json();
    if (!Array.isArray(data)) return false;

    if (data.length === 0 && CONTENEDORES && CONTENEDORES.length > 0) {
      for (var _cnt of CONTENEDORES) {
        await supaReq('POST', 'contenedores?on_conflict=id', _cntToRow(_cnt));
      }
      r = await supaReq('GET', 'contenedores?select=*&order=created_at.desc');
      if (!r.ok) return false;
      data = await r.json();
    }

    CONTENEDORES = data.map(function(row) { return _rowToCnt(row); });
    try { localStorage.setItem('erp_contenedores', JSON.stringify(CONTENEDORES)); } catch(e) {}
    if (typeof renderContenedores === 'function') try { renderContenedores(); } catch(e) {}
    return true;
  } catch(e) { console.warn('syncLoadContenedores:', e); return false; }
}

function _cntToRow(c) {
  return {
    id: c.id, ref: c.ref, estado: c.estado||'preparando', proveedor: c.proveedor||'',
    transitario: c.transitario||'', almacen_destino: c.almacen_destino||'', moneda: c.moneda||'USD',
    fecha_booking: c.fecha_booking||null, fecha_salida: c.fecha_salida||null,
    fecha_eta: c.fecha_eta||null, fecha_llegada: c.fecha_llegada||null, notas: c.notas||'',
    gastos: c.gastos||[], audit_log: c.audit_log||[]
  };
}
function _rowToCnt(r) {
  return {
    id: r.id, ref: r.ref, estado: r.estado||'preparando', proveedor: r.proveedor||'',
    transitario: r.transitario||'', almacen_destino: r.almacen_destino||'', moneda: r.moneda||'USD',
    fecha_booking: r.fecha_booking||'', fecha_salida: r.fecha_salida||'',
    fecha_eta: r.fecha_eta||'', fecha_llegada: r.fecha_llegada||'', notas: r.notas||'',
    gastos: r.gastos||[], audit_log: r.audit_log||[]
  };
}

async function _syncSaveContenedor(c) {
  if (typeof supaReq !== 'function' || !_supaOnline) return;
  try {
    var r = await supaReq('POST', 'contenedores?on_conflict=id', _cntToRow(c));
    if (!r.ok) console.warn('[CONTENEDORES] Error saving to Supabase:', r.status);
  } catch(e) { console.warn('_syncSaveContenedor:', e); }
}

async function _syncDeleteContenedor(id) {
  if (typeof supaReq !== 'function' || !_supaOnline) return;
  try {
    await supaReq('DELETE', 'contenedores?id=eq.' + encodeURIComponent(id));
  } catch(e) { console.warn('_syncDeleteContenedor:', e); }
}

// ── PRESTAMOS / DEUDAS SYNC ────────────────────────────────────
async function syncLoadPrestamos() {
  if (!_supaOnline || typeof supaReq !== 'function') return false;
  try {
    var r = await supaReq('GET', 'prestamos?select=*&order=fecha_inicio.desc');
    if (!r.ok) return false;
    var data = await r.json();
    if (!Array.isArray(data)) return false;

    // Migración automática: si la nube está vacía pero hay datos locales, los subimos
    if (data.length === 0 && PRESTAMOS && PRESTAMOS.length > 0) {
      console.log('[PRESTAMOS] Migrando datos locales a Supabase:', PRESTAMOS.length);
      for (var _pm of PRESTAMOS) {
        await supaReq('POST', 'prestamos?on_conflict=id', _prestamoToRow(_pm));
      }
      // Releer desde la nube
      r = await supaReq('GET', 'prestamos?select=*&order=fecha_inicio.desc');
      if (!r.ok) return false;
      data = await r.json();
      if (!Array.isArray(data)) return false;
    }

    PRESTAMOS = data.map(function(row) { return _rowToPrestamo(row); });
    try { localStorage.setItem('erp_prestamos', JSON.stringify(PRESTAMOS)); } catch(e) {}
    if (typeof renderPrestamos === 'function') try { renderPrestamos(); } catch(e) {}
    console.log('[PRESTAMOS] Cargados desde Supabase:', PRESTAMOS.length);
    return true;
  } catch(e) { console.warn('syncLoadPrestamos:', e); return false; }
}

function _prestamoToRow(p) {
  return {
    id: p.id,
    nombre: p.nombre,
    // 'tipo' en Supabase = tipo interno del préstamo (interes_simple, frances, simple, revolving...)
    tipo: p.tipoInteres || p.tipo || 'interes_simple',
    // 'tasa' en Supabase = el interés anual
    tasa: p.interes != null ? p.interes : (p.tasa != null ? p.tasa : 0),
    plazo: p.plazo != null ? p.plazo : 0,
    capital: p.capital != null ? p.capital : 0,
    moneda: p.moneda || 'USD',
    fecha_inicio: p.fechaInicio || null,
    cta: p.cta || '',
    notas: p.notas || '',
    // Columnas extra que añadimos nosotros
    direccion: p.direccion || '',
    interes: p.interes != null ? p.interes : 0,
    tipo_interes: p.tipoInteres || p.tipo || 'interes_simple',
    frecuencia: p.frecuencia || '',
    vencimiento: p.vencimiento || '',
    cuota_fija: p.cuotaFija != null ? p.cuotaFija : 0,
    pagos: JSON.stringify(p.pagos || []),
    cuotas: JSON.stringify(p.cuotas || []),
    audit_log: JSON.stringify(p.auditLog || [])
  };
}

function _rowToPrestamo(row) {
  var _j = function(v) { try { return typeof v === 'string' ? JSON.parse(v) : (v || []); } catch(e) { return []; } };
  // 'tasa' o 'interes' según qué columna tenga valor
  var interes = row.interes != null ? parseFloat(row.interes) : (row.tasa != null ? parseFloat(row.tasa) : 0);
  var tipo = row.tipo_interes || row.tipo || 'simple';
  return {
    id: row.id,
    nombre: row.nombre,
    direccion: row.direccion || '',
    capital: row.capital != null ? parseFloat(row.capital) : 0,
    interes: interes,
    tasa: row.tasa != null ? parseFloat(row.tasa) : interes,
    tipoInteres: tipo,
    tipo: tipo,
    plazo: row.plazo != null ? parseInt(row.plazo) : 0,
    frecuencia: row.frecuencia || '',
    moneda: row.moneda || 'USD',
    fechaInicio: row.fecha_inicio || '',
    vencimiento: row.vencimiento || '',
    notas: row.notas || '',
    cta: row.cta || '',
    cuotaFija: row.cuota_fija != null ? parseFloat(row.cuota_fija) : 0,
    pagos: _j(row.pagos),
    cuotas: _j(row.cuotas),
    auditLog: _j(row.audit_log)
  };
}

async function _syncSavePrestamo(p) {
  if (typeof supaReq !== 'function' || !_supaOnline) return;
  try {
    var r = await supaReq('POST', 'prestamos?on_conflict=id', _prestamoToRow(p));
    if (!r.ok) console.warn('[PRESTAMOS] Error saving to Supabase:', r.status);
  } catch(e) { console.warn('_syncSavePrestamo:', e); }
}

async function _syncDeletePrestamo(id) {
  if (typeof supaReq !== 'function' || !_supaOnline) return;
  try {
    await supaReq('DELETE', 'prestamos?id=eq.' + encodeURIComponent(id));
  } catch(e) { console.warn('_syncDeletePrestamo:', e); }
}


const MONEDAS=['USD','EUR','CUP','CUPT'];
const PRODS=[
  {n:"Chapa galv. 2000x1000x0,8",min:24,maj:23,stk:120},{n:"Chapa galv. 2000x1000x1",min:33,maj:31,stk:85},
  {n:"CHAPA 1500x3000x3,75",min:160,maj:165,stk:20},{n:"Chapa Z30 2500x1250x1",min:null,maj:45,stk:60},
  {n:"Cuadrado S275JR 12",min:16,maj:14,stk:210},{n:"Cuadrado S275JR 14",min:null,maj:20,stk:95},
  {n:"Cuadrado S275JR 16",min:22,maj:20,stk:340},{n:"ANG. 30x30x3x6000",min:12,maj:11,stk:150},
  {n:"ANG. 40x40x3x6000",min:null,maj:16,stk:80},{n:"ANG. 40x40x4x6000",min:null,maj:19,stk:45},
  {n:"Perfil Angular 25x25x3",min:17,maj:15,stk:190},{n:"Perfil Angular 30x30x3",min:17,maj:16,stk:165},
  {n:"Perfil Angular 40x40x4",min:25,maj:23,stk:130},{n:"Redondo S275JR 12",min:11,maj:6.64,stk:280},
  {n:"Redondo S275JR 16",min:16,maj:15,stk:95},{n:"T. CUA 40x1.5x6000",min:null,maj:21,stk:88},
  {n:"T. CUA 40x2.0x5800",min:21,maj:22,stk:74},{n:"T. RECT. 50x30x2.0",min:21,maj:22,stk:55},
  {n:"Varillas E6013 3.2x350mm",min:9.2,maj:8,stk:500},{n:"Silicona Neutra (Blanca)",min:null,maj:1.7,stk:320},
  {n:"Silicona Neutra (Transp.)",min:null,maj:1.7,stk:280},
];
function _loadReservas(){try{return JSON.parse(localStorage.getItem('erp_reservas')||'[]');}catch(e){return[];}}
function _saveReservas(){try{localStorage.setItem('erp_reservas',JSON.stringify(S.reservas));}catch(e){}}
// ── CONTENEDORES ──────────────────────────────────────────────
var CONTENEDORES=[];
(function(){
  try{var _c=JSON.parse(localStorage.getItem('erp_contenedores')||'[]');if(Array.isArray(_c))CONTENEDORES=_c;}catch(e){}
})();
function _saveContenedores(){try{localStorage.setItem('erp_contenedores',JSON.stringify(CONTENEDORES));}catch(e){}}
function _cntLabel(ref){
  if(!ref)return'';
  var c=CONTENEDORES.find(function(x){return (x.lote&&x.lote===ref)||x.ref===ref||x.id===ref;});
  if(!c)return ref;
  var lbl=c.lote||c.ref||ref;
  return lbl+(c.ref&&c.lote&&c.ref!==c.lote?' ('+c.ref+')':'');
}
function _cntBadge(ref){
  if(!ref)return'';
  var c=CONTENEDORES.find(function(x){return (x.lote&&x.lote===ref)||x.ref===ref||x.id===ref;});
  var col='var(--color-text-secondary)';
  var ic='📦';
  if(c){
    if(c.estado==='recibido'||c.estado==='cerrado'){col='var(--color-text-success)';ic='✅';}
    else if(c.estado==='retrasado'){col='var(--color-text-danger)';ic='⚠️';}
    else if(c.estado==='en_transito'||c.estado==='en_aduana'||c.estado==='en_puerto'){col='var(--color-text-info)';ic='🚢';}
    else if(c.estado==='preparando'||c.estado==='reservado'){col='var(--color-text-warning)';ic='📦';}
  }
  var lbl=c?(c.lote||c.ref||ref):ref;
  return '<span style="font-size:10px;color:'+col+';white-space:nowrap">'+ic+' Lote: '+lbl+'</span>';
}
let S={user:'',alm:'',tipo:'Minorista',cli:'',cart:[],pagos:[],vueltos:[],cartMon:'USD',reservas:_loadReservas()};
// Restore session state if page was reloaded
(function(){
  try{
    var _ss=JSON.parse(sessionStorage.getItem('erp_S')||'{}');
    if(_ss&&_ss.user&&_ss.alm){
      S.user=_ss.user; S.alm=_ss.alm; S.tipo=_ss.tipo||'Minorista';
      S.cli=_ss.cli||''; S.cart=_ss.cart||[]; S.cartMon=_ss.cartMon||'USD';
      S.step=_ss.step||0;
    }
  }catch(e){}
})();
let pinBuf='',pendingUser='';

function rUp(n,m){return m==='CUP'||m==='CUPT'?Math.ceil(n):parseFloat(n.toFixed(2));}

const STEPS=['Sesión','Almacén','Productos','Cobro'];
const PAGES=['pg-login','pg-alm','pg-prod','pg-pago'];
function _saveSession(){
  try{sessionStorage.setItem('erp_S',JSON.stringify({
    user:S.user,alm:S.alm,tipo:S.tipo,cli:S.cli,
    cart:S.cart,cartMon:S.cartMon,step:S.step||0
  }));}catch(e){}
}
function renderSteps(active){
  S.step=active; _saveSession();
  document.getElementById('step-bar').innerHTML=STEPS.map((s,i)=>{
    const done=i<active,act=i===active;
    return `${i>0?'<span class="chevron">›</span>':''}
    <div class="step ${done?'done':act?'active':''}" ${done&&i>0?`onclick="goStep('${PAGES[i]}',${i})"`:''}><div class="step-num">${done?'✓':i+1}</div><span>${s}</span></div>`;
  }).join('');
  const chip=document.getElementById('user-chip');
  if(S.user&&active>0){chip.style.display='flex';document.getElementById('chip-name').textContent=S.user;document.getElementById('chip-dot').style.background=USERS[S.user]?.tc||'gray';}
  else chip.style.display='none';
  var _rn=S.reservas.filter(r=>r.activa).length;
  var _rd=active>=2&&_rn>0?'inline':'none';
  document.getElementById('res-btn').style.display=_rd;
  var _rbt=document.getElementById('res-btn-top');if(_rbt)_rbt.style.display=_rd;
  var _rnt=document.getElementById('res-n-top');if(_rnt)_rnt.textContent=_rn;
  var _rb=document.getElementById('res-banner');if(_rb)_rb.style.display=_rn>0?'flex':'none';
  var _rbn=document.getElementById('res-banner-n');if(_rbn)_rbn.textContent=_rn+' reserva'+(_rn===1?'':'s');
}
function goStep(pg,idx){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('act'));
  document.getElementById(pg).classList.add('act');
  renderSteps(idx);
  if(pg==='pg-alm'){_poblarClientesPOS();}
  if(pg==='pg-prod'){renderProds();renderCart();renderCartCtx();}
  if(pg==='pg-pago')initPago();
  updResBadge();
  document.getElementById('sidebar').classList.remove('mob-open');
  var _gtb2=document.getElementById('topbar');if(_gtb2)_gtb2.style.display='none';
}
function selUser(u,el){
  pendingUser=u;pinBuf='';
  document.querySelectorAll('.user-card').forEach(c=>c.classList.remove('sel'));el.classList.add('sel');
  updPinDots();document.getElementById('pin-error').textContent='';
  document.getElementById('pin-wrap').style.display='block';
}
function updPinDots(){document.querySelectorAll('.pin-dot').forEach((d,i)=>d.classList.toggle('filled',i<pinBuf.length));}
function pinKey(k){
  const err=document.getElementById('pin-error');
  if(k==='cancel'){pinBuf='';document.getElementById('pin-wrap').style.display='none';document.querySelectorAll('.user-card').forEach(c=>c.classList.remove('sel'));pendingUser='';updPinDots();return;}
  if(k==='back'){pinBuf=pinBuf.slice(0,-1);updPinDots();err.textContent='';return;}
  if(pinBuf.length>=4)return;
  pinBuf+=k;updPinDots();
  if(pinBuf.length===4){
    if(USERS[pendingUser]&&pinBuf===USERS[pendingUser].pin){
      S.user=pendingUser;S.alm='';S.cart=[];
      pinBuf='';pendingUser='';updPinDots();
      document.getElementById('pin-wrap').style.display='none';
      document.querySelectorAll('.user-card').forEach(function(c){c.classList.remove('sel');});
      goStep('pg-alm',1);
    } else {err.textContent='PIN incorrecto';pinBuf='';pendingUser='';updPinDots();
      setTimeout(function(){document.querySelectorAll('.user-card').forEach(function(c){c.classList.remove('sel');});document.getElementById('pin-wrap').style.display='none';err.textContent='';},1500);}
  }
}
function logout(){
  try{sessionStorage.removeItem('erp_S');}catch(e){}
  S.user='';S.alm='';S.cart=[];S.reservas=[];pinBuf='';pendingUser='';
  try{localStorage.setItem('erp_reservas','[]');}catch(e){}
  document.getElementById('pin-wrap').style.display='none';
  document.querySelectorAll('.user-card').forEach(function(c){c.classList.remove('sel');});
  updPinDots();
  // Switch to mod-pos first so .page elements are visible
  document.querySelectorAll('.module').forEach(function(m){m.classList.remove('act');});
  var mp=document.getElementById('mod-pos');if(mp)mp.classList.add('act');
  document.querySelectorAll('.sb-item').forEach(function(b){b.classList.remove('act');});
  document.getElementById('tb-title').textContent='POS';
  goStep('pg-login',0);
  if(typeof buildSidebar==='function'){
    var nav=document.getElementById('sb-nav');
    if(nav)nav.innerHTML='<div style="padding:20px;text-align:center;color:var(--color-text-tertiary);font-size:12px">Inicia sesión</div>';
  }
}
function selAlm(a,el){S.alm=a;document.querySelectorAll('.alm-card').forEach(c=>c.classList.remove('sel'));el.classList.add('sel');}
function _poblarClientesPOS(){
  var sel=document.getElementById('s-cli');
  if(!sel)return;
  var isAdm=typeof S!=='undefined'&&S.user&&USERS[S.user]&&USERS[S.user].rol==='admin';
  var visClis=isAdm?CLIENTES:CLIENTES.filter(function(c){return !c.owner||c.owner===S.user;});
  sel.innerHTML='<option value="">Walk-in</option>'
    +visClis.map(function(c){return '<option value="'+c.id+'">'+c.nombre+'</option>';}).join('');
}
function goProductos(){
  if(!S.alm){alert('Elige un almacén');return;}
  var _cliSel=document.getElementById('s-cli');
  var _cliId=_cliSel?_cliSel.value:'';
  if(_cliId){var _c=CLIENTES.find(function(c){return c.id===_cliId;});S.cli=_c?_c.nombre:'Walk-in';S.cliId=_cliId;}
  else{S.cli='Walk-in';S.cliId=null;}
  S.cart=[];S.tipo='Minorista';S.cartMon='USD';
  document.getElementById('tb-min').classList.add('act');document.getElementById('tb-may').classList.remove('act');if(document.getElementById('tb-pre'))document.getElementById('tb-pre').classList.remove('act');
  document.querySelectorAll('.mt-btn').forEach((b,i)=>b.classList.toggle('act',i===0));
  goStep('pg-prod',2);
}
function selTipo(t,btn){
  S.tipo=t;
  document.querySelectorAll('.tg-btn').forEach(b=>b.classList.remove('act'));btn.classList.add('act');
  renderProds();
}
function setCartMon(m,btn){
  S.cartMon=m;
  document.querySelectorAll('.mt-btn').forEach(b=>b.classList.remove('act'));btn.classList.add('act');
  renderCart();
}
function getPorEscala(p, q){
  var isPlac = S.alm==='Placetas';
  var min = (isPlac && p.min_placetas!=null) ? p.min_placetas : (p.min??p.maj??0);
  var maj = (isPlac && p.maj_placetas!=null) ? p.maj_placetas : (p.maj??p.min??0);
  if(p.escala && p.escala.length && q > 0){
    var sorted = p.escala.slice().sort(function(a,b){return b.desde-a.desde;});
    for(var i=0;i<sorted.length;i++){
      var r=sorted[i];
      if(q >= r.desde && (r.hasta==null || r.hasta==='' || q <= r.hasta)){
        return parseFloat(r.precio)||maj||min;
      }
    }
    // No range matched — use first range as fallback
    return parseFloat(p.escala[0].precio)||maj||min;
  }
  if(S.tipo==='Preventa'){
    if (p.preventa_min != null) return parseFloat(p.preventa_min);
    if (RATES.DTO_PREVENTA > 0) return Number((min * (1 - RATES.DTO_PREVENTA/100)).toFixed(4));
    return min||maj;
  }
  if(S.tipo==='Minorista') return min||maj;
  return maj||min;
}
function getP(p){ return getPorEscala(p, 1); }
function stkDisp(p){
  // Block stock reserved by ANY user globally
  var allRes = typeof RESERVAS_GLOBAL !== 'undefined' ? RESERVAS_GLOBAL : S.reservas;
  const res=allRes.filter(r=>r.activa).reduce((a,r)=>{const l=r.lineas.find(l=>l.n===p.n);return a+(l?l.q:0);},0);
  const base=S.alm&&p.stk_alm&&p.stk_alm[S.alm]!=null?p.stk_alm[S.alm]:(p.stk||0);
  return base-res;
}
function renderProds(){
  const q=(document.getElementById('srch')?.value||'').toLowerCase();
  const catF=(document.getElementById('cat-filter')?.value||'');
  const g=document.getElementById('pgrid');if(!g)return;
  const m=S.cartMon;
  const cats=[''].concat([...new Set(PRODS.filter(p=>p.activo!==false&&p.cat).map(p=>p.cat))].sort());
  const cpanel=document.getElementById('cat-pills');
  if(cpanel)cpanel.innerHTML=cats.map(c=>`<button class="cat-pill${catF===c?' act':''}" onclick="setCatFilter('${c}')">${c||'Todos'}</button>`).join('');
  g.innerHTML=PRODS.filter(p=>{
    if(p.activo===false)return false;
    if(!p.n.toLowerCase().includes(q))return false;
    if(catF&&p.cat!==catF)return false;
    return true;
  }).map(p=>{
    const pr=getP(p)||(p.escala&&p.escala.length?p.escala[0].precio:0);if(pr==null||pr==='')return'';
    const stk=stkDisp(p);const ns=stk<=0;
    const alt=m!=='USD'?`<div class="pbt">${fN(fromUSD(pr,m,S.alm),dFor(m))} ${m}</div>`:'';
    var _bH=p.reservado?'<div class="badge-reservado" style="margin:0 0 4px;font-size:9px;padding:1px 6px">🔒 RESERVADO</div>':(p.oferta&&p.badgeTexto?`<div class="badge-oferta" style="margin:0 0 4px;font-size:9px;padding:1px 6px">${p.badgeTexto}</div>`:'');
    var _ofePr=p.oferta?(S.alm==='Placetas'?(p.precioOfertaPlacetas||p.precioOfertaHabana||null):(p.precioOfertaHabana||null)):null;
    var _priceHtml=_ofePr!=null?`<span style="color:#ef4444;font-weight:700">${fN(_ofePr)}</span> <span style="text-decoration:line-through;color:var(--color-text-tertiary);font-size:10px">${fN(pr)}</span> USD`:fN(pr)+' USD';
    return `<button class="pb${ns?' no-stk':''}" ${ns?'':`onclick="addCart(this.getAttribute('data-n'))" data-n="${p.n.replace(/"/g,'&quot;').replace(/'/g,'&#39;')}"`}>
      ${_bH}<div class="pbn">${p.n}</div><div class="pbp">${_priceHtml}</div>${alt}
      <div class="pbs">${ns?'Sin stock':'Stk:'+stk}</div>
    </button>`;
  }).join('');
}
function setCatFilter(cat){const el=document.getElementById('cat-filter');if(el)el.value=cat;renderProds();}
// Helper: precio efectivo respetando oferta > escala > min/maj
function _getCartPriceUSD(p, q){
  if(p.oferta){
    var ofePr=S.alm==='Placetas'?(p.precioOfertaPlacetas||p.precioOfertaHabana||null):(p.precioOfertaHabana||null);
    if(ofePr!=null) return ofePr;
  }
  return getPorEscala(p, q);
}
function addCart(n){
  const p=PRODS.find(x=>x.n===n);if(!p)return;
  const stk=stkDisp(p);
  const ex=S.cart.find(c=>c.n===n&&c.tipo===S.tipo);
  const newQty = ex ? ex.q+1 : 1;
  // Use escala price for new quantity, fallback to escala[0] if maj/min=0
  var precioUSD = _getCartPriceUSD(p, newQty);
  if(!precioUSD && p.escala && p.escala.length) precioUSD = parseFloat(p.escala[0].precio)||0;
  if(ex){if(ex.q>=stk)return;ex.q++;ex.precioUSD=precioUSD;}
  else S.cart.push({n,q:1,precioUSD,tipo:S.tipo,modified:false});
  renderCart();
}
function setQtyDirect(i,val){
  const p=PRODS.find(x=>x.n===S.cart[i].n);
  const stk=stkDisp(p||{stk:9999});
  const v=parseInt(val);if(isNaN(v)||v<1)return;
  S.cart[i].q=Math.min(stk,Math.max(1,v));
  renderCartTotalsOnly();
}
function commitQty(i,val){
  const p=PRODS.find(x=>x.n===S.cart[i].n);
  const stk=stkDisp(p||{stk:9999});
  const q=Math.min(stk,Math.max(1,parseInt(val)||1));
  S.cart[i].q=q;
  if(!S.cart[i].modified && p) S.cart[i].precioUSD=_getCartPriceUSD(p,q);
  renderCart();
}
function chQty(i,d){
  const p=PRODS.find(x=>x.n===S.cart[i].n);
  const stk=stkDisp(p||{stk:9999});
  const q=Math.max(0,Math.min(stk,S.cart[i].q+d));
  if(q===0){S.cart.splice(i,1);}else{
    S.cart[i].q=q;
    if(!S.cart[i].modified && p) S.cart[i].precioUSD=_getCartPriceUSD(p,q);
  }
  renderCart();
}
function editPriceMon(i,v,mon){
  S.cart[i].precioUSD=toUSD(parseFloat(v)||S.cart[i].precioUSD,mon);
  S.cart[i].modified=true;
  renderCart();
}
function renderCartCtx(){
  const el=document.getElementById('cart-ctx');if(!el)return;
  const u=USERS[S.user];
  el.innerHTML=`<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:100px;background:${u?.color};color:${u?.tc};font-size:11px">${S.user}</span>
    <span class="badge bb">${S.alm}</span>
    <span style="font-size:11px;color:var(--color-text-tertiary)">${S.cli||'Walk-in'}</span>`;
}
function renderCartTotalsOnly(){
  const m=S.cartMon;
  const totUSD=S.cart.reduce((a,c)=>a+c.precioUSD*c.q,0);
  const elM=document.getElementById('cart-tot-main');if(elM)elM.textContent=fN(fromUSD(totUSD,m,S.alm),dFor(m))+' '+m;
  const elA=document.getElementById('cart-tot-alts');
  if(elA)elA.innerHTML=MONEDAS.filter(x=>x!==m).map(x=>`<span class="total-alt">${fN(fromUSD(totUSD,x,S.alm),dFor(x))} ${x}</span>`).join('');
}
function renderCart(){
  const el=document.getElementById('cart-list');if(!el)return;
  const m=S.cartMon;
  if(!S.cart.length){
    el.innerHTML='<div style="color:var(--color-text-tertiary);font-size:12px;padding:12px 0;text-align:center">Toca un producto para añadir</div>';
    document.getElementById('cart-tot-main').textContent='0.00 '+m;
    document.getElementById('cart-tot-alts').innerHTML='';return;
  }
  let totUSD=0;
  el.innerHTML=S.cart.map((c,i)=>{
    const subUSD=c.precioUSD*c.q;totUSD+=subUSD;
    const subMon=fromUSD(subUSD,m,S.alm);
    const precMon=fromUSD(c.precioUSD,m,S.alm);
    const altMon=m==='USD'?'CUP':'USD';
    const altVal=m==='USD'?fromUSD(subUSD,'CUP',S.alm):subUSD;
    const stk=stkDisp(PRODS.find(x=>x.n===c.n)||{stk:9999});
    const tipoCls=c.tipo==='Mayorista'?'ba':'bb';
    return `<div class="cart-item">

      <!-- col 1: nombre + precio unit. editable + badges -->
      <div class="ci-left">
        <div class="ci-name">${c.n}</div>
        <div class="ci-pu-row">
          <span class="ci-pu-lbl">P.u.</span>
          <input type="number" class="ci-pu"
            value="${precMon.toFixed(dFor(m))}"
            step="${m==='CUP'||m==='CUPT'?'1':'0.01'}"
            onchange="editPriceMon(${i},this.value,'${m}')"
            onfocus="this.select()" title="Precio unitario — editable">
          <span class="ci-pu-lbl">${m}</span>
        </div>
        <div class="ci-badges">
          <span class="badge ${tipoCls}">${c.tipo==='Mayorista'?'May':'Min'}</span>
          ${c.modified?`<span class="badge" style="background:var(--color-background-danger);color:var(--color-text-danger)">mod</span>`:''}
          <span style="font-size:9px;color:var(--color-text-tertiary)">stk:${stk}</span>
        </div>
      </div>

      <!-- col 2: qty controls centrados -->
      <div class="qty-wrap">
        <button class="qb" onclick="chQty(${i},-1)">−</button>
        <input type="number" class="qty-n"
          value="${c.q}" min="1" max="${stk}"
          oninput="setQtyDirect(${i},this.value)"
          onblur="commitQty(${i},this.value)"
          onkeydown="if(event.key==='Enter'){commitQty(${i},this.value);this.blur();}"
          onfocus="this.select()">
        <button class="qb" onclick="chQty(${i},1)">+</button>
      </div>

      <!-- col 3: subtotal alineado derecha, siempre visible -->
      <div class="ci-sub">
        <div class="ci-sub-main">${fN(subMon,dFor(m))} ${m}</div>
        <div class="ci-sub-alt">${fN(altVal,dFor(altMon))} ${altMon}</div>
      </div>

    </div>`;
  }).join('');
  document.getElementById('cart-tot-main').textContent=fN(fromUSD(totUSD,m,S.alm),dFor(m))+' '+m;
  document.getElementById('cart-tot-alts').innerHTML=MONEDAS.filter(x=>x!==m)
    .map(x=>`<span class="total-alt">${fN(fromUSD(totUSD,x,S.alm),dFor(x))} ${x}</span>`).join('');
}

function ventaCreditoPOS() {
  if(!S.cart.length){alert('Añade productos al carrito primero.');return;}
  if(!S.cli || S.cli==='Walk-in'){alert('⚠️ Selecciona un cliente válido arriba a la izquierda para poder darle crédito.\n\n(No puedes dar crédito a "Walk-in")');return;}
  var c = CLIENTES.find(x => x.nombre === S.cli);
  if(!c){alert('Cliente no encontrado en la base de datos. Por favor, selecciona un cliente registrado.');return;}
  
  var desc = prompt("Descripción del pedido a crédito (Opcional):", "Venta desde POS");
  if(desc===null) return; // cancelado
  var iniStr = prompt("Abono inicial pagado ahora en USD (Opcional, 0 por defecto):", "0");
  if(iniStr===null) return;
  var ini = parseFloat(iniStr)||0;
  
  var lineas = S.cart.map(c => ({prod: c.n, q: c.q, precio: c.precioUSD, mon: 'USD'}));
  var alm = S.alm;
  var mon = 'USD';
  var fecha = today();
  var abonos = ini>0?[{id:'a'+(nextAid++),fecha:fecha,concepto:'efectivo',desc:'Abono inicial',monto:ini,mon:'USD',tasa:null,equivUSD:ini,enCaja:false,caja:null,cajaTipo:null}]:[];
  var fid = String(nextFid++);
  
  // stock check
  var stockError = null;
  lineas.forEach(function(l){
    var p=PRODS.find(function(x){return x.n===l.prod;});
    if(!p){stockError='Producto no encontrado: '+l.prod;return;}
    var disponible=(p.stk_alm&&p.stk_alm[alm]!=null)?p.stk_alm[alm]:(p.stk||0);
    if(l.q>disponible) stockError='Stock insuficiente: '+l.prod+' (disp: '+disponible+', ped: '+l.q+')';
  });
  if(stockError){alert(stockError);return;}
  
  var newFolio;
  // ── Let user choose: new folio or add to existing ──
  var existingFolios = c.folios.filter(function(f){
    return f.lineas && f.lineas.length > 0;
  });
  var emptyFolio = c.folios.find(function(f){
    return !f.lineas || f.lineas.length === 0;
  });
  
  var selectedFolio = null;
  if(existingFolios.length > 0){
    var opts = '0 → 📄 Folio NUEVO\n';
    existingFolios.forEach(function(f, i){
      var t = totF(f), p = pagF(f), saldo = t - p;
      var prods = (f.lineas||[]).map(function(l){return l.prod;}).filter(function(v,i,a){return a.indexOf(v)===i;}).slice(0,3).join(', ');
      if(prods.length > 40) prods = prods.substring(0,37) + '...';
      opts += (i+1) + ' → ' + (f.desc||'Sin descripción') + ' | ' + prods + ' | Saldo: $' + fN(saldo) + '\n';
    });
    var pick = prompt('¿En qué folio quieres registrar esta venta?\n\n' + opts, '0');
    if(pick === null) return; // cancelado
    var pickNum = parseInt(pick);
    if(pickNum > 0 && pickNum <= existingFolios.length){
      selectedFolio = existingFolios[pickNum - 1];
    }
  }
  // Also check for empty folio (credito_anticipado) if no selection made
  if(!selectedFolio && emptyFolio){
    selectedFolio = emptyFolio;
  }
  
  if(selectedFolio){
    newFolio = selectedFolio;
    fid = newFolio.id;
    if (!newFolio.lineas || newFolio.lineas.length === 0) {
      newFolio.fecha = fecha;
      newFolio.alm = alm;
      newFolio.mon = mon;
      newFolio.desc = desc;
      newFolio.lineas = lineas.map(l=>({...l,qO:l.q,pO:l.precio}));
      delete newFolio.tipo;
      delete newFolio.ref;
      delete newFolio.productos;
      delete newFolio.totalUSD;
    } else {
      newFolio.lineas = newFolio.lineas.concat(lineas.map(l=>({...l,qO:l.q,pO:l.precio})));
      newFolio.desc = newFolio.desc + ' | ' + desc;
    }
    if(ini>0) newFolio.abonos.push(abonos[0]);
  } else {
    newFolio={id:fid,fecha,alm,mon,desc,lineas:lineas.map(l=>({...l,qO:l.q,pO:l.precio})),abonos};
    c.folios.push(newFolio);
  }
  
  // discount stock
  lineas.forEach(function(l){
    var p=PRODS.find(function(x){return x.n===l.prod;});
    if(p&&alm){
      p.stk=Math.max(0,(p.stk||0)-l.q);
      if(p.stk_alm&&p.stk_alm[alm]!=null) p.stk_alm[alm]=Math.max(0,(p.stk_alm[alm]||0)-l.q);
      if(typeof syncStockUpdate==='function') syncStockUpdate([{n:l.prod,q:l.q}],alm);
    }
  });
  
  var _ventaFolio={
    id:venNextId++, fecha:fecha,
    vend:(typeof S!=='undefined'&&S.user)||'Admin',
    alm:alm, cli:c.nombre, tipo:'Mayorista', mon:mon,
    prods:lineas.map(function(l){return l.q+'× '+l.prod;}).join(', '),
    totalUSD:lineas.reduce(function(a,l){return a+l.q*l.precio;},0),
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
    var _fT=lineas.reduce(function(a,l){return a+l.q*l.precio;},0);
    tgSend('\uD83D\uDCC4 <b>Venta cr\u00e9dito (Folio '+fid+')</b>\n\uD83D\uDC64 '+_tgEsc(c.nombre)+' \u2022 '+alm+'\n\uD83D\uDCE6 <b>Productos:</b>\n'+_fP+'\n\uD83D\uDCB5 <b>$'+fN(_fT)+'</b>\n\uD83D\uDCDD '+_tgEsc(desc)+_tgCliBalance(c.nombre),alm,'venta');
  }
  showToast(`Folio a crédito creado para ${c.nombre}`);
  
  S.cart=[]; renderCart(); renderProds();
}
function reservar(){
  if(!S.cart.length)return;
  // Build modal — lotes/contenedores activos
  var cntOpts='<option value="">— Sin lote/contenedor —</option>'
    +CONTENEDORES
      .filter(function(c){return c.estado!=='cerrado';}) // excluir solo cerrados
      .map(function(c){
        var ic=c.estado==='retrasado'?'⚠️':(c.estado==='recibido'?'✅':(c.estado==='en_transito'||c.estado==='en_aduana'||c.estado==='en_puerto'?'🚢':'📦'));
        var lbl=(c.lote||c.ref)+(c.lote&&c.ref&&c.lote!==c.ref?' (• '+c.ref+')':'');
        var val=c.lote||c.ref; // usar lote o ref como valor de asociación
        return '<option value="'+val+'">'+ic+' '+lbl+'</option>';
      }).join('');
  var mo=document.getElementById('res-modal-cnt');
  if(!mo){
    mo=document.createElement('div');mo.id='res-modal-cnt';
    mo.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    document.body.appendChild(mo);
  }
  mo.innerHTML='<div style="background:var(--color-background-primary);border:1px solid var(--color-border-secondary);border-radius:var(--border-radius-lg);padding:22px;max-width:380px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.5)">'
    +'<div style="font-size:15px;font-weight:700;margin-bottom:16px">📋 Nueva Reserva</div>'
    +'<div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:14px;background:var(--color-background-secondary);padding:8px 10px;border-radius:var(--border-radius-md)">'
    +S.cart.map(function(c){return c.q+'× '+c.n;}).join('<br>')+'</div>'
    +'<label style="font-size:11px;font-weight:600;color:var(--color-text-secondary);display:block;margin-bottom:4px">NOTA / NOMBRE</label>'
    +'<input id="res-nota-inp" class="adm-inp" placeholder="Nombre del cliente, referencia..." style="width:100%;margin-bottom:12px">'
    +'<label style="font-size:11px;font-weight:600;color:var(--color-text-secondary);display:block;margin-bottom:4px">🚢 LOTE / CONTENEDOR (OPCIONAL)</label>'
    +(CONTENEDORES.length?'<select id="res-cnt-sel" class="adm-inp" style="width:100%;margin-bottom:16px">'+cntOpts+'</select>'
      :'<div style="font-size:11px;color:var(--color-text-tertiary);margin-bottom:16px;padding:8px;background:var(--color-background-secondary);border-radius:4px">Sin contenedores creados. Ve a Admin → 🚢 Contenedores.</div><input type="hidden" id="res-cnt-sel" value="">')
    +'<div style="display:flex;gap:8px">'
    +'<button class="adm-btn" style="flex:1" onclick="document.getElementById(\'res-modal-cnt\').style.display=\'none\'">Cancelar</button>'
    +'<button class="adm-btn adm-btn-p" style="flex:1" onclick="_confirmarReserva()">✓ Reservar</button>'
    +'</div></div>';
  mo.style.display='flex';
  setTimeout(function(){var n=document.getElementById('res-nota-inp');if(n)n.focus();},80);
}
function _confirmarReserva(){
  var nota=(document.getElementById('res-nota-inp')||{}).value||'';
  nota=nota.trim();
  var cnt=(document.getElementById('res-cnt-sel')||{}).value||'';
  var mo=document.getElementById('res-modal-cnt');
  if(mo)mo.style.display='none';
  S.reservas.push({id:Date.now(),activa:true,user:S.user,alm:S.alm,cli:S.cli, nota:nota, contenedor:cnt,
    lineas:S.cart.map(c=>({...c})),totalUSD:S.cart.reduce((a,c)=>a+c.precioUSD*c.q,0),
    fecha:new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit'})});
  _saveReservas();
  if((TG_ON||TG_TOKEN)&&S.cart&&S.cart.length){
    var _rP=S.cart.map(function(c){return '  • '+c.q+'x '+c.n+' @ $'+fN(c.precioUSD)+' = $'+fN(c.q*c.precioUSD);}).join('\n');
    var _rT=S.cart.reduce(function(a,c){return a+c.precioUSD*c.q;},0);
    var tgMsg = '\uD83D\uDCCB <b>Reserva</b>\n\uD83D\uDC64 '+(S.user||'?')+' \u2022 '+(S.alm||'')+'\n\uD83D\uDED2 '+(S.cli||'Walk-in')+'\n\uD83D\uDCE6 <b>Productos:</b>\n'+_rP+'\n\uD83D\uDCB5 <b>$'+fN(_rT)+'</b>';
    if(nota) tgMsg += '\n\uD83D\uDCDD ' + String(nota).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    if(cnt)  tgMsg += '\n\uD83D\uDE22 Contenedor: '+cnt;
    tgSend(tgMsg,S.alm,'pedido');
  }
  updResBadge();renderSteps(S.step||2);S.cart=[];renderCart();renderProds();showToast('Reservado — stock bloqueado');
}
function syncReservasGlobal(){
  RESERVAS_GLOBAL=S.reservas.slice();
  try{localStorage.setItem("erp_reservas_global",JSON.stringify(RESERVAS_GLOBAL));}catch(e){}
}
function updResBadge(){
  const n=S.reservas.filter(r=>r.activa).length;
  var rn=document.getElementById('res-n');if(rn)rn.textContent=n;
  var rb=document.getElementById('res-btn');if(rb)rb.style.display=n>0&&S.alm?'inline':'none';
  var rbt=document.getElementById('res-btn-top');if(rbt)rbt.style.display=n>0?'':'none';
  var rnt=document.getElementById('res-n-top');if(rnt)rnt.textContent=n;
  var rbanner=document.getElementById('res-banner');if(rbanner)rbanner.style.display=n>0?'flex':'none';
  var rbannern=document.getElementById('res-banner-n');if(rbannern)rbannern.textContent=n+' reserva'+(n===1?'':'s');
}
function openRes(){
  var _isAdmRes = typeof S!=='undefined'&&S.user&&USERS[S.user]&&USERS[S.user].rol==='admin';
  const act=S.reservas.filter(r=>r.activa&&(_isAdmRes||r.user===S.user));
  document.getElementById('res-list').innerHTML=act.length?act.map(r=>{
    var _mia = r.user===S.user;
    var _puedeCancelar = _isAdmRes || _mia;
    var _cntHtml = r.contenedor ? '<div style="margin-bottom:6px">'+_cntBadge(r.contenedor)+'</div>' : '';
    return `<div class="res-card">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-weight:500">${r.cli||'Walk-in'} · ${r.user} · ${r.alm} · ${r.fecha}</span>
        <span style="font-weight:500">${fN(r.totalUSD)} USD</span>
      </div>
      ${r.nota?`<div style="font-size:12px;color:var(--color-primary);background:var(--color-bg-secondary);padding:4px 8px;border-radius:4px;margin-bottom:6px">📝 ${r.nota}</div>`:''}
      ${_cntHtml}
      <div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:10px">${r.lineas.map(l=>l.q+'× '+l.n).join(' · ')}</div>
      <div style="display:flex;gap:6px">
        ${_mia?`<button class="btn btn-p" style="flex:1;font-size:12px;padding:8px" onclick="cobrarReserva(${r.id})">Cobrar ahora</button>`:''}
        ${_puedeCancelar?`<button class="btn" style="font-size:12px;padding:8px;width:auto" onclick="cancelRes(${r.id})">Cancelar</button>`:''}
      </div>
    </div>`;
  }).join(''):'<div style="text-align:center;color:var(--color-text-tertiary);padding:20px">Sin reservas activas</div>';
  document.getElementById('res-overlay').style.display='block';
}
function closeRes(){document.getElementById('res-overlay').style.display='none';}
function cancelRes(id){
  S.reservas=S.reservas.filter(x=>x.id!==id);
  try{localStorage.setItem('erp_reservas',JSON.stringify(S.reservas));}catch(e){}
  _saveReservas();updResBadge();openRes();renderProds();
  showToast('Reserva eliminada');
}
function cobrarReserva(id){
  const r=S.reservas.find(x=>x.id===id);if(!r)return;
  S.user=r.user;S.alm=r.alm;S.cli=r.cli;S.cart=r.lineas.map(c=>({...c}));
  r.activa=false;updResBadge();closeRes();goStep('pg-pago',3);
}
function getVentaUSD(){return S.cart.reduce((a,c)=>a+c.precioUSD*c.q,0);}
function getCobUSD(){return S.pagos.reduce((a,p)=>a+toUSD(p.m||0,p.mon),0);}
function getVueltoUSD(){return S.vueltos.reduce((a,v)=>a+toUSD(v.m||0,v.mon),0);}
function getPendCobro(){return Math.max(0,getVentaUSD()-getCobUSD());}
function getPendVuelto(){return (getCobUSD()-getVentaUSD())-getVueltoUSD();}
function initPago(){
  S.pagos=[];S.vueltos=[];
  // Load cajas so POS selector shows Supabase caja names
  if(typeof loadCajasData==='function'&&(!_cajasData||!_cajasData.length)){
    loadCajasData().then(function(){renderPago();});
  } else {
    renderPago();
  }
}
function goPago(){if(!S.cart.length)return;goStep('pg-pago',3);}
function addPago(mon){
  const sug=getPendCobro()>0?rUp(fromUSD(getPendCobro(),mon,S.alm),mon):0;
  const cj=(function(){
    // Pick the best caja name from Supabase or fallback
    var opts=_getCajasForMon(mon,S.alm||'Habana');
    // Prefer exact match almacen
    var exact=opts.find(function(o){return o.indexOf(S.alm||'Habana')>=0;});
    return exact||opts[0]||mon+' '+(S.alm||'Habana');
  })();const id='p'+Date.now();S.pagos.push({id,mon,m:sug,caja:cj});renderPago();
  setTimeout(()=>{const e=document.getElementById('pi-'+id);if(e){e.focus();e.select();}},40);
}
function addVuelto(mon){
  var _rv=fromUSD(getPendVuelto(),mon,S.alm);
  const sug=getPendVuelto()>0?(mon==='CUP'||mon==='CUPT'?Math.floor(_rv):parseFloat(_rv.toFixed(2))):0;
  const id='v'+Date.now();S.vueltos.push({id,mon,m:sug});renderPago();
  setTimeout(()=>{const e=document.getElementById('vi-'+id);if(e){e.focus();e.select();}},40);
}
function fillP(id){
  const idx=S.pagos.findIndex(x=>x.id===id);
  S.pagos[idx].m=rUp(fromUSD(getPendCobro()+toUSD(S.pagos[idx].m||0,S.pagos[idx].mon,S.alm),S.pagos[idx].mon,S.alm),S.pagos[idx].mon);
  renderPago();
}
function fillV(id){
  const idx=S.vueltos.findIndex(x=>x.id===id);
  S.vueltos[idx].m=parseFloat(fromUSD(getPendVuelto()+toUSD(S.vueltos[idx].m||0,S.vueltos[idx].mon,S.alm),S.vueltos[idx].mon,S.alm).toFixed(dFor(S.vueltos[idx].mon)));
  renderPago();
}
function renderPago(){
  const ventaUSD=getVentaUSD(),cobUSD=getCobUSD(),vueltoUSD=getVueltoUSD();
  const pendC=getPendCobro(),diff=cobUSD-ventaUSD,pendV=getPendVuelto();
  document.getElementById('pago-ctx').textContent=`${S.user} · ${S.alm} · ${S.cli||'Walk-in'} · ${fN(ventaUSD)} USD`;
  document.getElementById('pend-cobro').textContent=fN(pendC)+' USD';
  document.getElementById('strip-cobro').className='strip '+(pendC<0.01?'ok':'warn');
  document.getElementById('cobro-btns').innerHTML=pendC>0.005
    ?MONEDAS.map(m=>`<button class="bf" onclick="addPago('${m}')">${fN(rUp(fromUSD(pendC,m,S.alm),m),dFor(m))} ${m}</button>`).join('')
    :'<span style="font-size:12px;color:var(--color-text-success);font-weight:500">Cobro completo ✓</span>';
  document.getElementById('pagos-cnt').innerHTML=S.pagos.map((p,i)=>{
    const usd=toUSD(p.m||0,p.mon);const fq=rUp(fromUSD(getPendCobro()+usd,p.mon,S.alm),p.mon);
    return `<div class="prow">
      <span style="font-size:11px;color:var(--color-text-secondary);min-width:50px">Pago ${i+1}</span>
      <input type="number" id="pi-${p.id}" value="${p.m||''}" step="${dFor(p.mon)?'1':'0.01'}" style="flex:1;min-width:70px" oninput="S.pagos[${i}].m=parseFloat(this.value)||0;renderPagoTotalsOnly()">
      <select style="width:74px" onchange="S.pagos[${i}].mon=this.value;fillP('${p.id}')">
        ${MONEDAS.map(m=>`<option ${m===p.mon?'selected':''}>${m}</option>`).join('')}
      </select>
      <button class="bf" onclick="fillP('${p.id}')">${fN(fq,dFor(p.mon))} ${p.mon}</button>
      <span style="font-size:10px;color:var(--color-text-tertiary);min-width:54px;text-align:right">${fN(usd)} USD</span>
      <button style="border:none;background:none;cursor:pointer;color:var(--color-text-danger);font-size:16px;padding:0 2px" onclick="S.pagos.splice(${i},1);renderPago()">×</button>
    </div>
    <div style="display:flex;align-items:center;gap:5px;padding:2px 0 5px;flex-wrap:wrap">
      <span style="font-size:10px;color:var(--color-text-tertiary);min-width:50px">→ Caja</span>
      <select style="flex:1;font-size:11px;padding:3px 6px;border:.5px solid var(--color-border-secondary);border-radius:4px;background:var(--color-background-secondary);color:var(--color-text-primary)" onchange="S.pagos[${i}].caja=this.value">
        ${_getCajasForMon(p.mon,S.alm).map(k=>`<option ${k===(p.caja||p.mon+' '+S.alm)?'selected':''}>${k}</option>`).join('')}
      </select>
    </div>`;
  }).join('');
  document.getElementById('tot-cob').textContent=fN(cobUSD)+' USD';
  const vb=document.getElementById('vuelto-blk');vb.style.display=diff>0.005?'block':'none';
  if(diff>0.005){
    const el_pv2=document.getElementById('pend-vuelto');
    if(el_pv2){el_pv2.textContent=(pendV<0?'-':'')+fN(Math.abs(pendV))+' USD';el_pv2.style.color=pendV<-0.005?'var(--color-text-danger)':'';}
    document.getElementById('strip-vuelto').className='strip '+(pendV>-0.005&&pendV<0.01?'ok':pendV<-0.005?'err':'warn');
    document.getElementById('vuelto-btns').innerHTML=pendV>0.005
      ?MONEDAS.map(m=>`<button class="bf" onclick="addVuelto('${m}')">${fN((m==='CUP'||m==='CUPT')?Math.floor(fromUSD(pendV,m,S.alm)):parseFloat(fromUSD(pendV,m,S.alm).toFixed(2)),dFor(m))} ${m}</button>`).join('')
      :pendV<-0.005?'<span style="font-size:12px;color:var(--color-text-danger);font-weight:500">⚠ Exceso de vuelto: '+fN(Math.abs(pendV))+' USD</span>'
      :'<span style="font-size:12px;color:var(--color-text-success);font-weight:500">Vuelto cuadrado ✓</span>';
    document.getElementById('vueltos-cnt').innerHTML=S.vueltos.map((v,i)=>{
      const usd=toUSD(v.m||0,v.mon);const fq=parseFloat(fromUSD(getPendVuelto()+usd,v.mon,S.alm).toFixed(dFor(v.mon)));
      return `<div class="vrow">
        <span style="font-size:11px;color:var(--color-text-secondary);min-width:54px">Vuelto ${i+1}</span>
        <input type="number" id="vi-${v.id}" value="${v.m||''}" step="${dFor(v.mon)?'1':'0.01'}" style="flex:1;min-width:70px" oninput="S.vueltos[${i}].m=parseFloat(this.value)||0;renderPagoTotalsOnly()">
        <select style="width:74px" onchange="S.vueltos[${i}].mon=this.value;fillV('${v.id}')">
          ${MONEDAS.map(m=>`<option ${m===v.mon?'selected':''}>${m}</option>`).join('')}
        </select>
        <button class="bf" onclick="fillV('${v.id}')">${fN(fq,dFor(v.mon))} ${v.mon}</button>
        <span style="font-size:10px;color:var(--color-text-tertiary);min-width:54px;text-align:right">${fN(usd)} USD</span>
        <button style="border:none;background:none;cursor:pointer;color:var(--color-text-danger);font-size:16px;padding:0 2px" onclick="S.vueltos.splice(${i},1);renderPago()">×</button>
      </div>
      <div style="display:flex;align-items:center;gap:5px;padding:2px 0 5px;flex-wrap:wrap">
        <span style="font-size:10px;color:var(--color-text-tertiary);min-width:54px">← Caja</span>
        <select style="flex:1;font-size:11px;padding:3px 6px;border:.5px solid var(--color-border-secondary);border-radius:4px;background:var(--color-background-secondary);color:var(--color-text-primary)" onchange="S.vueltos[${i}].caja=this.value">
          ${_getCajasForMon(v.mon,S.alm).map(k=>`<option ${k===(v.caja||v.mon+' '+S.alm)?'selected':''}>${k}</option>`).join('')}
        </select>
      </div>`;
    }).join('');
    document.getElementById('tot-vuelto').textContent=fN(vueltoUSD)+' USD';
  }
  const neto=cobUSD-vueltoUSD-ventaUSD,ok=Math.abs(neto)<0.005&&pendC<0.005&&Math.abs(pendV)<0.005;
  const eb=document.getElementById('est-bar'),bc=document.getElementById('btn-conf');
  if(cobUSD<0.01){eb.style.cssText='background:var(--color-background-secondary);color:var(--color-text-secondary)';eb.textContent='Añade los pagos recibidos';bc.disabled=true;bc.style.opacity='.45';}
  else if(ok){eb.style.cssText='background:var(--color-background-success);color:var(--color-text-success)';eb.textContent='Operación cuadrada ✓';bc.disabled=false;bc.style.opacity='1';}
  else if(pendC>0.005){eb.style.cssText='background:var(--color-background-warning);color:var(--color-text-warning)';eb.textContent='Faltan '+fN(pendC)+' USD por cobrar';bc.disabled=true;bc.style.opacity='.45';}
  else{eb.style.cssText='background:var(--color-background-success);color:var(--color-text-success)';eb.textContent='Listo para confirmar ✓';bc.disabled=false;bc.style.opacity='1';}
}
function renderPagoTotalsOnly(){
  // Updates all cobro display EXCEPT the pago/vuelto input rows (to preserve focus)
  const ventaUSD=getVentaUSD(),cobUSD=getCobUSD(),vueltoUSD=getVueltoUSD();
  const pendC=getPendCobro(),diff=cobUSD-ventaUSD,pendV=getPendVuelto();
  const el_pend=document.getElementById('pend-cobro');
  if(el_pend) el_pend.textContent=fN(pendC)+' USD';
  const el_strip=document.getElementById('strip-cobro');
  if(el_strip) el_strip.className='strip '+(pendC<0.01?'ok':'warn');
  const el_cob=document.getElementById('cobro-btns');
  if(el_cob) el_cob.innerHTML=pendC>0.005
    ?MONEDAS.map(m=>`<button class="bf" onclick="addPago('${m}')">${fN(rUp(fromUSD(pendC,m,S.alm),m),dFor(m))} ${m}</button>`).join('')
    :'<span style="font-size:12px;color:var(--color-text-success);font-weight:500">Cobro completo ✓</span>';
  const el_tot=document.getElementById('tot-cob');
  if(el_tot) el_tot.textContent=fN(cobUSD)+' USD';
  // Update equiv USD label on each pago row without rebuilding
  S.pagos.forEach((p,i)=>{
    const usd=toUSD(p.m||0,p.mon);
    const el=document.getElementById('pi-usd-'+p.id);
    if(el) el.textContent=fN(usd)+' USD';
  });
  const vb=document.getElementById('vuelto-blk');
  if(vb) vb.style.display=diff>0.005?'block':'none';
  if(diff>0.005){
    const el_pv=document.getElementById('pend-vuelto');
    if(el_pv){el_pv.textContent=(pendV<0?'-':'')+fN(Math.abs(pendV))+' USD';el_pv.style.color=pendV<-0.005?'var(--color-text-danger)':'';}
    const el_sv=document.getElementById('strip-vuelto');
    if(el_sv) el_sv.className='strip '+(pendV>-0.005&&pendV<0.01?'ok':pendV<-0.005?'err':'warn');
    const el_vb=document.getElementById('vuelto-btns');
    if(el_vb) el_vb.innerHTML=pendV>0.005
      ?MONEDAS.map(m=>`<button class="bf" onclick="addVuelto('${m}')">${fN((m==='CUP'||m==='CUPT')?Math.floor(fromUSD(pendV,m,S.alm)):parseFloat(fromUSD(pendV,m,S.alm).toFixed(2)),dFor(m))} ${m}</button>`).join('')
      :pendV<-0.005?'<span style="font-size:12px;color:var(--color-text-danger);font-weight:500">⚠ Exceso de vuelto: '+fN(Math.abs(pendV))+' USD</span>'
      :'<span style="font-size:12px;color:var(--color-text-success);font-weight:500">Vuelto cuadrado ✓</span>';
    const el_tv=document.getElementById('tot-vuelto');
    if(el_tv) el_tv.textContent=fN(vueltoUSD)+' USD';
    S.vueltos.forEach((v,i)=>{
      const usd=toUSD(v.m||0,v.mon);
      const el=document.getElementById('vi-usd-'+v.id);
      if(el) el.textContent=fN(usd)+' USD';
    });
  }
  // Update status bar
  const neto=cobUSD-vueltoUSD-ventaUSD,ok=Math.abs(neto)<0.005&&pendC<0.005&&Math.abs(pendV)<0.005;
  const eb=document.getElementById('est-bar'),bc=document.getElementById('btn-conf');
  if(!eb||!bc) return;
  if(cobUSD<0.01){eb.style.cssText='background:var(--color-background-secondary);color:var(--color-text-secondary)';eb.textContent='Añade los pagos recibidos';bc.disabled=true;bc.style.opacity='.45';}
  else if(ok){eb.style.cssText='background:var(--color-background-success);color:var(--color-text-success)';eb.textContent='Operación cuadrada ✓';bc.disabled=false;bc.style.opacity='1';}
  else if(pendC>0.005){eb.style.cssText='background:var(--color-background-warning);color:var(--color-text-warning)';eb.textContent='Faltan '+fN(pendC)+' USD por cobrar';bc.disabled=true;bc.style.opacity='.45';}
  else{eb.style.cssText='background:var(--color-background-success);color:var(--color-text-success)';eb.textContent='Listo para confirmar ✓';bc.disabled=false;bc.style.opacity='1';}
}

// Returns caja names for a given moneda, preferring Supabase _cajasData
function _getCajasForMon(mon, alm) {
  var preferred = mon + ' ' + (alm || S.alm || '');
  // Use _cajasData if loaded (Supabase)
  if (typeof _cajasData !== 'undefined' && _cajasData.length) {
    var opts = _cajasData.filter(function(c){ return c.moneda === mon && c.activa; });
    if (opts.length) {
      return opts.map(function(c){ return c.nombre; });
    }
  }
  // Fallback: CUENTAS_BASE keys
  var keys = Object.keys(CUENTAS_BASE).filter(function(k){ return k.startsWith(mon); });
  return keys.length ? keys : [preferred];
}

function confirmar(){
  var totalUSD=getVentaUSD();
  var prods=S.cart.map(function(c){return c.q+'× '+c.n+' @ $'+fN(c.precioUSD||0);}).join(', ');
  var cobDesc=S.pagos.map(function(p){return fN(p.m,dFor(p.mon))+' '+p.mon;}).join(' + ');
  var vueltoDesc=S.vueltos.length?S.vueltos.map(function(v){return fN(v.m,dFor(v.mon))+' '+v.mon;}).join(' + '):'';
  // Per-product commission
  var userAComision = USERS[S.user] && USERS[S.user].aComision !== false;
  var estCom = 'No aplica';
  var comUSD = 0;
  var comPct = 0;
  var comDetalle = {};
  
  if (userAComision) {
    S.cart.forEach(function(c){
      var p=PRODS.find(function(x){return x.n===c.n;});
      var cat=p?p.cat:''; 
      var pct=getComPct(S.user,c.n,cat,S.alm);
      if(pct>0){ comUSD+=parseFloat((c.precioUSD*c.q*(pct/100)).toFixed(4)); estCom='Pendiente'; }
    });
    comUSD=parseFloat(comUSD.toFixed(2));
    comPct=totalUSD>0?parseFloat((comUSD/totalUSD*100).toFixed(2)):0;
    
    // Desglose por moneda basado en los pagos recibidos
    if (comUSD > 0) {
      var netCobrado = {};
      S.pagos.forEach(function(p){ netCobrado[p.mon] = (netCobrado[p.mon]||0) + p.m; });
      S.vueltos.forEach(function(v){ netCobrado[v.mon] = (netCobrado[v.mon]||0) - v.m; });
      Object.keys(netCobrado).forEach(function(m){
        if(netCobrado[m] > 0) comDetalle[m] = parseFloat((netCobrado[m] * (comPct / 100)).toFixed(4));
      });
    }
    if(S.alm==='Placetas'&&!COM_REGLAS.some(function(r){return r.vendedor===S.user&&(r.almacen==='Placetas'||!r.almacen);}))estCom='No aplica';
  }

  var _ticket=genTicket(S.alm);
  var venta={
    id:venNextId++,fecha:today(),hora:new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),vend:S.user,alm:S.alm,cli:S.cli||'Walk-in',
    tipo:(S.tipo==='Preventa'?'Mayorista':S.tipo),mon:S.cartMon,prods:prods,totalUSD:totalUSD,ticket:_ticket,
    comPct:estCom==='No aplica'?0:comPct,
    comUSD:estCom==='No aplica'?0:comUSD,
    comDetalle:estCom==='No aplica'?{}:comDetalle,
    estCom:estCom,nota:(S.tipo==='Preventa'?'[Pre-venta] ':'')+(document.getElementById('venta-nota')?.value||''),
    pagos:S.pagos.map(function(p){return {m:p.m,mon:p.mon,caja:p.caja||(p.mon+' '+S.alm)};}),
    vueltos:S.vueltos.map(function(v){return {m:v.m,mon:v.mon,caja:v.caja||(v.mon+' '+S.alm)};})  
  };
  VENTAS.unshift(venta);
  // Descontar stock
  S.cart.forEach(function(c){
    var p=PRODS.find(function(x){return x.n===c.n;});
    if(p){
      p.stk=Math.max(0,(p.stk||0)-c.q);
      if(p.stk_alm&&p.stk_alm[S.alm]!=null) p.stk_alm[S.alm]=Math.max(0,(p.stk_alm[S.alm]||0)-c.q);
    }
  });
  // Sync Supabase
  if(typeof syncSaveVenta==='function') syncSaveVenta(venta);
  if(typeof syncStockUpdate==='function') syncStockUpdate(S.cart.slice(), S.alm);
  if(typeof updateCajasFromVenta==='function') updateCajasFromVenta(S.pagos.slice(),S.vueltos.slice(),S.alm);
  // Save to offline cache immediately
  if(typeof offlineAutoSave==='function') offlineAutoSave();
  if(!_supaOnline && typeof showOfflineBanner==='function') showOfflineBanner(_syncQueue.length);
  // Telegram notification
  // Telegram notification
  (function(){
    var _tgProds=S.cart.map(function(c){return '  • '+c.q+'× '+c.n+' @ $'+fN(c.precioUSD||0)+' = $'+fN(c.q*(c.precioUSD||0));}).join('\n');
    var _tgCob=S.pagos.map(function(p){return fN(p.m,dFor(p.mon))+' '+p.mon+(p.caja?' ('+p.caja+')':'');}).join(' + ');
    var _tgVuelto=S.vueltos&&S.vueltos.length?S.vueltos.map(function(v){return fN(v.m,dFor(v.mon))+' '+v.mon+(v.caja?' ('+v.caja+')':'');}).join(' + '):'';
    var _tgHora=venta.hora?' · '+venta.hora:'';
    var _tgMsg='\uD83D\uDCB0 <b>Venta POS</b> <code>'+_ticket+'</code>\n'
      +'\uD83D\uDC64 '+venta.vend+' \u2022 '+venta.alm+_tgHora+'\n'
      +'\uD83D\uDED2 '+venta.cli+'\n'
      +'\uD83D\uDCE6 <b>Productos:</b>\n'+_tgProds+'\n'
      +'\uD83D\uDCB5 <b>'+fN(venta.totalUSD)+' USD</b>\n'
      +'\uD83D\uDCB3 Cobro: '+_tgCob
      +(_tgVuelto?'\n\uD83D\uDD04 Vuelto: '+_tgVuelto:'')
      +(venta.nota?'\n\uD83D\uDCDD '+venta.nota:'')
      +_tgCliBalance(venta.cli);
    try{ tgSend(_tgMsg, S.alm, 'venta'); }catch(_tgE){ console.warn('TG venta POS:',_tgE); }
  })();
  var linesHtml='<div class="res-line" style="border-bottom:.5px solid var(--color-border-tertiary);margin-bottom:6px;padding-bottom:6px"><span style="color:var(--color-text-tertiary);font-size:11px">Ticket</span><span style="font-weight:700;font-size:13px;letter-spacing:.05em">'+_ticket+(venta.hora?' <span style="font-size:10px;font-weight:400;color:var(--color-text-tertiary);margin-left:6px">⏰ '+venta.hora+'</span>':'')+'</span></div>'
  +'<div class="res-line"><span>Productos</span>'
    +'<span style="text-align:right;font-size:12px;line-height:1.7">'
    +S.cart.map(function(c){return c.q+'× '+c.n;}).join('<br>')
    +'</span></div>'
    +'<div class="res-line"><span>Total</span><strong>'+fN(totalUSD)+' USD</strong></div>'
    +'<div class="res-line"><span></span><span style="font-size:11px;color:var(--color-text-secondary)">'
    +MONEDAS.filter(function(m){return m!=='USD';}).map(function(m){return fN(fromUSD(totalUSD,m,S.alm),dFor(m))+' '+m;}).join(' · ')
    +'</span></div>'
    +'<div class="res-line"><span>Cobrado</span><span>'+cobDesc+'</span></div>'
    +(vueltoDesc?'<div class="res-line"><span>Vuelto</span><span>'+vueltoDesc+'</span></div>':'')
    +(function(){
      // Caja breakdown
      var cajaMap={};
      venta.pagos.forEach(function(p){
        cajaMap[p.caja]=(cajaMap[p.caja]||[]);
        cajaMap[p.caja].push('+'+fN(p.m,dFor(p.mon))+' '+p.mon);
      });
      venta.vueltos.forEach(function(v){
        cajaMap[v.caja]=(cajaMap[v.caja]||[]);
        cajaMap[v.caja].push('−'+fN(v.m,dFor(v.mon))+' '+v.mon);
      });
      var keys=Object.keys(cajaMap);
      if(!keys.length) return '';
      return '<div style="border-top:.5px solid var(--color-border-tertiary);margin-top:8px;padding-top:8px">'
        +'<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:5px;font-weight:600">MOVIMIENTOS DE CAJA</div>'
        +keys.map(function(k){
          return '<div class="res-line">'
            +'<span style="font-size:11px">'+k+'</span>'
            +'<span style="font-size:11px">'+cajaMap[k].join(' · ')+'</span>'
            +'</div>';
        }).join('')+'</div>';
    })()
    +(venta.nota?'<div class="res-line" style="border-top:.5px solid var(--color-border-tertiary);margin-top:8px;padding-top:8px"><span style="color:var(--color-text-tertiary)">📝</span><span style="font-size:12px">'+venta.nota+'</span></div>':'');
  document.getElementById('ok-lines').innerHTML=linesHtml;
  const notaEl=document.getElementById('venta-nota');if(notaEl)notaEl.value='';
  goStep('pg-ok',3);
}
function nuevaVenta(){
  S.cart=[];S.pagos=[];S.vueltos=[];S.alm='';S.cli='';S.tipo='Minorista';
  document.querySelectorAll('.alm-card').forEach(c=>c.classList.remove('sel'));
  document.getElementById('s-cli').value='';goStep('pg-alm',1);
}
function otraVentaMismoAlmacen(){
  S.cart=[];S.pagos=[];S.vueltos=[];S.tipo='Minorista';S.cartMon='USD';
  document.getElementById('tb-min').classList.add('act');document.getElementById('tb-may').classList.remove('act');if(document.getElementById('tb-pre'))document.getElementById('tb-pre').classList.remove('act');
  document.querySelectorAll('.mt-btn').forEach((b,i)=>b.classList.toggle('act',i===0));
  goStep('pg-prod',2);
}
renderSteps(0);





