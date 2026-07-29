
async function syncStockUpdate(cart, alm) {
  if (!_supaOnline) return;
  for (var c of cart) {
    var p = PRODS.find(function(x){ return x.n === c.n; });
    if (!p) continue;
    // Lookup supaId by nombre if missing
    if (!p.supaId) {
      try {
        var lr = await supaReq('GET', 'productos?nombre=eq.'+encodeURIComponent(p.n)+'&select=id');
        if (lr.ok) { var ld = await lr.json(); if (ld&&ld[0]) p.supaId = ld[0].id; }
      } catch(e) {}
    }
    if (!p.supaId) continue;
    var qty = (p.stk_alm && p.stk_alm[alm] != null) ? p.stk_alm[alm] : 0;
    try {
      await supaReq('PATCH',
        'stock_almacen?producto_id=eq.'+p.supaId+'&almacen=eq.'+encodeURIComponent(alm),
        { cantidad: qty });
    } catch(e) { console.warn('syncStockUpdate:', e); }
  }
  if (typeof _dRecalcReservas === 'function') _dRecalcReservas();
}
