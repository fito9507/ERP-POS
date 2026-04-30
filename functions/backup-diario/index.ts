import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TG_TOKEN  = Deno.env.get('TG_TOKEN') ?? '';
const TG_BACKUP = '-5277125001';
const SUPA_URL  = Deno.env.get('SUPABASE_URL') ?? '';
const SUPA_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function esc(v: any): string {
  return v != null ? "'" + String(v).replace(/'/g, "''") + "'" : 'NULL';
}

Deno.serve(async (_req: Request): Promise<Response> => {
  console.log('BACKUP START - TG_TOKEN:', TG_TOKEN ? 'SET' : 'MISSING');
  if (!TG_TOKEN) return new Response('TG_TOKEN missing', { status: 500 });

  try {
    const supa = createClient(SUPA_URL, SUPA_KEY);
    const now = new Date().toISOString();
    let sql = `-- BACKUP Marin Metal PDL\n-- Fecha: ${now}\n\n`;
    let total = 0;

    // 1. Productos
    sql += '-- PRODUCTOS\n';
    const { data: prods } = await supa.from('productos').select('*').order('nombre');
    (prods ?? []).forEach((r: any) => {
      sql += `INSERT INTO productos (nombre,categoria,precio_min,precio_maj,precio_ddp,stk_min,activo,en_stock,en_transito,imagen_url) VALUES (${esc(r.nombre)},${esc(r.categoria)},${r.precio_min??'NULL'},${r.precio_maj??'NULL'},${r.precio_ddp??'NULL'},${r.stk_min??10},${r.activo},${r.en_stock},${r.en_transito??false},${esc(r.imagen_url)}) ON CONFLICT (nombre) DO UPDATE SET categoria=EXCLUDED.categoria,precio_min=EXCLUDED.precio_min,precio_maj=EXCLUDED.precio_maj,precio_ddp=EXCLUDED.precio_ddp,stk_min=EXCLUDED.stk_min,activo=EXCLUDED.activo,en_stock=EXCLUDED.en_stock,en_transito=EXCLUDED.en_transito,imagen_url=EXCLUDED.imagen_url;\n`;
      total++;
    });

    // 2. Stock
    sql += '\n-- STOCK\n';
    const { data: stk } = await supa.from('stock_almacen').select('producto_id,almacen,cantidad,productos(nombre)');
    (stk ?? []).forEach((r: any) => {
      if (!r.productos) return;
      sql += `INSERT INTO stock_almacen (producto_id,almacen,cantidad) VALUES ((SELECT id FROM productos WHERE nombre=${esc(r.productos.nombre)}),'${r.almacen}',${r.cantidad??0}) ON CONFLICT (producto_id,almacen) DO UPDATE SET cantidad=EXCLUDED.cantidad;\n`;
      total++;
    });

    // 3. Tasas
    sql += '\n-- TASAS\n';
    const { data: tasas } = await supa.from('tasas').select('*');
    (tasas ?? []).forEach((r: any) => {
      sql += `INSERT INTO tasas (moneda,valor,tasa_mkt,ajuste) VALUES ('${r.moneda}',${r.valor??0},${r.tasa_mkt??0},${r.ajuste??0}) ON CONFLICT (moneda) DO UPDATE SET valor=EXCLUDED.valor,tasa_mkt=EXCLUDED.tasa_mkt,ajuste=EXCLUDED.ajuste;\n`;
      total++;
    });

    // 4. Tasas almacen
    sql += '\n-- TASAS ALMACEN\n';
    const { data: tasasAlm } = await supa.from('tasas_almacen').select('*');
    (tasasAlm ?? []).forEach((r: any) => {
      sql += `INSERT INTO tasas_almacen (almacen,moneda,ajuste) VALUES ('${r.almacen}','${r.moneda}',${r.ajuste??0}) ON CONFLICT (almacen,moneda) DO UPDATE SET ajuste=EXCLUDED.ajuste;\n`;
      total++;
    });

    // 5. Usuarios
    sql += '\n-- USUARIOS\n';
    const { data: usrs } = await supa.from('usuarios').select('*');
    (usrs ?? []).forEach((r: any) => {
      sql += `INSERT INTO usuarios (nombre,pin,rol,almacen,color,tc,activo,puede_vender) VALUES (${esc(r.nombre)},${esc(r.pin)},${esc(r.rol)},${esc(r.almacen)},${esc(r.color)},${esc(r.tc)},${r.activo!==false},${r.puede_vender!==false}) ON CONFLICT (nombre) DO UPDATE SET pin=EXCLUDED.pin,rol=EXCLUDED.rol,almacen=EXCLUDED.almacen,color=EXCLUDED.color,tc=EXCLUDED.tc,activo=EXCLUDED.activo,puede_vender=EXCLUDED.puede_vender;\n`;
      total++;
    });

    // 6. Ventas
    sql += '\n-- VENTAS\n';
    const { data: ventas } = await supa.from('ventas').select('*').order('fecha', { ascending: false }).limit(10000);
    (ventas ?? []).forEach((r: any) => {
      sql += `INSERT INTO ventas (fecha,vendedor,almacen,cliente,tipo,productos,total_usd,moneda_cobro,com_pct,com_usd,est_com,cobrado_usd,notas,cobros_json) VALUES (${esc(r.fecha)},${esc(r.vendedor)},${esc(r.almacen)},${esc(r.cliente)},${esc(r.tipo)},${esc(JSON.stringify(r.productos))},${r.total_usd??0},${esc(r.moneda_cobro)},${r.com_pct??0},${r.com_usd??0},${esc(r.est_com)},${r.cobrado_usd??0},${esc(r.notas)},${esc(JSON.stringify(r.cobros_json))}) ON CONFLICT DO NOTHING;\n`;
      total++;
    });

    // 7. Movimientos IG
    sql += '\n-- MOVIMIENTOS IG\n';
    const { data: movs } = await supa.from('movimientos_ig').select('*').order('fecha', { ascending: false });
    (movs ?? []).forEach((r: any) => {
      sql += `INSERT INTO movimientos_ig (fecha,tipo,descripcion,monto,moneda,equiv_usd,cuenta,vendedor,notas) VALUES (${esc(r.fecha)},${esc(r.tipo)},${esc(r.descripcion)},${r.monto??0},${esc(r.moneda)},${r.equiv_usd??0},${esc(r.cuenta)},${esc(r.vendedor)},${esc(r.notas)}) ON CONFLICT DO NOTHING;\n`;
      total++;
    });

    // 8. Cajas
    sql += '\n-- CAJAS\n';
    const { data: cajas } = await supa.from('cajas').select('*');
    (cajas ?? []).forEach((r: any) => {
      sql += `INSERT INTO cajas (nombre,moneda,almacen,saldo_inicial,activa) VALUES (${esc(r.nombre)},${esc(r.moneda)},${esc(r.almacen)},${r.saldo_inicial??0},${r.activa!==false}) ON CONFLICT (nombre) DO UPDATE SET saldo_inicial=EXCLUDED.saldo_inicial,activa=EXCLUDED.activa;\n`;
      total++;
    });

    console.log('SQL lines:', total);

    const fname = `backup_${now.slice(0,10)}_${now.slice(11,16).replace(':','-')}.sql`;
    const caption = `💾 <b>Backup automático</b>\n${now.slice(0,16).replace('T',' ')} UTC\n\n${total} registros\n🤖 ERP Marin Metal`;

    const fd = new FormData();
    fd.append('chat_id', TG_BACKUP);
    fd.append('document', new Blob([sql], { type: 'text/plain' }), fname);
    fd.append('caption', caption);
    fd.append('parse_mode', 'HTML');

    const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendDocument`, { method: 'POST', body: fd });
    const data = await res.json();
    console.log('TG:', JSON.stringify(data).slice(0,150));

    return data.ok ? new Response('OK', { status: 200 }) : new Response('TG error: '+data.description, { status: 500 });

  } catch(e) {
    console.error('FATAL:', String(e));
    return new Response('Error: '+String(e), { status: 500 });
  }
});
