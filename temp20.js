
// ═══════════════════════════════════════════════════════════════
// MÓDULO: CAJAS PERSONALIZADAS + PRÉSTAMOS
// ═══════════════════════════════════════════════════════════════

// ── Cajas personalizadas (se guardan en localStorage) ───────────
function getCustomCajas() {
  try { return JSON.parse(localStorage.getItem('erp_cajas_custom')||'[]'); } catch(e) { return []; }
}
function saveCustomCajas(arr) {
  try { localStorage.setItem('erp_cajas_custom', JSON.stringify(arr)); } catch(e) {}
}
function getAllCajas() {
  // Prefer Supabase _cajasData when loaded (same approach as _getCajasForMon)
  if (typeof _cajasData !== 'undefined' && _cajasData.length) {
    return _cajasData.filter(function(c){ return c.activa !== false; }).map(function(c){ return c.nombre; });
  }
  // Fallback: hardcoded CUENTAS_BASE + custom cajas
  var base = Object.keys(CUENTAS_BASE);
  var custom = getCustomCajas().map(function(c){ return c.key; });
  return base.concat(custom.filter(function(k){ return !base.includes(k); }));
}
function addCustomCaja(nombre, moneda) {
  var key = moneda + ' ' + nombre;
  var arr = getCustomCajas();
  if (!arr.find(function(c){ return c.key === key; })) {
    arr.push({ key: key, nombre: nombre, moneda: moneda });
    saveCustomCajas(arr);
    // Add to CUENTAS_BASE
    if (!CUENTAS_BASE[key]) CUENTAS_BASE[key] = { ingV:0, ingIG:0, gasIG:0, mon: moneda };
  }
}

// Load custom cajas on startup
(function(){
  getCustomCajas().forEach(function(c){
    if (!CUENTAS_BASE[c.key]) CUENTAS_BASE[c.key] = { ingV:0, ingIG:0, gasIG:0, mon: c.moneda };
  });
})();

// ── Panel gestión de cajas en IG (renderizable) ─────────────────
function renderGestionCajas() {
  var el = document.getElementById('ig-cajas-mgmt');
  if (!el) return;
  var monedas = ['USD','EUR','CUP','CUPT'];
  el.innerHTML = '<div style="font-size:13px;font-weight:600;margin-bottom:10px">Añadir caja</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">'
    + '<input class="adm-inp" id="new-caja-nombre" placeholder="Nombre (ej: España, Xportprise)" style="flex:1;max-width:200px">'
    + '<select class="adm-inp" id="new-caja-mon" style="max-width:100px">'
    + monedas.map(function(m){ return '<option>'+m+'</option>'; }).join('')
    + '</select>'
    + '<button class="adm-btn adm-btn-p" onclick="admAddCaja()">+ Crear caja</button>'
    + '</div>'
    + '<div style="font-size:13px;font-weight:600;margin-bottom:8px">Cajas personalizadas</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:6px">'
    + getCustomCajas().map(function(c){
        return '<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;background:var(--color-background-secondary);border-radius:var(--border-radius-md);font-size:12px">'
          + '<strong>'+c.moneda+'</strong> '+c.nombre
          + '<span onclick="admRemoveCaja(\''+c.key+'\')" style="cursor:pointer;color:var(--color-text-danger);font-size:15px">×</span></span>';
      }).join('') || '<span style="font-size:12px;color:var(--color-text-tertiary)">Sin cajas personalizadas</span>'
    + '</div>';
}
function admAddCaja() {
  var nombre = (document.getElementById('new-caja-nombre').value||'').trim();
  var mon = document.getElementById('new-caja-mon').value;
  if (!nombre) { showToast('Introduce un nombre para la caja'); return; }
  addCustomCaja(nombre, mon);
  document.getElementById('new-caja-nombre').value = '';
  renderGestionCajas();
  if (typeof renderCajas==='function') renderCajas();
  showToast('Caja creada: ' + mon + ' ' + nombre);
}
function admRemoveCaja(key) {
  if (!confirm('¿Eliminar caja "'+key+'"?')) return;
  var arr = getCustomCajas().filter(function(c){ return c.key !== key; });
  saveCustomCajas(arr);
  delete CUENTAS_BASE[key];
  renderGestionCajas();
  if (typeof renderCajas==='function') renderCajas();
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO: PRÉSTAMOS
// ═══════════════════════════════════════════════════════════════

var PRESTAMOS = (function(){
  try { return JSON.parse(localStorage.getItem('erp_prestamos')||'[]'); } catch(e) { return []; }
})();

// MÓDULO: CONTENEDORES
// ═══════════════════════════════════════════════════════════════
var CONTENEDORES = (function(){
  try{var d=JSON.parse(localStorage.getItem('erp_contenedores')||'[]');if(d&&d.length)return d;}catch(e){}
  return [];
})();

function saveContenedor(cnt, deletedId) {
  try { localStorage.setItem('erp_contenedores', JSON.stringify(CONTENEDORES)); } catch(e) {}
  if (typeof renderContenedores === 'function') renderContenedores();
  if (cnt && typeof _syncSaveContenedor === 'function') _syncSaveContenedor(cnt);
  if (deletedId && typeof _syncDeleteContenedor === 'function') _syncDeleteContenedor(deletedId);
}

function _addAuditLog(p, action) {
  if (!p.auditLog) p.auditLog = [];
  var ahora = new Date();
  p.auditLog.push({
    fecha: ahora.toISOString().slice(0, 10),
    hora: String(ahora.getHours()).padStart(2,'0')+':'+String(ahora.getMinutes()).padStart(2,'0'),
    user: (typeof S!=='undefined'&&S.user?S.user:'Admin'),
    action: action
  });
}

function savePrestamos(p, deletedId) {
  try { localStorage.setItem('erp_prestamos', JSON.stringify(PRESTAMOS)); } catch(e) {}
  if (typeof renderPrestamos === 'function') renderPrestamos();
  // Sincronizar con Supabase
  if (p && typeof _syncSavePrestamo === 'function') _syncSavePrestamo(p);
  if (deletedId && typeof _syncDeletePrestamo === 'function') _syncDeletePrestamo(deletedId);
}

// Generate payment schedule
function calcCuotas(p) {
  var cuotas = [];
  if (p.tipo === 'simple') {
    // Single payment, no interest
    cuotas.push({
      num: 1,
      fecha: p.vencimiento || '',
      capital: p.capital,
      interes: 0,
      total: p.capital,
      pagada: false, fechaPago: null
    });
  } else if (p.tipo === 'interes_simple') {
    // BULLET LOAN: Only interest is scheduled. Capital does NOT amortize automatically.
    // Use explicit "amortizacion" payments to reduce the principal.
    var interesMensual = p.capital * (p.tasa / 100);
    for (var i = 1; i <= p.plazo; i++) {
      var fecha = new Date(p.fechaInicio);
      fecha.setMonth(fecha.getMonth() + i);
      cuotas.push({
        num: i,
        fecha: fecha.toISOString().slice(0,10),
        capital: 0,           // NO amortization in scheduled cuota
        interes: interesMensual,
        total: interesMensual, // cuota = interest only
        pagada: false, fechaPago: null
      });
    }
    // Capital repayment done via separate 'amortizacion' type payments
  } else if (p.tipo === 'revolving') {
    // REVOLVING FIXED QUOTA
    var r = p.tasa / 100;
    var saldo = p.capital;
    var cuotaF = p.cuotaFija || 0;
    var maxIter = 600;
    var i = 1;
    while (saldo > 0.01 && i <= maxIter) {
      var interes = saldo * r;
      var amort = cuotaF - interes;
      var pagoTotal = cuotaF;
      
      if (saldo < amort) {
        amort = saldo;
        pagoTotal = saldo + interes;
        saldo = 0;
      } else {
        saldo -= amort;
      }
      
      var fecha = new Date(p.fechaInicio);
      fecha.setMonth(fecha.getMonth() + i);
      cuotas.push({
        num: i,
        fecha: fecha.toISOString().slice(0,10),
        capital: amort,
        interes: interes,
        total: pagoTotal,
        saldoRestante: saldo,
        pagada: false, fechaPago: null
      });
      i++;
    }
  } else {
    // French method (PMT formula)
    var r = p.tasa / 100;
    var n = p.plazo;
    var pmt = r === 0 ? p.capital / n : p.capital * r * Math.pow(1+r,n) / (Math.pow(1+r,n)-1);
    var saldo = p.capital;
    for (var i = 1; i <= n; i++) {
      var interes = saldo * r;
      var amort = pmt - interes;
      saldo = Math.max(0, saldo - amort);
      var fecha = new Date(p.fechaInicio);
      fecha.setMonth(fecha.getMonth() + i);
      cuotas.push({
        num: i,
        fecha: fecha.toISOString().slice(0,10),
        capital: amort,
        interes: interes,
        total: pmt,
        saldoRestante: saldo,
        pagada: false, fechaPago: null
      });
    }
  }
  return cuotas;
}

function crearPrestamo(data) {
  var p = {
    id: 'pr-' + Date.now(),
    nombre: data.nombre,
    tipo: data.tipo, // 'simple' | 'interes_simple' | 'frances'
    direccion: data.direccion || 'nosotros_debemos', // 'nosotros_debemos' | 'nos_deben'
    capital: data.capital,
    tasa: data.tasa || 0,
    plazo: data.plazo || 1,
    moneda: data.moneda,
    fechaInicio: data.fechaInicio,
    vencimiento: data.vencimiento || '',
    notas: data.notas || '',
    cta: data.cta || '',
    cuotaFija: data.cuotaFija || 0,
    cuotas: []
  };
  p.cuotas = calcCuotas(p);
  PRESTAMOS.unshift(p);

  if (data.regIni && p.cta) {
    var esDeuda = p.direccion !== 'nos_deben';
    var tipoMov = esDeuda ? 'Préstamo recibido' : 'Préstamo otorgado';
    var sentidoMov = esDeuda ? 'ingreso' : 'gasto';
    var descMov = 'Apertura de préstamo/deuda — ' + p.nombre;

    // 1. Agregar al libro I/G (movimientos_ig)
    var igId = (typeof igNextId !== 'undefined') ? igNextId++ : Date.now();
    var equivUSD = p.moneda === 'USD' ? p.capital : (typeof toUSD === 'function' ? toUSD(p.capital, p.moneda) : (p.capital / (RATES[p.moneda] || 1)));
    if (typeof MOVS !== 'undefined') {
      MOVS.unshift({
        id: igId, fecha: p.fechaInicio, tipo: tipoMov, desc: descMov,
        acreedor: p.nombre, monto: p.capital, mon: p.moneda,
        equivUSD: parseFloat(equivUSD.toFixed(2)),
        cta: p.cta, sentido: sentidoMov, notas: ''
      });
      try { localStorage.setItem('erp_movs', JSON.stringify(MOVS.slice(0, 1000))); } catch(e){}
    }
    if (typeof _supaWrite === 'function') {
      _supaWrite('POST', 'movimientos_ig', {
        fecha: p.fechaInicio, tipo: tipoMov, descripcion: descMov,
        monto: parseFloat(p.capital.toFixed(4)), moneda: p.moneda,
        equiv_usd: parseFloat(equivUSD.toFixed(4)),
        cuenta: p.cta || '', vendedor: (typeof S!=='undefined'&&S.user)||'', notas: ''
      });
    }

    // 2. Agregar a mov_cajas
    var cajaTipo = esDeuda ? 'deposito' : 'retiro';
    var cRow = {
      tipo: cajaTipo, fecha: p.fechaInicio, notas: descMov, 
      usuario: (typeof S !== 'undefined' && S.user) || 'Admin',
      caja_origen: cajaTipo === 'retiro' ? p.cta : null,
      caja_destino: cajaTipo === 'deposito' ? p.cta : null,
      monto_origen: p.capital, monto_destino: p.capital
    };
    if (typeof _cajasMovs !== 'undefined') _cajasMovs.unshift(cRow);
    if (typeof supaReq === 'function' && typeof _supaOnline !== 'undefined' && _supaOnline) {
      supaReq('POST', 'mov_cajas', cRow).catch(function(e){console.warn('mov_cajas:',e);});
    }
  }

  _addAuditLog(p, 'Registro de deuda creado: ' + fN(p.capital,2) + ' ' + p.moneda);
  savePrestamos(p);
  showToast('Creado: ' + p.nombre);
  if (typeof renderLibro === 'function') renderLibro();
  if (typeof renderLiqCuentas === 'function') renderLiqCuentas();
}

function showEditarDeudaModal(id){
  var p=PRESTAMOS.find(function(x){return x.id===id;});
  if(!p)return;
  var mo=document.getElementById('edit-deuda-modal');
  if(!mo){
    mo=document.createElement('div');
    mo.id='edit-deuda-modal';
    mo.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
    document.body.appendChild(mo);
  }
  var cajas=typeof getAllCajas==='function'?getAllCajas():[];
  mo.innerHTML='<div style="max-width:480px;width:100%;max-height:90vh;overflow-y:auto;background:var(--color-background-primary);border-radius:14px;padding:24px 20px;box-shadow:0 20px 60px rgba(0,0,0,.7);position:relative">'
    +'<button type="button" onclick="document.getElementById(\'edit-deuda-modal\').style.display=\'none\'" style="position:absolute;top:10px;right:12px;background:none;border:none;cursor:pointer;font-size:22px;color:var(--color-text-secondary)">×</button>'
    +'<div style="font-size:16px;font-weight:600;margin-bottom:16px">Editar deuda / préstamo</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    +'<div style="grid-column:1/-1"><label class="lbl">Nombre / Acreedor / Deudor *</label>'
    +'<input class="adm-inp" id="ed-nombre" value="'+(p.nombre||'')+'"></div>'
    +'<div><label class="lbl">Dirección</label>'
    +'<select class="adm-inp" id="ed-dir" disabled>'
    +'<option value="nosotros_debemos"'+(p.direccion==='nosotros_debemos'?' selected':'')+'>📤 Nosotros debemos</option>'
    +'<option value="nos_deben"'+(p.direccion==='nos_deben'?' selected':'')+'>📥 Nos deben</option>'
    +'</select></div>'
    +'<div><label class="lbl">Tipo</label>'
    +'<select class="adm-inp" id="ed-tipo" disabled>'
    +'<option value="'+p.tipo+'" selected>'+p.tipo+'</option>'
    +'</select></div>'
    +'<div><label class="lbl">Moneda</label>'
    +'<select class="adm-inp" id="ed-mon" disabled><option>'+p.moneda+'</option></select></div>'
    +'<div><label class="lbl">Fecha inicio</label>'
    +'<input class="adm-inp" type="date" id="ed-fecha" value="'+(p.fechaInicio||'')+'"></div>'
    +'<div><label class="lbl">Vencimiento</label>'
    +'<input class="adm-inp" type="date" id="ed-venc" value="'+(p.vencimiento||'')+'"></div>'
    +'<div><label class="lbl">Caja asociada (predeterminada)</label>'
    +'<select class="adm-inp" id="ed-cta"><option value="">Sin asignar</option>'
    +cajas.filter(function(k){
      if(typeof _getMonedaFromCaja==='function'){
        var mCaja=_getMonedaFromCaja(k);
        return !mCaja || mCaja===p.moneda;
      }
      return true;
    }).map(function(k){return '<option'+(k===p.cta?' selected':'')+'>'+k+'</option>';}).join('')+'</select></div>'
    +'<div style="grid-column:1/-1"><label class="lbl">Notas</label>'
    +'<input class="adm-inp" id="ed-notas" value="'+(p.notas||'')+'"></div>'
    +'</div>'
    +'<div style="display:flex;gap:8px;margin-top:16px">'
    +'<button type="button" class="btn btn-p" onclick="admGuardarDeuda(\''+p.id+'\')" style="flex:1">Guardar cambios</button>'
    +'<button type="button" class="btn" onclick="document.getElementById(\'edit-deuda-modal\').style.display=\'none\'">Cancelar</button>'
    +'</div>'
    +'</div>';
  mo.style.display='flex';
}

function admGuardarDeuda(id){
  var p=PRESTAMOS.find(function(x){return x.id===id;});
  if(!p)return;
  var nombre=(document.getElementById('ed-nombre')?.value||'').trim();
  if(!nombre){showToast('El nombre es obligatorio');return;}
  p.nombre=nombre;
  p.fechaInicio=document.getElementById('ed-fecha')?.value||p.fechaInicio;
  p.vencimiento=document.getElementById('ed-venc')?.value||'';
  p.cta=document.getElementById('ed-cta')?.value||'';
  p.notas=document.getElementById('ed-notas')?.value||'';
  _addAuditLog(p, 'Edición de detalles de la deuda');
  savePrestamos(p);
  document.getElementById('edit-deuda-modal').style.display='none';
  renderDeudas();
  showToast('Deuda actualizada ✓');
}

function pagarCuota(prestamoId, cuotaNum) {
  var p = PRESTAMOS.find(function(x){ return x.id === prestamoId; });
  if (!p) return;
  var c = p.cuotas.find(function(x){ return x.num === cuotaNum; });
  if (!c) return;
  c.pagada = !c.pagada;
  c.fechaPago = c.pagada ? today() : null;
  // Create MOVS entry when marking paid
  if (c.pagada && typeof igNextId !== 'undefined') {
    var esDeuda = p.direccion !== 'nos_deben';
    var equivUSD = p.moneda === 'USD' ? c.total
      : (typeof toUSD === 'function' ? toUSD(c.total, p.moneda) : c.total / (RATES[p.moneda] || 1));
    MOVS.unshift({
      id: igNextId++,
      fecha: today(),
      tipo: esDeuda ? 'Amortización deuda' : 'Cobro préstamo',
      desc: 'Cuota ' + c.num + '/' + p.cuotas.length + ' — ' + p.nombre,
      acreedor: p.nombre,
      monto: c.total,
      mon: p.moneda,
      equivUSD: parseFloat(equivUSD.toFixed(2)),
      cta: p.cta || '',
      sentido: esDeuda ? 'gasto' : 'ingreso',
      notas: ''
    });
    try { localStorage.setItem('erp_movs', JSON.stringify(MOVS.slice(0, 500))); } catch(e) {}
    if (typeof renderLibro === 'function') try { renderLibro(); } catch(e) {}
    if (typeof renderCajas === 'function') try { renderCajas(); } catch(e) {}
  }
  savePrestamos(p);
  if (typeof renderDeudas === 'function') renderDeudas();
}

function renderPrestamos() {
  var el = document.getElementById('prestamos-root');
  if (!el) return;

  var totalDeuda = PRESTAMOS.reduce(function(a, p) {
    var pendiente = p.cuotas.filter(function(c){ return !c.pagada; }).reduce(function(s,c){ return s+c.total; }, 0);
    return a + (p.moneda === 'USD' ? pendiente : pendiente / (RATES[p.moneda]||1));
  }, 0);

  var html = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">'
    + '<div>'
    + '<div style="font-size:16px;font-weight:700">Préstamos</div>'
    + '<div style="font-size:12px;color:var(--color-text-secondary)">Pendiente total: <strong>'+fN(totalDeuda)+' USD equiv.</strong></div>'
    + '</div>'
    + '<button class="adm-btn adm-btn-p" onclick="showNuevoPrestamo()">+ Nuevo préstamo</button>'
    + '</div>'
    + '<div id="prestamo-form" style="display:none"></div>';

  if (!PRESTAMOS.length) {
    html += '<div style="text-align:center;padding:40px;color:var(--color-text-tertiary)">Sin préstamos registrados</div>';
  } else {
    PRESTAMOS.forEach(function(p) {
      var pagadas = p.cuotas.filter(function(c){ return c.pagada; }).length;
      var pendiente = p.cuotas.filter(function(c){ return !c.pagada; }).reduce(function(a,c){ return a+c.total; }, 0);
      var vencidas = p.cuotas.filter(function(c){ return !c.pagada && c.fecha < today(); }).length;
      var pct = Math.round(pagadas / p.cuotas.length * 100);

      html += '<div class="adm-card" style="margin-bottom:10px">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:10px">'
        + '<div>'
        + '<div style="font-size:14px;font-weight:600">'+p.nombre+'</div>'
        + '<div style="font-size:11px;color:var(--color-text-secondary)">'
        + (p.tipo==='frances'?'Método francés':'Interés simple') + ' · '
        + fN(p.capital)+' '+p.moneda+' · '+p.tasa+'%/mes · '+p.plazo+' meses'
        + (p.cta?' · <span style="color:var(--color-text-tertiary)">'+p.cta+'</span>':'')
        + '</div>'
        + '</div>'
        + '<div style="text-align:right">'
        + '<div style="font-size:13px;font-weight:600;color:'+(vencidas?'var(--color-text-danger)':'var(--color-text-warning)')+'">'+fN(pendiente,2)+' '+p.moneda+' pend.</div>'
        + (vencidas?'<div style="font-size:11px;color:var(--color-text-danger)">⚠ '+vencidas+' vencida'+(vencidas>1?'s':'')+'</div>':'')
        + '</div>'
        + '</div>'
        // Progress bar
        + '<div style="background:var(--color-background-secondary);border-radius:4px;height:6px;margin-bottom:10px">'
        + '<div style="background:var(--color-text-success);height:6px;border-radius:4px;width:'+pct+'%"></div>'
        + '</div>'
        + '<div style="font-size:11px;color:var(--color-text-tertiary);margin-bottom:8px">'+pagadas+'/'+p.cuotas.length+' cuotas pagadas ('+pct+'%)</div>'
        // Cuotas table (first 5 unpaid)
        + '<details><summary style="cursor:pointer;font-size:12px;color:var(--color-text-secondary)">Ver cuotas</summary>'
        + '<div style="overflow-x:auto;margin-top:8px"><table class="adm-table"><thead><tr>'
        + '<th>#</th><th>Fecha</th><th style="text-align:right">Capital</th><th style="text-align:right">Interés</th><th style="text-align:right">Total</th>'
        + (p.tipo==='frances'?'<th style="text-align:right">Saldo</th>':'')
        + '<th>Estado</th></tr></thead><tbody>'
        + p.cuotas.map(function(c){
            var vencida = !c.pagada && c.fecha < today();
            return '<tr style="'+(c.pagada?'opacity:.5':'')+(vencida?';background:rgba(248,113,113,.07)':'')+'">'
              + '<td>'+c.num+'</td>'
              + '<td>'+fD(c.fecha)+'</td>'
              + '<td style="text-align:right">'+fN(c.capital,2)+'</td>'
              + '<td style="text-align:right">'+fN(c.interes,2)+'</td>'
              + '<td style="text-align:right;font-weight:500">'+fN(c.total,2)+'</td>'
              + (p.tipo==='frances'?'<td style="text-align:right">'+fN(c.saldoRestante||0,2)+'</td>':'')
              + '<td><button class="adm-btn-sm" onclick="pagarCuota(\''+p.id+'\','+c.num+')" style="color:'+(c.pagada?'var(--color-text-success)':vencida?'var(--color-text-danger)':'var(--color-text-secondary)')+'">'
              + (c.pagada?'✓ Pagada':vencida?'⚠ Vencida':'Pagar')+'</button></td>'
              + '</tr>';
          }).join('')
        + '</tbody></table></div></details>'
        + '<div style="display:flex;gap:6px;margin-top:8px">'
        + '<button class="adm-btn-sm" onclick="eliminarPrestamo(\''+p.id+'\')" style="color:var(--color-text-danger)">Eliminar</button>'
        + '</div>'
        + '</div>';
    });
  }

  el.innerHTML = html;
}

function showNuevoPrestamo() {
  var el = document.getElementById('prestamo-form');
  if (!el) return;
  el.style.display = 'block';
  var cajas = getAllCajas();
  el.innerHTML = '<div class="adm-card" style="margin-bottom:14px">'
    + '<div style="font-size:13px;font-weight:600;margin-bottom:12px">Nuevo préstamo</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    + '<div style="grid-column:1/-1"><label class="adm-lbl-f">Nombre / Descripción *</label>'
    + '<input class="adm-inp" id="pr-nombre" placeholder="Ej: Préstamo Fito — Container 3"></div>'
    + '<div><label class="adm-lbl-f">Tipo de préstamo</label>'
    + '<select class="adm-inp" id="pr-tipo" onchange="updPrestamoForm()">'
    + '<option value="interes_simple">Interés simple (cuota fija sin amortizar)</option>'
    + '<option value="frances">Método francés (amortizando capital)</option>'
    + '</select></div>'
    + '<div><label class="adm-lbl-f">Capital (importe prestado)</label>'
    + '<input class="adm-inp" type="number" id="pr-capital" value="0" step="0.01" oninput="updPrestamoForm()"></div>'
    + '<div><label class="adm-lbl-f">Tasa mensual (%)</label>'
    + '<input class="adm-inp" type="number" id="pr-tasa" value="2" step="0.1" oninput="updPrestamoForm()"></div>'
    + '<div><label class="adm-lbl-f">Plazo (meses)</label>'
    + '<input class="adm-inp" type="number" id="pr-plazo" value="12" step="1" min="1" oninput="updPrestamoForm()"></div>'
    + '<div><label class="adm-lbl-f">Moneda</label>'
    + '<select class="adm-inp" id="pr-mon">'
    + ['USD','EUR','CUP','CUPT'].map(function(m){ return '<option>'+m+'</option>'; }).join('')
    + '</select></div>'
    + '<div><label class="adm-lbl-f">Fecha inicio</label>'
    + '<input class="adm-inp" type="date" id="pr-fecha" value="'+today()+'"></div>'
    + '<div><label class="adm-lbl-f">Cuenta de pago</label>'
    + '<select class="adm-inp" id="pr-cta">'
    + '<option value="">Sin asignar</option>'
    + cajas.map(function(k){ return '<option>'+k+'</option>'; }).join('')
    + '</select></div>'
    + '<div style="grid-column:1/-1"><label class="adm-lbl-f">Notas</label>'
    + '<input class="adm-inp" id="pr-notas" placeholder="Observaciones..."></div>'
    + '</div>'
    + '<div id="pr-preview" style="margin-top:12px;font-size:12px;color:var(--color-text-secondary)"></div>'
    + '<div style="display:flex;gap:8px;margin-top:14px">'
    + '<button class="adm-btn adm-btn-p" onclick="admCrearPrestamo()">Crear préstamo</button>'
    + '<button class="adm-btn" onclick="document.getElementById(\'prestamo-form\').style.display=\'none\'">Cancelar</button>'
    + '</div>'
    + '</div>';
  updPrestamoForm();
}

function updPrestamoForm() {
  var capital = parseFloat(document.getElementById('pr-capital')?.value)||0;
  var tasa = parseFloat(document.getElementById('pr-tasa')?.value)||0;
  var plazo = parseInt(document.getElementById('pr-plazo')?.value)||1;
  var tipo = document.getElementById('pr-tipo')?.value||'frances';
  var el = document.getElementById('pr-preview');
  if (!el || !capital) return;
  if (tipo === 'interes_simple') {
    var int = capital * tasa/100;
    var totalPagar = capital + int * plazo;
    el.innerHTML = '<strong>Cuota mensual:</strong> '+fN(int,2)+' (solo interés) · Último mes: '+fN(capital+int,2)
      + ' · <strong>Total a pagar: '+fN(totalPagar,2)+'</strong>';
  } else {
    var r = tasa/100;
    var pmt = r===0 ? capital/plazo : capital*r*Math.pow(1+r,plazo)/(Math.pow(1+r,plazo)-1);
    el.innerHTML = '<strong>Cuota mensual:</strong> '+fN(pmt,2)+' · <strong>Total a pagar: '+fN(pmt*plazo,2)+'</strong>';
  }
}

function admCrearPrestamo() {
  var nombre = (document.getElementById('pr-nombre')?.value||'').trim();
  if (!nombre) { showToast('El nombre es obligatorio'); return; }
  crearPrestamo({
    nombre: nombre,
    tipo: document.getElementById('pr-tipo').value,
    capital: parseFloat(document.getElementById('pr-capital').value)||0,
    tasa: parseFloat(document.getElementById('pr-tasa').value)||0,
    plazo: parseInt(document.getElementById('pr-plazo').value)||12,
    moneda: document.getElementById('pr-mon').value,
    fechaInicio: document.getElementById('pr-fecha').value||today(),
    cta: document.getElementById('pr-cta').value,
    notas: document.getElementById('pr-notas').value,
  });
  document.getElementById('prestamo-form').style.display = 'none';
  renderPrestamos();
}

function eliminarPrestamo(id) {
  var p=PRESTAMOS.find(function(x){return x.id===id;});
  if(!p)return;
  
  // Safety checks
  var hasPagos = (p.pagos && p.pagos.length>0) || (p.cuotas && p.cuotas.some(function(c){return c.pagada;}));
  if(hasPagos) {
    showToast('❌ No puedes eliminar una deuda con pagos registrados. Elimina los pagos primero o liquídala.');
    return;
  }
  
  if (!confirm('¿Eliminar este préstamo/deuda por completo?')) return;
  
  // Reverse initial capital movement if it exists
  var descApertura = 'Apertura de préstamo/deuda — '+p.nombre;
  if(typeof supaReq==='function' && typeof _supaOnline!=='undefined' && _supaOnline) {
    var q = 'fecha=eq.'+encodeURIComponent(p.fechaInicio||'')+'&monto_origen=eq.'+(p.capital||0)+'&notas=eq.'+encodeURIComponent(descApertura);
    supaReq('DELETE','mov_cajas?'+q).catch(function(e){console.warn('delete inicial:',e);});
  }
  if(typeof _cajasMovs!=='undefined') {
    var cIdx=_cajasMovs.findIndex(function(m){return m.fecha===p.fechaInicio && m.monto_origen===p.capital && m.notas===descApertura;});
    if(cIdx>=0) _cajasMovs.splice(cIdx,1);
  }

  PRESTAMOS = PRESTAMOS.filter(function(x){ return x.id !== id; });
  savePrestamos(null, id);
  if(typeof renderDeudas === 'function') renderDeudas();
  else if(typeof renderPrestamos === 'function') renderPrestamos();
}

function toggleDeudasLiquidadas() {
  var act = localStorage.getItem('erp_mostrar_liquidadas') === 'true';
  localStorage.setItem('erp_mostrar_liquidadas', !act);
  if(typeof renderDeudas === 'function') renderDeudas();
}

function applyStockMov(mov) {
  var p = PRODS.find(function(x){ return x.n === mov.producto; });
  if (!p) return false;
  if (!p.stk_alm) p.stk_alm = { Habana:0, Placetas:0, Xportprise:0 };

  if (mov.tipo === 'entrada') {
    p.stk_alm[mov.almacen] = (p.stk_alm[mov.almacen]||0) + mov.cantidad;
  } else if (mov.tipo === 'salida' || mov.tipo === 'ajuste_baja') {
    p.stk_alm[mov.almacen] = Math.max(0, (p.stk_alm[mov.almacen]||0) - mov.cantidad);
  } else if (mov.tipo === 'ajuste_alta') {
    p.stk_alm[mov.almacen] = (p.stk_alm[mov.almacen]||0) + mov.cantidad;
  } else if (mov.tipo === 'traslado') {
    p.stk_alm[mov.almacen] = Math.max(0, (p.stk_alm[mov.almacen]||0) - mov.cantidad);
    p.stk_alm[mov.almacenDest] = (p.stk_alm[mov.almacenDest]||0) + mov.cantidad;
  } else if (mov.tipo === 'ajuste_abs') {
    // Set absolute value
    p.stk_alm[mov.almacen] = mov.cantidad;
  }
  // Recalculate total
  p.stk = Object.values(p.stk_alm).reduce(function(a,v){return a+v;},0);
  return true;
}

function registrarMovStock(data) {
  var mov = {
    id: 'smov-' + Date.now(),
    fecha: data.fecha || today(),
    tipo: data.tipo,
    producto: data.producto,
    almacen: data.almacen,
    almacenDest: data.almacenDest || '',
    cantidad: parseFloat(data.cantidad) || 0,
    motivo: data.motivo || '',
    contenedor: data.contenedor || '',
    usuario: (typeof S !== 'undefined' && S.user) || 'Admin'
  };
  if (!applyStockMov(mov)) { showToast('Producto no encontrado'); return false; }
  STOCK_MOVS.unshift(mov);
  saveStockMovs();
  // Save to Supabase
  if (_supaOnline) {
    supaReq('POST','stock_movimientos',{
      id: mov.id,
      fecha: mov.fecha,
      tipo: mov.tipo,
      producto: mov.producto,
      almacen: mov.almacen,
      almacen_dest: mov.almacenDest||'',
      cantidad: mov.cantidad,
      motivo: mov.motivo||'',
      contenedor: mov.contenedor||'',
      usuario: mov.usuario
    }).catch(function(e){console.warn('mov supabase:',e);});
  } else {
    enqueue({method:'POST',path:'stock_movimientos',body:{
      id:mov.id,fecha:mov.fecha,tipo:mov.tipo,producto:mov.producto,
      almacen:mov.almacen,almacen_dest:mov.almacenDest||'',
      cantidad:mov.cantidad,motivo:mov.motivo||'',contenedor:mov.contenedor||'',usuario:mov.usuario
    }});
  }
  // Sync stock to Supabase
  var p = PRODS.find(function(x){ return x.n === mov.producto; });
  if (p && _supaOnline) {
    (async function(){
      // Get supaId if missing
      if (!p.supaId) {
        try {
          var lr = await supaReq('GET','productos?nombre=eq.'+encodeURIComponent(p.n)+'&select=id');
          if (lr.ok) { var ld=await lr.json(); if(ld&&ld[0]) p.supaId=ld[0].id; }
        } catch(e) {}
      }
      if (!p.supaId) return;
      // Patch affected almacenes
      var almsToSync = mov.tipo==='traslado'
        ? [mov.almacen, mov.almacenDest]
        : [mov.almacen];
      for (var a of almsToSync) {
        if (!a) continue;
        var qty = (p.stk_alm&&p.stk_alm[a]!=null) ? p.stk_alm[a] : 0;
        try {
          // Use upsert — always works whether row exists or not
          await supaReq('POST',
            'stock_almacen?on_conflict=producto_id,almacen',
            {producto_id:p.supaId, almacen:a, cantidad:qty});
        } catch(e){ console.warn('mov stock sync:',e); }
      }
      console.log('✓ Stock synced:', mov.producto, almsToSync.join('+'));
    })();
  }
  if (typeof renderStock === 'function') try { renderStock(); } catch(e) {}
  return true;
}

// ── UI ───────────────────────────────────────────────────────
var _stockMovTab = 'nuevo'; // 'nuevo' | 'historial'

function renderStockMovimientos() {
  var el = document.getElementById('stock-movs-panel');
  if (!el) return;
  var _isAdmStock = typeof S!=='undefined'&&S.user&&USERS[S.user]&&USERS[S.user].rol==='admin';

  var html = '<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">'
    + (_isAdmStock ? '<button class="adm-tab'+(_stockMovTab==='nuevo'?' act':'')+'" onclick="_stockMovTab=\'nuevo\';renderStockMovimientos()">📥 Nuevo movimiento</button>' : '')
    + '<button class="adm-tab'+(_stockMovTab==='historial'?' act':'')+'" onclick="_stockMovTab=\'historial\';renderStockMovimientos()">📋 Historial</button>'
    + '</div>';

  if (_stockMovTab === 'nuevo') {
    var alms = ['Habana','Placetas','Xportprise'];
    var tipos = [
      {v:'entrada',    l:'📥 Entrada (compra/recepción)'},
      {v:'salida',     l:'📤 Salida (merma/pérdida)'},
      {v:'traslado',   l:'🔄 Traslado entre almacenes'},
      {v:'ajuste_abs', l:'✏️ Ajuste absoluto (fijar cantidad)'},
      {v:'ajuste_alta',l:'➕ Ajuste positivo'},
      {v:'ajuste_baja',l:'➖ Ajuste negativo'},
    ];
    html += '<div class="adm-card">'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:560px">'
      + '<div style="grid-column:1/-1"><label class="adm-lbl-f">Tipo de movimiento</label>'
      + '<select class="adm-inp" id="smov-tipo" onchange="_updMovAlmDest()">'
      + tipos.map(function(t){ return '<option value="'+t.v+'">'+t.l+'</option>'; }).join('')
      + '</select></div>'
      + '<div style="grid-column:1/-1"><label class="adm-lbl-f">Producto</label>'
      + '<select class="adm-inp" id="smov-prod">'
      + PRODS.filter(function(p){return p.activo!==false;}).sort(function(a,b){return a.n.localeCompare(b.n);}).map(function(p){
          return '<option value="'+p.n.replace(/"/g,'&quot;')+'">'+p.n+'</option>';
        }).join('')
      + '</select></div>'
      + '<div><label class="adm-lbl-f">Almacén origen</label>'
      + '<select class="adm-inp" id="smov-alm">'
      + alms.map(function(a){ return '<option>'+a+'</option>'; }).join('')
      + '</select></div>';

    // Dest almacen — always present, hidden unless traslado
    html += '<div id="smov-dest-wrap" style="display:none"><label class="adm-lbl-f">Almacén destino</label>'
      + '<select class="adm-inp" id="smov-alm-dest">'
      + alms.map(function(a){ return '<option>'+a+'</option>'; }).join('')
      + '</select></div>';

    html += '<div><label class="adm-lbl-f">Cantidad</label>'
      + '<input class="adm-inp" type="number" id="smov-qty" value="1" min="0" step="1"></div>'
      + '<div><label class="adm-lbl-f">Fecha</label>'
      + '<input class="adm-inp" type="date" id="smov-fecha" value="'+today()+'"></div>'
      + '<div style="grid-column:1/-1"><label class="adm-lbl-f">Motivo / Referencia</label>'
      + '<input class="adm-inp" id="smov-motivo" placeholder="Ej: Llegada container #3, Merma transporte..."></div>'
      + '<div id="smov-cnt-wrap" style="grid-column:1/-1"><label class="adm-lbl-f">🚢 Lote / Contenedor (para entradas)</label>'
      + '<select class="adm-inp" id="smov-cnt">'
      + '<option value="">— Sin lote —</option>'
      + CONTENEDORES.map(function(c){
          var ic=c.estado==='retrasado'?'⚠️':(c.estado==='recibido'||c.estado==='cerrado'?'✅':(c.estado==='en_transito'||c.estado==='en_aduana'||c.estado==='en_puerto'?'🚢':'📦'));
          var lbl=(c.lote||c.ref)+(c.lote&&c.ref&&c.lote!==c.ref?' (• '+c.ref+')':'');
          var val=c.lote||c.ref;
          return '<option value="'+val+'">'+ic+' Lote: '+lbl+'</option>';
        }).join('')
      + '</select></div>'
      + '</div>'
      + '<button class="adm-btn adm-btn-p" style="margin-top:14px" onclick="admRegistrarMovStock()">Registrar movimiento</button>'
      + '</div>';

  } else {
    // Historial
    var q = (document.getElementById('smov-q')?.value||'').toLowerCase();
    var movs = STOCK_MOVS.filter(function(m){ return !q || m.producto.toLowerCase().includes(q) || m.motivo.toLowerCase().includes(q); });
    var tipoColor = { entrada:'var(--color-text-success)', salida:'var(--color-text-danger)',
      traslado:'var(--color-text-info)', ajuste_abs:'var(--color-text-secondary)',
      ajuste_alta:'var(--color-text-success)', ajuste_baja:'var(--color-text-warning)' };
    var tipoIcon = { entrada:'📥', salida:'📤', traslado:'🔄', ajuste_abs:'✏️', ajuste_alta:'➕', ajuste_baja:'➖' };

    html += '<div style="display:flex;gap:8px;margin-bottom:10px">'
      + '<input class="adm-inp" id="smov-q" placeholder="Buscar producto o motivo..." '
      + 'oninput="_dRender(function(){renderStockMovimientos()})" style="flex:1;max-width:300px">'
      + '<span style="font-size:12px;color:var(--color-text-tertiary);align-self:center">'+movs.length+' movimientos</span>'
      + '</div>';

    if (!movs.length) {
      html += '<div style="text-align:center;padding:30px;color:var(--color-text-tertiary)">Sin movimientos registrados</div>';
    } else {
      html += '<div class="adm-table-wrap"><table class="adm-table"><thead><tr>'
        + '<th>Fecha</th><th>Tipo</th><th>Producto</th><th>Almacén</th><th style="text-align:right">Cant.</th><th>Lote</th><th>Motivo</th><th>Usuario</th><th></th>'
        + '</tr></thead><tbody>'
        + movs.map(function(m){
            var dest = (m.tipo === 'traslado' && m.almacenDest) ? ' → '+m.almacenDest : '';
            var loteBadge = m.contenedor ? _cntBadge(m.contenedor) : '<span style="color:var(--color-text-tertiary);font-size:10px">—</span>';
            var mid = String(m.id).replace(/'/g,'');
            return '<tr>'
              + '<td style="font-size:11px">'+fD(m.fecha)+'</td>'
              + '<td style="font-size:11px;color:'+(tipoColor[m.tipo]||'')+'">'+(tipoIcon[m.tipo]||'')+' '+m.tipo.replace('_',' ')+'</td>'
              + '<td style="font-size:11px;max-width:140px">'+m.producto+'</td>'
              + '<td style="font-size:11px">'+m.almacen+dest+'</td>'
              + '<td style="text-align:right;font-weight:600;color:'+(tipoColor[m.tipo]||'')+'">'
              + (m.tipo==='salida'||m.tipo==='ajuste_baja'?'−':m.tipo==='traslado'?'↔':'+')
              + m.cantidad+'</td>'
              + '<td style="font-size:11px">'+loteBadge+'</td>'
              + '<td style="font-size:11px;color:var(--color-text-secondary);max-width:120px">'+(m.motivo||'—')+'</td>'
              + '<td style="font-size:11px;color:var(--color-text-tertiary)">'+m.usuario+'</td>'
              + '<td><button class="adm-btn" style="padding:2px 7px;font-size:11px" onclick="_editMovLote(\''+mid+'\')">✏️</button></td>'
              + '</tr>';
          }).join('')
        + '</tbody></table></div>';
    }
  }

  el.innerHTML = html;
}

// ── EDITAR LOTE / MOTIVO DE MOVIMIENTO EXISTENTE ────────────────
function _editMovLote(id) {
  var m = STOCK_MOVS.find(function(x){ return String(x.id) === String(id); });
  if (!m) { showToast('Movimiento no encontrado'); return; }
  var mo = document.getElementById('mov-edit-modal');
  if (!mo) {
    mo = document.createElement('div'); mo.id = 'mov-edit-modal';
    mo.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    document.body.appendChild(mo);
  }
  var cntOpts = '<option value="">— Sin lote —</option>'
    + CONTENEDORES.map(function(c){
        var ic = c.estado==='retrasado'?'⚠️':(c.estado==='recibido'||c.estado==='cerrado'?'✅':(c.estado==='en_transito'||c.estado==='en_aduana'||c.estado==='en_puerto'?'🚢':'📦'));
        var lbl = (c.lote||c.ref)+(c.lote&&c.ref&&c.lote!==c.ref?' (• '+c.ref+')':'');
        var val = c.lote||c.ref;
        var sel = (m.contenedor&&m.contenedor===val)?'selected':'';
        return '<option value="'+val+'" '+sel+'>'+ic+' Lote: '+lbl+'</option>';
      }).join('');
  mo.innerHTML = '<div style="background:var(--color-background-primary);border:1px solid var(--color-border-secondary);border-radius:var(--border-radius-lg);padding:22px;max-width:400px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.6)">'
    + '<div style="font-size:14px;font-weight:700;margin-bottom:4px">✏️ Editar movimiento</div>'
    + '<div style="font-size:11px;color:var(--color-text-tertiary);margin-bottom:16px">'+fD(m.fecha)+' · '+m.tipo+' · '+m.producto+' · '+m.cantidad+' uds</div>'
    + '<label style="font-size:11px;font-weight:600;color:var(--color-text-secondary);display:block;margin-bottom:4px">🚢 LOTE / CONTENEDOR</label>'
    + (CONTENEDORES.length
        ? '<select id="mov-edit-cnt" class="adm-inp" style="width:100%;margin-bottom:12px">'+cntOpts+'</select>'
        : '<div style="font-size:11px;color:var(--color-text-tertiary);margin-bottom:12px;padding:8px;background:var(--color-background-secondary);border-radius:4px">Sin contenedores. Crea uno en Admin → 🚢 Contenedores.</div><input type="hidden" id="mov-edit-cnt" value="'+(m.contenedor||'')+'">')
    + '<label style="font-size:11px;font-weight:600;color:var(--color-text-secondary);display:block;margin-bottom:4px">MOTIVO / REFERENCIA</label>'
    + '<input id="mov-edit-motivo" class="adm-inp" style="width:100%;margin-bottom:16px" value="'+(m.motivo||'')+'">'
    + '<input type="hidden" id="mov-edit-id" value="'+id+'">'
    + '<div style="display:flex;gap:8px">'
    + '<button class="adm-btn" style="flex:1" onclick="document.getElementById(\'mov-edit-modal\').style.display=\'none\'">Cancelar</button>'
    + '<button class="adm-btn adm-btn-p" style="flex:1" onclick="_saveMovLote()">✓ Guardar</button>'
    + '</div></div>';
  mo.style.display = 'flex';
}

function _saveMovLote() {
  var id     = (document.getElementById('mov-edit-id')||{}).value||'';
  var cnt    = (document.getElementById('mov-edit-cnt')||{}).value||'';
  var motivo = (document.getElementById('mov-edit-motivo')||{}).value||'';
  var m = STOCK_MOVS.find(function(x){ return String(x.id) === String(id); });
  if (!m) { showToast('Movimiento no encontrado'); return; }
  m.contenedor = cnt;
  m.motivo = motivo;
  saveStockMovs();
  // Sync patch to Supabase if online
  if (typeof _supaOnline !== 'undefined' && _supaOnline && typeof supaReq === 'function') {
    supaReq('PATCH', 'stock_movimientos?id=eq.'+encodeURIComponent(id), {
      contenedor: cnt||'', motivo: motivo||''
    }).catch(function(e){ console.warn('mov patch supabase:', e); });
  }
  document.getElementById('mov-edit-modal').style.display = 'none';
  showToast('✓ Movimiento actualizado');
  renderStockMovimientos();
}

function admRegistrarMovStock() {
  var tipo   = (document.getElementById('smov-tipo') || {}).value;
  var prod   = (document.getElementById('smov-prod') || {}).value;
  var alm    = (document.getElementById('smov-alm') || {}).value;
  var almD   = (document.getElementById('smov-alm-dest') || {}).value || '';
  var qty    = parseFloat((document.getElementById('smov-qty') || {}).value) || 0;
  var fecha  = (document.getElementById('smov-fecha') || {}).value || today();
  var motivo = (document.getElementById('smov-motivo') || {}).value || '';
  var cnt    = (document.getElementById('smov-cnt') || {}).value || '';

  if (!tipo || !prod) { showToast('Selecciona tipo y producto'); return; }
  if (qty <= 0) { showToast('La cantidad debe ser mayor que 0'); return; }
  if (tipo === 'traslado' && alm === almD) { showToast('Almacén origen y destino no pueden ser iguales'); return; }

  var data = {
    tipo: tipo, producto: prod, almacen: alm,
    almacenDest: almD, cantidad: qty, fecha: fecha, motivo: motivo, contenedor: cnt
  };
  var ok = registrarMovStock(data);
  if (ok) {
    showToast('✓ Movimiento registrado: ' + qty + ' uds ' + tipo + (cnt?' · '+cnt:''));
    if (typeof renderStock === 'function') renderStock();
    var qEl = document.getElementById('smov-qty');
    var mEl = document.getElementById('smov-motivo');
    var cEl = document.getElementById('smov-cnt');
    if (qEl) qEl.value = '1';
    if (mEl) mEl.value = '';
    if (cEl) cEl.value = '';
  } else {
    showToast('Error: producto no encontrado');
  }
}

// ── EDITAR LOTE / MOTIVO DE MOVIMIENTO EXISTENTE ────────────────
function _editMovLote(id) {
  var m = STOCK_MOVS.find(function(x){ return String(x.id) === String(id); });
  if (!m) { showToast('Movimiento no encontrado'); return; }
  var mo = document.getElementById('mov-edit-modal');
  if (!mo) {
    mo = document.createElement('div'); mo.id = 'mov-edit-modal';
    mo.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    document.body.appendChild(mo);
  }
  var cntOpts = '<option value="">— Sin lote —</option>'
    + CONTENEDORES.map(function(c){
        var ic = c.estado==='retrasado'?'⚠️':(c.estado==='recibido'||c.estado==='cerrado'?'✅':(c.estado==='en_transito'||c.estado==='en_aduana'||c.estado==='en_puerto'?'🚢':'📦'));
        var lbl = (c.lote||c.ref)+(c.lote&&c.ref&&c.lote!==c.ref?' (• '+c.ref+')':'');
        var val = c.lote||c.ref;
        var sel = (m.contenedor&&m.contenedor===val)?'selected':'';
        return '<option value="'+val+'" '+sel+'>'+ic+' Lote: '+lbl+'</option>';
      }).join('');
  mo.innerHTML = '<div style="background:var(--color-background-primary);border:1px solid var(--color-border-secondary);border-radius:var(--border-radius-lg);padding:22px;max-width:400px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.6)">'
    + '<div style="font-size:14px;font-weight:700;margin-bottom:4px">✏️ Editar movimiento</div>'
    + '<div style="font-size:11px;color:var(--color-text-tertiary);margin-bottom:16px">'+fD(m.fecha)+' · '+m.tipo+' · '+m.producto+' · '+m.cantidad+' uds</div>'
    + '<label style="font-size:11px;font-weight:600;color:var(--color-text-secondary);display:block;margin-bottom:4px">🚢 LOTE / CONTENEDOR</label>'
    + (CONTENEDORES.length
        ? '<select id="mov-edit-cnt" class="adm-inp" style="width:100%;margin-bottom:12px">'+cntOpts+'</select>'
        : '<div style="font-size:11px;color:var(--color-text-tertiary);margin-bottom:12px;padding:8px;background:var(--color-background-secondary);border-radius:4px">Sin contenedores. Crea uno en Admin → 🚢 Contenedores.</div><input type="hidden" id="mov-edit-cnt" value="'+(m.contenedor||'')+'">')
    + '<label style="font-size:11px;font-weight:600;color:var(--color-text-secondary);display:block;margin-bottom:4px">MOTIVO / REFERENCIA</label>'
    + '<input id="mov-edit-motivo" class="adm-inp" style="width:100%;margin-bottom:16px" value="'+(m.motivo||'')+'">'
    + '<input type="hidden" id="mov-edit-id" value="'+id+'">'
    + '<div style="display:flex;gap:8px">'
    + '<button class="adm-btn" style="flex:1" onclick="document.getElementById(\'mov-edit-modal\').style.display=\'none\'">Cancelar</button>'
    + '<button class="adm-btn adm-btn-p" style="flex:1" onclick="_saveMovLote()">✓ Guardar</button>'
    + '</div></div>';
  mo.style.display = 'flex';
}

function _saveMovLote() {
  var id     = (document.getElementById('mov-edit-id')||{}).value||'';
  var cnt    = (document.getElementById('mov-edit-cnt')||{}).value||'';
  var motivo = (document.getElementById('mov-edit-motivo')||{}).value||'';
  var m = STOCK_MOVS.find(function(x){ return String(x.id) === String(id); });
  if (!m) { showToast('Movimiento no encontrado'); return; }
  m.contenedor = cnt;
  m.motivo = motivo;
  saveStockMovs();
  // Sync patch to Supabase if online
  if (typeof _supaOnline !== 'undefined' && _supaOnline && typeof supaReq === 'function') {
    supaReq('PATCH', 'stock_movimientos?id=eq.'+encodeURIComponent(id), {
      contenedor: cnt||'', motivo: motivo||''
    }).catch(function(e){ console.warn('mov patch supabase:', e); });
  }
  document.getElementById('mov-edit-modal').style.display = 'none';
  showToast('✓ Movimiento actualizado');
  renderStockMovimientos();
}



function _updMovAlmDest() {
  var tipo = (document.getElementById('smov-tipo')||{}).value;
  var dest = document.getElementById('smov-dest-wrap');
  if (dest) dest.style.display = tipo === 'traslado' ? '' : 'none';
}





