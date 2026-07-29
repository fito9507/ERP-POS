

// ═══ MÓDULO BACKUP / EXPORT ═══

function limpiarCacheLocal(){
  if(!confirm('¿Limpiar caché local? Se borrarán ventas, movimientos y cajas del almacenamiento local. Los datos en Supabase no se tocan.')) return;
  var keys = ['erp_ventas','erp_prods','erp_movs','erp_cajas_movs','erp_queue',
    'erp_reservas','erp_reservas_global','erp_liquidaciones'];
  keys.forEach(function(k){ try{localStorage.removeItem(k);}catch(e){} });
  // Reset in-memory
  VENTAS.length=0; MOVS.length=0; _cajasMovs=[]; _syncQueue=[];
  // Reload from Supabase
  if(_supaOnline){
    syncLoadVentas();
    syncLoadMovsIG();
    loadCajasData().then(function(){ if(typeof renderMiCaja==='function')renderMiCaja(); });
  }
  showToast('✓ Caché local limpiado — recargando desde Supabase');
}

function renderBackup() {
  var el = document.getElementById('backup-root');
  if (!el) return;

  var isAdm = typeof S !== 'undefined' && S.user && USERS[S.user] && USERS[S.user].rol === 'admin';

  el.innerHTML = '<div style="max-width:600px">'
    + '<div style="font-size:16px;font-weight:700;margin-bottom:4px">Backup y Exportación</div>'
    + '<div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:20px">El backup diario (.sql + .json) se envía a Telegram a las 8pm. Restaura desde "Restaurar Supabase".</div>'

    + '<div class="adm-card" style="margin-bottom:12px">'
    + '<div style="font-size:13px;font-weight:600;margin-bottom:4px">🔄 Sincronización</div>'
    + '<div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:12px">Empuja los datos locales hacia Supabase manualmente si hace falta.</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    + '<button class="adm-btn" onclick="syncTodosProductos()" style="margin-top:6px">🔄 Sincronizar productos con Supabase</button>'
    + '<button class="adm-btn" onclick="syncPushAllClientes()" style="margin-top:6px">👤 Sincronizar clientes con Supabase</button>'
    + '<button class="adm-btn" style="margin-top:6px;border-color:var(--color-text-danger);color:var(--color-text-danger)" onclick="limpiarCacheLocal()">🗑 Limpiar caché local</button>'
    + '</div>'
    + '</div>'

    + '<div class="adm-card" style="margin-bottom:12px">'    + '<div style="font-size:13px;font-weight:600;margin-bottom:4px">📊 Cierre diario Telegram</div>'    + '<div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:12px">Envía el resumen de ventas del día a los grupos de Telegram. Se envía automáticamente a las 8pm desde Supabase (sin necesitar el navegador abierto).</div>'    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'    + '<button class="adm-btn adm-btn-p" onclick="enviarCierreDiario()">📤 Enviar cierre ahora</button>'    + '<button class="adm-btn" onclick="enviarCierreDiario(new Date(Date.now()-86400000).toISOString().slice(0,10))">📅 Enviar cierre de ayer</button>'    + '<button class="adm-btn" onclick="enviarBackupTelegram()">💾 Enviar backup ahora</button>'    + '</div></div>'    + '<div class="adm-card" style="margin-bottom:12px">'    + '<div style="font-size:13px;font-weight:600;margin-bottom:4px">🗄 Backup SQL (Supabase)</div>'
    + '<div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:12px">Genera un archivo .sql con INSERT statements para restaurar la base de datos en Supabase.</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    + '<button class="adm-btn adm-btn-p" onclick="exportBackupSQL()">⬇ Descargar SQL backup</button>'
    + '<button class="adm-btn" onclick="document.getElementById(\'import-sql-input\').click()">⬆ Restaurar Supabase (.sql / .json)</button>'
    + '<input type="file" id="import-sql-input" accept=".sql,.json" style="display:none" onchange="importarBackupSQL(this)">'
    + '<button class="adm-btn" onclick="backupImagenesTelegram()" style="margin-top:8px">\uD83D\uDCF7 Backup im\u00e1genes \u2192 Telegram</button>'
    + '</div>'

    + '<div class="adm-card" style="margin-bottom:12px">'
    + '<div style="font-size:13px;font-weight:600;margin-bottom:4px">📊 Exportar a Excel</div>'
    + '<div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:12px">Genera un .xlsx con pestañas: Ventas, Productos, Clientes, Movimientos I/G.</div>'
    + '<button class="adm-btn adm-btn-p" onclick="exportExcel()">⬇ Descargar Excel</button>'
    + '</div>'

    + '<div class="adm-card">'
    + '<div style="font-size:13px;font-weight:600;margin-bottom:8px">📈 Resumen de datos</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">'
    + '<div>Productos: <strong>' + PRODS.length + '</strong></div>'
    + '<div>Usuarios: <strong>' + Object.keys(USERS).length + '</strong></div>'
    + '<div>Ventas: <strong>' + (typeof VENTAS !== 'undefined' ? VENTAS.length : 0) + '</strong></div>'
    + '<div>Clientes: <strong>' + (typeof CLIENTES !== 'undefined' ? CLIENTES.length : 0) + '</strong></div>'
    + '<div>Movimientos I/G: <strong>' + (typeof MOVS !== 'undefined' ? MOVS.length : 0) + '</strong></div>'
    + '</div>'
    + '</div>'
    + '</div>';
}

// Backup automático diario — envía SQL al Telegram admin
async function _buildBackupJSON() {
  var snap = {_fecha: new Date().toISOString()};
  var tablas = ['productos','stock_almacen','tasas','tasas_almacen','usuarios','ventas',
                'cajas','mov_cajas','movimientos_ig','clientes','prestamos','comisiones',
                'pedidos','folios','abonos','com_reglas','liquidaciones',
                'stock_movimientos','contenedores'];
  for (var i = 0; i < tablas.length; i++) {
    try {
      var r = await supaReq('GET', tablas[i] + '?select=*&limit=5000');
      if (r.ok) snap[tablas[i]] = await r.json() || [];
    } catch(e) { console.warn('_buildBackupJSON ' + tablas[i] + ':', e); }
  }
  window._backupJSON = snap;
  return snap;
}
async function enviarBackupTelegram() {
  if(!_supaOnline){ console.warn('Sin conexion para backup'); return; }
  if((!TG_ON&&!TG_TOKEN) || !TG_BACKUP){ return; }
  try {
    // 1. Build JSON snapshot first — independent of SQL so it never silently fails
    var snap;
    try { snap = await _buildBackupJSON(); } catch(e) { console.warn('JSON snapshot error:', e); }

    // 2. Send JSON backup to Telegram
    if (snap) {
      try {
        var fdj = new FormData();
        fdj.append('chat_id', TG_BACKUP);
        fdj.append('document', new Blob([JSON.stringify(snap)], {type:'application/json'}),
          'backup_' + new Date().toISOString().slice(0,10) + '.json');
        fdj.append('caption', '\uD83D\uDCE6 Snapshot JSON \u2014 restaurable desde el ERP (Admin \u2192 Restaurar)');
        var rj = await _tgApi('sendDocument', fdj, true);
        if (rj.ok) {
          console.log('Backup JSON enviado');
          try { localStorage.setItem('erp_backup_enviado', new Date().toISOString().slice(0,10)); } catch(e) {}
        } else {
          console.warn('Backup JSON fallo:', rj.status);
        }
      } catch(e) { console.warn('backup json tg:', e); }
    }

    // 3. Rate limit then send SQL
    await new Promise(function(rs){setTimeout(rs, 3000);});
    var sql = await exportBackupSQL(true);
    if(sql){
      var fname = 'backup_'+new Date().toISOString().slice(0,10)+'.sql';
      var inserts = (sql.match(/INSERT INTO/g)||[]).length;
      var caption = '\uD83D\uDCBE <b>Backup SQL diario</b>\n'
        + new Date().toISOString().slice(0,10)+'\n\n'
        + inserts+' registros\n'
        + '\uD83E\uDD16 Backup autom\u00e1tico ERP';
      var fd = new FormData();
      fd.append('chat_id', TG_BACKUP);
      fd.append('document', new Blob([sql], {type:'text/sql'}), fname);
      fd.append('caption', caption);
      fd.append('parse_mode', 'HTML');
      try {
        var r = await _tgApi('sendDocument', fd, true);
        if(r.ok) console.log('Backup SQL enviado a Telegram');
        else console.warn('Backup SQL Telegram fallo:', r.status);
      } catch(errSQL) { console.warn('Error enviando backup SQL:', errSQL); }
    }
  } catch(e){ console.warn('enviarBackupTelegram:', e); }
}

async function backupImagenesTelegram(){
  if(!_supaOnline){ showToast('\u26a0 Necesitas conexi\u00f3n'); return; }
  if((!TG_ON&&!TG_TOKEN)||!TG_BACKUP){ showToast('\u26a0 Telegram no configurado'); return; }
  var conImg=PRODS.filter(function(p){return p.img;});
  if(!conImg.length){ showToast('No hay productos con imagen'); return; }
  if(!confirm('Enviar '+conImg.length+' im\u00e1genes de productos al grupo de backup de Telegram?\n(Puede tardar unos minutos)')) return;
  var ok=0,err=0;
  for(var i=0;i<conImg.length;i++){
    var p=conImg[i];
    try{
      var ir=await fetch(p.img);
      if(!ir.ok){err++;continue;}
      var blob=await ir.blob();
      var ext=(p.img.split('.').pop()||'jpg').split('?')[0].slice(0,4);
      var fd=new FormData();
      fd.append('chat_id',TG_BACKUP);
      fd.append('document',blob,(p.nombre||'producto').replace(/[^\w\-]/g,'_')+'.'+ext);
      fd.append('caption','\uD83D\uDCF7 '+p.nombre);
      var tr=await _tgApi('sendDocument', fd, true);
      if(tr.ok)ok++; else err++;
      showToast('\uD83D\uDCF7 '+(i+1)+'/'+conImg.length);
      await new Promise(function(rs){setTimeout(rs,1200);}); // rate limit telegram
    }catch(e){err++;}
  }
  showToast('\u2713 Im\u00e1genes: '+ok+' enviadas'+(err?' \u00b7 '+err+' errores':''));
}

async function importarBackupSQL(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = async function(e) {
    var sql = e.target.result;
    // ── Restauracion JSON via REST (modifica Supabase directamente, sin exec_sql) ──
    if (file.name.endsWith('.json') || (sql && sql.trim().charAt(0)==='{')) {
      var data; try{ data=JSON.parse(sql); }catch(_e){ showToast('\u26a0 JSON no v\u00e1lido'); return; }
      var tablas=Object.keys(data).filter(function(k){return k.charAt(0)!=='_'&&Array.isArray(data[k]);});
      var totReg=tablas.reduce(function(a,t){return a+data[t].length;},0);
      if(!confirm('\u00bfRestaurar backup JSON ('+(data._fecha||'?').slice(0,10)+')?\n\n'+tablas.length+' tablas, '+totReg+' registros.\nLos registros existentes con el mismo id se ACTUALIZARAN.\n\n\u00bfContinuar?')) return;
      showToast('\u23f3 Restaurando '+totReg+' registros...');
      var okT=0, errT=0;
      for(var ti=0;ti<tablas.length;ti++){
        var tn=tablas[ti], rows=data[tn];
        for(var ri=0;ri<rows.length;ri++){
          var row=rows[ri];
          try{
            var rr=await supaReq('POST',tn,row);
            if(rr.ok){okT++;}
            else if(rr.status===409&&row.id!==undefined){
              var body2=Object.assign({},row); delete body2.id;
              var rp=await supaReq('PATCH',tn+'?id=eq.'+row.id,body2);
              if(rp.ok)okT++; else errT++;
            } else errT++;
          }catch(_e){errT++;}
        }
        showToast('\u23f3 '+tn+' \u2713 ('+(ti+1)+'/'+tablas.length+')');
      }
      showToast(errT===0?('\u2713 Restauraci\u00f3n completa: '+okT+' registros'):('\u2713 '+okT+' OK \u00b7 '+errT+' errores (ver consola)'));
      if(typeof syncLoadVentas==='function')try{await syncLoadVentas();}catch(_e){}
      if(typeof syncLoadMovsIG==='function')try{await syncLoadMovsIG();}catch(_e){}
      if(typeof loadCajasData==='function')try{await loadCajasData();}catch(_e){}
      if(typeof syncLoadClientes==='function')try{await syncLoadClientes();}catch(_e){}
      return;
    }
    if (!sql || !sql.includes('INSERT INTO')) {
      showToast('⚠ Archivo no válido — no contiene sentencias INSERT');
      return;
    }
    // Count statements
    var total = (sql.match(/INSERT INTO/g)||[]).length;
    if (!confirm('¿Restaurar backup?\n\n' + total + ' registros encontrados.\nEsto sobreescribirá los datos actuales en Supabase.\n\n¿Continuar?')) return;

    showToast('⏳ Restaurando ' + total + ' registros...');
    // Split by statement and execute
    var stmts = sql.split(';').map(function(s){ return s.trim(); }).filter(function(s){ return s.startsWith('INSERT INTO'); });
    var ok = 0; var err = 0;
    for (var i = 0; i < stmts.length; i++) {
      // Use Supabase REST — send raw SQL via rpc
      try {
        var r = await supaReq('POST', 'rpc/exec_sql', {sql: stmts[i]+';'});
        if (r.ok) ok++; else err++;
      } catch(e) { err++; }
    }
    if (ok === 0 && err > 0) {
      // Fallback: rpc not available — show instructions
      showToast('⚠ Pega el SQL manualmente en Supabase SQL Editor');
      alert('El backup no se puede restaurar automáticamente porque la función rpc/exec_sql no está disponible.\n\nPasos para restaurar:\n1. Abre Supabase → SQL Editor\n2. Pega el contenido del archivo .sql\n3. Pulsa Run');
    } else {
      showToast('✓ Restauración completada: ' + ok + ' OK · ' + err + ' errores');
      // Reload data
      await syncLoadProductos();
      if (typeof syncLoadVentas === 'function') await syncLoadVentas();
      if (typeof loadCajasData === 'function') await loadCajasData();
      showToast('✓ Datos recargados desde Supabase');
    }
  };
  reader.readAsText(file);
  input.value = '';
}

async function exportBackupSQL(returnSQL) {
  if(!_supaOnline){ showToast('⚠ Necesitas conexión para generar el backup SQL'); return; }
  showToast('⏳ Generando backup SQL...');
  var sql = '-- BACKUP Marin Metal PDL\n-- Fecha: ' + new Date().toISOString() + '\n\n';

  try {
    var esc = function(v){ return (v!=null && v!==undefined && v!=='') ? "'"+String(v).replace(/'/g,"''")+"'" : 'NULL'; };
    var escN = function(v){ return (v!=null && v!==undefined) ? parseFloat(v) : 'NULL'; };
    var escB = function(v){ return v === true ? 'true' : v === false ? 'false' : 'false'; };
    var escJ = function(v){ return v!=null ? "'"+JSON.stringify(v).replace(/'/g,"''")+"'::jsonb" : "'[]'::jsonb"; };

    // 1. Productos — TODOS los campos
    sql += '-- ── PRODUCTOS ──────────────────────────\n';
    var prods = await supaReq('GET','productos?select=*&order=nombre.asc');
    if(prods.ok){
      var pd = await prods.json();
      pd.forEach(function(r){
        sql += "INSERT INTO productos ("
          + "nombre,categoria,precio_min,precio_maj,precio_ddp,stk_min,activo,en_stock,en_web,"
          + "imagen_url,en_transito,precio_min_placetas,precio_maj_placetas,"
          + "en_transito_habana,en_transito_placetas,en_transito_xportprise,"
          + "precio_preventa_min,precio_preventa_maj,moq,precios_escala,"
          + "en_oferta,badge_texto,precio_oferta,precio_oferta_habana,precio_oferta_placetas"
          + ") VALUES ("
          + esc(r.nombre)+","+esc(r.categoria)+","
          + escN(r.precio_min)+","+escN(r.precio_maj)+","+escN(r.precio_ddp)+","
          + (r.stk_min||10)+","
          + escB(r.activo)+","+escB(r.en_stock)+","+escB(r.en_web)+","
          + esc(r.imagen_url)+","
          + escB(r.en_transito)+","
          + escN(r.precio_min_placetas)+","+escN(r.precio_maj_placetas)+","
          + escB(r.en_transito_habana)+","+escB(r.en_transito_placetas)+","+escB(r.en_transito_xportprise)+","
          + escN(r.precio_preventa_min)+","+escN(r.precio_preventa_maj)+","
          + (r.moq||1)+","
          + escJ(r.precios_escala)+","
          + escB(r.en_oferta)+","+esc(r.badge_texto)+","
          + escN(r.precio_oferta)+","+escN(r.precio_oferta_habana)+","+escN(r.precio_oferta_placetas)
          + ") ON CONFLICT (nombre) DO UPDATE SET "
          + "categoria=EXCLUDED.categoria,precio_min=EXCLUDED.precio_min,precio_maj=EXCLUDED.precio_maj,"
          + "precio_ddp=EXCLUDED.precio_ddp,stk_min=EXCLUDED.stk_min,activo=EXCLUDED.activo,"
          + "en_stock=EXCLUDED.en_stock,en_web=EXCLUDED.en_web,imagen_url=EXCLUDED.imagen_url,"
          + "en_transito=EXCLUDED.en_transito,precio_min_placetas=EXCLUDED.precio_min_placetas,"
          + "precio_maj_placetas=EXCLUDED.precio_maj_placetas,en_transito_habana=EXCLUDED.en_transito_habana,"
          + "en_transito_placetas=EXCLUDED.en_transito_placetas,en_transito_xportprise=EXCLUDED.en_transito_xportprise,"
          + "precio_preventa_min=EXCLUDED.precio_preventa_min,precio_preventa_maj=EXCLUDED.precio_preventa_maj,"
          + "moq=EXCLUDED.moq,precios_escala=EXCLUDED.precios_escala,en_oferta=EXCLUDED.en_oferta,"
          + "badge_texto=EXCLUDED.badge_texto,precio_oferta=EXCLUDED.precio_oferta,"
          + "precio_oferta_habana=EXCLUDED.precio_oferta_habana,precio_oferta_placetas=EXCLUDED.precio_oferta_placetas;\n";
      });
    }

    // 2. Stock por almacén
    sql += '\n-- ── STOCK ──────────────────────────────\n';
    var stk = await supaReq('GET','stock_almacen?select=producto_id,almacen,cantidad,productos(nombre)');
    if(stk.ok){
      var sd = await stk.json();
      sd.forEach(function(r){
        if(!r.productos) return;
        sql += "INSERT INTO stock_almacen (producto_id,almacen,cantidad) VALUES ((SELECT id FROM productos WHERE nombre='"+r.productos.nombre.replace(/'/g,"''")+"'),'"+r.almacen+"',"+(r.cantidad||0)+") ON CONFLICT (producto_id,almacen) DO UPDATE SET cantidad=EXCLUDED.cantidad;\n";
      });
    }

    // 3. Tasas
    sql += '\n-- ── TASAS ──────────────────────────────\n';
    var tasas = await supaReq('GET','tasas?select=*');
    if(tasas.ok){
      var td = await tasas.json();
      td.forEach(function(r){
        sql += "INSERT INTO tasas (moneda,valor,tasa_mkt,ajuste) VALUES ('"+r.moneda+"',"+(r.valor||0)+","+(r.tasa_mkt||0)+","+(r.ajuste||0)+") ON CONFLICT (moneda) DO UPDATE SET valor=EXCLUDED.valor,tasa_mkt=EXCLUDED.tasa_mkt,ajuste=EXCLUDED.ajuste;\n";
      });
    }

    // 4. Tasas almacen
    sql += '\n-- ── TASAS ALMACEN ───────────────────────\n';
    var ta = await supaReq('GET','tasas_almacen?select=*');
    if(ta.ok){
      var tad = await ta.json();
      tad.forEach(function(r){
        sql += "INSERT INTO tasas_almacen (almacen,moneda,ajuste) VALUES ('"+r.almacen+"','"+r.moneda+"',"+(r.ajuste||0)+") ON CONFLICT (almacen,moneda) DO UPDATE SET ajuste=EXCLUDED.ajuste;\n";
      });
    }

    // 5. Usuarios
    sql += '\n-- ── USUARIOS ────────────────────────────\n';
    var usrs = await supaReq('GET','usuarios?select=*');
    if(usrs.ok){
      var ud = await usrs.json();
      ud.forEach(function(r){
        sql += "INSERT INTO usuarios (nombre,pin,rol,almacen,color,tc,activo,puede_vender,a_comision) VALUES ("+esc(r.nombre)+","+esc(r.pin)+","+esc(r.rol)+","+esc(r.almacen)+","+esc(r.color)+","+esc(r.tc)+","+(r.activo!==false)+","+(r.puede_vender!==false)+","+(r.a_comision!==false)+") ON CONFLICT (nombre) DO UPDATE SET pin=EXCLUDED.pin,rol=EXCLUDED.rol,almacen=EXCLUDED.almacen,color=EXCLUDED.color,tc=EXCLUDED.tc,activo=EXCLUDED.activo,puede_vender=EXCLUDED.puede_vender,a_comision=EXCLUDED.a_comision;\n";
      });
    }

    // 6. Ventas (TODAS)
    sql += '\n-- ── VENTAS ──────────────────────────────\n';
    var vts = await supaReq('GET','ventas?select=*&order=fecha.desc&limit=10000');
    if(vts.ok){
      var vd = await vts.json();
      vd.forEach(function(r){
        sql += "INSERT INTO ventas (fecha,vendedor,almacen,cliente,tipo,productos,total_usd,moneda_cobro,com_pct,com_usd,est_com,cobrado_usd,notas,cobros_json) VALUES ("+esc(r.fecha)+","+esc(r.vendedor)+","+esc(r.almacen)+","+esc(r.cliente)+","+esc(r.tipo)+","+esc(r.productos)+","+(r.total_usd||0)+","+esc(r.moneda_cobro)+","+(r.com_pct||0)+","+(r.com_usd||0)+","+esc(r.est_com)+","+(r.cobrado_usd||0)+","+esc(r.notas)+","+esc(r.cobros_json)+") ON CONFLICT DO NOTHING;\n";
      });
    }

    // 7. Cajas
    sql += '\n-- ── CAJAS ───────────────────────────────\n';
    var cjs = await supaReq('GET','cajas?select=*');
    if(cjs.ok){
      var cjd = await cjs.json();
      cjd.forEach(function(r){
        sql += "INSERT INTO cajas (nombre,moneda,almacen,saldo_inicial,activa) VALUES ("+esc(r.nombre)+","+esc(r.moneda)+","+esc(r.almacen)+","+(r.saldo_inicial||0)+","+(r.activa!==false)+") ON CONFLICT (nombre) DO UPDATE SET moneda=EXCLUDED.moneda,almacen=EXCLUDED.almacen,saldo_inicial=EXCLUDED.saldo_inicial,activa=EXCLUDED.activa;\n";
      });
    }

    // 8. Movimientos de cajas
    sql += '\n-- ── MOV CAJAS ───────────────────────────\n';
    var mcj = await supaReq('GET','mov_cajas?select=*&order=created_at.desc&limit=10000');
    if(mcj.ok){
      var mcd = await mcj.json();
      mcd.forEach(function(r){
        sql += "INSERT INTO mov_cajas (caja_origen,caja_destino,monto_origen,monto_destino,concepto,usuario,fecha) VALUES ("+esc(r.caja_origen)+","+esc(r.caja_destino)+","+(r.monto_origen||0)+","+(r.monto_destino||0)+","+esc(r.concepto)+","+esc(r.usuario)+","+esc(r.fecha)+") ON CONFLICT DO NOTHING;\n";
      });
    }

    // 9. Movimientos I/G
    sql += '\n-- ── MOVIMIENTOS I/G ─────────────────────\n';
    try {
      var mig = await supaReq('GET','movimientos_ig?select=*&order=fecha.desc&limit=10000');
      if(mig.ok){
        var mid = await mig.json();
        mid.forEach(function(r){
          sql += "INSERT INTO movimientos_ig (fecha,tipo,descripcion,monto,moneda,cuenta,vendedor,almacen,notas) VALUES ("+esc(r.fecha)+","+esc(r.tipo)+","+esc(r.desc)+","+(r.monto||0)+","+esc(r.mon)+","+esc(r.cta)+","+esc(r.vend)+","+esc(r.alm)+","+esc(r.notas)+") ON CONFLICT DO NOTHING;\n";
        });
      }
    } catch(e){}

    // 10. Clientes
    sql += '\n-- ── CLIENTES ────────────────────────────\n';
    try {
      var cls = await supaReq('GET','clientes?select=*');
      if(cls.ok){
        var cld = await cls.json();
        cld.forEach(function(r){
          sql += "INSERT INTO clientes (nombre,telefono,direccion,notas) VALUES ("+esc(r.nombre)+","+esc(r.telefono)+","+esc(r.direccion)+","+esc(r.notas)+") ON CONFLICT (nombre) DO UPDATE SET telefono=EXCLUDED.telefono,direccion=EXCLUDED.direccion,notas=EXCLUDED.notas;\n";
        });
      }
    } catch(e){}

    // 11. Préstamos
    sql += '\n-- ── PRESTAMOS ───────────────────────────\n';
    try {
      var prs = await supaReq('GET','prestamos?select=*&order=fecha_inicio.desc');
      if(prs.ok){
        var prd = await prs.json();
        prd.forEach(function(r){
          sql += "INSERT INTO prestamos (id,nombre,tipo,capital,tasa,plazo,moneda,fecha_inicio,cta,notas,pagos,cuotas,direccion,interes,tipo_interes,frecuencia,vencimiento,cuota_fija)"
            + " VALUES ("+esc(r.id)+","+esc(r.nombre)+","+esc(r.tipo)+","+(r.capital||0)+","+(r.tasa||0)+","+(r.plazo||0)+","+esc(r.moneda||'USD')+","+esc(r.fecha_inicio)+","+esc(r.cta)+","+esc(r.notas)
            + ",'"+JSON.stringify(r.pagos||[]).replace(/'/g,"''")+  "'::jsonb"
            + ",'"+JSON.stringify(r.cuotas||[]).replace(/'/g,"''")+  "'::jsonb"
            + ","+esc(r.direccion)+","+(r.interes||0)+","+esc(r.tipo_interes||'simple')+","+esc(r.frecuencia)+","+esc(r.vencimiento)+","+(r.cuota_fija||0)
            + ") ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre,tipo=EXCLUDED.tipo,capital=EXCLUDED.capital,tasa=EXCLUDED.tasa,plazo=EXCLUDED.plazo,moneda=EXCLUDED.moneda,fecha_inicio=EXCLUDED.fecha_inicio,cta=EXCLUDED.cta,notas=EXCLUDED.notas,pagos=EXCLUDED.pagos,cuotas=EXCLUDED.cuotas,direccion=EXCLUDED.direccion,interes=EXCLUDED.interes,tipo_interes=EXCLUDED.tipo_interes,frecuencia=EXCLUDED.frecuencia,vencimiento=EXCLUDED.vencimiento,cuota_fija=EXCLUDED.cuota_fija;\n";
        });
      }
    } catch(e){ sql += '-- (error al leer prestamos: '+e.message+')\n'; }

    // 11b. Contenedores
    sql += '\n-- ── CONTENEDORES ────────────────────────\n';
    try {
      var cnts = await supaReq('GET','contenedores?select=*&order=created_at.desc');
      if(cnts.ok){
        var cntd = await cnts.json();
        cntd.forEach(function(r){
          sql += "INSERT INTO contenedores (id,ref,estado,proveedor,transitario,almacen_destino,moneda,fecha_booking,fecha_salida,fecha_eta,fecha_llegada,notas,gastos,audit_log)"
            + " VALUES ("+esc(r.id)+","+esc(r.ref)+","+esc(r.estado)+","+esc(r.proveedor)+","+esc(r.transitario)+","+esc(r.almacen_destino)+","+esc(r.moneda||'USD')
            + ","+esc(r.fecha_booking)+","+esc(r.fecha_salida)+","+esc(r.fecha_eta)+","+esc(r.fecha_llegada)+","+esc(r.notas)
            + ",'"+JSON.stringify(r.gastos||[]).replace(/'/g,"''")+"'::jsonb"
            + ",'"+JSON.stringify(r.audit_log||[]).replace(/'/g,"''")+"'::jsonb"
            + ") ON CONFLICT (id) DO UPDATE SET ref=EXCLUDED.ref,estado=EXCLUDED.estado,proveedor=EXCLUDED.proveedor,transitario=EXCLUDED.transitario,almacen_destino=EXCLUDED.almacen_destino,moneda=EXCLUDED.moneda,fecha_booking=EXCLUDED.fecha_booking,fecha_salida=EXCLUDED.fecha_salida,fecha_eta=EXCLUDED.fecha_eta,fecha_llegada=EXCLUDED.fecha_llegada,notas=EXCLUDED.notas,gastos=EXCLUDED.gastos,audit_log=EXCLUDED.audit_log;\n";
        });
      }
    } catch(e){ sql += '-- (error al leer contenedores: '+e.message+')\n'; }

    // 12. Reglas de comisión
    sql += '\n-- ── COMISIONES ──────────────────────────\n';
    try {
      var com = await supaReq('GET','comisiones?select=*');
      if(com.ok){
        var comd = await com.json();
        comd.forEach(function(r){
          sql += "INSERT INTO comisiones (vendedor,tipo,pct,activa) VALUES ("+esc(r.vendedor)+","+esc(r.tipo)+","+(r.pct||0)+","+(r.activa!==false)+") ON CONFLICT (vendedor,tipo) DO UPDATE SET pct=EXCLUDED.pct,activa=EXCLUDED.activa;\n";
        });
      }
    } catch(e){ sql += '-- (sin tabla comisiones o error: '+e.message+')\n'; }

    // 13. Pedidos catálogo
    sql += '\n-- ── PEDIDOS ─────────────────────────────\n';
    try {
      var ped = await supaReq('GET','pedidos?select=*&order=created_at.desc&limit=5000');
      if(ped.ok){
        var pedd = await ped.json();
        pedd.forEach(function(r){
          sql += "INSERT INTO pedidos (id,nombre,telefono,almacen,productos_json,total_usd,moneda,notas,estado,created_at)"
            + " VALUES ("+esc(r.id)+","+esc(r.nombre)+","+esc(r.telefono)+","+esc(r.almacen)
            + ",'"+JSON.stringify(r.productos_json||[]).replace(/'/g,"''")+  "'::jsonb"
            + ","+(r.total_usd||0)+","+esc(r.moneda)+","+esc(r.notas)+","+esc(r.estado||'pendiente')+","+esc(r.created_at)
            + ") ON CONFLICT (id) DO NOTHING;\n";
        });
      }
    } catch(e){ sql += '-- (sin tabla pedidos o error: '+e.message+')\n'; }

    // 14. Número de pedido configurable (tasas tabla, clave PEDIDO_NUM_*)
    // Ya cubierto en sección TASAS arriba

    // ── TABLAS ADICIONALES (folios, abonos, com_reglas, liquidaciones, stock_movimientos) ──
    var _extraTablas=['folios','abonos','com_reglas','liquidaciones','stock_movimientos','contenedores'];
    window._backupJSON={_fecha:new Date().toISOString()};
    for(var _ti=0;_ti<_extraTablas.length;_ti++){
      var _tn=_extraTablas[_ti];
      try{
        var _tr=await supaReq('GET',_tn+'?select=*&limit=5000');
        if(!_tr.ok) continue;
        var _td=await _tr.json()||[];
        window._backupJSON[_tn]=_td;
        sql+='\n-- \u2500\u2500 '+_tn.toUpperCase()+' \u2500\u2500\n';
        _td.forEach(function(r){
          var ks=Object.keys(r).filter(function(k){return r[k]!==undefined;});
          var vals=ks.map(function(k){
            var v=r[k];
            if(v===null) return 'NULL';
            if(typeof v==='number') return v;
            if(typeof v==='boolean') return v?'true':'false';
            if(typeof v==='object') return "'"+JSON.stringify(v).replace(/'/g,"''")+"'::jsonb";
            return "'"+String(v).replace(/'/g,"''")+"'";
          });
          sql+='INSERT INTO '+_tn+' ('+ks.join(',')+') VALUES ('+vals.join(',')+') ON CONFLICT (id) DO NOTHING;\n';
        });
      }catch(e){console.warn('backup '+_tn+':',e);}
    }
    // Guardar tambien las tablas principales en el JSON (para restauracion via REST)
    var _mainTablas=['productos','stock_almacen','tasas','tasas_almacen','usuarios','ventas','cajas','mov_cajas','movimientos_ig','clientes','prestamos','comisiones','pedidos'];
    for(var _mi=0;_mi<_mainTablas.length;_mi++){
      try{
        var _mr=await supaReq('GET',_mainTablas[_mi]+'?select=*&limit=5000');
        if(_mr.ok) window._backupJSON[_mainTablas[_mi]]=await _mr.json()||[];
      }catch(e){}
    }

    if(returnSQL) return sql;
    // Download
    var blob = new Blob([sql], {type:'text/sql'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'backup_marinmetal_'+new Date().toISOString().slice(0,10)+'.sql';
    a.click();
    showToast('✓ SQL backup descargado');
  } catch(e) {
    showToast('⚠ Error: '+e.message);
    console.error('exportBackupSQL:', e);
  }
}

function exportJSON() {
  var data = {
    version: 2,
    fecha: new Date().toISOString(),
    USERS: USERS,
    PRODS: PRODS,
    VENTAS: typeof VENTAS !== 'undefined' ? VENTAS : [],
    CLIENTES: typeof CLIENTES !== 'undefined' ? CLIENTES : [],
    MOVS: typeof MOVS !== 'undefined' ? MOVS : [],
    PRESTAMOS: typeof _prestamosData !== 'undefined' ? _prestamosData : [],
    CAJAS: typeof _cajasData !== 'undefined' ? _cajasData : [],
    CAJAS_MOVS: typeof _cajasMovs !== 'undefined' ? _cajasMovs : [],
    RATES: RATES,
    RATES_ALM: typeof RATES_ALM !== 'undefined' ? RATES_ALM : {},
    CONTENEDORES: typeof CONTENEDORES !== 'undefined' ? CONTENEDORES : [],
  };
  var json = JSON.stringify(data, null, 2);
  var blob = new Blob([json], {type: 'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'marinmetal-erp-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  showToast('JSON descargado ✓');
}

function importJSON(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      if (!data.version || !data.PRODS) { showToast('Archivo JSON inválido'); return; }
      if (!confirm('¿Restaurar todos los datos desde este backup?\n\nFecha: ' + (data.fecha||'desconocida') + '\nProductos: ' + data.PRODS.length + '\nVentas: ' + (data.VENTAS||[]).length + '\n\nEsto sobreescribirá los datos actuales.')) return;
      // Restore
      data.PRODS.forEach(function(p,i){ PRODS[i]=p; }); PRODS.length=data.PRODS.length;
      if(data.VENTAS&&typeof VENTAS!=='undefined'){ data.VENTAS.forEach(function(v,i){VENTAS[i]=v;}); VENTAS.length=data.VENTAS.length; }
      if(data.CLIENTES&&typeof CLIENTES!=='undefined'){ data.CLIENTES.forEach(function(c,i){CLIENTES[i]=c;}); CLIENTES.length=data.CLIENTES.length; }
      if(data.MOVS&&typeof MOVS!=='undefined'){ data.MOVS.forEach(function(m,i){MOVS[i]=m;}); MOVS.length=data.MOVS.length; }
      if(data.CONTENEDORES&&typeof CONTENEDORES!=='undefined'){ data.CONTENEDORES.forEach(function(m,i){CONTENEDORES[i]=m;}); CONTENEDORES.length=data.CONTENEDORES.length; }
      Object.assign(RATES, data.RATES||{});
      showToast('Datos restaurados ✓');
      renderBackup();
    } catch(err) {
      showToast('Error al leer el archivo: ' + err.message);
    }
  };
  reader.readAsText(file);
  input.value = '';
}

function exportExcel() {
  if (typeof XLSX === 'undefined') {
    showToast('Cargando librería Excel...');
    setTimeout(exportExcel, 1500);
    return;
  }
  var wb = XLSX.utils.book_new();

  // ── Hoja 1: VENTAS ──
  var ventasData = [['ID','Fecha','Vendedor','Almacén','Cliente','Tipo','Productos','Total USD','Moneda','Comisión %','Comisión USD','Estado Com.']];
  (typeof VENTAS !== 'undefined' ? VENTAS : []).forEach(function(v) {
    ventasData.push([v.id, v.fecha, v.vend, v.alm, v.cli||'Walk-in', v.tipo, v.prods, v.totalUSD, v.mon, v.comPct||0, v.comUSD||0, v.estCom||'']);
  });
  var wsVentas = XLSX.utils.aoa_to_sheet(ventasData);
  wsVentas['!cols'] = [{wch:6},{wch:12},{wch:10},{wch:12},{wch:14},{wch:10},{wch:40},{wch:12},{wch:8},{wch:10},{wch:12},{wch:12}];
  XLSX.utils.book_append_sheet(wb, wsVentas, 'Ventas');

  // ── Hoja 2: PRODUCTOS ──
  var prodsData = [['Nombre','Categoría','P.Min','P.May','DDP','Stock Total','Habana','Placetas','Xportprise','Stock Mín','Activo']];
  PRODS.forEach(function(p) {
    prodsData.push([
      p.n, p.cat||'', p.min||'', p.maj||'', p.ddp||'',
      p.stk||0,
      (p.stk_alm&&p.stk_alm.Habana)||0,
      (p.stk_alm&&p.stk_alm.Placetas)||0,
      (p.stk_alm&&p.stk_alm.Xportprise)||0,
      p.stk_min||10,
      p.activo===false?'No':'Sí'
    ]);
  });
  var wsProds = XLSX.utils.aoa_to_sheet(prodsData);
  wsProds['!cols'] = [{wch:40},{wch:14},{wch:10},{wch:10},{wch:10},{wch:12},{wch:10},{wch:10},{wch:12},{wch:10},{wch:8}];
  XLSX.utils.book_append_sheet(wb, wsProds, 'Productos');

  // ── Hoja 3: CLIENTES ──
  var cliData = [['ID','Nombre','Almacén','Tel','Deuda Total USD','Pagado USD','Pendiente USD','Folios']];
  (typeof CLIENTES !== 'undefined' ? CLIENTES : []).forEach(function(c) {
    var tot = c.folios ? c.folios.reduce(function(a,f){ return a + f.lineas.reduce(function(b,l){ return b + (toUSD(l.precio,l.mon)*l.q); },0); },0) : 0;
    var pag = c.folios ? c.folios.reduce(function(a,f){ return a + f.abonos.reduce(function(b,ab){ return b + (ab.equivUSD||toUSD(ab.monto,ab.mon)); },0); },0) : 0;
    cliData.push([c.id, c.nombre, c.alm||'', c.tel||'', tot, pag, tot-pag, c.folios?c.folios.length:0]);
  });
  var wsCli = XLSX.utils.aoa_to_sheet(cliData);
  wsCli['!cols'] = [{wch:8},{wch:18},{wch:12},{wch:14},{wch:16},{wch:14},{wch:14},{wch:8}];
  XLSX.utils.book_append_sheet(wb, wsCli, 'Clientes');

  // ── Hoja 4: INGRESOS/GASTOS ──
  var igrData = [['ID','Fecha','Tipo','Descripción','Monto','Moneda','Equiv.USD','Cuenta','Vendedor']];
  (typeof MOVS !== 'undefined' ? MOVS : []).forEach(function(m) {
    igrData.push([m.id, m.fecha, m.tipo, m.desc||'', m.monto, m.mon, m.equivUSD||toUSD(m.monto,m.mon), m.cuenta||'', m.vend||'']);
  });
  var wsIgr = XLSX.utils.aoa_to_sheet(igrData);
  wsIgr['!cols'] = [{wch:6},{wch:12},{wch:20},{wch:30},{wch:12},{wch:8},{wch:12},{wch:16},{wch:12}];
  XLSX.utils.book_append_sheet(wb, wsIgr, 'Ingresos-Gastos');

  // ── Hoja 5: RESUMEN ──
  var resData = [
    ['Marin Metal ERP — Backup', new Date().toLocaleDateString('es-ES')],
    [],
    ['Productos activos', PRODS.filter(function(p){return p.activo!==false;}).length],
    ['Total ventas', (typeof VENTAS!=='undefined'?VENTAS.length:0)],
    ['Total clientes', (typeof CLIENTES!=='undefined'?CLIENTES.length:0)],
    ['Total movimientos I/G', (typeof MOVS!=='undefined'?MOVS.length:0)],
    [],
    ['Tasas de cambio actuales'],
    ['USD', RATES.USD],['EUR', RATES.EUR],['CUP', RATES.CUP],['CUPT', RATES.CUPT],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resData), 'Resumen');

  var fecha = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, 'marinmetal-erp-' + fecha + '.xlsx');
  showToast('Excel descargado ✓');
}


