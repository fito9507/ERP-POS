
async function updateCajasFromVenta(pagos, vueltos, alm) {
  // Update local CUENTAS_BASE (legacy fallback)
  pagos.forEach(function(p) {
    var mon = p.mon;
    var k = p.caja || (mon + ' ' + alm);
    if (!CUENTAS_BASE[k]) CUENTAS_BASE[k] = {ingV:0, ingIG:0, gasIG:0, mon:mon};
    CUENTAS_BASE[k].ingV += (p.m || 0);
  });
  vueltos.forEach(function(v) {
    var mon = v.mon;
    var k = v.caja || (mon + ' ' + alm);
    if (!CUENTAS_BASE[k]) CUENTAS_BASE[k] = {ingV:0, ingIG:0, gasIG:0, mon:mon};
    CUENTAS_BASE[k].gasIG += (v.m || 0);
  });
  // Write to Supabase mov_cajas — same schema as admRegistrarMovCaja (no created_at, no null fields)
  if (typeof _supaOnline !== 'undefined' && typeof supaReq === 'function') {
    var fecha = today();
    var usuario = (typeof S !== 'undefined' ? S.user : '');
    for (var i = 0; i < pagos.length; i++) {
      var p = pagos[i];
      if (!p.m || p.m <= 0) continue;
      var cajaDest = p.caja || (p.mon + ' ' + alm);
      var row = {
        tipo: 'deposito',
        fecha: fecha,
        notas: 'Venta POS',
        usuario: usuario,
        caja_destino: cajaDest,
        monto_origen: p.m,
        monto_destino: p.m,
        tasa_usada: null
      };
      try {
        _cajasMovs.unshift(row); // optimistic
        if(_supaOnline){
          var r = await supaReq('POST', 'mov_cajas', row);
          if (!r.ok) {
            var errText = await r.text();
            console.warn('mov_cajas pago 400:', errText);
            enqueue({method:'POST',path:'mov_cajas',body:row});
          }
        } else {
          enqueue({method:'POST',path:'mov_cajas',body:row});
        }
      } catch(e) { console.warn('updateCajasFromVenta pago:', e); }
    }
    for (var j = 0; j < vueltos.length; j++) {
      var v2 = vueltos[j];
      if (!v2.m || v2.m <= 0) continue;
      var cajaOrig = v2.caja || (v2.mon + ' ' + alm);
      var rowV = {
        tipo: 'retiro',
        fecha: fecha,
        notas: 'Vuelto POS',
        usuario: usuario,
        caja_origen: cajaOrig,
        monto_origen: v2.m,
        monto_destino: v2.m,
        tasa_usada: null
      };
      try {
        if(_supaOnline){
          var rv = await supaReq('POST', 'mov_cajas', rowV);
          if (!rv.ok) {
            var errTextV = await rv.text();
            console.warn('mov_cajas vuelto 400:', errTextV);
            enqueue({method:'POST',path:'mov_cajas',body:rowV});
          } else {
            var savedV = await rv.json();
            if (savedV&&savedV[0]&&typeof _cajasMovs!=='undefined') _cajasMovs.unshift(savedV[0]);
          }
        } else {
          _cajasMovs.unshift(rowV); // optimistic
          enqueue({method:'POST',path:'mov_cajas',body:rowV});
        }
      } catch(e) { console.warn('updateCajasFromVenta vuelto:', e); }
    }
  }
  if (typeof renderCajas === 'function') { try { renderCajas(); } catch(e) {} }
}
