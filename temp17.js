

async function syncTodosProductos() {
  if (!_supaOnline) { showToast('Sin conexión'); return; }
  showToast('Sincronizando ' + PRODS.length + ' productos...');
  var ok = 0, fail = 0, errors = [];
  for (var p of PRODS) {
    try {
      var row = {
        nombre: p.n,
        categoria: p.cat||'',
        precio_min: p.min!=null ? p.min : null,
        precio_maj: p.maj!=null ? p.maj : null,
        precio_ddp: p.ddp!=null ? p.ddp : null,
        stk_min: p.stk_min||10,
        activo: p.activo!==false
      };
      var r = await supaReq('POST', 'productos?on_conflict=nombre', row);
      if (r.ok) {
        var data = await r.json();
        var pid = data && data[0] ? data[0].id : null;
        if (!pid) {
          // Row already existed, get id by name
          var gr = await supaReq('GET', 'productos?nombre=eq.' + encodeURIComponent(p.n) + '&select=id');
          if (gr.ok) { var gd = await gr.json(); pid = gd && gd[0] ? gd[0].id : null; }
        }
        if (pid) {
          p.supaId = pid;
          for (var alm of ['Habana','Placetas','Xportprise']) {
            var qty = (p.stk_alm && p.stk_alm[alm] != null) ? p.stk_alm[alm] : 0;
            await supaReq('POST', 'stock_almacen?on_conflict=producto_id,almacen',
              { producto_id: pid, almacen: alm, cantidad: qty });
          }
          ok++;
        } else { fail++; errors.push(p.n + ': no id'); }
      } else {
        var errTxt = await r.text();
        fail++;
        errors.push(p.n + ': ' + r.status);
        console.warn('syncTodosProductos error', p.n, r.status, errTxt);
      }
    } catch(e) { fail++; errors.push(p.n + ': ' + e.message); console.warn(e); }
  }
  if (errors.length) console.warn('Sync errors:', errors);
  showToast('✓ ' + ok + ' sync' + (fail ? ' · ' + fail + ' errores' : ' · Todo OK'));
  if (typeof renderBackup === 'function') renderBackup();
}

