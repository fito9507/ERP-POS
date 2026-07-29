

function _closeVentaModal(){
  var mo=document.getElementById('venta-detail-modal');
  if(mo) mo.style.display='none';
}
function buildReceiptHtml(v){
  var pagos=v.pagos||[],vueltos=v.vueltos||[];
  var cobDesc=pagos.length?pagos.map(function(p){return fN(p.m,dFor(p.mon))+' '+p.mon;}).join(' + '):'--';
  var vueltoDesc=vueltos.length?vueltos.map(function(vt){return fN(vt.m,dFor(vt.mon))+' '+vt.mon;}).join(' + '):'';
  var cajaMap={};
  pagos.forEach(function(p){cajaMap[p.caja]=cajaMap[p.caja]||[];cajaMap[p.caja].push('+'+fN(p.m,dFor(p.mon))+' '+p.mon);});
  vueltos.forEach(function(vt){cajaMap[vt.caja]=cajaMap[vt.caja]||[];cajaMap[vt.caja].push('-'+fN(vt.m,dFor(vt.mon))+' '+vt.mon);});
  var ck=Object.keys(cajaMap);
  var h='';
  h+='<div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:16px">'+v.vend+' &middot; '+v.alm+' &middot; '+(v.cli||'Walk-in')+'</div>';
  h+='<div class="res-line"><span>Productos</span><span style="text-align:right;font-size:12px;line-height:1.7">'
    +v.prods.split(', ').map(function(p){var _at=p.indexOf(' @ ');return _at>0?p.slice(0,_at):p;}).join('<br>')
    +'</span></div>';
  h+='<div class="res-line"><span>Total</span><strong>'+fN(v.totalUSD)+' USD</strong></div>';
  h+='<div class="res-line"><span></span><span style="font-size:11px;color:var(--color-text-secondary)">'+['EUR','CUP','CUPT'].map(function(m){return fN(fromUSD(v.totalUSD,m,v.alm),dFor(m))+' '+m;}).join(' &middot; ')+'</span></div>';
  h+='<div class="res-line"><span>Cobrado</span><span>'+cobDesc+'</span></div>';
  if(vueltoDesc) h+='<div class="res-line"><span>Vuelto</span><span>'+vueltoDesc+'</span></div>';
  if(ck.length){
    h+='<div style="border-top:.5px solid var(--color-border-tertiary);margin-top:8px;padding-top:8px">';
    h+='<div style="font-size:10px;color:var(--color-text-tertiary);margin-bottom:5px;font-weight:600;letter-spacing:.5px">MOVIMIENTOS DE CAJA</div>';
    ck.forEach(function(k){h+='<div class="res-line"><span style="font-size:11px">'+k+'</span><span style="font-size:11px">'+cajaMap[k].join(' &middot; ')+'</span></div>';});
    h+='</div>';
  }
  if(v.nota) h+='<div class="res-line" style="border-top:.5px solid var(--color-border-tertiary);margin-top:8px;padding-top:8px"><span style="color:var(--color-text-tertiary)">&#128203;</span><span style="font-size:12px">'+v.nota+'</span></div>';
  return h;
}
function verVenta(id){
  var v=VENTAS.find(function(x){return x.id===id;});
  if(!v) return;
  var mo=document.getElementById('venta-detail-modal');
  if(!mo){
    mo=document.createElement('div');
    mo.id='venta-detail-modal';
    mo.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
    document.body.appendChild(mo);
  }
  // Parsear ticket/hora desde nota si no vinieron del mapeo de Supabase
  if(!v.ticket && v.nota){var _tm=v.nota.match(/\[([A-Z]{3}\d{2}-\d+)\]/);if(_tm)v.ticket=_tm[1];}
  if(!v.hora  && v.nota){var _hm=v.nota.match(/\[(\d{2}:\d{2})\]/);if(_hm)v.hora=_hm[1];}
  mo.innerHTML='<div style="max-width:420px;width:100%;max-height:90vh;overflow-y:auto;position:relative;background:var(--color-background-primary);border-radius:var(--border-radius-lg);padding:24px 20px;box-shadow:0 20px 60px rgba(0,0,0,.6)">'
    +'<button onclick="_closeVentaModal()" style="position:absolute;top:10px;right:12px;background:none;border:none;cursor:pointer;font-size:22px;color:var(--color-text-secondary);z-index:1">&times;</button>'
    +'<div style="text-align:center;margin-bottom:20px">'
    +'<div style="width:52px;height:52px;border-radius:50%;background:var(--color-background-success);display:flex;align-items:center;justify-content:center;font-size:22px;margin:0 auto 12px">&#10003;</div>'
    +'<div style="font-size:18px;font-weight:600;margin-bottom:6px">Venta #'+v.id+(v.ticket?' <span style="font-size:11px;font-weight:500;background:var(--color-background-secondary);border:1px solid var(--color-border-secondary);padding:2px 8px;border-radius:20px;color:var(--color-text-secondary);vertical-align:middle">'+v.ticket+'</span>':'')+'</div>'
    +'<div style="font-size:12px;color:var(--color-text-secondary)">'+fD(v.fecha)+(v.hora?' &nbsp;·&nbsp; <span style="font-weight:600;color:var(--color-text-primary)">⏰ '+v.hora+'</span>':'')+'</div>'
    +'</div>'
    +'<div style="margin-bottom:20px">'+buildReceiptHtml(v)+'</div>'
    +'<button class="btn" onclick="_closeVentaModal()" style="width:100%">Cerrar</button>'
    +'</div>';
  mo.style.display='flex';
}


