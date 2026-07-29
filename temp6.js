






// ── CUENTAS BASE (del Excel) ──────────────────────────────
const CUENTAS_BASE={
  'USD Habana':{ingV:0,ingIG:0,gasIG:0,mon:'USD'},
  'EUR Habana':{ingV:0,ingIG:0,gasIG:0,mon:'EUR'},
  'CUP Habana':{ingV:0,ingIG:0,gasIG:0,mon:'CUP'},
  'USD Placetas':{ingV:0,ingIG:0,gasIG:0,mon:'USD'},
  'EUR Placetas':{ingV:0,ingIG:0,gasIG:0,mon:'EUR'},
  'CUP Placetas':{ingV:0,ingIG:0,gasIG:0,mon:'CUP'},
  'USD España':{ingV:0,ingIG:0,gasIG:0,mon:'USD'},
  'EUR España':{ingV:0,ingIG:0,gasIG:0,mon:'EUR'},
  'CUPT Habana':{ingV:0,ingIG:0,gasIG:0,mon:'CUPT'},
  'CUPT Placetas':{ingV:0,ingIG:0,gasIG:0,mon:'CUPT'},
};

// ── DEUDAS BASE ───────────────────────────────────────────
let DEUDAS=[];
(function(){try{var _d=JSON.parse(localStorage.getItem('erp_deudas')||'[]');if(_d&&_d.length)DEUDAS=_d;}catch(e){}})();

// ── MOVIMIENTOS I/G ───────────────────────────────────────
let MOVS=[];
(function(){try{var _m=JSON.parse(localStorage.getItem('erp_movs')||'[]');if(_m&&_m.length){MOVS=_m;igNextId=_m.reduce(function(a,m){return Math.max(a,m.id||0);},0)+1;}}catch(e){}})();
let igNextId =13;


const TIPO_META={
  'Cobro POS':{sentido:'ingreso',icon:'💰',cls:'tag-ingreso'},
  'Cobro cliente':{sentido:'ingreso',icon:'💰',cls:'tag-ingreso'},
  'Compensación cliente':{sentido:'ingreso',icon:'💰',cls:'tag-ingreso'},
  'Cobro préstamo':{sentido:'ingreso',icon:'💰',cls:'tag-ingreso'},
  'Pago cuota':{sentido:'gasto',icon:'📉',cls:'tag-deuda'},
  'Gasto operativo':{sentido:'gasto',icon:'📋',cls:'tag-gasto'},
  'Comisión vendedor':{sentido:'gasto',icon:'💼',cls:'tag-com'},
  'Ingreso no-venta':{sentido:'ingreso',icon:'💰',cls:'tag-ingreso'},
  'Préstamo recibido':{sentido:'ingreso',icon:'🏦',cls:'tag-ingreso'},
  'Amortización deuda':{sentido:'gasto',icon:'📉',cls:'tag-deuda'},
  'Pago intereses':{sentido:'gasto',icon:'📉',cls:'tag-deuda'},
  'Aporte socio':{sentido:'ingreso',icon:'🤝',cls:'tag-ingreso'},
  'Transferencia entre cuentas':{sentido:'neutro',icon:'↔️',cls:'bb'},
};

// ── NAV ───────────────────────────────────────────────────
function navTo_ig(pg,btn){
  document.querySelectorAll('#mod-ig .page').forEach(p=>p.classList.remove('act'));
  document.getElementById(pg).classList.add('act');
  document.querySelectorAll('#mod-ig .nav button').forEach(b=>b.classList.remove('act'));
  if(btn)btn.classList.add('act');
  var _isVendIG=typeof S!=='undefined'&&S.user&&USERS[S.user]&&USERS[S.user].rol==='vendedor';
  var _almIG=_isVendIG&&USERS[S.user]?USERS[S.user].almacen:'';
  if(pg==='libro'){
    // Auto-filter by alm for vendedor
    if(_isVendIG&&_almIG){
      var lc=document.getElementById('l-cta');
      // Set cta filter to first caja of their alm if not set
      if(lc&&!lc.value){
        var _firstCta=_cajasData.find(function(c){return c.almacen===_almIG;});
        // Don't force filter, just render — renderLibro filters by alm for vendedor
      }
    }
    renderLibro();
  }
  if(pg==='cajas'){document.getElementById('cajas-grid').innerHTML='<div style="padding:20px;text-align:center;color:var(--color-text-tertiary)">⏳ Cargando...</div>';renderCajas();}
  if(pg==='cajas-mgmt'){if(typeof renderGestionCajas==='function')renderGestionCajas();}
  if(pg==='deuda')renderDeudas();
  if(pg==='contenedores'&&typeof renderContenedores==='function')renderContenedores();
  if(pg==='nuevo'){document.getElementById('n-fecha').value=today();updNuevo();}
}

// ── FECHAS ────────────────────────────────────────────────
function setR(r){
  const d=new Date(),fmt=x=>x.toISOString().slice(0,10);
  const elDesde=document.getElementById('ig-desde');
  const elHasta=document.getElementById('ig-hasta');
  if(!elDesde||!elHasta) return; // elements not in DOM yet
  let desde,hasta=fmt(d);
  if(r==='hoy')desde=fmt(d);
  else if(r==='semana'){const s=new Date(d);s.setDate(d.getDate()-((d.getDay()||7)-1));desde=fmt(s);}
  else if(r==='mes')desde=fmt(new Date(d.getFullYear(),d.getMonth(),1));
  else if(r==='limpiar'){
    desde='';hasta='';
    ['l-tipo','l-cta','l-sentido'].forEach(id=>{var e=document.getElementById(id);if(e)e.value='';});
    var lq=document.getElementById('l-q');if(lq)lq.value='';
    elDesde.value='';elHasta.value='';
    renderLibro();return;
  }
  else{desde='2025-01-01';hasta='2026-12-31';}
  elDesde.value=desde;elHasta.value=hasta;
  renderLibro();
}

// ── FILTRAR ───────────────────────────────────────────────
if(typeof _cajasData==='undefined') var _cajasData=[];
function filtrar_ig(){
  const desde=(document.getElementById('ig-desde')||{}).value||'';
  const hasta=(document.getElementById('ig-hasta')||{}).value||'';
  const tipo=(document.getElementById('l-tipo')||{}).value||'';
  const cta=(document.getElementById('l-cta')||{}).value||'';
  const sentido=(document.getElementById('l-sentido')||{}).value||'';
  const q=((document.getElementById('l-q')||{}).value||'').toLowerCase();
  // Vendedor: filter by their almacen's cajas
  var _isVendIG=typeof S!=='undefined'&&S.user&&USERS[S.user]&&USERS[S.user].rol==='vendedor';
  var _almIG=_isVendIG&&USERS[S.user]?USERS[S.user].almacen:'';
  var _almCtas=_almIG?_cajasData.filter(function(c){return c.almacen===_almIG;}).map(function(c){return c.nombre;}):[]; 
  // If vendedor and _cajasData not loaded yet — show all movs temporarily
  if(_almIG&&!_almCtas.length&&!_cajasData.length) return MOVS.slice(0,100);
  return MOVS.filter(m=>{
    if(desde&&m.fecha<desde)return false;
    if(hasta&&m.fecha>hasta)return false;
    if(tipo&&m.tipo!==tipo)return false;
    if(cta&&m.cta!==cta)return false;
    if(sentido&&m.sentido!==sentido)return false;
    if(q&&!m.desc.toLowerCase().includes(q)&&!(m.notas||'').toLowerCase().includes(q))return false;
    // Vendedor sees: their alm's movs + global cajas + their own cobros
    if(_almIG){
      var _globalAlms3=['USA','Xportprise','General','España'];
      var _ctaOk=_almCtas.includes(m.cta)||(m.cta||'').includes(_almIG);
      var _isGlobal=_globalAlms3.some(function(g){return (m.cta||'').indexOf(g)>=0;});
      var _isMyMov=m.vend&&m.vend===S.user;
      var _mentionsMe=m.desc&&m.desc.toLowerCase().indexOf((S.user||'').toLowerCase())>=0;
      // Show if: caja matches alm, OR global caja, OR has vendedor field, OR description mentions them
      if(!_ctaOk&&!_isGlobal&&!_isMyMov&&!_mentionsMe)return false;
    }
    return true;
  });
}

// ── RENDER LIBRO ──────────────────────────────────────────
function renderLibro(){
  // Sort and group transfer pairs together
  const _rawData=filtrar_ig().sort((a,b)=>(b.ts||(b.fecha+'T00:00:00Z')).localeCompare(a.ts||(a.fecha+'T00:00:00Z'))||(b.id-a.id));
  // Re-group: after each transfer salida, insert its matching entrada immediately after
  const _seen=new Set();
  const data=[];
  _rawData.forEach(function(m){
    if(_seen.has(m.id)) return;
    _seen.add(m.id);
    data.push(m);
    if(m.tipo==='Transferencia entre cuentas'&&(m.desc||'').indexOf('(salida)')>=0){
      var _base=(m.desc||'').replace(' (salida)','');
      var _pair=_rawData.find(function(x){
        return !_seen.has(x.id)&&x.tipo==='Transferencia entre cuentas'
          &&(x.desc||'').replace(' (entrada)','')===_base&&x.fecha===m.fecha;
      });
      if(_pair){_seen.add(_pair.id);data.push(_pair);}
    }
  });
  const ing=data.filter(m=>m.sentido==='ingreso').reduce((a,m)=>a+m.equivUSD,0);
  const gas=data.filter(m=>m.sentido==='gasto').reduce((a,m)=>a+m.equivUSD,0);
  const neto=ing-gas;
  document.getElementById('l-metrics').innerHTML=`
    <div class="metric"><div class="lbl">Ingresos período</div><div class="val" style="color:var(--color-text-success)">${fN(ing)}</div><div class="sub">USD equiv.</div></div>
    <div class="metric"><div class="lbl">Gastos período</div><div class="val" style="color:var(--color-text-danger)">${fN(gas)}</div><div class="sub">USD equiv.</div></div>
    <div class="metric"><div class="lbl">Neto</div><div class="val" style="color:${neto>=0?'var(--color-text-success)':'var(--color-text-danger)'}">${neto>=0?'+':''}${fN(neto)}</div><div class="sub">USD equiv.</div></div>
    <div class="metric"><div class="lbl">Movimientos</div><div class="val">${data.length}</div><div class="sub">en el período</div></div>`;

  // por cuenta
  const xcta={};
  data.forEach(m=>{
    if(!xcta[m.cta])xcta[m.cta]={ing:0,gas:0,mon:m.cta.split(' ')[0]};
    if(m.sentido==='ingreso')xcta[m.cta].ing+=m.monto;
    else if(m.sentido==='gasto')xcta[m.cta].gas+=m.monto;
  });
  document.getElementById('l-xctab').innerHTML=Object.entries(xcta).map(([c,v])=>{
    const neto=v.ing-v.gas;
    return `<tr>
      <td style="font-weight:500">${c}</td>
      <td style="color:var(--color-text-success);text-align:right">${fN(v.ing)}</td>
      <td style="color:var(--color-text-danger);text-align:right">${fN(v.gas)}</td>
      <td style="font-weight:500;text-align:right;color:${neto>=0?'var(--color-text-success)':'var(--color-text-danger)'}">${neto>=0?'+':''}${fN(neto)}</td>
      <td style="font-size:11px;color:var(--color-text-secondary)">${v.mon}</td>
    </tr>`;
  }).join('')||'<tr><td colspan="5" style="color:var(--color-text-tertiary);text-align:center;padding:10px">Sin movimientos</td></tr>';

  // movimientos
  document.getElementById('l-count').textContent=data.length+' registros';
  const meta=TIPO_META;
  document.getElementById('l-movs').innerHTML=data.length?data.map(m=>{
    const tm=meta[m.tipo]||{icon:'•',cls:'bb'};
    var isGasto=m.sentido==='gasto';
    var isTransferSalida=m.tipo==='Transferencia entre cuentas'&&(m.desc||'').indexOf('(salida)')>=0;
    var isTransferEntrada=m.tipo==='Transferencia entre cuentas'&&(m.desc||'').indexOf('(entrada)')>=0;
    if(isTransferSalida) isGasto=true;
    var timeStr = m.ts && !isNaN(new Date(m.ts).getTime()) ? new Date(m.ts).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}) : '';
    return `<div class="mov-row">
      <div class="mov-icon" style="background:var(--color-background-secondary)">${tm.icon}</div>
      <div class="mov-main">
        <div class="mov-desc">
          <strong>${m.desc}</strong>
          ${m.vend?`<span style="font-size:10px;color:var(--color-text-secondary)"> — ${m.vend}</span>`:''}
          ${m.acreedor?`<span style="font-size:10px;color:var(--color-text-secondary)"> — ${m.acreedor}</span>`:''}
        </div>
        <div class="mov-meta">
          <span class="tipo-tag ${tm.cls}">${m.tipo}</span>
          &nbsp;${fD(m.fecha)}${timeStr?' '+timeStr:''} · ${m.cta}
          ${m.notas?` · <em>${m.notas}</em>`:''}
        </div>
      </div>
      <div class="mov-amt">
        <div class="mov-amt-main" style="color:${isTransferSalida?'var(--color-text-danger)':isTransferEntrada?'var(--color-text-success)':isGasto?'var(--color-text-danger)':'var(--color-text-success)'}">
          ${isTransferSalida?'−':isGasto?'−':'+'}${fN(m.monto,m.mon==='CUP'||m.mon==='CUPT'?0:2)} ${m.mon}
        </div>
        ${m.mon!=='USD'?`<div class="mov-amt-sub">≈ ${isGasto?'−':'+'}${fN(m.equivUSD)} USD</div>`:''}
      </div>
      ${(typeof S!=='undefined'&&S.user&&USERS[S.user]&&USERS[S.user].rol==='admin')?`<button style="border:none;background:none;cursor:pointer;color:var(--color-text-tertiary);font-size:14px;padding:0 4px;margin-left:4px" onclick="eliminar(${m.id})">×</button>`:''}
    </div>`;
  }).join(''):`<div style="color:var(--color-text-tertiary);font-size:12px;padding:16px 0;text-align:center">Sin movimientos con estos filtros</div>`;
}

// ── NUEVO MOVIMIENTO ──────────────────────────────────────
function updNuevo(){
  var _igVend2=typeof S!=='undefined'&&S.user&&USERS[S.user]&&USERS[S.user].rol==='vendedor';
  // For IG module: always use the user's assigned almacen (from Supabase), not S.alm
  // S.alm is where they sell today; almacen is where they can register expenses
  var _igAlm2=_igVend2?(USERS[S.user]?.almacen||S.alm||''):'';
  const mon=document.getElementById('n-mon').value;

  // Rebuild n-cta options from _cajasData filtered by moneda (and alm for vendedor)
  var _nCta=document.getElementById('n-cta');
  var _nCta2=document.getElementById('n-cta2');
  if(_nCta){
    var _prevCta=_nCta.value;
    var _allCajas=[];
    if(typeof _cajasData!=='undefined'&&_cajasData.length){
      var _globalAlms=['USA','Xportprise','General','España'];
      _allCajas=_cajasData.filter(function(c){
        return c.activa!==false
          && c.moneda===mon
          && (!_igAlm2 || c.almacen===_igAlm2 || _globalAlms.indexOf(c.almacen)>=0);
      });
      // If no match for this moneda+alm, show all for that moneda (admin can pick any)
      if(!_allCajas.length&&!_igAlm2){
        _allCajas=_cajasData.filter(function(c){return c.activa!==false&&c.moneda===mon;});
      }
    }
    // Fallback to hardcoded if _cajasData empty
    if(!_allCajas.length){
      var _hardcoded={
        USD:['USD Habana','USD Placetas','USD España'],
        EUR:['EUR Habana','EUR Placetas','EUR España'],
        CUP:['CUP Habana','CUP Placetas'],
        CUPT:['CUPT Habana','CUPT Placetas']
      };
      var _hc=(_hardcoded[mon]||[]);
      if(_igAlm2) _hc=_hc.filter(function(n){return n.indexOf(_igAlm2)>=0;});
      _allCajas=_hc.map(function(n){return {nombre:n};});
    }
    _nCta.innerHTML=_allCajas.map(function(c){
      return '<option'+(c.nombre===_prevCta?' selected':'')+'>'+c.nombre+'</option>';
    }).join('');
    // Auto-select first if previous doesn't match new moneda
    if(_nCta.value&&!_nCta.value.startsWith(mon+' ')) _nCta.selectedIndex=0;
    // Also update n-cta2
    if(_nCta2){
      var _prevCta2=_nCta2.value;
      _nCta2.innerHTML=_allCajas.map(function(c){
        return '<option'+(c.nombre===_prevCta2?' selected':'')+'>'+c.nombre+'</option>';
      }).join('');
    }
  }

  // Hide admin-only tipos for vendedor
  var _nTipo=document.getElementById('n-tipo');
  if(_nTipo&&_igVend2){
    Array.from(_nTipo.options).forEach(function(o){
      var adminOnly=['Comisión vendedor','Amortización deuda','Pago intereses','Aporte socio','Préstamo recibido','Transferencia entre cuentas'];
      o.style.display=adminOnly.includes(o.value)?'none':'';
    });
    if(_nTipo.options[_nTipo.selectedIndex]&&_nTipo.options[_nTipo.selectedIndex].style.display==='none'){
      _nTipo.value='Gasto operativo';
    }
  }

  const tipo=document.getElementById('n-tipo').value;
  const monto=parseFloat(document.getElementById('n-monto').value)||0;
  // Detect almacen from selected caja name (e.g. "CUP Habana" → "Habana")
  var _ctaVal=(document.getElementById('n-cta')?.value||'');
  var _igAlmDetect=['Habana','Placetas','Xportprise'].find(function(a){return _ctaVal.indexOf(a)>=0;})||_igAlm2||'Habana';
  const equiv=toUSD(monto,mon,_igAlmDetect);
  document.getElementById('n-equiv').value=equiv>0?equiv.toFixed(4):'';
  // extras
  document.getElementById('n-com-extra').style.display=tipo==='Comisión vendedor'?'block':'none';
  document.getElementById('n-deuda-extra').style.display=['Amortización deuda','Pago intereses','Préstamo recibido'].includes(tipo)?'block':'none';
  document.getElementById('n-cta2-wrap').style.display=tipo==='Transferencia entre cuentas'?'block':'none';
  if(tipo==='Comisión vendedor'){
    const alm=document.getElementById('n-alm-venta')?.value||'Habana';
    var _comCta=(mon==='CUP'?'CUP ':'USD ')+alm;
    if(_nCta)_nCta.value=_comCta;
  }
  // preview
  const meta=TIPO_META[tipo]||{};
  const prev=document.getElementById('n-preview');
  if(monto>0){
    prev.style.display='block';
    const isGasto=meta.sentido==='gasto';
    prev.style.background=isGasto?'var(--color-background-danger)':'var(--color-background-success)';
    prev.style.color=isGasto?'var(--color-text-danger)':'var(--color-text-success)';
    if(tipo==='Transferencia entre cuentas'){
      const cta2=document.getElementById('n-cta2')?.value||'';
      const ctaOrig=document.getElementById('n-cta').value;
      const monFmt=fN(monto,mon==='CUP'||mon==='CUPT'?0:2);
      prev.style.background='var(--color-background-info)';
      prev.style.color='var(--color-text-info)';
      prev.textContent=`Salida: ${monFmt} ${mon} de ${ctaOrig}  →  Entrada: ${monFmt} ${mon} en ${cta2}`;
    } else {
      prev.textContent=`${isGasto?'Salida':'Entrada'}: ${fN(monto,mon==='CUP'||mon==='CUPT'?0:2)} ${mon}${mon!=='USD'?` (≈ ${fN(equiv)} USD)`:''} desde ${document.getElementById('n-cta').value}`;
    }
  } else prev.style.display='none';
}

function registrar(){
  const fecha=document.getElementById('n-fecha').value||today();
  const tipo=document.getElementById('n-tipo').value;
  const desc=document.getElementById('n-desc').value;
  const monto=parseFloat(document.getElementById('n-monto').value)||0;
  const mon=document.getElementById('n-mon').value;
  const cta=document.getElementById('n-cta').value;
  const notas=document.getElementById('n-notas').value;
  if(!desc){alert('Añade una descripción');return;}
  if(!monto){alert('Introduce el monto');return;}
  const meta=TIPO_META[tipo]||{sentido:'gasto'};
  // Validate saldo disponible
  if((meta.sentido==='gasto'||tipo==='Transferencia entre cuentas')&&typeof _getSaldoCaja==='function'){
    var _saldoCheck=_getSaldoCaja(cta);
    if(_saldoCheck>=0&&monto>_saldoCheck){
      if(!confirm('Saldo disponible en '+cta+': '+fN(_saldoCheck,mon==='CUP'?0:2)+' '+mon+'\n¿Continuar de todas formas?')) return;
    }
  }
  const equivUSD=parseFloat(toUSD(monto,mon).toFixed(2));
  const mov={id:igNextId++,fecha,tipo,desc,monto,mon,equivUSD,cta,sentido:meta.sentido,notas,ts:new Date().toISOString()};
  if(tipo==='Comisión vendedor'){mov.vend=document.getElementById('n-vend').value;mov.alm=document.getElementById('n-alm-venta').value;}
  if(['Amortización deuda','Pago intereses','Préstamo recibido'].includes(tipo)){mov.acreedor=document.getElementById('n-acreedor').value;}
  // si es transferencia, registrar también la entrada en cuenta destino
  if(tipo==='Transferencia entre cuentas'){
    const cta2=document.getElementById('n-cta2').value;
    MOVS.unshift({...mov,id:igNextId++,cta:cta2,sentido:'ingreso',desc:mov.desc+' (entrada)'});
    mov.sentido='gasto';mov.desc=mov.desc+' (salida)';
  }
  MOVS.unshift(mov);
  // Save to localStorage
  try{localStorage.setItem('erp_movs',JSON.stringify(MOVS.slice(0,500)));}catch(e){}
  // Save to Supabase movimientos_ig + update mov_cajas so saldo reflects change
  if(typeof supaReq!=='undefined'){
    // Schema Supabase: descripcion, moneda, cuenta, vendedor — _supaWrite handles offline queue
    _supaWrite('POST','movimientos_ig',{
      fecha:mov.fecha, tipo:mov.tipo, descripcion:mov.desc,
      monto:parseFloat(parseFloat(mov.monto).toFixed(4)),
      moneda:mov.mon,
      equiv_usd:parseFloat(parseFloat(mov.equivUSD).toFixed(4)),
      cuenta:mov.cta, vendedor:mov.vend||'', notas:mov.notas||''
    });
    // If transferencia, also save the entrada entry
    if(mov.tipo==='Transferencia entre cuentas'&&MOVS.length>1){
      var _e=MOVS.find(function(m){return m.sentido==='ingreso'&&(m.desc||'').indexOf('(entrada)')>=0;});
      if(!_e) _e=MOVS[1];
      if(_e){
      _supaWrite('POST','movimientos_ig',{fecha:_e.fecha,tipo:_e.tipo,descripcion:_e.desc,monto:parseFloat(parseFloat(_e.monto).toFixed(4)),
        moneda:_e.mon,equiv_usd:parseFloat(parseFloat(_e.equivUSD).toFixed(4)),cuenta:_e.cta,vendedor:'',notas:_e.notas||''});
      }
    }
    // Write to mov_cajas so saldo de caja reflects this movement
    if(mov.tipo==='Transferencia entre cuentas'){
      // Transferencia: salida de cuenta origen + entrada a cuenta destino
      var _cta2=document.getElementById('n-cta2')?.value||'';
      var _mcTrans={tipo:'transferencia',fecha:mov.fecha,
        notas:mov.desc.replace(' (salida)','').replace(' (entrada)',''),
        usuario:(typeof S!=='undefined'&&S.user)||'Admin',
        caja_origen:mov.cta, caja_destino:_cta2,
        monto_origen:mov.monto, monto_destino:mov.monto, tasa_usada:1};
      _cajasMovs.unshift(_mcTrans);
      _supaWrite('POST','mov_cajas',_mcTrans);
    } else {
      var _mcRow;
      if(mov.sentido==='gasto'){
        _mcRow={tipo:'retiro',fecha:mov.fecha,notas:mov.tipo+' — '+mov.desc,
          usuario:(typeof S!=='undefined'&&S.user)||'Admin',
          caja_origen:mov.cta, caja_destino:null,
          monto_origen:mov.monto,monto_destino:mov.monto,tasa_usada:null};
      } else {
        _mcRow={tipo:'deposito',fecha:mov.fecha,notas:mov.tipo+' — '+mov.desc,
          usuario:(typeof S!=='undefined'&&S.user)||'Admin',
          caja_origen:null, caja_destino:mov.cta,
          monto_origen:mov.monto,monto_destino:mov.monto,tasa_usada:null};
      }
      _cajasMovs.unshift(_mcRow);
      _supaWrite('POST','mov_cajas',_mcRow);
    }
  }
  // mostrar en recientes
  const rc=document.getElementById('nuevo-recientes');
  if(rc.children[0]?.style.textAlign==='center')rc.innerHTML='';
  const div=document.createElement('div');
  div.className='mov-row';
  const isGasto=meta.sentido==='gasto';
  const _isTransfer=tipo==='Transferencia entre cuentas';
  const _cta2Trans=_isTransfer?(document.getElementById('n-cta2')?.value||''):'';
  div.innerHTML=`<div class="mov-icon" style="background:var(--color-background-secondary)">${(TIPO_META[tipo]||{icon:'•'}).icon}</div>
    <div class="mov-main">
      <div class="mov-desc"><strong>${desc}</strong>${_isTransfer?' → '+_cta2Trans:''}</div>
      <div class="mov-meta">${fD(fecha)} · ${cta}</div>
    </div>
    <div class="mov-amt">
      <div class="mov-amt-main" style="color:${_isTransfer?'var(--color-text-info)':isGasto?'var(--color-text-danger)':'var(--color-text-success)'}">
        ${_isTransfer?'↔':isGasto?'−':'+'}${fN(monto,mon==='CUP'||mon==='CUPT'?0:2)} ${mon}
      </div>
    </div>`;
  rc.prepend(div);
  // limpiar
  ['n-desc','n-monto','n-notas'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('n-equiv').value='';
  document.getElementById('n-preview').style.display='none';
  // Telegram for I/G movement (skip transfers - they are internal)
  if((TG_ON||TG_TOKEN)&&tipo!=='Transferencia entre cuentas'){
    var _igIcon=meta.sentido==='ingreso'?'\uD83D\uDCB0':'\uD83D\uDCB8';
    var _igAlm=['Habana','Placetas','Xportprise'].find(function(a){return cta.indexOf(a)>=0;})||'';
    var _igMsg=_igIcon+' <b>'+tipo+'</b>\n'
      +'\uD83D\uDCDD '+desc+'\n'
      +(meta.sentido==='ingreso'?'+':'-')+fN(monto,mon==='CUP'||mon==='CUPT'?0:2)+' '+mon
      +(mon!=='USD'?' \u2248 $'+fN(equivUSD):'')+'\n'
      +'\uD83C\uDFE6 '+cta;
    tgSend(_igMsg,_igAlm,'venta');
  }
  showToast('Registrado: '+desc);
}

function eliminar(id){
  if(typeof S!=='undefined'&&S.user&&USERS[S.user]&&USERS[S.user].rol!=='admin'){
    showToast('⚠ Solo el admin puede eliminar movimientos');return;
  }
  if(!confirm('¿Eliminar este movimiento?'))return;
  // Find mov before removing to reverse caja movement
  var _mov=MOVS.find(function(m){return m.id===id;});
  MOVS=MOVS.filter(function(m){return m.id!==id;});
  // Also remove paired transfer entry if exists
  if(_mov&&_mov.tipo==='Transferencia entre cuentas'){
    var _baseDesc=(_mov.desc||'').replace(' (salida)','').replace(' (entrada)','');
    MOVS=MOVS.filter(function(m){
      return !(m.tipo==='Transferencia entre cuentas'&&
        (m.desc||'').replace(' (salida)','').replace(' (entrada)','')=== _baseDesc&&
        m.fecha===_mov.fecha);
    });
  }
  try{localStorage.setItem('erp_movs',JSON.stringify(MOVS.slice(0,500)));}catch(e){}
  // Reverse mov_cajas entry
  if(_mov&&typeof _getSaldoCaja!=='undefined'){
    // Find and remove matching mov_cajas row
    var _ctaMov=_mov.cta||'';
    _cajasMovs=_cajasMovs.filter(function(mc){
      var matchOrigen=mc.caja_origen===_ctaMov&&parseFloat(mc.monto_origen)===parseFloat(_mov.monto);
      var matchDest=mc.caja_destino===_ctaMov&&parseFloat(mc.monto_destino)===parseFloat(_mov.monto);
      var matchDesc=(mc.notas||'').indexOf(_baseDesc||_mov.desc||'')>=0;
      return !(matchOrigen||matchDest)&&matchDesc!==false||!(matchDesc);
    });
    // Delete from Supabase mov_cajas by description+caja+monto
    if(_supaOnline&&typeof supaReq!=='undefined'){
      var _q='mov_cajas?notas=like.*'+encodeURIComponent((_mov.desc||'').replace(' (salida)','').replace(' (entrada)',''))+'*&monto_origen=eq.'+_mov.monto;
      supaReq('DELETE',_q).catch(function(e){console.warn('mov_cajas delete:',e);});
    }
  }
  // Delete from Supabase movimientos_ig — await before reload
  if(_supaOnline&&typeof supaReq!=='undefined'){
    var _delPromises=[supaReq('DELETE','movimientos_ig?id=eq.'+id)];
    if(_mov&&_mov.tipo==='Transferencia entre cuentas'){
      var _baseDsc=(_mov.desc||'').replace(' (salida)','').replace(' (entrada)','');
      // Delete paired entry by matching description and fecha
      _delPromises.push(supaReq('DELETE','movimientos_ig?descripcion=like.*'+encodeURIComponent(_baseDsc)+'*&fecha=eq.'+_mov.fecha+'&tipo=eq.Transferencia+entre+cuentas&id=neq.'+id));
    }
    Promise.all(_delPromises).then(function(){
      renderLibro();
      if(typeof renderCajas==='function') renderCajas();
    }).catch(function(e){
      console.warn('I/G delete error:',e);
      renderLibro();
    });
  } else {
    enqueue({method:'DELETE',path:'movimientos_ig?id=eq.'+id,body:null});
    renderLibro();
    if(typeof renderCajas==='function') renderCajas();
  }
}

// ── CAJAS ─────────────────────────────────────────────────
async function renderCajas(){
  var elGrid = document.getElementById('cajas-grid');
  if (elGrid) elGrid.innerHTML = '<div style="padding:20px;text-align:center;color:var(--color-text-tertiary)">⏳ Cargando cajas...</div>';

  // Always load fresh data from Supabase
  if (typeof loadCajasData === 'function') await loadCajasData();

  var isAdmin = typeof S!=='undefined'&&S.user&&USERS[S.user]&&USERS[S.user].rol==='admin';
  var userAlm = typeof S!=='undefined'&&S.user&&USERS[S.user]?USERS[S.user].almacen:'';
  var RATES_USD = {USD:1, EUR:1/RATES.EUR, CUP:1/RATES.CUP, CUPT:1/RATES.CUPT};

  // Build cajas list
  var cajas = [];
  if (typeof _cajasData !== 'undefined' && _cajasData.length) {
    cajas = _cajasData
      .filter(function(c){ return c.activa && (isAdmin || !userAlm || c.almacen === userAlm); })
      .map(function(c){
        // _getSaldoCaja sums saldo_inicial + mov_cajas (includes POS deposits)
        var saldo = typeof _getSaldoCaja==='function' ? _getSaldoCaja(c.nombre) : parseFloat(c.saldo_inicial||0);
        // Also add POS ventas that match this caja by name (for cases where mov_cajas wasn't written yet)
        var ventasEnCaja = (typeof VENTAS!=='undefined'?VENTAS:[])
          .filter(function(v){ return v.pagos && v.pagos.some(function(p){ return (p.caja||p.mon+' '+v.alm)===c.nombre; }); })
          .reduce(function(acc,v){
            (v.pagos||[]).forEach(function(p){
              if((p.caja||p.mon+' '+v.alm)===c.nombre){
                // Only add if not already in _cajasMovs (avoid double-count)
                var alreadyCounted = _cajasMovs.some(function(m){
                  return m.notas==='Venta POS' && m.caja_destino===c.nombre &&
                    Math.abs(parseFloat(m.monto_destino)-p.m)<0.01;
                });
                if(!alreadyCounted) acc += (p.m||0);
              }
            });
            return acc;
          }, 0);
        // Convert ventas en caja to caja moneda (pagos are already in the right currency)
        saldo += ventasEnCaja;
        return {
          cta: c.nombre, mon: c.moneda, almacen: c.almacen||'General',
          saldo: saldo, equivUSD: saldo*(RATES_USD[c.moneda]||1),
          saldo_inicial: parseFloat(c.saldo_inicial||0)
        };
      });
  } else {
    // Fallback: CUENTAS_BASE hardcoded (offline mode)
    cajas = Object.entries(CUENTAS_BASE).filter(function(e){
      return isAdmin||!userAlm||e[0].indexOf(userAlm)>=0;
    }).map(function(entry){
      var cta=entry[0], v=entry[1];
      var igIng=MOVS.filter(function(m){return m.cta===cta&&m.sentido==='ingreso';}).reduce(function(a,m){return a+m.monto;},0);
      var igGas=MOVS.filter(function(m){return m.cta===cta&&m.sentido==='gasto';}).reduce(function(a,m){return a+m.monto;},0);
      var saldo=(v.ingV||0)+(v.ingIG||0)+igIng-(v.gasIG||0)-igGas;
      return {cta:cta, mon:v.mon, almacen:cta.split(' ').slice(1).join(' ')||'General', saldo:saldo, equivUSD:saldo*(RATES_USD[v.mon]||1)};
    });
  }

  // Order almacenes
  var almOrder = ['Habana','Placetas','Xportprise','España','USA','General'];
  var almLabel = {};
  var byAlm = {};
  cajas.forEach(function(c){
    if(!byAlm[c.almacen]) byAlm[c.almacen]=[];
    byAlm[c.almacen].push(c);
  });

  var monIcon = {USD:'$',EUR:'€',CUP:'₱',CUPT:'\u20b1'};
  var totUSD = cajas.reduce(function(a,c){return a+c.equivUSD;},0);

  var html = '';
  // Header con totales y refresh
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">'
    + '<div>'
    + '<div style="font-size:12px;color:var(--color-text-secondary)">Saldos en tiempo real desde Supabase · ventas POS incluidas</div>'
    + '</div>'
    + '<button class="adm-btn" onclick="renderCajas()" style="font-size:11px;padding:5px 12px">🔄 Actualizar</button>'
    + '</div>';

  almOrder.concat(Object.keys(byAlm).filter(function(a){return almOrder.indexOf(a)<0;})).forEach(function(alm){
    if (!byAlm[alm] || !byAlm[alm].length) return;
    var almCajas = byAlm[alm];
    var almTot = almCajas.reduce(function(a,c){return a+c.equivUSD;},0);
    html += '<div style="margin-bottom:20px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:0 2px">'
      + '<div style="font-size:11px;font-weight:700;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:1px">'+(almLabel[alm]||alm)+'</div>'
      + '<div style="font-size:12px;color:var(--color-text-secondary)">Total: <b style="color:var(--color-text-primary)">'+fN(almTot,2)+' USD</b></div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">';
    almCajas.forEach(function(c){
      var pos = c.saldo >= 0;
      var icon = monIcon[c.mon]||'';
      var color = pos ? 'var(--color-text-success)' : 'var(--color-text-danger)';
      var dec = (c.mon==='CUP'||c.mon==='CUPT') ? 0 : 2;
      var _cf = (c.nombre||c.cta||'').toUpperCase();
      var _mp = (c.mon||'').toUpperCase()+' ';
      var _as = (alm||'').toUpperCase();
      var _cs = _cf.startsWith(_mp) ? _cf.slice(_mp.length) : _cf;
      if(_cs === _as) _cs = '';
      var _sl = _cs.length > 0 && _cs !== _as;
      html += '<div class="card" style="padding:14px 12px;text-align:center;border-color:'+(pos?'var(--color-border-tertiary)':'rgba(248,113,113,.3)')+'">'
        + '<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:4px;font-weight:600;letter-spacing:.05em">'+c.mon+(_sl?' · '+_cs:'')+'</div>'
        + '<div style="font-size:clamp(13px,3vw,20px);font-weight:800;color:'+color+';line-height:1.2;word-break:break-all">'+icon+' '+fN(c.saldo,dec)+'</div>'
        + '<div style="font-size:10px;color:var(--color-text-tertiary);margin-top:5px">≈ '+fN(c.equivUSD,2)+' USD</div>'
        + '</div>';
    });
    html += '</div></div>';
  });

  // Total general
  html += '<div style="border-top:1px solid var(--color-border-secondary);padding-top:14px;display:flex;justify-content:space-between;align-items:center;margin-top:4px">'
    + '<span style="font-size:13px;color:var(--color-text-secondary);font-weight:500">Total general</span>'
    + '<span style="font-size:22px;font-weight:800;color:var(--color-text-success)">'+fN(totUSD,2)+' USD</span>'
    + '</div>';

  if (elGrid) elGrid.innerHTML = html;

  // Render detail table
  var tbody = document.getElementById('cajas-table');
  var tfoot = document.getElementById('cajas-foot');
  if (tbody) {
    var totIngV=0,totIngIG=0,totGasIG=0,totSaldo=0,totEqUSD=0;
    tbody.innerHTML = cajas.map(function(c){
      // Count POS ventas into this caja
      var posIng = _cajasMovs.filter(function(m){
        return m.caja_destino===c.cta && m.notas==='Venta POS';
      }).reduce(function(a,m){return a+parseFloat(m.monto_destino||0);},0);
      var otherIng = _cajasMovs.filter(function(m){
        return m.caja_destino===c.cta && m.notas!=='Venta POS' && m.tipo!=='retiro';
      }).reduce(function(a,m){return a+parseFloat(m.monto_destino||0);},0);
      var gastos = _cajasMovs.filter(function(m){
        return m.caja_origen===c.cta;
      }).reduce(function(a,m){return a+parseFloat(m.monto_origen||0);},0);
      var dec = (c.mon==='CUP'||c.mon==='CUPT')?0:2;
      totIngV+=posIng; totIngIG+=otherIng; totGasIG+=gastos;
      totSaldo+=c.saldo; totEqUSD+=c.equivUSD;
      return '<tr>'
        +'<td style="font-weight:500">'+c.cta+'</td>'
        +'<td style="color:var(--color-text-success)">'+fN(posIng,dec)+'</td>'
        +'<td style="color:var(--color-text-info)">'+fN(otherIng,dec)+'</td>'
        +'<td style="color:var(--color-text-danger)">'+fN(gastos,dec)+'</td>'
        +'<td style="font-weight:600;color:'+(c.saldo>=0?'var(--color-text-success)':'var(--color-text-danger)')+'">'+fN(c.saldo,dec)+' '+c.mon+'</td>'
        +'<td style="color:var(--color-text-secondary)">'+fN(c.equivUSD,2)+' USD</td>'
        +'</tr>';
    }).join('');
    if (tfoot) tfoot.innerHTML = '<tr style="font-weight:700;border-top:1px solid var(--color-border-secondary)">'
      +'<td>TOTAL</td>'
      +'<td style="color:var(--color-text-success)">—</td>'
      +'<td>—</td><td>—</td>'
      +'<td>—</td>'
      +'<td style="color:var(--color-text-success);font-size:14px">'+fN(totEqUSD,2)+' USD</td>'
      +'</tr>';
  }

  var totEl = document.getElementById('cajas-total');
  if (totEl) totEl.innerHTML = '';
}

// ── DEUDAS ────────────────────────────────────────────────
function renderDeudas(){
  var el=document.getElementById('deudas-root');
  if(!el)return;
  // Migrate old cuota-based payments to pagos[] (backwards compat)
  PRESTAMOS.forEach(function(p){ _migrarPagosDeuda(p); });
  var totalPagar=0,totalCobrar=0;
  PRESTAMOS.forEach(function(p){
    var saldo=_saldoDeuda(p);
    var usd=p.moneda==='USD'?saldo:(typeof toUSD==='function'?toUSD(saldo,p.moneda):saldo/(RATES[p.moneda]||1));
    if(p.direccion==='nos_deben')totalCobrar+=usd; else totalPagar+=usd;
  });
  var _mostrarLiquidadas = localStorage.getItem('erp_mostrar_liquidadas') === 'true';
  var pagar=PRESTAMOS.filter(function(p){
    if(p.direccion==='nos_deben') return false;
    return _mostrarLiquidadas ? true : _saldoDeuda(p) > 0.001;
  });
  var cobrar=PRESTAMOS.filter(function(p){
    if(p.direccion!=='nos_deben') return false;
    return _mostrarLiquidadas ? true : _saldoDeuda(p) > 0.001;
  });
  var html='';
  // Header
  html+='<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">'
    +'<div style="font-size:15px;font-weight:600">📋 Deudas y Préstamos</div>'
    +'<div>'
    +'<button class="btn btn-sm" style="margin-right:8px;padding:6px 10px;font-size:12px;background:var(--color-background-tertiary);border:1px solid var(--color-border-secondary)" onclick="toggleDeudasLiquidadas()">'
    +(_mostrarLiquidadas?'👁 Ocultar liquidadas':'🙈 Ver liquidadas')+'</button>'
    +'<button class="btn btn-p" style="padding:6px 14px;font-size:13px" onclick="showNuevaDeuda()">+ Nueva</button>'
    +'</div></div>';
  // Metrics cards
  html+='<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px">'
    +'<div style="background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.25);border-radius:10px;padding:12px">'
    +'<div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:3px">📤 Por pagar (debemos)</div>'
    +'<div style="font-size:20px;font-weight:700;color:var(--color-text-danger)">'+fN(totalPagar)+' USD</div>'
    +'<div style="font-size:11px;color:var(--color-text-tertiary)">'+pagar.length+' activo'+(pagar.length!==1?'s':'')+'</div>'
    +'</div>'
    +'<div style="background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.25);border-radius:10px;padding:12px">'
    +'<div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:3px">📥 Por cobrar (nos deben)</div>'
    +'<div style="font-size:20px;font-weight:700;color:var(--color-text-success)">'+fN(totalCobrar)+' USD</div>'
    +'<div style="font-size:11px;color:var(--color-text-tertiary)">'+cobrar.length+' activo'+(cobrar.length!==1?'s':'')+'</div>'
    +'</div>'
    +'</div>';
  // ── Helper: group debts by nombre and render grouped ──
  function _groupByNombre(list){
    var groups={}, order=[];
    list.forEach(function(p){
      var key=p.nombre.trim();
      if(!groups[key]){groups[key]=[];order.push(key);}
      groups[key].push(p);
    });
    // Sort groups: most total USD first
    order.sort(function(a,b){
      var tA=groups[a].reduce(function(s,p){var sd=_saldoDeuda(p);return s+(p.moneda==='USD'?sd:(typeof toUSD==='function'?toUSD(sd,p.moneda):sd/(RATES[p.moneda]||1)));},0);
      var tB=groups[b].reduce(function(s,p){var sd=_saldoDeuda(p);return s+(p.moneda==='USD'?sd:(typeof toUSD==='function'?toUSD(sd,p.moneda):sd/(RATES[p.moneda]||1)));},0);
      return tB-tA;
    });
    return {groups:groups,order:order};
  }
  function _renderGroup(nombre, items, accentRgb){
    var isSingle = items.length === 1;
    // Total per currency
    var byCurr={};
    items.forEach(function(p){
      var sd=_saldoDeuda(p); var m=p.moneda||'USD';
      if(!byCurr[m]) byCurr[m]=0; byCurr[m]+=sd;
    });
    var totalUSD=items.reduce(function(s,p){
      var sd=_saldoDeuda(p);
      return s+(p.moneda==='USD'?sd:(typeof toUSD==='function'?toUSD(sd,p.moneda):sd/(RATES[p.moneda]||1)));
    },0);
    var allLiquidada=items.every(function(p){return _saldoDeuda(p)<=0.005;});
    var currParts=Object.keys(byCurr).map(function(m){return fN(byCurr[m],m==='CUP'||m==='CUPT'?0:2)+' '+m;});
    var gid='dg-'+nombre.replace(/[^a-zA-Z0-9]/g,'_');
    var collapsed = isSingle ? '' : ' dg-collapsed';
    var chevron = isSingle ? '' : '<span class="dg-chev" style="font-size:10px;transition:transform .2s;margin-left:4px">▼</span>';
    var g='<div class="deuda-group'+collapsed+'" data-gid="'+gid+'" style="margin-bottom:8px">'
      +'<div class="dg-header" style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;border-radius:8px;background:rgba('+accentRgb+','+(allLiquidada?'.04':'.08')+');'+(isSingle?'':'cursor:pointer;')+'">'
      +'<div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1">'
      +'<div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+nombre+'</div>'
      +(items.length>1?'<span style="font-size:10px;background:rgba('+accentRgb+',.2);padding:1px 7px;border-radius:10px;font-weight:600;white-space:nowrap">'+items.length+' deudas</span>':'')
      +(allLiquidada?'<span style="font-size:10px;background:rgba(74,222,128,.15);color:var(--color-text-success);padding:1px 6px;border-radius:4px;font-weight:500">✓</span>':'')
      +chevron
      +'</div>'
      +'<div style="text-align:right;flex-shrink:0">'
      +'<div style="font-size:13px;font-weight:700;color:rgb('+accentRgb+')">'+fN(totalUSD,2)+' USD</div>'
      +(Object.keys(byCurr).length>1||!byCurr['USD']?'<div style="font-size:10px;color:var(--color-text-tertiary)">'+currParts.join(' + ')+'</div>':'')
      +'</div>'
      +'</div>'
      +'<div class="dg-body" style="'+(isSingle?'':'display:none;')+'padding-top:'+(isSingle?'6':'0')+'px">';
    items.forEach(function(p){g+=_renderDeudaCard(p);});
    g+='</div></div>';
    return g;
  }

  // Two columns (Responsive flex-wrap)
  html+='<div class="deudas-cols" style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px">';
  // Por pagar
  html+='<div style="flex:1 1 300px;min-width:0">'
    +'<div style="font-size:11px;font-weight:700;color:var(--color-text-danger);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid rgba(248,113,113,.2);padding-bottom:6px">📤 Por pagar</div>';
  if(pagar.length){
    var gP=_groupByNombre(pagar);
    gP.order.forEach(function(n){html+=_renderGroup(n,gP.groups[n],'248,113,113');});
  } else html+='<div style="color:var(--color-text-success);font-size:12px;padding:20px 0;text-align:center">Sin deudas pendientes ✓</div>';
  html+='</div>';
  // Por cobrar
  html+='<div style="flex:1 1 300px;min-width:0">'
    +'<div style="font-size:11px;font-weight:700;color:var(--color-text-success);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid rgba(74,222,128,.2);padding-bottom:6px">📥 Por cobrar</div>';
  if(cobrar.length){
    var gC=_groupByNombre(cobrar);
    gC.order.forEach(function(n){html+=_renderGroup(n,gC.groups[n],'74,222,128');});
  } else html+='<div style="color:var(--color-text-tertiary);font-size:12px;padding:20px 0;text-align:center">Sin cobros pendientes</div>';
  html+='</div>';
  html+='</div>';
  // Historial
  var hist=MOVS.filter(function(m){return m.tipo==='Amortización deuda'||m.tipo==='Cobro préstamo'||m.tipo==='Pago cuota';});
  html+='<div style="border-top:1px solid var(--color-border-tertiary);padding-top:12px">'
    +'<div style="font-size:11px;font-weight:700;color:var(--color-text-secondary);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">Historial de pagos/cobros</div>';
  if(hist.length){
    html+=hist.sort(function(a,b){return(b.fecha||'').localeCompare(a.fecha||'');}).slice(0,30).map(function(m){
      var esG=m.sentido==='gasto';
      return '<div class="mov-row"><div class="mov-main"><div class="mov-desc">'+m.desc+'</div>'
        +'<div class="mov-meta">'+fD(m.fecha)+(m.cta?' · '+m.cta:'')+' · '+m.tipo+'</div></div>'
        +'<div class="mov-amt"><div class="mov-amt-main" style="color:var(--color-text-'+(esG?'danger':'success')+')">'
        +(esG?'−':'+')+fN(m.monto,m.mon==='CUP'?0:2)+' '+m.mon+'</div>'
        +(m.mon!=='USD'&&m.equivUSD?'<div class="mov-amt-sub">≈ '+fN(m.equivUSD)+' USD</div>':'')
        +'</div></div>';
    }).join('');
  } else {
    html+='<div style="color:var(--color-text-tertiary);font-size:12px;padding:16px 0;text-align:center">Sin movimientos registrados</div>';
  }
  html+='</div>';
  el.innerHTML=html;
  // ── Attach click handlers for collapsible groups ──
  el.querySelectorAll('.dg-header').forEach(function(hdr){
    var grp = hdr.parentNode;
    if(!grp || !grp.classList.contains('deuda-group')) return;
    if(!grp.classList.contains('dg-collapsed') && grp.querySelectorAll('.dg-body > *').length <= 1) return; // single item, no toggle
    hdr.addEventListener('click', function(){
      var body = grp.querySelector('.dg-body');
      var chev = grp.querySelector('.dg-chev');
      if(!body) return;
      var isCollapsed = grp.classList.contains('dg-collapsed');
      if(isCollapsed){
        grp.classList.remove('dg-collapsed');
        body.style.display='block';
        body.style.paddingTop='6px';
        if(chev) chev.style.transform='rotate(0deg)';
      } else {
        grp.classList.add('dg-collapsed');
        body.style.display='none';
        body.style.paddingTop='0';
        if(chev) chev.style.transform='rotate(-90deg)';
      }
    });
  });
}

// ── HELPERS ──────────────────────────────────────────
function _totalDeuda(p){
  if(p.tipo==='interes_simple' || p.tipo==='revolving') return p.capitalOriginal||p.capital;
  if(p.tipo==='frances') return p.cuotas.reduce(function(a,c){return a+c.total;},0);
  return p.capital;
}
function _pagadoDeuda(p){
  if(p.tipo==='interes_simple' || p.tipo==='revolving') return Math.max(0,(p.capitalOriginal||p.capital)-p.capital);
  if(p.tipo==='frances') return (p.pagos||[]).reduce(function(a,pg){return a+(pg.montoDeuda!=null?pg.montoDeuda:pg.monto);},0);
  return (p.pagos||[]).reduce(function(a,pg){return a+(pg.montoDeuda!=null?pg.montoDeuda:pg.monto);},0);
}
function _saldoDeuda(p){
  if(p.tipo==='interes_simple' || p.tipo==='revolving') return Math.max(0,p.capital);
  return Math.max(0,_totalDeuda(p)-_pagadoDeuda(p));
}
function _interesesPagadosDeuda(p){
  return (p.pagos||[]).filter(function(pg){return pg.tipoPago==='interes' || pg.tipoPago==='cuota_revolving';})
    .reduce(function(a,pg){
      if(pg.tipoPago==='cuota_revolving' && pg._intAsignado != null) return a + pg._intAsignado;
      return a + (pg.montoDeuda!=null?pg.montoDeuda:pg.monto);
    },0);
}
function _migrarPagosDeuda(p){
  if(!p.pagos)p.pagos=[];
  if(p.tipo==='frances'){
    var acum=_pagadoDeuda(p);
    var corriendo=0;
    p.cuotas.forEach(function(c){
      corriendo+=c.total;
      if(c.pagada&&c.fechaPago){
        var ya=p.pagos.some(function(pg){return pg._cuotaNum===c.num;});
        if(!ya && corriendo > acum + 0.001) {
          var faltante = Math.min(c.total, corriendo - acum);
          p.pagos.push({id:'pg-mig-'+p.id+'-'+c.num,fecha:c.fechaPago,hora:'',
            monto:faltante,mon:p.moneda,nota:'Cuota '+c.num+'/'+p.cuotas.length,
            caja:p.cta||'',movId:null,_cuotaNum:c.num});
          acum += faltante;
        }
      }
    });
  }
}

function _renderDeudaCard(p){
  _migrarPagosDeuda(p);
  var esIS=(p.tipo==='interes_simple' || p.tipo==='revolving');
  var totalD=_totalDeuda(p);
  var pagadoD=_pagadoDeuda(p);
  var saldoD=_saldoDeuda(p);
  var intPagados=_interesesPagadosDeuda(p);
  var intMensual=esIS?parseFloat((p.capital*(p.tasa||0)/100).toFixed(2)):0;
  var pct=totalD?Math.min(100,Math.round(pagadoD/totalD*100)):0;
  var proxima=p.cuotas.find(function(c){return !c.pagada;});
  var vencidas=p.cuotas.filter(function(c){return !c.pagada&&c.fecha&&c.fecha<today();}).length;
  var tipoLabel={simple:'Deuda simple',interes_simple:'Solo intereses (bullet)',revolving:'Línea de Crédito / Tarjeta Revolving',frances:'Cuota fija (francés)'}[p.tipo]||p.tipo;
  var esDeuda=p.direccion!=='nos_deben';
  var ac=esDeuda?'248,113,113':'74,222,128';
  var tc=esDeuda?'var(--color-text-danger)':'var(--color-text-success)';
  var liquidada=saldoD<=0.005;
  var h='<div style="border:1px solid rgba('+ac+','+(liquidada?'.15':'.25')+');border-radius:10px;padding:13px;margin-bottom:10px;background:var(--color-background-secondary);'+(liquidada?'opacity:.7':'')+';">';

  // ── Header ──
  h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:9px">'
    +'<div style="flex:1;min-width:0">'
    +'<div style="font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px">'
    +p.nombre
    +(liquidada?'<span style="font-size:10px;background:rgba(74,222,128,.15);color:var(--color-text-success);padding:2px 6px;border-radius:4px;font-weight:500">✓ Liquidada</span>':'')
    +'</div>'
    +'<div style="font-size:11px;color:var(--color-text-secondary);margin-top:2px">'
    +tipoLabel+(p.tasa && p.tipo!=='simple'?' · '+p.tasa+'%/mes':'')
    +(esIS?'':' · <span title="Capital sin intereses">'+fN(p.capital,2)+' '+p.moneda+'</span>')
    +(p.cta?' · <span style="color:var(--color-text-tertiary)">'+p.cta+'</span>':'')
    +(p.notas?' · <em>'+p.notas+'</em>':'')
    +'</div></div>'
    +'<div style="text-align:right;margin-left:8px">'
    +'<div style="font-size:10px;color:var(--color-text-tertiary)">Capital pendiente</div>'
    +'<div style="font-size:16px;font-weight:700;color:'+tc+'">'+fN(saldoD,2)+' '+p.moneda+'</div>'
    +(vencidas&&!esIS?'<div style="font-size:10px;color:var(--color-text-danger)">⚠ '+vencidas+' vencida'+(vencidas>1?'s':'')+'</div>':'')
    +'</div></div>';

  // ── Bullet loan: 3-stat grid ──
  if(esIS){
    h+='<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">'
      +'<div style="flex:1 1 30%;min-width:75px;background:rgba(100,149,237,.1);border-radius:7px;padding:8px;text-align:center">'
      +'<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:2px">Interés mensual</div>'
      +'<div style="font-size:13px;font-weight:700;color:#8ab4f8">'+fN(intMensual,2)+'</div>'
      +'<div style="font-size:9px;color:var(--color-text-tertiary)">'+p.moneda+'/mes</div>'
      +'</div>'
      +'<div style="flex:1 1 30%;min-width:75px;background:rgba('+ac+',.08);border-radius:7px;padding:8px;text-align:center">'
      +'<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:2px">Amortizado</div>'
      +'<div style="font-size:13px;font-weight:700;color:var(--color-text-success)">'+fN(pagadoD,2)+'</div>'
      +'<div style="font-size:9px;color:var(--color-text-tertiary)">'+p.moneda+'</div>'
      +'</div>'
      +'<div style="flex:1 1 30%;min-width:75px;background:rgba('+ac+',.08);border-radius:7px;padding:8px;text-align:center">'
      +'<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:2px">Interés pagado</div>'
      +'<div style="font-size:13px;font-weight:700;color:var(--color-text-secondary)">'+fN(intPagados,2)+'</div>'
      +'<div style="font-size:9px;color:var(--color-text-tertiary)">'+p.moneda+'</div>'
      +'</div>'
      +'</div>';
    if(pagadoD>0){
      h+='<div style="background:var(--color-background-primary);border-radius:4px;height:5px;margin-bottom:3px">'
        +'<div style="background:rgba('+ac+',1);height:5px;border-radius:4px;width:'+pct+'%;transition:width .4s"></div></div>'
        +'<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:10px;text-align:center">Capital original: '+fN(p.capitalOriginal||p.capital,2)+' '+p.moneda+' · Amortizado: '+pct+'%</div>';
    }
  } else {
    // ── Regular progress bar ──
    h+='<div style="background:var(--color-background-primary);border-radius:4px;height:6px;margin-bottom:4px">'
      +'<div style="background:rgba('+ac+',1);height:6px;border-radius:4px;width:'+pct+'%;transition:width .4s"></div></div>'
      +'<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--color-text-tertiary);margin-bottom:10px">'
      +'<span>Pagado: '+fN(pagadoD,2)+' '+p.moneda+'</span>'
      +'<span>Total: '+fN(totalD,2)+' '+p.moneda+' ('+pct+'%)</span>'
      +'</div>';
  }

  // ── Pagar buttons ──
  if(!liquidada){
    var sugMonto=proxima?proxima.total:saldoD;
    if(p.tipo==='interes_simple' || p.tipo==='revolving'){
      var sugerInt=parseFloat((p.capital*(p.tasa||0)/100).toFixed(2));
      var isCuotaRev = (p.tipo==='revolving' && p.cuotaFija>0);
      var sugerMonto = isCuotaRev ? p.cuotaFija : sugerInt;
      var lblBtn = isCuotaRev ? '💳 Pagar cuota' : '💳 Pagar intereses';
      var tpBtn = isCuotaRev ? 'cuota_revolving' : 'interes';
      var hintBtn = isCuotaRev ? fN(p.cuotaFija,2)+' '+p.moneda+'/mes' : fN(sugerInt,2)+' '+p.moneda+'/mes';
      h+='<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">'
        +'<button onclick="abrirPagoModal(\''+p.id+'\','+sugerMonto+',\''+tpBtn+'\')" style="flex:1 1 45%;min-width:120px;padding:8px;border-radius:8px;border:1px solid rgba(100,149,237,.4);background:rgba(100,149,237,.1);color:#8ab4f8;font-size:11px;font-weight:600;cursor:pointer;line-height:1.4">'
        +lblBtn+'<br><span style="font-size:10px;font-weight:400;opacity:.8">'+hintBtn+'</span></button>'
        +'<button onclick="abrirPagoModal(\''+p.id+'\',0,\'amortizacion\')" style="flex:1 1 45%;min-width:120px;padding:8px;border-radius:8px;border:1px solid rgba('+ac+',.4);background:rgba('+ac+',.1);color:'+tc+';font-size:11px;font-weight:600;cursor:pointer;line-height:1.4">'
        +(esDeuda?'🔽 Amortizar capital':'🔽 Cobrar capital')
        +'<br><span style="font-size:10px;font-weight:400;opacity:.8">Reduce el saldo</span></button>'
        +'</div>'
        +'<div style="margin-bottom:10px">'
        +'<button onclick="abrirPagoModal(\''+p.id+'\',0,\'incremento\')" style="width:100%;padding:6px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:transparent;color:var(--color-text-tertiary);font-size:10px;cursor:pointer">'
        +(esDeuda?'🔼 Nueva disposición (incrementar capital)':'🔼 Conceder más crédito (incrementar capital)')
        +'</button></div>';
    } else {
      h+='<div style="margin-bottom:10px">'
        +'<button onclick="abrirPagoModal(\''+p.id+'\','+sugMonto+',\'pago\')" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba('+ac+',.4);background:rgba('+ac+',.1);color:'+tc+';font-size:12px;font-weight:600;cursor:pointer">'
        +(esDeuda?'💸 Registrar pago':'💰 Registrar cobro')
        +(proxima&&p.tipo!=='simple'?' — Próxima cuota: '+fN(proxima.total,2)+' '+p.moneda:'')
        +'</button></div>';
    }
  }

  // ── Historial de pagos ──
  var pagos=p.pagos||[];
  var necesitaGuardarId = false;
  if(pagos.length){
    pagos.forEach(function(pg, i){ if(!pg.id){ pg.id='pg-'+Date.now()+'-'+i; necesitaGuardarId=true; } });
    if(necesitaGuardarId && typeof savePrestamos==='function') savePrestamos(p);
    h+='<details open><summary style="cursor:pointer;font-size:11px;font-weight:600;color:var(--color-text-secondary);margin-bottom:6px;list-style:none;display:flex;justify-content:space-between">'
      +'<span>📋 Historial de pagos ('+pagos.length+')</span>'
      +'<span style="font-size:10px;font-weight:400;color:var(--color-text-tertiary)">clic para plegar</span>'
      +'</summary>'
      +'<div style="border:1px solid var(--color-border-tertiary);border-radius:6px;overflow:hidden;margin-bottom:8px">';
    pagos.slice().sort(function(a,b){var c=((b.fecha||'')+(b.hora||'')).localeCompare((a.fecha||'')+(a.hora||'')); return c!==0?c:(b.id||'').localeCompare(a.id||'');}).forEach(function(pg,i){
      var esPar=i%2===0;
      var htmlMontoDeuda = '';
      if (pg.mon !== p.moneda && pg.montoDeuda != null) {
        htmlMontoDeuda = '<span style="font-size:10px;font-weight:400;color:var(--color-text-warning);margin-left:6px">(Amortiza '+fN(pg.montoDeuda,2)+' '+p.moneda+')</span>';
      }
      h+='<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;'+(esPar?'':'background:rgba(255,255,255,.02)')+';border-bottom:1px solid var(--color-border-tertiary)">'
        +'<div style="flex:1;min-width:0">'
        +'<div style="font-size:11px;font-weight:500">'+fN(pg.monto,2)+' '+pg.mon+htmlMontoDeuda+'</div>'
        +'<div style="font-size:10px;color:var(--color-text-tertiary)">'
        +(pg.fecha?fD(pg.fecha):'—')+(pg.hora?' '+pg.hora:'')
        +(pg.user?' · 👤 '+(pg.user==='—'?'Admin':pg.user):'')
        +(pg.caja?' · '+pg.caja:'')
        +(pg.nota?' · <em>'+pg.nota+'</em>':'')
        +(pg._cuotaNum?'<span style="margin-left:4px;opacity:.5">[migrado]</span>':'')
        +'</div></div>'
        +'<button onclick="abrirEditarPagoModal(\''+p.id+'\',\''+pg.id+'\')" title="Editar pago" style="background:none;border:none;cursor:pointer;font-size:14px;color:var(--color-text-tertiary);padding:2px 5px">✏️</button>'
        +'<button onclick="eliminarPago(\''+p.id+'\',\''+pg.id+'\')" title="Eliminar pago" style="background:none;border:none;cursor:pointer;font-size:14px;color:var(--color-text-danger);padding:2px 5px">×</button>'
        +'</div>';
    });
    h+='</div></details>';
  } else {
    h+='<div style="font-size:11px;color:var(--color-text-tertiary);text-align:center;padding:8px 0;margin-bottom:8px">Sin pagos registrados</div>';
  }

  // ── Cuadro de amortización (referencia) ──
  if(p.cuotas.length>0){
    h+='<details style="font-size:11px"><summary style="cursor:pointer;color:var(--color-text-secondary)">📅 Cuadro de amortización (referencia)</summary>'
      +'<div style="overflow-x:auto;margin-top:6px"><table class="adm-table"><thead><tr>'
      +'<th>#</th><th>Vence</th>'
      +(p.tipo!=='simple'?'<th style="text-align:right">Capital</th><th style="text-align:right">Interés</th>':'')
      +'<th style="text-align:right">Total</th>'
      +'</tr></thead><tbody>'
      +p.cuotas.map(function(c){
        var esPagada=p.pagos&&p.pagos.some(function(pg){return pg._cuotaNum===c.num;});
        var venc=!esPagada&&c.fecha&&c.fecha<today();
        return '<tr style="'+(esPagada?'opacity:.4':venc?'background:rgba(248,113,113,.07)':'')+'">'
          +'<td>'+(esPagada?'<span style="color:var(--color-text-success)">✓</span> ':'')+c.num+'</td>'
          +'<td>'+(c.fecha?fD(c.fecha):'—')+'</td>'
          +(p.tipo!=='simple'?'<td style="text-align:right">'+fN(c.capital,2)+'</td><td style="text-align:right">'+fN(c.interes,2)+'</td>':'')
          +'<td style="text-align:right;font-weight:500">'+fN(c.total,2)+'</td>'
          +'</tr>';
      }).join('')
      +'</tbody></table></div></details>';
  }

  // ── Registro de auditoría (Inborrable) ──
  if (p.auditLog && p.auditLog.length > 0) {
    h+='<details><summary style="cursor:pointer;font-size:10px;font-weight:600;color:var(--color-text-tertiary);margin-top:12px;list-style:none;display:flex;justify-content:space-between">'
      +'<span>🛡️ Registro de auditoría (Inborrable)</span>'
      +'<span style="font-size:10px;font-weight:400">clic para expandir</span>'
      +'</summary>'
      +'<div style="border:1px solid var(--color-border-tertiary);border-radius:6px;overflow:hidden;margin-top:8px;background:rgba(0,0,0,0.1)">';
    p.auditLog.slice().reverse().forEach(function(log,i){
      var esPar=i%2===0;
      h+='<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;'+(esPar?'':'background:rgba(255,255,255,.02)')+';border-bottom:1px solid var(--color-border-tertiary)">'
        +'<div style="flex:1;min-width:0">'
        +'<div style="font-size:10px;font-weight:500;color:var(--color-text-secondary)">'+log.action+'</div>'
        +'<div style="font-size:9px;color:var(--color-text-tertiary)">'
        +(log.fecha?fD(log.fecha):'')+' '+(log.hora||'')+' · 👤 '+(log.user||'Admin')
        +'</div></div></div>';
    });
    h+='</div></details>';
  }
  // ── Actions ──
  h+='<div style="display:flex;gap:5px;margin-top:10px;justify-content:flex-end">'
    +'<button class="adm-btn-sm" onclick="showEditarDeudaModal(\''+p.id+'\')" style="font-size:10px">✏️ Editar</button>'
    +(liquidada?'':'<button class="adm-btn-sm" onclick="liquidarDeuda_p(\''+p.id+'\')" style="color:var(--color-text-success);font-size:10px">✓ Liquidar todo</button>')
    +'<button class="adm-btn-sm" onclick="eliminarPrestamo(\''+p.id+'\')" style="color:var(--color-text-danger);font-size:10px">🗑 Eliminar</button>'
    +'</div>';
  h+='</div>';
  return h;
}

// ── MODAL: REGISTRAR PAGO ─────────────────────────────
function abrirPagoModal(prestamoId, sugMonto, tipoPago){
  var p=PRESTAMOS.find(function(x){return x.id===prestamoId;});
  if(!p)return;
  tipoPago=tipoPago||'pago';
  var mo=document.getElementById('pago-deuda-modal');
  if(!mo){
    mo=document.createElement('div');
    mo.id='pago-deuda-modal';
    mo.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
    document.body.appendChild(mo);
  }
  var esDeuda=p.direccion!=='nos_deben';
  var cajas=typeof getAllCajas==='function'?getAllCajas():(typeof _getCajaNombres==='function'?_getCajaNombres():[]);
  var saldo=_saldoDeuda(p);
  var sugerMonto=(sugMonto!=null&&sugMonto>0)?sugMonto:saldo;
  var titulo='',bannerHtml='';
  if(tipoPago==='interes'){
    titulo='💳 Pago de intereses';
    bannerHtml='<div style="font-size:11px;background:rgba(100,149,237,.1);border:1px solid rgba(100,149,237,.25);border-radius:7px;padding:8px;margin-bottom:12px">El capital <strong>no cambia</strong> — solo se registran los intereses del período.</div>';
  } else if(tipoPago==='cuota_revolving'){
    titulo='💳 Pago de cuota fija (Revolving)';
    var intMes=parseFloat((p.capital*(p.tasa||0)/100).toFixed(2));
    bannerHtml='<div style="font-size:11px;background:rgba(100,149,237,.1);border:1px solid rgba(100,149,237,.25);border-radius:7px;padding:8px;margin-bottom:12px">Del monto total, <strong>'+fN(intMes,2)+' '+p.moneda+'</strong> cubrirán los intereses y el resto amortizará el capital.</div>';
  } else if(tipoPago==='amortizacion'){
    titulo='🔽 Amortización de capital';
    bannerHtml='<div style="font-size:11px;background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.2);border-radius:7px;padding:8px;margin-bottom:12px">Este pago <strong>reduce el capital</strong> pendiente y regenera el cuadro de amortización.</div>';
    sugerMonto=sugMonto||saldo;
  } else if(tipoPago==='incremento'){
    titulo='🔼 Nueva disposición de capital';
    bannerHtml='<div style="font-size:11px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.2);border-radius:7px;padding:8px;margin-bottom:12px"><strong>Aumenta el capital</strong> de la deuda y regenera el cuadro. El saldo pendiente se incrementará.</div>';
    sugerMonto=0;
  } else {
    titulo=esDeuda?'💸 Registrar pago':'💰 Registrar cobro';
    bannerHtml='';
  }
  mo.innerHTML='<div style="max-width:420px;width:100%;background:var(--color-background-primary);border-radius:14px;padding:22px 20px;box-shadow:0 20px 60px rgba(0,0,0,.7);position:relative">'
    +'<button type="button" onclick="document.getElementById(\'pago-deuda-modal\').style.display=\'none\'" style="position:absolute;top:10px;right:12px;background:none;border:none;cursor:pointer;font-size:22px;color:var(--color-text-secondary)">×</button>'
    +'<div style="font-size:14px;font-weight:600;margin-bottom:4px">'+titulo+'</div>'
    +'<div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:12px">'+p.nombre
    +(tipoPago!=='incremento'?' · Saldo: <strong>'+fN(saldo,2)+' '+p.moneda+'</strong>':'')
    +((tipoPago==='interes'||tipoPago==='cuota_revolving')?' · Capital: <strong>'+fN(p.capital,2)+' '+p.moneda+'</strong>':'')
    +'</div>'
    +bannerHtml
    +'<input type="hidden" id="pm-tipo" value="'+tipoPago+'">'
    +'<div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-bottom:4px">'
    +'<div><label class="lbl">Monto *</label><input class="adm-inp" type="number" id="pm-monto" data-target="'+sugerMonto+'" value="'+(sugerMonto>0?sugerMonto.toFixed(2):'')+'" placeholder="0.00" step="0.01" min="0.01" oninput="updPmEquiv(\''+prestamoId+'\')"></div>'
    +'<div><label class="lbl">Moneda</label><select class="adm-inp" id="pm-mon" onchange="updPmEquiv(\''+prestamoId+'\', false, true)">'
    +['USD','EUR','CUP','CUPT'].map(function(m){return '<option'+(m===p.moneda?' selected':'')+'>'+m+'</option>';}).join('')+'</select></div>'
    +'</div>'
    +'<div id="pm-tasa-wrap" style="display:none;margin-bottom:4px"><label class="lbl">Tasa aplicada (<span id="pm-tasa-hint"></span>)</label><input class="adm-inp" type="number" id="pm-tasa" step="0.0001" oninput="updPmEquiv(\''+prestamoId+'\', true)"></div>'
    +'<div id="pm-equiv-wrap" style="display:none;align-items:center;font-size:12px;color:var(--color-text-warning);margin-bottom:10px;height:26px">'
    +'<span>≈ Reduce la deuda en: </span>'
    +'<input class="adm-inp" type="number" id="pm-equiv-monto" style="width:100px;height:26px;padding:2px 8px;margin:0 6px;font-size:13px;font-weight:600;color:var(--color-text-warning);background:rgba(255,255,255,0.05)" step="0.01" min="0.01" oninput="updPmEquivInv(\''+prestamoId+'\')">'
    +'<strong id="pm-equiv-mon">'+p.moneda+'</strong>'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
    +'<div><label class="lbl">Fecha</label><input class="adm-inp" type="date" id="pm-fecha" value="'+today()+'"></div>'
    +'<div><label class="lbl">Caja</label><select class="adm-inp" id="pm-caja"><option value="">Sin caja</option>'
    +cajas.map(function(k){return '<option'+(k===(p.cta||'')?' selected':'')+'>'+k+'</option>';}).join('')+'</select></div>'
    +'</div>'
    +'<div style="margin-bottom:14px"><label class="lbl">Nota (opcional)</label>'
    +'<input class="adm-inp" id="pm-nota" placeholder="Ej: Interés mayo, abono capital..."></div>'
    +'<div style="display:flex;gap:8px">'
    +'<button type="button" class="btn btn-p" onclick="registrarPagoDeuda(\''+prestamoId+'\')" style="flex:1">Registrar</button>'
    +'<button type="button" class="btn" onclick="document.getElementById(\'pago-deuda-modal\').style.display=\'none\'">Cancelar</button>'
    +'</div></div>';
  mo.style.display='flex';
  updPmEquiv(prestamoId);
  setTimeout(function(){document.getElementById('pm-monto')&&document.getElementById('pm-monto').focus();},80);
}

function updPmEquiv(pid, isManual, isMonChange) {
  var p=PRESTAMOS.find(function(x){return x.id===pid;});
  if(!p)return;
  var monto=parseFloat(document.getElementById('pm-monto')?.value)||0;
  var mon=document.getElementById('pm-mon')?.value||p.moneda;
  
  var cSel = document.getElementById('pm-caja');
  if(cSel && !isManual) {
    var currCaja = cSel.value;
    var cajas = typeof getAllCajas==='function'?getAllCajas():[];
    var opts = '<option value="">Sin caja</option>';
    cajas.forEach(function(k){
      if(typeof _getMonedaFromCaja==='function'){
        var mCaja = _getMonedaFromCaja(k);
        if(mCaja && mCaja !== mon) return;
      }
      opts += '<option'+(k===currCaja?' selected':'')+'>'+k+'</option>';
    });
    cSel.innerHTML = opts;
  }

  var eqEl=document.getElementById('pm-equiv');
  var tw=document.getElementById('pm-tasa-wrap');
  var ta=document.getElementById('pm-tasa');
  var th=document.getElementById('pm-tasa-hint');

  if(mon===p.moneda) {
    var eqWrap = document.getElementById('pm-equiv-wrap');
    if(eqWrap) eqWrap.style.display='none';
    if(tw) tw.style.display='none';
  } else {
    if(tw) tw.style.display='';
    var _peso = {EUR:5, USD:4, MLC:3, CUP:2, CUPT:1};
    var esInverso = (_peso[mon]||0) > (_peso[p.moneda]||0);
    var baseMon = esInverso ? mon : p.moneda;
    var targetMon = esInverso ? p.moneda : mon;
    
    var almToUse = null;
    var cSel = document.getElementById('pm-caja');
    var currCaja = cSel ? cSel.value : '';
    if(currCaja && typeof _cajasData !== 'undefined') {
      var cObj = _cajasData.find(function(c){return c.nombre===currCaja;});
      if(cObj) almToUse = cObj.almacen;
    }
    if(!almToUse && p.cta && typeof _cajasData !== 'undefined') {
      var pObj = _cajasData.find(function(c){return c.nombre===p.cta;});
      if(pObj) almToUse = pObj.almacen;
    }

    var defaultTasa = 1;
    if(typeof toUSD==='function' && typeof fromUSD==='function') {
      var usdEq = toUSD(1, baseMon, almToUse);
      defaultTasa = fromUSD(usdEq, targetMon, almToUse);
    } else {
      defaultTasa = (RATES[targetMon]||1) / (RATES[baseMon]||1);
    }

    if(!isManual || !ta.value) {
      if(ta) ta.value = parseFloat(defaultTasa.toFixed(6));
    }
    var actTasa = parseFloat(ta?.value)||defaultTasa;
    if(th) th.textContent = '1 '+baseMon+' = '+actTasa+' '+targetMon;
    
    var inputMonto = document.getElementById('pm-monto');
    if(isMonChange && inputMonto) {
       var target = parseFloat(inputMonto.getAttribute('data-target'))||0;
       if(target>0) {
          monto = esInverso ? (target / actTasa) : (target * actTasa);
          inputMonto.value = parseFloat(monto.toFixed(2));
       }
    }

    var eqWrap = document.getElementById('pm-equiv-wrap');
    var eqInput = document.getElementById('pm-equiv-monto');
    var montoDeuda = esInverso ? (monto * actTasa) : (monto / actTasa);
    if(eqWrap) eqWrap.style.display='flex';
    if(eqInput && document.activeElement !== eqInput) {
      eqInput.value = montoDeuda ? parseFloat(montoDeuda.toFixed(2)) : '';
    }
  }
}

function updPmEquivInv(pid) {
  var p=PRESTAMOS.find(function(x){return x.id===pid;});
  if(!p)return;
  var equivInput = document.getElementById('pm-equiv-monto');
  var montoDeuda = parseFloat(equivInput?.value)||0;
  var mon = document.getElementById('pm-mon')?.value||p.moneda;
  if(mon === p.moneda) return;
  
  var actTasaStr = document.getElementById('pm-tasa')?.value || '';
  var actTasa = parseFloat(actTasaStr.replace(/,/g, '.'));
  if(!actTasa) return;
  
  var _peso = {EUR:5, USD:4, MLC:3, CUP:2, CUPT:1};
  var esInverso = (_peso[mon]||0) > (_peso[p.moneda]||0);
  
  var monto = esInverso ? (montoDeuda / actTasa) : (montoDeuda * actTasa);
  var inputMonto = document.getElementById('pm-monto');
  if(inputMonto) {
    inputMonto.value = monto ? parseFloat(monto.toFixed(2)) : '';
  }
}

function registrarPagoDeuda(prestamoId){
  var p=PRESTAMOS.find(function(x){return x.id===prestamoId;});
  if(!p)return;
  var monto=parseFloat(document.getElementById('pm-monto')?.value)||0;
  if(monto<=0){showToast('El monto debe ser mayor que 0');return;}
  var mon=document.getElementById('pm-mon')?.value||p.moneda;
  
  var montoDeuda = monto;
  if(mon !== p.moneda) {
    var actTasaStr = document.getElementById('pm-tasa')?.value || '';
    var actTasa = parseFloat(actTasaStr.replace(/,/g, '.'));
    if(actTasa) {
      var _peso = {EUR:5, USD:4, MLC:3, CUP:2, CUPT:1};
      var esInverso = (_peso[mon]||0) > (_peso[p.moneda]||0);
      montoDeuda = esInverso ? (monto * actTasa) : (monto / actTasa);
    } else {
      var almToUse = null;
      var cajaStr = document.getElementById('pm-caja')?.value || p.cta || '';
      if(cajaStr && typeof _cajasData !== 'undefined') {
        var cObj = _cajasData.find(function(c){return c.nombre===cajaStr;});
        if(cObj) almToUse = cObj.almacen;
      }
      var eqU=mon==='USD'?monto:(typeof toUSD==='function'?toUSD(monto,mon,almToUse):monto/(RATES[mon]||1));
      montoDeuda=p.moneda==='USD'?eqU:(typeof fromUSD==='function'?fromUSD(eqU,p.moneda,almToUse):eqU*(RATES[p.moneda]||1));
    }
  }
  montoDeuda=parseFloat(montoDeuda.toFixed(2));

  var fecha=document.getElementById('pm-fecha')?.value||today();
  var caja=document.getElementById('pm-caja')?.value||'';
  var nota=document.getElementById('pm-nota')?.value||'';
  var tipoPago=document.getElementById('pm-tipo')?.value||'pago';
  
  if(tipoPago!=='incremento' && tipoPago!=='interes'){
    var sld=_saldoDeuda(p);
    var cap=(p.tipo==='interes_simple' || p.tipo==='revolving')?p.capital:sld;
    var maxVal=(tipoPago==='amortizacion')?cap:sld;
    if(montoDeuda > maxVal + 0.05) {
      showToast('❌ Bloqueado: Estás intentando pagar el equivalente a '+fN(montoDeuda,2)+' '+p.moneda+', pero el saldo pendiente es de solo '+fN(maxVal,2)+' '+p.moneda+'. Reduce el monto.');
      return;
    }
  }

  if(!p.pagos)p.pagos=[];
  var esDeuda=p.direccion!=='nos_deben';

  // ── Determine movement type ──
  var tipoMov,sentidoMov,descMov,cajaTipo;
  if(tipoPago==='interes'){
    tipoMov='Pago intereses';sentidoMov='gasto';
    descMov=(nota||'Intereses')+' — '+p.nombre;
    cajaTipo=esDeuda?'retiro':'deposito';
  } else if(tipoPago==='cuota_revolving'){
    tipoMov='Pago cuota';sentidoMov='gasto';
    descMov=(nota||'Pago cuota')+' — '+p.nombre;
    cajaTipo=esDeuda?'retiro':'deposito';
  } else if(tipoPago==='amortizacion'){
    tipoMov='Amortización deuda';sentidoMov='gasto';
    descMov=(nota||'Amortización')+' — '+p.nombre;
    cajaTipo=esDeuda?'retiro':'deposito';
  } else if(tipoPago==='incremento'){
    tipoMov='Disposición deuda';
    sentidoMov=esDeuda?'ingreso':'gasto'; // nosotros_debemos: received cash
    descMov=(nota||'Incremento capital')+' — '+p.nombre;
    cajaTipo=esDeuda?'deposito':'retiro'; // money enters our caja
  } else {
    tipoMov=esDeuda?'Amortización deuda':'Cobro préstamo';
    sentidoMov=esDeuda?'gasto':'ingreso';
    descMov=(nota||'Pago')+' — '+p.nombre;
    cajaTipo=esDeuda?'retiro':'deposito';
  }

  // ── Create MOVS entry (local book) ──
  var movId=null;
  if(typeof igNextId!=='undefined'){
    movId=igNextId++;
    var almToUse = null;
    var cajaStr = caja || p.cta || '';
    if(cajaStr && typeof _cajasData !== 'undefined') {
      var cObj = _cajasData.find(function(c){return c.nombre===cajaStr;});
      if(cObj) almToUse = cObj.almacen;
    }
    var equivUSD=mon==='USD'?monto:(typeof toUSD==='function'?toUSD(monto,mon,almToUse):monto/(RATES[mon]||1));
    MOVS.unshift({id:movId,fecha:fecha,tipo:tipoMov,desc:descMov,
      acreedor:p.nombre,monto:monto,mon:mon,
      equivUSD:parseFloat(equivUSD.toFixed(2)),
      cta:caja,sentido:sentidoMov,notas:nota});
    try{localStorage.setItem('erp_movs',JSON.stringify(MOVS.slice(0,1000)));}catch(e){}
    // Persistir en Supabase movimientos_ig (si no, desaparece del Libro al sincronizar)
    if(typeof _supaWrite==='function'){
      _supaWrite('POST','movimientos_ig',{
        fecha:fecha, tipo:tipoMov, descripcion:descMov,
        monto:parseFloat(parseFloat(monto).toFixed(4)), moneda:mon,
        equiv_usd:parseFloat(equivUSD.toFixed(4)),
        cuenta:caja||'', vendedor:(typeof S!=='undefined'&&S.user)||'', notas:nota||''
      });
    }
  }

  // ── Push to mov_cajas (Supabase caja) ──
  if(caja) {
    var cRow = {
      tipo: cajaTipo, fecha: fecha, notas: descMov, 
      usuario: (typeof S!=='undefined'&&S.user)||'Admin',
      caja_origen: cajaTipo==='retiro' ? caja : null,
      caja_destino: cajaTipo==='deposito' ? caja : null,
      monto_origen: monto, monto_destino: monto
    };
    if (typeof _cajasMovs !== 'undefined') _cajasMovs.unshift(cRow);
    if (typeof supaReq === 'function' && typeof _supaOnline !== 'undefined' && _supaOnline) {
      supaReq('POST','mov_cajas',cRow).catch(function(e){console.warn('mov_cajas:',e);});
    }
  }

  // ── Modify capital if needed ──
  var amRev = 0;
  if(tipoPago==='amortizacion'){
    p.capital=Math.max(0,p.capital-montoDeuda);
    if(typeof calcCuotas==='function') p.cuotas=calcCuotas(p);
  } else if(tipoPago==='cuota_revolving'){
    var intMes = parseFloat((p.capital*(p.tasa||0)/100).toFixed(2));
    amRev = Math.max(0, montoDeuda - intMes);
    p.capital=Math.max(0,p.capital-amRev);
  } else if(tipoPago==='incremento'){
    p.capitalOriginal=(p.capitalOriginal||p.capital)+montoDeuda;
    p.capital=p.capital+montoDeuda;
    if(typeof calcCuotas==='function') p.cuotas=calcCuotas(p);
  }
  
  var pgObj = {id:'pg-'+Date.now(),fecha:fecha,hora:new Date().toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit'}),
    user:(typeof S!=='undefined'&&S.user)||'—',
    monto:monto, mon:mon, nota: nota, caja:caja,
    montoDeuda:montoDeuda, tipoPago:tipoPago
  };
  if(tipoPago==='cuota_revolving') {
    pgObj._intAsignado = Math.max(0, montoDeuda - amRev);
  }
  if (movId !== null) pgObj._movId = movId;
  p.pagos.push(pgObj);

  if(tipoPago!=='interes'&&tipoPago!=='incremento') _autoMarcarCuotas(p);
  _addAuditLog(p, 'Registro de pago: ' + fN(monto,2) + ' ' + mon + (tipoPago!=='pago'?' ('+tipoPago+')':''));
  savePrestamos(p);
  document.getElementById('pago-deuda-modal').style.display='none';
  if(typeof renderLibro==='function')try{renderLibro();}catch(e){}
  if(typeof renderCajas==='function')try{renderCajas();}catch(e){}
  renderDeudas();
  showToast('Registrado — '+fN(monto,2)+' '+mon+' ✓');
}

function _autoMarcarCuotas(p){
  // Mark cuotas as paid if total pagado covers them, unmark otherwise
  if (p.cuotas) {
    p.cuotas.forEach(function(c) {
      if(c.pagada) { c.pagada=false; c.fechaPago=null; }
    });
  }
  
  if(p.tipo==='interes_simple' || p.tipo==='revolving') return;

  var acum=_pagadoDeuda(p);
  var corriendo=0;
  p.cuotas.forEach(function(c){
    corriendo+=c.total;
    if(corriendo<=acum+0.001){
      if(!c.pagada) { c.pagada=true; c.fechaPago=today(); }
    }
  });
}

// ── MODAL: EDITAR PAGO ──────────────────────────────────
var _editPagoCtx={pid:null,pgId:null};
function abrirEditarPagoModal(prestamoId,pagoId){
  var p=PRESTAMOS.find(function(x){return x.id===prestamoId;});
  if(!p)return;
  var pg=(p.pagos||[]).find(function(x){return x.id===pagoId;});
  if(!pg)return;
  _editPagoCtx={pid:prestamoId,pgId:pagoId};
  var mo=document.getElementById('edit-pago-modal');
  if(!mo){
    mo=document.createElement('div');
    mo.id='edit-pago-modal';
    mo.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
    document.body.appendChild(mo);
  }
  var cajas=typeof getAllCajas==='function'?getAllCajas():[];
  mo.innerHTML='<div style="max-width:400px;width:100%;background:var(--color-background-primary);border-radius:14px;padding:22px 20px;box-shadow:0 20px 60px rgba(0,0,0,.7);position:relative">'
    +'<button type="button" onclick="document.getElementById(\'edit-pago-modal\').style.display=\'none\'" style="position:absolute;top:10px;right:12px;background:none;border:none;cursor:pointer;font-size:22px;color:var(--color-text-secondary)">×</button>'
    +'<div style="font-size:14px;font-weight:600;margin-bottom:14px">✏️ Editar pago</div>'
    +'<div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-bottom:10px">'
    +'<div><label class="lbl">Monto *</label><input class="adm-inp" type="number" id="ep-monto" value="'+pg.monto.toFixed(2)+'" step="0.01"></div>'
    +'<div><label class="lbl">Moneda</label><select class="adm-inp" id="ep-mon">'
    +['USD','EUR','CUP','CUPT'].map(function(m){return '<option'+(m===pg.mon?' selected':'')+'>'+m+'</option>';}).join('')+'</select></div>'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
    +'<div><label class="lbl">Fecha</label><input class="adm-inp" type="date" id="ep-fecha" value="'+(pg.fecha||today())+'"></div>'
    +'<div><label class="lbl">Caja</label><select class="adm-inp" id="ep-caja"><option value="">Sin caja</option>'
    +cajas.map(function(k){return '<option'+(k===pg.caja?' selected':'')+'>'+k+'</option>';}).join('')+'</select></div>'
    +'</div>'
    +'<div style="margin-bottom:6px"><label class="lbl">Nota</label><input class="adm-inp" id="ep-nota" value="'+(pg.nota||'').replace(/"/g,'&quot;')+'"></div>'
    +'<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:14px">Registrado por: '+(pg.user||'—')+(pg.hora?' a las '+pg.hora:'')+'</div>'
    +'<div style="display:flex;gap:8px">'
    +'<button type="button" class="btn btn-p" onclick="guardarEditarPago()" style="flex:1">Guardar cambios</button>'
    +'<button type="button" class="btn" onclick="document.getElementById(\'edit-pago-modal\').style.display=\'none\'">Cancelar</button>'
    +'</div></div>';
  mo.style.display='flex';
}

function guardarEditarPago(){
  var p=PRESTAMOS.find(function(x){return x.id===_editPagoCtx.pid;});
  if(!p)return;
  var pg=(p.pagos||[]).find(function(x){return x.id===_editPagoCtx.pgId;});
  if(!pg)return;
  var nuevoMonto=parseFloat(document.getElementById('ep-monto')?.value)||0;
  var nuevoMon=document.getElementById('ep-mon')?.value||pg.mon;
  var nuevaFecha=document.getElementById('ep-fecha')?.value||pg.fecha;
  var nuevaCaja=document.getElementById('ep-caja')?.value||'';
  var nuevaNota=document.getElementById('ep-nota')?.value||'';
  if(nuevoMonto<=0){showToast('El monto debe ser mayor que 0');return;}
  // Update MOVS if linked
  if(pg.movId!=null){
    var mov=MOVS.find(function(m){return m.id===pg.movId;});
    if(mov){
      var esDeuda=p.direccion!=='nos_deben';
      var equivUSD=nuevoMon==='USD'?nuevoMonto:(typeof toUSD==='function'?toUSD(nuevoMonto,nuevoMon):nuevoMonto/(RATES[nuevoMon]||1));
      mov.monto=nuevoMonto;mov.mon=nuevoMon;
      mov.equivUSD=parseFloat(equivUSD.toFixed(2));
      mov.fecha=nuevaFecha;mov.cta=nuevaCaja;
      mov.desc=(nuevaNota||'Pago')+' — '+p.nombre;
      mov.notas=nuevaNota;
      try{localStorage.setItem('erp_movs',JSON.stringify(MOVS.slice(0,1000)));}catch(e){}
    }
  }
  // Update pagos entry
  pg.monto=nuevoMonto;pg.mon=nuevoMon;pg.fecha=nuevaFecha;pg.caja=nuevaCaja;pg.nota=nuevaNota;
  _autoMarcarCuotas(p);
  _addAuditLog(p, 'Edición de pago: ' + fN(pg.monto,2) + ' ' + pg.mon);
  savePrestamos(p);
  document.getElementById('edit-pago-modal').style.display='none';
  if(typeof renderLibro==='function')try{renderLibro();}catch(e){}
  if(typeof renderCajas==='function')try{renderCajas();}catch(e){}
  renderDeudas();
  showToast('Pago actualizado ✓');
}

function eliminarPago(prestamoId,pagoId){
  var p=PRESTAMOS.find(function(x){return x.id===prestamoId;});
  if(!p)return;
  var pgIdx=(p.pagos||[]).findIndex(function(x){return x.id===pagoId;});
  if(pgIdx<0)return;
  var pg=p.pagos[pgIdx];
  if(!confirm('¿Eliminar este pago de '+fN(pg.monto,2)+' '+pg.mon+'?\nEsta acción también eliminará el movimiento del libro contable.'))return;
  var notaAuto=pg.nota||(pg.tipoPago==='interes'?'Intereses':pg.tipoPago==='amortizacion'?'Amortización':pg.tipoPago==='incremento'?'Incremento capital':'Pago');
  var descMov=(notaAuto)+' — '+p.nombre;
  var descLiq='Liquidación — '+p.nombre;

  // Remove from MOVS
  if(pg.movId!=null){
    var mi=MOVS.findIndex(function(m){return m.id===pg.movId;});
    if(mi>=0)MOVS.splice(mi,1);
    try{localStorage.setItem('erp_movs',JSON.stringify(MOVS.slice(0,1000)));}catch(e){}
  } else {
    var mi=MOVS.findIndex(function(m){return m.fecha===pg.fecha && m.monto===pg.monto && (m.desc===descMov || m.desc===descLiq);});
    if(mi>=0) { MOVS.splice(mi,1); try{localStorage.setItem('erp_movs',JSON.stringify(MOVS.slice(0,1000)));}catch(e){} }
  }

  p.pagos.splice(pgIdx, 1);

  // Borrar de Supabase movimientos_ig (por descripcion + fecha + monto)
  if(typeof supaReq==='function' && typeof _supaOnline!=='undefined' && _supaOnline){
    supaReq('DELETE','movimientos_ig?descripcion=eq.'+encodeURIComponent(descMov)+'&fecha=eq.'+encodeURIComponent(pg.fecha)+'&monto=eq.'+pg.monto).catch(function(e){});
    supaReq('DELETE','movimientos_ig?descripcion=eq.'+encodeURIComponent(descLiq)+'&fecha=eq.'+encodeURIComponent(pg.fecha)+'&monto=eq.'+pg.monto).catch(function(e){});
  }
  // Remove from _cajasMovs and Supabase
  var targetId = null;
  if(typeof _cajasMovs!=='undefined'){
    var cIdx=_cajasMovs.findIndex(function(m){return m.fecha===pg.fecha && m.monto_origen===pg.monto && (m.notas===descMov || m.notas===descLiq);});
    if(cIdx>=0){
      targetId = _cajasMovs[cIdx].id;
      _cajasMovs.splice(cIdx,1);
    }
  }

  if(typeof supaReq==='function' && typeof _supaOnline!=='undefined' && _supaOnline){
    if(targetId) {
      supaReq('DELETE','mov_cajas?id=eq.'+targetId).catch(function(e){});
    } else {
      var q = 'fecha=eq.'+encodeURIComponent(pg.fecha)+'&monto_origen=eq.'+pg.monto+'&notas=in.('+encodeURIComponent('"'+descMov+'","'+descLiq+'"')+')';
      supaReq('DELETE','mov_cajas?'+q).catch(function(e){});
    }
  }

  // Restore capital if it was amortization or increment
  if(pg.tipoPago==='amortizacion'){
    p.capital = (p.capital||0) + (pg.montoDeuda||pg.monto);
    if(typeof calcCuotas==='function') p.cuotas=calcCuotas(p);
  } else if(pg.tipoPago==='cuota_revolving'){
    var intMesR = pg._intAsignado != null ? pg._intAsignado : 0;
    var capRevR = Math.max(0, (pg.montoDeuda||pg.monto) - intMesR);
    p.capital = (p.capital||0) + capRevR;
  } else if(pg.tipoPago==='incremento'){
    p.capital = Math.max(0, (p.capital||0) - (pg.montoDeuda||pg.monto));
    if(typeof calcCuotas==='function') p.cuotas=calcCuotas(p);
  }

  _autoMarcarCuotas(p);
  _addAuditLog(p, 'Eliminación de pago: ' + fN(pg.monto,2) + ' ' + pg.mon);
  savePrestamos(p);
  if(typeof renderLibro==='function')try{renderLibro();}catch(e){}
  if(typeof renderCajas==='function')try{renderCajas();}catch(e){}
  renderDeudas();
  showToast('Pago eliminado');
}



function showNuevaDeuda(){
  var mo=document.getElementById('nueva-deuda-modal');
  if(!mo){
    mo=document.createElement('div');
    mo.id='nueva-deuda-modal';
    mo.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
    document.body.appendChild(mo);
  }
  var cajas=typeof getAllCajas==='function'?getAllCajas():[];
  mo.innerHTML='<div style="max-width:480px;width:100%;max-height:90vh;overflow-y:auto;background:var(--color-background-primary);border-radius:14px;padding:24px 20px;box-shadow:0 20px 60px rgba(0,0,0,.7);position:relative">'
    +'<button type="button" onclick="document.getElementById(\'nueva-deuda-modal\').style.display=\'none\'" style="position:absolute;top:10px;right:12px;background:none;border:none;cursor:pointer;font-size:22px;color:var(--color-text-secondary)">×</button>'
    +'<div style="font-size:16px;font-weight:600;margin-bottom:16px">Nueva deuda / préstamo</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    +'<div style="grid-column:1/-1"><label class="lbl">Nombre / Acreedor / Deudor *</label>'
    +'<input class="adm-inp" id="nd-nombre" placeholder="Ej: Préstamo Juan García"></div>'
    +'<div><label class="lbl">Dirección</label>'
    +'<select class="adm-inp" id="nd-dir">'
    +'<option value="nosotros_debemos">📤 Nosotros debemos (por pagar)</option>'
    +'<option value="nos_deben">📥 Nos deben (por cobrar)</option>'
    +'</select></div>'
    +'<div><label class="lbl">Tipo</label>'
    +'<select class="adm-inp" id="nd-tipo" onchange="updNuevaDeudaForm()">'
    +'<option value="simple">Deuda simple (sin interés)</option>'
    +'<option value="interes_simple">Interés mensual fijo</option>'
    +'<option value="revolving">Línea de Crédito / Tarjeta Revolving</option>'
    +'<option value="frances">Cuota fija — Método francés</option>'
    +'</select></div>'
    +'<div><label class="lbl">Capital *</label>'
    +'<input class="adm-inp" type="number" id="nd-capital" placeholder="0.00" step="0.01" oninput="updNuevaDeudaForm()"></div>'
    +'<div><label class="lbl">Moneda</label>'
    +'<select class="adm-inp" id="nd-mon" onchange="updNuevaDeudaForm()">'+['USD','EUR','CUP','CUPT'].map(function(m){return '<option>'+m+'</option>';}).join('')+'</select></div>'
    +'<div id="nd-tasa-wrap"><label class="lbl" style="display:flex;justify-content:space-between">Tasa (%) <select id="nd-tasa-tipo" style="background:none;border:none;color:var(--color-text-primary);font-weight:600;font-size:10px;outline:none;cursor:pointer" onchange="updNuevaDeudaForm()"><option value="anual">Anual (TIN)</option><option value="mensual">Mensual</option></select></label>'
    +'<input class="adm-inp" type="number" id="nd-tasa" value="9.5" step="0.01" oninput="updNuevaDeudaForm()"></div>'
    +'<div id="nd-plazo-wrap"><label class="lbl">Plazo (meses)</label>'
    +'<input class="adm-inp" type="number" id="nd-plazo" value="12" step="1" min="1" oninput="updNuevaDeudaForm()"></div>'
    +'<div id="nd-cuota-wrap" style="display:none"><label class="lbl">Cuota mensual fija</label>'
    +'<input class="adm-inp" type="number" id="nd-cuota" value="280" step="0.01" oninput="updNuevaDeudaForm()"></div>'
    +'<div id="nd-venc-wrap" style="display:none"><label class="lbl">Vencimiento (opcional)</label>'
    +'<input class="adm-inp" type="date" id="nd-venc"></div>'
    +'<div><label class="lbl">Fecha inicio</label>'
    +'<input class="adm-inp" type="date" id="nd-fecha" value="'+today()+'"></div>'
    +'<div><label class="lbl">Caja asociada</label>'
    +'<select class="adm-inp" id="nd-cta"><option value="">Sin asignar</option>'
    +cajas.map(function(k){return '<option>'+k+'</option>';}).join('')+'</select></div>'
    +'<div style="grid-column:1/-1;display:flex;align-items:center;gap:8px;margin-top:6px">'
    +'<input type="checkbox" id="nd-reg-ini" checked style="width:16px;height:16px">'
    +'<label for="nd-reg-ini" style="font-size:12px;color:var(--color-text-primary);cursor:pointer;margin:0">Registrar este capital como un movimiento automático en la caja seleccionada</label>'
    +'</div>'
    +'<div style="grid-column:1/-1"><label class="lbl">Notas</label>'
    +'<input class="adm-inp" id="nd-notas" placeholder="Observaciones..."></div>'
    +'</div>'
    +'<div id="nd-preview" style="margin-top:10px;font-size:12px;color:var(--color-text-secondary);padding:10px;background:var(--color-background-secondary);border-radius:8px;display:none"></div>'
    +'<div style="display:flex;gap:8px;margin-top:16px">'
    +'<button type="button" class="btn btn-p" onclick="admCrearDeuda()" style="flex:1">Crear</button>'
    +'<button type="button" class="btn" onclick="document.getElementById(\'nueva-deuda-modal\').style.display=\'none\'">Cancelar</button>'
    +'</div>'
    +'</div>';
  mo.style.display='flex';
  updNuevaDeudaForm();
}

function updNuevaDeudaForm(){
  var tipo=document.getElementById('nd-tipo')?.value||'simple';
  var tw=document.getElementById('nd-tasa-wrap');
  var pw=document.getElementById('nd-plazo-wrap');
  var cw=document.getElementById('nd-cuota-wrap');
  var vw=document.getElementById('nd-venc-wrap');
  if(tw)tw.style.display=tipo==='simple'?'none':'';
  if(pw)pw.style.display=(tipo==='simple'||tipo==='interes_simple'||tipo==='revolving')?'none':'';
  if(cw)cw.style.display=tipo==='revolving'?'':'none';
  if(vw)vw.style.display=tipo==='simple'?'':'none';
  
  // Filter Cajas by currency
  var cSel = document.getElementById('nd-cta');
  var mon = document.getElementById('nd-mon')?.value;
  if(cSel && mon) {
    var currCaja = cSel.value;
    var cajas = typeof getAllCajas==='function'?getAllCajas():[];
    var opts = '<option value="">Sin asignar</option>';
    cajas.forEach(function(k){
      if(typeof _getMonedaFromCaja==='function'){
        var mCaja = _getMonedaFromCaja(k);
        if(mCaja && mCaja !== mon && !(mon === 'CUPT' && mCaja === 'CUP')) return;
      }
      opts += '<option'+(k===currCaja?' selected':'')+'>'+k+'</option>';
    });
    cSel.innerHTML = opts;
  }

  var capital=parseFloat(document.getElementById('nd-capital')?.value)||0;
  var tasa=parseFloat(document.getElementById('nd-tasa')?.value)||0;
  var tasaTipo=document.getElementById('nd-tasa-tipo')?.value||'mensual';
  if (tasaTipo === 'anual') tasa = tasa / 12;

  // If interes_simple, default to 120 months (10 years) of projected calendar schedule
  var plazo=tipo==='interes_simple'?120:(parseInt(document.getElementById('nd-plazo')?.value)||1);
  var cuotaFija=parseFloat(document.getElementById('nd-cuota')?.value)||0;
  
  var prev=document.getElementById('nd-preview');
  if(!prev)return;
  if(!capital){prev.style.display='none';return;}
  var txt='';
  if(tipo==='simple'){
    txt='Capital a devolver: <strong>'+fN(capital,2)+'</strong> sin intereses';
  } else if(tipo==='interes_simple'){
    var intM=capital*tasa/100;
    txt='Interés inicial estimado: <strong>'+fN(intM,2)+' / mes</strong> (Solo interés)<br><span style="color:var(--color-text-tertiary);margin-top:4px;display:block">💡 El capital de <strong>'+fN(capital,2)+'</strong> generará interés mensualmente sobre el saldo pendiente. Puedes hacer pagos libres.</span>';
  } else if (tipo==='revolving') {
    var intM = capital * tasa / 100;
    if (cuotaFija <= intM) {
      txt='<span style="color:var(--color-text-danger)">⚠️ La cuota fija de '+fN(cuotaFija,2)+' no cubre siquiera el primer interés mensual de '+fN(intM,2)+'. La deuda crecerá infinitamente. Sube la cuota.</span>';
    } else {
      var sld = capital;
      var count = 0;
      var totalProy = 0;
      var r = tasa / 100;
      while (sld > 0.01 && count < 600) {
        var intP = sld * r;
        var amP = cuotaFija - intP;
        if (sld < amP) {
          totalProy += (sld + intP);
          sld = 0;
        } else {
          totalProy += cuotaFija;
          sld -= amP;
        }
        count++;
      }
      if (count >= 600) {
         txt='Cuota fija de <strong>'+fN(cuotaFija,2)+'</strong> terminaría en más de 50 años.';
      } else {
         txt='Cuota mensual fija: <strong>'+fN(cuotaFija,2)+'</strong> · Plazo estimado: <strong>'+count+' meses</strong><br><span style="color:var(--color-text-tertiary);margin-top:4px;display:block">Total proyectado a pagar: '+fN(totalProy,2)+'</span>';
      }
    }
  } else {
    var r=tasa/100;
    var pmt=r===0?capital/plazo:capital*r*Math.pow(1+r,plazo)/(Math.pow(1+r,plazo)-1);
    txt='Cuota mensual fija: <strong>'+fN(pmt,2)+'</strong> · Total proyectado a pagar: <strong>'+fN(pmt*plazo,2)+'</strong>';
  }
  prev.innerHTML=txt;
  prev.style.display='block';
}


function admCrearDeuda(){
  var nombre=(document.getElementById('nd-nombre')?.value||'').trim();
  if(!nombre){showToast('El nombre es obligatorio');return;}
  var capital=parseFloat(document.getElementById('nd-capital')?.value)||0;
  if(!capital){showToast('El capital debe ser mayor que 0');return;}
  var rawTasa = parseFloat(document.getElementById('nd-tasa')?.value)||0;
  var tasaTipo = document.getElementById('nd-tasa-tipo')?.value||'mensual';
  var finalTasa = tasaTipo === 'anual' ? rawTasa / 12 : rawTasa;
  var tipoD = document.getElementById('nd-tipo').value;
  var cuotaFija = parseFloat(document.getElementById('nd-cuota')?.value)||0;

  if (tipoD === 'revolving') {
     var intPrimerMes = capital * finalTasa / 100;
     if (cuotaFija <= intPrimerMes) {
        showToast('La cuota fija no cubre los intereses. La deuda sería impagable.');
        return;
     }
  }

  crearPrestamo({
    nombre:nombre,
    tipo:tipoD,
    direccion:document.getElementById('nd-dir').value,
    capital:capital,
    tasa:finalTasa,
    plazo:parseInt(document.getElementById('nd-plazo')?.value)||1,
    cuotaFija:cuotaFija,
    moneda:document.getElementById('nd-mon').value,
    fechaInicio:document.getElementById('nd-fecha').value||today(),
    vencimiento:document.getElementById('nd-venc')?.value||'',
    cta:document.getElementById('nd-cta').value,
    regIni:document.getElementById('nd-reg-ini')?.checked,
    notas:document.getElementById('nd-notas').value,
  });
  document.getElementById('nueva-deuda-modal').style.display='none';
  if (typeof renderDeudas==='function') renderDeudas();
  if (typeof renderLibro==='function') renderLibro();
}

function liquidarDeuda_p(id){
  var p=PRESTAMOS.find(function(x){return x.id===id;});
  if(!p)return;
  var saldo = _saldoDeuda(p);
  if(saldo<=0) { showToast('La deuda ya está liquidada'); return; }
  if(!confirm('¿Marcar toda esta deuda/préstamo como completamente liquidada por el saldo de '+fN(saldo,2)+' '+p.moneda+'?'))return;

  var ahora=today();
  var hora=String(new Date().getHours()).padStart(2,'0')+':'+String(new Date().getMinutes()).padStart(2,'0');
  var esD=p.direccion!=='nos_deben';
  var tipoMov=esD?'Amortización deuda':'Cobro préstamo';
  var sentidoMov=esD?'gasto':'ingreso';
  var descMov='Liquidación — '+p.nombre;
  var cajaTipo=esD?'retiro':'deposito';
  var movId=null;

  if(typeof igNextId!=='undefined'){
    movId=igNextId++;
    var almToUse = null;
    if(p.cta && typeof _cajasData !== 'undefined') {
      var pObj = _cajasData.find(function(c){return c.nombre===p.cta;});
      if(pObj) almToUse = pObj.almacen;
    }
    var equivUSD=p.moneda==='USD'?saldo:(typeof toUSD==='function'?toUSD(saldo,p.moneda,almToUse):saldo/(RATES[p.moneda]||1));
    MOVS.unshift({
      id:movId,fecha:ahora,tipo:tipoMov,desc:descMov,
      acreedor:p.nombre,monto:saldo,mon:p.moneda,
      equivUSD:parseFloat(equivUSD.toFixed(2)),
      cta:p.cta||'',sentido:sentidoMov,notas:''
    });
    try{localStorage.setItem('erp_movs',JSON.stringify(MOVS.slice(0,500)));}catch(e){}
    // Persistir en Supabase movimientos_ig (si no, desaparece del Libro al sincronizar)
    if(typeof _supaWrite==='function'){
      _supaWrite('POST','movimientos_ig',{
        fecha:ahora, tipo:tipoMov, descripcion:descMov,
        monto:parseFloat(parseFloat(saldo).toFixed(4)), moneda:p.moneda,
        equiv_usd:parseFloat(equivUSD.toFixed(4)),
        cuenta:p.cta||'', vendedor:(typeof S!=='undefined'&&S.user)||'', notas:''
      });
    }
  }
  
  if(p.cta) {
    var cRow = {
      tipo: cajaTipo, fecha: ahora, notas: descMov,
      usuario: (typeof S!=='undefined'&&S.user)||'Admin',
      caja_origen: cajaTipo==='retiro' ? p.cta : null,
      caja_destino: cajaTipo==='deposito' ? p.cta : null,
      monto_origen: saldo, monto_destino: saldo
    };
    if(typeof _cajasMovs!=='undefined') _cajasMovs.unshift(cRow);
    if(typeof supaReq==='function' && typeof _supaOnline!=='undefined' && _supaOnline) {
      supaReq('POST','mov_cajas',cRow).catch(function(e){console.warn('mov_cajas:',e);});
    }
  }

  var tipoP = (p.tipo==='interes_simple') ? 'amortizacion' : 'pago';
  if(!p.pagos) p.pagos=[];
  p.pagos.push({id:'pg-'+Date.now(),fecha:ahora,hora:hora,
    monto:saldo,mon:p.moneda,montoDeuda:saldo,nota:'Liquidación',caja:p.cta||'',movId:movId,tipoPago:tipoP,
    user:typeof S!=='undefined'&&S.user?S.user:'—'});

  if(p.tipo==='interes_simple') {
    p.capital = 0;
    if(typeof calcCuotas==='function') p.cuotas=calcCuotas(p);
  }

  _autoMarcarCuotas(p);
  _addAuditLog(p, 'Liquidación total (Marcada)');
  savePrestamos(p);
  if(typeof renderLibro==='function')try{renderLibro();}catch(e){}
  if(typeof renderCajas==='function')try{renderCajas();}catch(e){}
  renderDeudas();
  showToast('Deuda liquidada ✓');
}


// (old DEUDAS code removed — now using PRESTAMOS unified system)




function exportCSV(){
  const data=filtrar_ig();
  let csv='Fecha,Tipo,Descripción,Monto,Moneda,Equiv.USD,Cuenta,Sentido,Notas\n';
  data.forEach(m=>{csv+=`${m.fecha},${m.tipo},"${m.desc}",${m.monto},${m.mon},${m.equivUSD},${m.cta},${m.sentido},"${m.notas||''}"\n`;});
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='ingresos_gastos.csv';a.click();
}


document.getElementById('l-desde').value='2025-01-01';
document.getElementById('l-hasta').value='2026-12-31';
renderLibro();


function renderGestionCajasWrap() {
  var el = document.getElementById('ig-cajas-mgmt');
  if (!el) return;
  var isAdmin = typeof S!=='undefined'&&S.user&&USERS[S.user]&&USERS[S.user].rol==='admin';
  if (!isAdmin) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--color-text-tertiary)">Solo el administrador puede gestionar cajas</div>';
    return;
  }
  if (typeof renderGestionCajas === 'function') renderGestionCajas();
}




