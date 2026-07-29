const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

// Replace in flushQueue
content = content.replace(
  `        // Normalize field names — Supabase column is 'cta', not 'caja' or 'cuenta'. And 'descripcion', not 'concepto'.
        if (op.body.concepto !== undefined) { op.body.descripcion = op.body.concepto; delete op.body.concepto; }
        if (op.body.cuenta !== undefined) { op.body.cta = op.body.cuenta; delete op.body.cuenta; }
        if (op.body.caja !== undefined) { op.body.cta = op.body.caja; delete op.body.caja; }
        if (op.body.vendedor !== undefined) { op.body.usuario = op.body.vendedor; delete op.body.vendedor; }`,
  `        // Normalize field names — Supabase columns are 'descripcion', 'cuenta', 'vendedor'
        if (op.body.concepto !== undefined) { op.body.descripcion = op.body.concepto; delete op.body.concepto; }
        if (op.body.cta !== undefined) { op.body.cuenta = op.body.cta; delete op.body.cta; }
        if (op.body.caja !== undefined) { op.body.cuenta = op.body.caja; delete op.body.caja; }
        if (op.body.usuario !== undefined) { op.body.vendedor = op.body.usuario; delete op.body.usuario; }
        if (op.body.vend !== undefined) { op.body.vendedor = op.body.vend; delete op.body.vend; }`
);

// We need to carefully replace fields ONLY when it's an object passed to movimientos_ig
// It's safer to just do explicit replacements for the known chunks.

const chunks = [
  [
    `_supaWrite('POST','movimientos_ig',{
        fecha:today(),tipo:'Comision vendedor',concepto:'Pago Liq. '+liq.vend+' '+liq.semana,
        monto:parseFloat(parseFloat(monto).toFixed(4)),moneda:mon,
        equiv_usd:parseFloat((mon==='CUP'?monto/(RATES.CUP||512.88):monto).toFixed(4)),
        caja:cta, usuario:liq.vend, notas:''
      });`,
    `_supaWrite('POST','movimientos_ig',{
        fecha:today(),tipo:'Comision vendedor',descripcion:'Pago Liq. '+liq.vend+' '+liq.semana,
        monto:parseFloat(parseFloat(monto).toFixed(4)),moneda:mon,
        equiv_usd:parseFloat((mon==='CUP'?monto/(RATES.CUP||512.88):monto).toFixed(4)),
        cuenta:cta, vendedor:liq.vend, notas:''
      });`
  ],
  [
    `_supaWrite('POST','movimientos_ig',{
        fecha:today(),tipo:'Ingreso no-venta',concepto:'Reembolso Liq. '+liq.vend+' '+liq.semana,
        monto:parseFloat(parseFloat(sobrante).toFixed(4)),moneda:mon,
        equiv_usd:parseFloat((mon==='CUP'?sobrante/(RATES.CUP||512.88):sobrante).toFixed(4)),
        caja:cta, usuario:liq.vend, notas:''
      });`,
    `_supaWrite('POST','movimientos_ig',{
        fecha:today(),tipo:'Ingreso no-venta',descripcion:'Reembolso Liq. '+liq.vend+' '+liq.semana,
        monto:parseFloat(parseFloat(sobrante).toFixed(4)),moneda:mon,
        equiv_usd:parseFloat((mon==='CUP'?sobrante/(RATES.CUP||512.88):sobrante).toFixed(4)),
        cuenta:cta, vendedor:liq.vend, notas:''
      });`
  ],
  [
    `supaReq('POST','movimientos_ig',{fecha:_e.fecha,tipo:_e.tipo,concepto:_e.desc,monto:parseFloat(parseFloat(_e.monto).toFixed(4)),
        moneda:_e.mon,equiv_usd:parseFloat(parseFloat(_e.equivUSD).toFixed(4)),caja:_e.cta,usuario:'',notas:_e.notas||''})`,
    `supaReq('POST','movimientos_ig',{fecha:_e.fecha,tipo:_e.tipo,descripcion:_e.desc,monto:parseFloat(parseFloat(_e.monto).toFixed(4)),
        moneda:_e.mon,equiv_usd:parseFloat(parseFloat(_e.equivUSD).toFixed(4)),cuenta:_e.cta,vendedor:'',notas:_e.notas||''})`
  ],
  [
    `_supaWrite('POST','movimientos_ig',{
      fecha:fecha,tipo:igTipo,descripcion:igMov.desc,
      monto:parseFloat(parseFloat(equivUSD).toFixed(4)),moneda:'USD',
      cta:igCta,usuario:(typeof S!=='undefined'&&S.user)||'',notas:''
    });`,
    `_supaWrite('POST','movimientos_ig',{
      fecha:fecha,tipo:igTipo,descripcion:igMov.desc,
      monto:parseFloat(parseFloat(equivUSD).toFixed(4)),moneda:'USD',
      cuenta:igCta,vendedor:(typeof S!=='undefined'&&S.user)||'',notas:''
    });`
  ],
  [
    `supaReq('POST','movimientos_ig',{
          fecha:fecha, tipo:'Ingreso no-venta',
          concepto: (notas||'Depósito externo') + ' → ' + orig,
          monto: monto, moneda: _monO,
          equiv_usd: parseFloat((monto*(_RATES_USD[_monO]||1)).toFixed(4)),
          caja: orig, usuario: usuario, notas: notas
        })`,
    `supaReq('POST','movimientos_ig',{
          fecha:fecha, tipo:'Ingreso no-venta',
          descripcion: (notas||'Depósito externo') + ' → ' + orig,
          monto: monto, moneda: _monO,
          equiv_usd: parseFloat((monto*(_RATES_USD[_monO]||1)).toFixed(4)),
          cuenta: orig, vendedor: usuario, notas: notas
        })`
  ],
  [
    `supaReq('POST','movimientos_ig',{
          fecha:fecha, tipo:'Gasto operativo',
          concepto: (notas||'Retiro') + ' ← ' + orig,
          monto: monto, moneda: _monO,
          equiv_usd: parseFloat((monto*(_RATES_USD[_monO]||1)).toFixed(4)),
          caja: orig, usuario: usuario, notas: notas
        })`,
    `supaReq('POST','movimientos_ig',{
          fecha:fecha, tipo:'Gasto operativo',
          descripcion: (notas||'Retiro') + ' ← ' + orig,
          monto: monto, moneda: _monO,
          equiv_usd: parseFloat((monto*(_RATES_USD[_monO]||1)).toFixed(4)),
          cuenta: orig, vendedor: usuario, notas: notas
        })`
  ],
  [
    `supaReq('POST','movimientos_ig',{
          fecha:fecha, tipo:'Transferencia entre cuentas',
          concepto: (notas||'Transferencia') + ' (salida)',
          monto: monto, moneda: _monO,
          equiv_usd: parseFloat((monto*(_RATES_USD[_monO]||1)).toFixed(4)),
          caja: orig, usuario: usuario, notas: notas
        })`,
    `supaReq('POST','movimientos_ig',{
          fecha:fecha, tipo:'Transferencia entre cuentas',
          descripcion: (notas||'Transferencia') + ' (salida)',
          monto: monto, moneda: _monO,
          equiv_usd: parseFloat((monto*(_RATES_USD[_monO]||1)).toFixed(4)),
          cuenta: orig, vendedor: usuario, notas: notas
        })`
  ],
  [
    `supaReq('POST','movimientos_ig',{
          fecha:fecha, tipo:'Transferencia entre cuentas',
          concepto: (notas||'Transferencia') + ' (entrada)',
          monto: monto, moneda: _monD,
          equiv_usd: parseFloat((monto*(_RATES_USD[_monD]||1)).toFixed(4)),
          caja: dest, usuario: usuario, notas: notas
        })`,
    `supaReq('POST','movimientos_ig',{
          fecha:fecha, tipo:'Transferencia entre cuentas',
          descripcion: (notas||'Transferencia') + ' (entrada)',
          monto: monto, moneda: _monD,
          equiv_usd: parseFloat((monto*(_RATES_USD[_monD]||1)).toFixed(4)),
          cuenta: dest, vendedor: usuario, notas: notas
        })`
  ],
  [
    `supaReq('POST','movimientos_ig',{
          fecha:fecha, tipo:'Transferencia entre cuentas',
          concepto: (notas||'Cambio de divisa') + ' (salida ' + _monO + ')',
          monto: monto, moneda: _monO,
          equiv_usd: parseFloat((monto*(_RATES_USD[_monO]||1)).toFixed(4)),
          caja: orig, usuario: usuario, notas: notas
        })`,
    `supaReq('POST','movimientos_ig',{
          fecha:fecha, tipo:'Transferencia entre cuentas',
          descripcion: (notas||'Cambio de divisa') + ' (salida ' + _monO + ')',
          monto: monto, moneda: _monO,
          equiv_usd: parseFloat((monto*(_RATES_USD[_monO]||1)).toFixed(4)),
          cuenta: orig, vendedor: usuario, notas: notas
        })`
  ],
  [
    `supaReq('POST','movimientos_ig',{
          fecha:fecha, tipo:'Transferencia entre cuentas',
          concepto: (notas||'Cambio de divisa') + ' (entrada ' + _monD + ')',
          monto: montoDest, moneda: _monD,
          equiv_usd: parseFloat((montoDest*(_RATES_USD[_monD]||1)).toFixed(4)),
          caja: dest, usuario: usuario, notas: notas
        })`,
    `supaReq('POST','movimientos_ig',{
          fecha:fecha, tipo:'Transferencia entre cuentas',
          descripcion: (notas||'Cambio de divisa') + ' (entrada ' + _monD + ')',
          monto: montoDest, moneda: _monD,
          equiv_usd: parseFloat((montoDest*(_RATES_USD[_monD]||1)).toFixed(4)),
          cuenta: dest, vendedor: usuario, notas: notas
        })`
  ],
  [
    `supaReq('PATCH', 'movimientos_ig?cta=eq.'+encodeURIComponent(caja.nombre), { cta: nuevoNombre });`,
    `supaReq('PATCH', 'movimientos_ig?cuenta=eq.'+encodeURIComponent(caja.nombre), { cuenta: nuevoNombre });`
  ],
  [
    `supaReq('PATCH', 'movimientos_ig?cta=eq.'+encodeURIComponent(nombreAnterior), { cta: nuevoNombre });`,
    `supaReq('PATCH', 'movimientos_ig?cuenta=eq.'+encodeURIComponent(nombreAnterior), { cuenta: nuevoNombre });`
  ],
  [
    `sql += "INSERT INTO movimientos_ig (fecha,tipo,concepto,monto,moneda,caja,usuario,almacen,notas) VALUES ("+esc(r.fecha)+","+esc(r.tipo)+","+esc(r.concepto)+","+(r.monto||0)+","+esc(r.moneda)+","+esc(r.caja)+","+esc(r.usuario)+","+esc(r.almacen)+","+esc(r.notas)+") ON CONFLICT DO NOTHING;\\n";`,
    `sql += "INSERT INTO movimientos_ig (fecha,tipo,descripcion,monto,moneda,cuenta,vendedor,almacen,notas) VALUES ("+esc(r.fecha)+","+esc(r.tipo)+","+esc(r.desc)+","+(r.monto||0)+","+esc(r.mon)+","+esc(r.cta)+","+esc(r.vend)+","+esc(r.alm)+","+esc(r.notas)+") ON CONFLICT DO NOTHING;\\n";`
  ]
];

for(const [target, replacement] of chunks) {
  if(!content.includes(target)) {
    console.warn("Could not find target:", target.substring(0, 50));
  }
  content = content.replace(target, replacement);
}

fs.writeFileSync('index.html', content);
console.log("Done");
