import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TG_TOKEN = Deno.env.get('TG_TOKEN') ?? '';
const SUPA_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPA_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const TG_VENTAS: Record<string,string> = {
  Habana: '-1003851284058',
  Placetas: '-1003866260307'
};

async function tgSend(chatId: string, text: string): Promise<void> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const data = await res.json();
    console.log('TG:', chatId, JSON.stringify(data).slice(0,150));
  } catch(e) {
    console.error('tgSend error:', e);
  }
}

function fN(n: number, dec: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

Deno.serve(async (_req: Request): Promise<Response> => {
  console.log('START - TG_TOKEN:', TG_TOKEN ? 'SET('+TG_TOKEN.slice(0,8)+')' : 'MISSING');

  if (!TG_TOKEN) {
    return new Response('TG_TOKEN missing', { status: 500 });
  }

  try {
    const supa = createClient(SUPA_URL, SUPA_KEY);

    const cubaNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Havana' }));
    const hoy = `${cubaNow.getFullYear()}-${String(cubaNow.getMonth()+1).padStart(2,'0')}-${String(cubaNow.getDate()).padStart(2,'0')}`;
    console.log('Fecha Cuba:', hoy);

    const { data: tasas } = await supa.from('tasas').select('moneda,valor');
    const rates: Record<string,number> = {};
    (tasas ?? []).forEach((t: any) => { rates[t.moneda] = parseFloat(t.valor); });
    const CUP = rates['USD'] ?? 535;
    const EURUSD = rates['USDEUR'] ?? 1.13;

    const { data: tasasAlm } = await supa.from('tasas_almacen').select('almacen,moneda,ajuste');
    const RATES_ALM: Record<string,Record<string,number>> = {};
    (tasasAlm ?? []).forEach((r: any) => {
      if (!RATES_ALM[r.almacen]) RATES_ALM[r.almacen] = {};
      RATES_ALM[r.almacen][r.moneda] = parseFloat(r.ajuste ?? 0);
    });

    const MON_SYM: Record<string,string> = { USD:'$', EUR:'€', CUP:'₱', CUPT:'₱' };
    const MON_DEC: Record<string,number> = { USD:2, EUR:2, CUP:0, CUPT:0 };

    for (const alm of ['Habana', 'Placetas']) {
      console.log('Processing:', alm);
      const chatId = TG_VENTAS[alm];

      const { data: ventas } = await supa.from('ventas')
        .select('*').eq('almacen', alm)
        .gte('fecha', hoy).lte('fecha', hoy + 'T23:59:59');
      const ventasHoy = ventas ?? [];
      console.log(alm, 'ventas:', ventasHoy.length);

      if (ventasHoy.length === 0) {
        await tgSend(chatId, `📊 <b>Cierre — ${alm}</b>\n🗓 ${hoy}\n\n🛒 Sin ventas hoy`);
        continue;
      }

      const cobros: Record<string,number> = {};
      const vueltosMon: Record<string,number> = {};
      const porVend: Record<string,{n:number,usd:number}> = {};
      const prodMap: Record<string,{qty:number,usd:number}> = {};

      for (const v of ventasHoy) {
        const vend = v.vendedor ?? '?';
        if (!porVend[vend]) porVend[vend] = { n:0, usd:0 };
        porVend[vend].n++;
        porVend[vend].usd += parseFloat(v.total_usd ?? 0);

        const prods = Array.isArray(v.productos) ? v.productos : [];
        for (const p of prods) {
          const nm = p.n ?? p.nombre ?? '?';
          if (!prodMap[nm]) prodMap[nm] = { qty:0, usd:0 };
          prodMap[nm].qty += parseFloat(p.q ?? p.qty ?? 1);
          prodMap[nm].usd += parseFloat(p.precioUSD ?? p.precio ?? 0) * parseFloat(p.q ?? p.qty ?? 1);
        }

        const cobrosJSON = Array.isArray(v.cobros_json) ? v.cobros_json : [];
        for (const c of cobrosJSON) {
          const mon = c.mon ?? c.moneda ?? 'USD';
          const amt = parseFloat(c.m ?? c.monto ?? 0);
          if (c.esVuelto || c.tipo === 'vuelto') vueltosMon[mon] = (vueltosMon[mon]??0) + amt;
          else cobros[mon] = (cobros[mon]??0) + amt;
        }
      }

      const adjUSD = RATES_ALM[alm]?.['USD'] ?? 0;
      const cupRate = Math.round((CUP + adjUSD) * 100) / 100;
      const adjEUR = RATES_ALM[alm]?.['EUR'] ?? 0;
      const cupEUR = Math.round((EURUSD * CUP + adjEUR) * 100) / 100;

      function toUSD(m: number, mon: string): number {
        if (mon === 'USD') return m;
        if (mon === 'CUP') return m / cupRate;
        if (mon === 'EUR') return m * cupEUR / cupRate;
        const pct = RATES_ALM[alm]?.['CUPT'] ?? 19;
        return m / (cupRate * (1 + pct/100));
      }

      const allMons = [...new Set([...Object.keys(cobros), ...Object.keys(vueltosMon)])];
      let netoTotalUSD = 0;

      const cobrosLines = allMons.filter(m=>(cobros[m]??0)>0).map(m=>{
        const dec=MON_DEC[m]??2;
        const equiv=m!=='USD'?` ≈ $${fN(toUSD(cobros[m],m),2)}`:'';
        return `  ${MON_SYM[m]??''} ${fN(cobros[m],dec)} ${m}${equiv}`;
      }).join('\n');

      const vueltosLines = allMons.filter(m=>(vueltosMon[m]??0)>0).map(m=>
        `  ${MON_SYM[m]??''} ${fN(vueltosMon[m],MON_DEC[m]??0)} ${m}`
      ).join('\n');

      const netoLines = allMons.filter(m=>(cobros[m]??0)>0||(vueltosMon[m]??0)>0).map(m=>{
        const neto=(cobros[m]??0)-(vueltosMon[m]??0);
        const dec=MON_DEC[m]??2;
        const equiv=m!=='USD'?` ≈ $${fN(toUSD(neto,m),2)}`:'';
        netoTotalUSD+=toUSD(neto,m);
        return `  ${MON_SYM[m]??''}  ${fN(cobros[m]??0,dec)} cobrado${(vueltosMon[m]??0)>0?' − '+fN(vueltosMon[m],dec)+' vuelto':''} = <b>${fN(neto,dec)}</b> ${m}${equiv}`;
      }).join('\n');
      const netoTotal = allMons.length>1?`\n  ———\n  <b>💰 Total neto: $${fN(netoTotalUSD,2)}</b>`:'';

      const vendLines = Object.entries(porVend).map(([v,d])=>
        `  👤 ${v}: ${d.n} venta${d.n!==1?'s':''} ◆ $${fN(d.usd,2)}`
      ).join('\n');

      const prodLines = Object.entries(prodMap).map(([n,d])=>
        `  • ${d.qty}× ${n} — $${fN(d.usd,2)}`
      ).join('\n');

      const { data: igMovs } = await supa.from('movimientos_ig')
        .select('*').gte('fecha',hoy).lte('fecha',hoy+'T23:59:59');
      const igAlm = (igMovs??[]).filter((m:any)=>(m.cuenta??'').includes(alm));
      const igByMon: Record<string,{ing:number,gas:number,movs:any[]}> = {};
      for (const m of igAlm) {
        const mon=m.moneda??'USD';
        if(!igByMon[mon]) igByMon[mon]={ing:0,gas:0,movs:[]};
        const sentido=['Ingreso no-venta','Devolución'].includes(m.tipo)?'ingreso':'gasto';
        if(sentido==='ingreso') igByMon[mon].ing+=parseFloat(m.monto??0);
        else igByMon[mon].gas+=parseFloat(m.monto??0);
        igByMon[mon].movs.push({...m,sentido});
      }
      const igLines = Object.entries(igByMon).map(([mon,d])=>{
        const dec=MON_DEC[mon]??2;
        const lines=d.movs.map((m:any)=>`  ${m.sentido==='ingreso'?'+':'-'} ${fN(m.monto,dec)} ${mon} · ${m.descripcion}`).join('\n');
        const neto=d.ing-d.gas;
        return `${lines}\n  = ${neto>=0?'+':'-'}${fN(Math.abs(neto),dec)} ${mon} neto`;
      }).join('\n');

      const { data: cajas } = await supa.from('cajas').select('*').eq('almacen',alm).eq('activa',true);
      const { data: cajaMov } = await supa.from('mov_cajas').select('*');
      const cajasLines = (cajas??[]).map((c:any)=>{
        let saldo=parseFloat(c.saldo_inicial??0);
        (cajaMov??[]).forEach((mv:any)=>{
          if(mv.caja_origen===c.nombre) saldo-=parseFloat(mv.monto_origen??0);
          if(mv.caja_destino===c.nombre) saldo+=parseFloat(mv.monto_destino??0);
        });
        const dec=c.moneda==='USD'||c.moneda==='EUR'?2:0;
        return `  ${MON_SYM[c.moneda]??''} ${fN(saldo,dec)} ${c.moneda} (${c.nombre})`;
      }).join('\n');

      const parts = [
        `📊 <b>Cierre — ${alm}</b>`,
        `🗓 ${hoy}`,
        `\n🛒 <b>${ventasHoy.length} venta${ventasHoy.length!==1?'s':''}</b>`,
        cobrosLines?`\n<b>Cobrado:</b>\n${cobrosLines}`:'',
        vueltosLines?`\n<b>Vueltos:</b>\n${vueltosLines}`:'',
        netoLines?`\n<b>💵 Neto por moneda:</b>\n${netoLines}${netoTotal}`:'',
        vendLines?`\n<b>Por vendedor:</b>\n${vendLines}`:'',
        prodLines?`\n\n<b>Vendido:</b>\n${prodLines}`:'',
        igLines?`\n\n<b>📋 I/G del día:</b>\n${igLines}`:'',
        cajasLines?`\n\n<b>🏦 Saldo cajas:</b>\n${cajasLines}`:'',
      ].filter(Boolean).join('\n');

      console.log('Sending to', chatId, 'len:', parts.length);
      await tgSend(chatId, parts);
    }

    console.log('DONE');
    return new Response('OK', { status: 200 });

  } catch(e) {
    console.error('FATAL:', String(e));
    return new Response('Error: '+String(e), { status: 500 });
  }
});
