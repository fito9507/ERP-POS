const SUPA_URL = 'https://gpkslaqfqfdeoleiayng.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdwa3NsYXFmcWZkZW9sZWlheW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2Nzk0MzQsImV4cCI6MjA4OTI1NTQzNH0.iTMO4obXaYC2O1QkAgkaRjygMvjkFnCFuVBVO35DmRk';

async function run() {
  const rf = await fetch(SUPA_URL + '/rest/v1/folios?select=*', { headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY }});
  const folios = await rf.json();
  
  let reservasPorProd = {};
  folios.forEach(f => {
    let lineas = [];
    if (typeof f.lineas === 'string') {
      try { lineas = JSON.parse(f.lineas); } catch(e){}
    } else if (Array.isArray(f.lineas)) {
      lineas = f.lineas;
    }
    lineas.forEach(l => {
      if (!l.prod) return;
      if (!reservasPorProd[l.prod]) reservasPorProd[l.prod] = 0;
      reservasPorProd[l.prod] += (l.q || 0);
    });
  });

  const rp = await fetch(SUPA_URL + '/rest/v1/productos?select=*', { headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY }});
  const prods = await rp.json();

  let updates = 0;
  for (const p of prods) {
    const isTransit = p.en_transito_habana || p.en_transito_placetas || p.en_transito_xportprise;
    if (!isTransit) continue;

    const oldQtyRes = parseInt(p.qty_reservada) || 0;
    const oldBadge = p.badge_texto || '';
    const newQtyRes = reservasPorProd[p.nombre] || 0;

    let totalStock = 0;
    if (Array.isArray(p.stock_almacen)) {
      p.stock_almacen.forEach(s => totalStock += (s.cantidad||0));
    } else if (typeof p.stock_almacen === 'string') {
      try { JSON.parse(p.stock_almacen).forEach(s => totalStock += (s.cantidad||0)); } catch(e){}
    }
    const newBadge = (totalStock > 0 && newQtyRes >= totalStock) ? 'RESERVADO' : '';

    if (newQtyRes !== oldQtyRes || newBadge !== oldBadge) {
      console.log('Update ' + p.nombre + ': qty ' + oldQtyRes + ' -> ' + newQtyRes + ', badge ' + oldBadge + ' -> ' + newBadge);
      await fetch(SUPA_URL + '/rest/v1/productos?id=eq.' + p.id, {
        method: 'PATCH',
        headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ qty_reservada: newQtyRes, badge_texto: newBadge || null })
      });
      updates++;
    }
  }
  console.log('Updated ' + updates + ' products.');
}
run();
