const SUPA_URL = 'https://gpkslaqfqfdeoleiayng.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdwa3NsYXFmcWZkZW9sZWlheW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2Nzk0MzQsImV4cCI6MjA4OTI1NTQzNH0.iTMO4obXaYC2O1QkAgkaRjygMvjkFnCFuVBVO35DmRk';

async function run() {
  const rp = await fetch(SUPA_URL + '/rest/v1/productos?select=nombre,qty_reservada,badge_texto,stock_almacen(cantidad)', { headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY }});
  const prods = await rp.json();

  for (const p of prods) {
    if (['ROSCA CHAPA M6.3X25 (1\")', 'ROSCA CHAPA M6.3X38 (1.5\")', 'CHIRRE M4X10', 'KIT TORNILLO&TUERCA M12x70'].includes(p.nombre)) {
      let totalStock = 0;
      if (Array.isArray(p.stock_almacen)) {
        p.stock_almacen.forEach(s => totalStock += (s.cantidad||0));
      }
      console.log(p.nombre + ' -> Stock: ' + totalStock + ' Reservado: ' + p.qty_reservada + ' Badge: ' + p.badge_texto);
    }
  }
}
run();
