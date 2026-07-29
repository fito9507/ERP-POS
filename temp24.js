
function renderStock(){
  var el=document.getElementById('stock-root');if(!el)return;
  var wasFocused = document.activeElement && document.activeElement.id === 'stock-search-inp';
  var selStart = wasFocused ? document.activeElement.selectionStart : 0;
  var _isVend=typeof S!=='undefined'&&S.user&&USERS[S.user]&&USERS[S.user].rol==='vendedor';
  var _mp=document.getElementById('stock-movs-panel');if(_mp)_mp.style.display=_isVend?'none':'';
  var alms=['Habana','Placetas','Xportprise'];
  var q=(window._stockQ||'').toLowerCase(),catF=window._stockCat||'',almF=window._stockAlm||'';
  var userAlm=typeof S!=='undefined'&&S.user&&USERS[S.user]?USERS[S.user].almacen:'';
  var activos=PRODS.filter(function(p){return p.activo!==false && p.enStock!==false;});
  var total=activos.reduce(function(a,p){return a+(p.stk||0);},0);
  var bajos=activos.filter(function(p){return(p.stk||0)<=(p.stk_min||10);}).length;
  var cats=Object.keys(activos.reduce(function(a,p){if(p.cat)a[p.cat]=1;return a;},{})).sort();
  var prods=activos.filter(function(p){
    if(q&&p.n.toLowerCase().indexOf(q)<0)return false;
    if(catF&&p.cat!==catF)return false;
    if(almF){
      var hasStk = (p.stk_alm&&p.stk_alm[almF])>0;
      var inTrans = (p.enTransito&&p.enTransito[almF]);
      if(!hasStk && !inTrans) return false;
    }
    return true;
  }).sort(function(a,b){return a.n.localeCompare(b.n, undefined, {numeric: true});});
  var visAlms=almF?[almF]:alms;
  // Valor del inventario (DDP × stock) — solo admin
  var valorTotal = activos.reduce(function(a,p){return a+(p.ddp||0)*(p.stk||0);},0);
  var valorHabana = activos.reduce(function(a,p){return a+(p.ddp||0)*((p.stk_alm&&p.stk_alm.Habana)||0);},0);
  var valorPlacetas = activos.reduce(function(a,p){return a+(p.ddp||0)*((p.stk_alm&&p.stk_alm.Placetas)||0);},0);
  var valorXport = activos.reduce(function(a,p){return a+(p.ddp||0)*((p.stk_alm&&p.stk_alm.Xportprise)||0);},0);
  var sinDDP = activos.filter(function(p){return (p.stk||0)>0 && !p.ddp;}).length;

  var h='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-bottom:14px">';
  h+='<div class="adm-card"><div class="adm-lbl">Productos</div><div class="adm-val">'+activos.length+'</div></div>';
  h+='<div class="adm-card"><div class="adm-lbl">Uds totales</div><div class="adm-val">'+fN(total,0)+'</div></div>';
  alms.forEach(function(a){var t=activos.reduce(function(s,p){return s+((p.stk_alm&&p.stk_alm[a])||0);},0);h+='<div class="adm-card"><div class="adm-lbl">'+a+'</div><div class="adm-val" style="font-size:16px">'+fN(t,0)+'</div></div>';});
  h+='</div>';
  if(!_isVend){
    h+='<div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:14px;margin-bottom:14px">'
      +'<div style="font-size:13px;font-weight:700;margin-bottom:10px">💰 Valor del inventario (DDP)'+(sinDDP>0?'<span style="font-size:10px;color:var(--color-text-warning);font-weight:400;margin-left:8px">⚠ '+sinDDP+' productos sin DDP</span>':'')+'</div>'
      +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">'
      +'<div class="adm-card" style="border:1px solid var(--color-border-primary)"><div class="adm-lbl">Total</div><div class="adm-val" style="color:var(--color-text-success);font-size:18px">$'+fN(valorTotal)+'</div></div>'
      +'<div class="adm-card"><div class="adm-lbl">Habana</div><div class="adm-val" style="font-size:15px">$'+fN(valorHabana)+'</div></div>'
      +'<div class="adm-card"><div class="adm-lbl">Placetas</div><div class="adm-val" style="font-size:15px">$'+fN(valorPlacetas)+'</div></div>'
      +'<div class="adm-card"><div class="adm-lbl">Xportprise</div><div class="adm-val" style="font-size:15px">$'+fN(valorXport)+'</div></div>'
      +'</div></div>';
  }
  if(!_isVend) h+='<button class="adm-btn adm-btn-p" onclick="syncLoadProductos().then(function(){renderStock();showToast(\'✓ Stock sincronizado\');})" style="margin-bottom:8px;width:100%">🔄 Sincronizar stock desde Supabase</button>';
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">'
    +'<input id="stock-search-inp" class="adm-inp" placeholder="Buscar..." oninput="window._stockQ=this.value;_dRender(renderStock)" style="flex:1;max-width:240px" value="'+(window._stockQ||'')+'">'
    +'<select class="adm-inp" onchange="window._stockAlm=this.value;renderStock()" style="max-width:130px"><option value="">Todos almacenes</option>'
    +alms.map(function(a){return'<option'+(almF===a?' selected':'')+'>'+a+'</option>';}).join('')+'</select>'
    +'<select class="adm-inp" onchange="window._stockCat=this.value;renderStock()" style="max-width:130px"><option value="">Todas cats</option>'
    +cats.map(function(c){return'<option'+(catF===c?' selected':'')+'>'+c+'</option>';}).join('')+'</select>'
    +(bajos>0?'<span class="badge" style="background:var(--color-background-warning);color:var(--color-text-warning);padding:4px 10px">'+bajos+' bajo mínimo</span>':'')
    +'<button class="adm-btn adm-btn-s" onclick="shareStockWhatsApp()" style="margin-left:auto;border-color:#25D366;color:#25D366"><svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style="margin-right:6px;vertical-align:-2px"><path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/></svg>Catálogo WhatsApp</button>'
    +'<button class="adm-btn adm-btn-s" onclick="shareStockQtyWhatsApp()" style="border-color:#25D366;color:#25D366"><svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style="margin-right:6px;vertical-align:-2px"><path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/></svg>Stock WhatsApp</button>'
    +'</div>';
  h+='<div class="adm-table-wrap"><table class="adm-table"><thead><tr><th>Producto</th><th>Cat.</th>'
    +visAlms.map(function(a){return'<th style="text-align:right">'+a+'</th>';}).join('')
    +'<th style="text-align:right">Total</th><th style="text-align:right">Min/May</th></tr></thead><tbody>';
  if(!prods.length){h+='<tr><td colspan="'+(visAlms.length+4)+'" style="text-align:center;padding:20px;color:var(--color-text-tertiary)">Sin resultados</td></tr>';}
  else{prods.forEach(function(p){
    var bajo=(p.stk||0)<=(p.stk_min||10);
    h+='<tr'+(bajo?' style="background:rgba(251,191,36,.07)"':'')+'>'
      +'<td style="font-size:12px">'+p.n+(bajo?' ⚠':'')+'</td>'
      +'<td style="font-size:11px;color:var(--color-text-tertiary)">'+(p.cat||'—')+'</td>';
    visAlms.forEach(function(a){
      var v=(p.stk_alm&&p.stk_alm[a]!=null)?p.stk_alm[a]:0;
      h+='<td style="text-align:right;font-weight:'+(a===userAlm?'700':'400')+';color:'+(v===0?'var(--color-text-tertiary)':v<=(p.stk_min||10)?'var(--color-text-warning)':'var(--color-text-primary)')+'">'+fN(v,0)+'</td>';
    });
    h+='<td style="text-align:right;font-weight:600">'+fN(p.stk||0,0)+'</td>'
      +'<td style="text-align:right;font-size:11px;color:var(--color-text-secondary)">'+(p.min!=null?fN(p.min):'—')+' / '+(p.maj!=null?fN(p.maj):'—')+'</td></tr>';
  });}
  h+='</tbody></table></div>';
  el.innerHTML=h;
  if(wasFocused){ var inp=document.getElementById('stock-search-inp'); if(inp){ inp.focus(); try{inp.setSelectionRange(selStart, typeof selEnd!=='undefined'?selEnd:selStart);}catch(e){} } }
  if(typeof renderStockMovimientos==='function')try{renderStockMovimientos();}catch(e){}
}
function shareStockWhatsApp() {
  var q=(window._stockQ||'').toLowerCase(),catF=window._stockCat||'',almF=window._stockAlm||'';
  var activos=PRODS.filter(function(p){return p.activo!==false && p.enStock!==false;});
  var prods=activos.filter(function(p){
    if(q&&p.n.toLowerCase().indexOf(q)<0)return false;
    if(catF&&p.cat!==catF)return false;
    if(almF){
      var hasStk = (p.stk_alm&&p.stk_alm[almF])>0;
      var inTrans = (p.enTransito&&p.enTransito[almF]);
      if(!hasStk && !inTrans) return false;
    }
    return true;
  }).sort(function(a,b){return a.n.localeCompare(b.n, undefined, {numeric: true});});
  
  if(!prods.length){ showToast('No hay productos en esta lista'); return; }
  if(prods.length > 50){
    if(!confirm('Vas a enviar '+prods.length+' productos al WhatsApp. Esto generará un mensaje muy largo. ¿Continuar?')) return;
  }

  var prodsStock = [];
  var prodsTransito = [];
  prods.forEach(function(p){
    var isTrans = almF ? (p.enTransito&&p.enTransito[almF]) : (p.enTransito && (p.enTransito.Habana || p.enTransito.Placetas || p.enTransito.Xportprise));
    if(isTrans) prodsTransito.push(p);
    else prodsStock.push(p);
  });

  var text = "🚀 *NUESTRO CATÁLOGO" + (catF ? " - " + catF.toUpperCase() : "") + "* 🚀\n\n";

  function appendProd(p, isPrev) {
    text += "📦 *" + p.n + "*\n";
    var norm = (p.min!=null && p.min!=='') ? p.min : ((p.maj!=null && p.maj!=='') ? p.maj : (p.escala && p.escala.length ? p.escala[0].precio : null));
    
    if(p.oferta){
      var ofPr = typeof S!=='undefined' && S.alm==='Placetas'?(p.precioOfertaPlacetas||p.precioOfertaHabana):(p.precioOfertaHabana);
      if(ofPr!=null) {
        text += "🔥 *OFERTA: " + fN(ofPr) + " USD*\n";
        if(norm!=null) text += "💲 Normal: ~" + fN(norm) + " USD~\n";
      }
    } else if (isPrev) {
      var prevPrice = norm;
      if (p.preventa_min != null && p.preventa_min !== '') {
        prevPrice = p.preventa_min;
      } else if (typeof RATES !== 'undefined' && RATES.DTO_PREVENTA > 0 && norm != null) {
        prevPrice = Number((parseFloat(norm) * (1 - RATES.DTO_PREVENTA/100)).toFixed(4));
      }
      if (prevPrice != null) text += "⏳ *PREVENTA: " + fN(prevPrice) + " USD*\n";
      if (norm!=null && parseFloat(prevPrice) !== parseFloat(norm)) text += "💲 Normal: ~" + fN(norm) + " USD~\n";
    } else {
      if(p.min!=null && p.maj!=null && p.min===p.maj) {
        text += "💲 Precio: " + fN(p.min) + " USD\n";
      } else {
        if(p.min!=null) text += "💲 Min: " + fN(p.min) + " USD\n";
        if(p.maj!=null) text += "💲 May: " + fN(p.maj) + " USD\n";
      }
    }
    text += "\n";
  }

  if (prodsStock.length > 0) {
    if (prodsTransito.length > 0) text += "🟢 *DISPONIBLES EN STOCK*\n\n";
    prodsStock.forEach(function(p){ appendProd(p, false); });
  }
  
  if (prodsTransito.length > 0) {
    if (prodsStock.length > 0) text += "➖➖➖➖➖➖➖➖➖➖\n\n";
    text += "🚢 *EN TRÁNSITO (PREVENTA)*\n\n";
    prodsTransito.forEach(function(p){ appendProd(p, true); });
  }

  text += "👉 ¡Responde a este mensaje para hacer tu pedido!\n\n";
  text += "🌐 *Ver catálogo online:*\nhttps://marinmetal.com/ofertas/";
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

function shareStockQtyWhatsApp() {
  var q=(window._stockQ||'').toLowerCase(), catF=window._stockCat||'', almF=window._stockAlm||'';
  var activos=PRODS.filter(function(p){return p.activo!==false && p.enStock!==false;});
  var prods=activos.filter(function(p){
    if(q&&p.n.toLowerCase().indexOf(q)<0)return false;
    if(catF&&p.cat!==catF)return false;
    var total = p.stk||0;
    if(almF){
      var almQty = (p.stk_alm&&p.stk_alm[almF])||0;
      if(almQty<=0) return false;
    }
    return total>0;
  }).sort(function(a,b){return a.n.localeCompare(b.n, undefined, {numeric: true});});

  if(!prods.length){ showToast('No hay productos con stock'); return; }

  var alms = almF ? [almF] : ['Habana','Placetas','Xportprise'];
  var fecha = new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'});

  var text = "📊 *STOCK" + (almF ? " — " + almF.toUpperCase() : "") + (catF ? " — " + catF.toUpperCase() : "") + "* 📊\n";
  text += "📅 " + fecha + "\n\n";

  // Group by category
  var byCat = {};
  prods.forEach(function(p){
    var cat = p.cat || 'Sin categoría';
    if(!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(p);
  });

  Object.keys(byCat).sort().forEach(function(cat){
    text += "━━━ *" + cat + "* ━━━\n";
    byCat[cat].forEach(function(p){
      var line = "▪ " + p.n + "\n";
      if(almF){
        var qty = (p.stk_alm&&p.stk_alm[almF])||0;
        line += "   📦 " + fN(qty,0) + " uds\n";
      } else {
        var parts = [];
        alms.forEach(function(a){
          var qty = (p.stk_alm&&p.stk_alm[a])||0;
          if(qty>0) parts.push(a.substring(0,3) + ": " + fN(qty,0));
        });
        var total = p.stk||0;
        line += "   📦 " + fN(total,0) + " total";
        if(parts.length>1) line += " (" + parts.join(" | ") + ")";
        line += "\n";
      }
      text += line;
    });
    text += "\n";
  });

  var totalUnits = prods.reduce(function(a,p){
    if(almF) return a + ((p.stk_alm&&p.stk_alm[almF])||0);
    return a + (p.stk||0);
  },0);
  text += "📋 *" + prods.length + " productos* — *" + fN(totalUnits,0) + " unidades totales*";

  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

// ── MODAL: NUEVO / EDITAR CONTENEDOR ──────────────────────────────────
function showNuevoContenedor() { _showFormCnt(); }
function showEditContenedor(id) {
  var c=CONTENEDORES.find(function(x){return x.id===id;});
  if(c) _showFormCnt(c);
}
function _showFormCnt(c) {
  var isEdit = !!c;
  var mo=document.getElementById('cnt-form-modal');
  if(!mo){
    mo=document.createElement('div');
    mo.id='cnt-form-modal';
    mo.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
    document.body.appendChild(mo);
  }
  
  var html='<div style="max-width:500px;width:100%;background:var(--color-background-primary);border-radius:14px;padding:22px 20px;box-shadow:0 20px 60px rgba(0,0,0,.7);position:relative">'
    +'<button type="button" onclick="document.getElementById(\'cnt-form-modal\').style.display=\'none\'" style="position:absolute;top:10px;right:12px;background:none;border:none;cursor:pointer;font-size:22px;color:var(--color-text-secondary)">×</button>'
    +'<div style="font-size:16px;font-weight:700;margin-bottom:16px">🚢 '+(isEdit?'Editar Contenedor':'Nuevo Contenedor')+'</div>'
    
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">'
    +'<div><label class="lbl">Referencia Contenedor (EJ: MSKU-1234) *</label><input type="text" id="fcnt-ref" class="adm-inp" value="'+(isEdit?c.ref:'')+'"></div>'
    +'<div><label class="lbl"># Lote (ID de pedido/lote)</label><input type="text" id="fcnt-lote" class="adm-inp" placeholder="Auto = misma referencia" value="'+(isEdit?(c.lote||''):'')+'"></div>'
    +'<div style="grid-column:1/-1;font-size:10px;color:var(--color-text-tertiary);margin-top:-6px">El # Lote es el código que se asocia a entradas de stock y reservas. Si lo dejas vacío, usará la referencia del contenedor.</div>'
    +'</div>'
    
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">'
    +'<div style="grid-column:1/-1"><label class="lbl">Estado</label><select id="fcnt-est" class="adm-sel">'
    +'<option value="preparando" '+(isEdit&&c.estado==='preparando'?'selected':'')+'>Preparando</option>'
    +'<option value="reservado" '+(isEdit&&c.estado==='reservado'?'selected':'')+'>Reservado</option>'
    +'<option value="en_puerto" '+(isEdit&&c.estado==='en_puerto'?'selected':'')+'>En Puerto (Origen)</option>'
    +'<option value="en_transito" '+(isEdit&&c.estado==='en_transito'?'selected':'')+'>En Tránsito</option>'
    +'<option value="en_aduana" '+(isEdit&&c.estado==='en_aduana'?'selected':'')+'>En Aduana (Destino)</option>'
    +'<option value="recibido" '+(isEdit&&c.estado==='recibido'?'selected':'')+'>Recibido</option>'
    +'<option value="cerrado" '+(isEdit&&c.estado==='cerrado'?'selected':'')+'>Cerrado</option>'
    +'</select></div>'
    +'</div>'
    
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">'
    +'<div><label class="lbl">Proveedor(es)</label><input type="text" id="fcnt-prov" class="adm-inp" placeholder="Empresa A, Empresa B..." value="'+(isEdit?c.proveedor||'':'')+'"></div>'
    +'<div><label class="lbl">Transitario</label><input type="text" id="fcnt-trans" class="adm-inp" value="'+(isEdit?c.transitario||'':'')+'"></div>'
    +'</div>'
    
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">'
    +'<div><label class="lbl">Moneda Principal</label><select id="fcnt-mon" class="adm-sel"><option value="USD" '+(isEdit&&c.moneda==='USD'?'selected':'')+'>USD</option><option value="EUR" '+(isEdit&&c.moneda==='EUR'?'selected':'')+'>EUR</option></select></div>'
    +'<div><label class="lbl">Destino final</label><input type="text" id="fcnt-dest" class="adm-inp" placeholder="Habana" value="'+(isEdit?c.almacen_destino||'':'')+'"></div>'
    +'<div><label class="lbl">Fecha ETA</label><input type="date" id="fcnt-eta" class="adm-inp" value="'+(isEdit?c.fecha_eta||'':'')+'"></div>'
    +'</div>'
    
    +'<div style="margin-bottom:16px"><label class="lbl">Notas</label><input type="text" id="fcnt-notas" class="adm-inp" value="'+(isEdit?c.notas||'':'')+'"></div>'
    
    +'<button onclick="saveFormContenedor('+(isEdit?'\''+c.id+'\'':'null')+')" style="width:100%;background:var(--color-primary);color:var(--color-text-primary);border:none;padding:10px;border-radius:8px;font-weight:600;cursor:pointer">Guardar Contenedor</button>'
    +'</div>';
    
  mo.innerHTML=html;
  mo.style.display='flex';
}

function saveFormContenedor(id) {
  var ref=document.getElementById('fcnt-ref').value.trim();
  if(!ref){showToast('Referencia obligatoria');return;}
  var lote=(document.getElementById('fcnt-lote')||{value:''}).value.trim()||ref;
  var est=document.getElementById('fcnt-est').value;
  var prov=document.getElementById('fcnt-prov').value.trim();
  var trans=document.getElementById('fcnt-trans').value.trim();
  var mon=document.getElementById('fcnt-mon').value;
  var dest=document.getElementById('fcnt-dest').value.trim();
  var eta=document.getElementById('fcnt-eta').value;
  var notas=document.getElementById('fcnt-notas').value.trim();
  
  if (id) {
    var c=CONTENEDORES.find(function(x){return x.id===id;});
    if(c) {
      c.ref=ref; c.lote=lote; c.estado=est; c.proveedor=prov; c.transitario=trans; 
      c.moneda=mon; c.almacen_destino=dest; c.fecha_eta=eta; c.notas=notas;
      saveContenedor(c);
      showToast('Contenedor actualizado');
    }
  } else {
    var nc = {
      id:'cnt-'+Date.now(), ref:ref, lote:lote, estado:est, proveedor:prov, transitario:trans,
      moneda:mon, almacen_destino:dest, fecha_eta:eta, notas:notas,
      gastos:[], audit_log:[], created_at:new Date().toISOString()
    };
    CONTENEDORES.unshift(nc);
    saveContenedor(nc);
    showToast('Contenedor / Lote '+lote+' creado');
  }
  document.getElementById('cnt-form-modal').style.display='none';
}

function eliminarContenedor(id) {
  if(!confirm('¿Eliminar este contenedor y TODOS sus gastos asociados de forma permanente?')) return;
  CONTENEDORES = CONTENEDORES.filter(function(x){return x.id!==id;});
  saveContenedor(null, id);
  showToast('Contenedor eliminado');
}

// ── MODAL: GASTO ───────────────────────────────────────────────
function agregarGastoCnt(cntId) { _showFormGasto(cntId); }
function editarGastoCnt(cntId, gId) {
  var c=CONTENEDORES.find(function(x){return x.id===cntId;});
  if(c){
    var g=(c.gastos||[]).find(function(x){return x.id===gId;});
    if(g) _showFormGasto(cntId, g);
  }
}
function _showFormGasto(cntId, g) {
  var isEdit = !!g;
  var mo=document.getElementById('cnt-gasto-modal');
  if(!mo){
    mo=document.createElement('div'); mo.id='cnt-gasto-modal';
    mo.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
    document.body.appendChild(mo);
  }
  
  var conceptos = ['Mercancía proveedor', 'Flete', 'Seguro', 'Arancel/Aduana', 'Inspección', 'Almacenaje', 'Otros'];
  var cOpts = conceptos.map(function(x){ return '<option value="'+x+'" '+(isEdit&&g.concepto===x?'selected':'')+'>'+x+'</option>'; }).join('');
  if (isEdit && conceptos.indexOf(g.concepto)===-1) {
    cOpts += '<option value="'+g.concepto+'" selected>'+g.concepto+'</option>';
  }
  
  var html='<div style="max-width:400px;width:100%;background:var(--color-background-primary);border-radius:14px;padding:22px 20px;box-shadow:0 20px 60px rgba(0,0,0,.7);position:relative">'
    +'<button type="button" onclick="document.getElementById(\'cnt-gasto-modal\').style.display=\'none\'" style="position:absolute;top:10px;right:12px;background:none;border:none;cursor:pointer;font-size:22px;color:var(--color-text-secondary)">×</button>'
    +'<div style="font-size:16px;font-weight:700;margin-bottom:16px">'+(isEdit?'✏️ Editar Gasto':'➕ Nuevo Gasto')+'</div>'
    
    +'<div style="margin-bottom:12px"><label class="lbl">Concepto *</label><select id="fcg-con" class="adm-sel" onchange="if(this.value===\'Otros\'){document.getElementById(\'fcg-con-otr\').style.display=\'block\'}else{document.getElementById(\'fcg-con-otr\').style.display=\'none\'}">'
    + cOpts + (isEdit&&conceptos.indexOf(g.concepto)===-1?'':'<option value="Otros">Otro (especificar)</option>')
    +'</select><input type="text" id="fcg-con-otr" class="adm-inp" placeholder="Especifique el concepto" style="display:none;margin-top:6px"></div>'
    
    +'<div style="margin-bottom:12px"><label class="lbl">Acreedor / Proveedor</label><input type="text" id="fcg-acr" class="adm-inp" placeholder="Empresa o persona" value="'+(isEdit?g.acreedor||'':'')+'"></div>'
    
    +'<div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-bottom:12px">'
    +'<div><label class="lbl">Monto Total *</label><input type="number" step="0.01" id="fcg-mon" class="adm-inp" value="'+(isEdit?g.monto:'')+'"></div>'
    +'<div><label class="lbl">Moneda</label><select id="fcg-cur" class="adm-sel">'
    +(typeof MONEDAS!=='undefined'?MONEDAS:['USD','EUR','CUP','CUPT']).map(function(m){return '<option value="'+m+'" '+(isEdit&&g.moneda===m?'selected':'')+'>'+m+'</option>';}).join('')
    +'</select></div>'
    +'</div>'
    
    +'<div style="margin-bottom:16px"><label class="lbl">Vencimiento (Opcional)</label><input type="date" id="fcg-ven" class="adm-inp" value="'+(isEdit?g.vencimiento||'':'')+'"></div>'
    
    +'<div style="display:flex;gap:10px">'
    +(isEdit ? '<button onclick="eliminarGastoCnt(\''+cntId+'\',\''+g.id+'\')" style="flex:1;background:rgba(248,113,113,.2);color:var(--color-text-danger);border:none;padding:10px;border-radius:8px;font-weight:600;cursor:pointer">Eliminar</button>' : '')
    +'<button onclick="saveFormGasto(\''+cntId+'\','+(isEdit?'\''+g.id+'\'':'null')+')" style="flex:2;background:var(--color-primary);color:var(--color-text-primary);border:none;padding:10px;border-radius:8px;font-weight:600;cursor:pointer">Guardar Gasto</button>'
    +'</div>'
    +'</div>';
    
  mo.innerHTML=html;
  mo.style.display='flex';
}

function saveFormGasto(cntId, gId) {
  var c=CONTENEDORES.find(function(x){return x.id===cntId;});
  if(!c)return;
  var con=document.getElementById('fcg-con').value;
  if(con==='Otros') con=document.getElementById('fcg-con-otr').value.trim();
  if(!con){showToast('Concepto obligatorio');return;}
  var acr=document.getElementById('fcg-acr').value.trim();
  var mon=parseFloat(document.getElementById('fcg-mon').value)||0;
  if(mon<=0){showToast('Monto inválido');return;}
  var cur=document.getElementById('fcg-cur').value;
  var ven=document.getElementById('fcg-ven').value;
  
  if(gId) {
    var g=(c.gastos||[]).find(function(x){return x.id===gId;});
    if(g) { g.concepto=con; g.acreedor=acr; g.monto=mon; g.moneda=cur; g.vencimiento=ven; }
  } else {
    if(!c.gastos) c.gastos=[];
    c.gastos.push({id:'cg-'+Date.now(), concepto:con, acreedor:acr, monto:mon, moneda:cur, vencimiento:ven, pagos:[]});
  }
  
  saveContenedor(c);
  showToast(gId?'Gasto actualizado':'Gasto añadido');
  document.getElementById('cnt-gasto-modal').style.display='none';
}

function eliminarGastoCnt(cntId, gId) {
  if(!confirm('¿Eliminar este concepto de gasto?')) return;
  var c=CONTENEDORES.find(function(x){return x.id===cntId;});
  if(!c)return;
  c.gastos = (c.gastos||[]).filter(function(x){return x.id!==gId;});
  saveContenedor(c);
  document.getElementById('cnt-gasto-modal').style.display='none';
}

// ── REGISTRAR PAGO ─────────────────────────────────────────────
var _cntPagoCtx={cid:null,gid:null};
function registrarPagoCnt(cntId, gId) {
  var c=CONTENEDORES.find(function(x){return x.id===cntId;});
  if(!c)return;
  var g=(c.gastos||[]).find(function(x){return x.id===gId;});
  if(!g)return;
  
  _cntPagoCtx={cid:cntId,gid:gId};
  var pagadoGasto = (g.pagos||[]).reduce(function(acc, pg){ return acc + parseFloat(pg.monto||0); }, 0);
  var falta = g.monto - pagadoGasto;
  
  var mo=document.getElementById('cnt-pago-modal');
  if(!mo){
    mo=document.createElement('div'); mo.id='cnt-pago-modal';
    mo.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
    document.body.appendChild(mo);
  }
  
  var opts = '<option value="">Sin caja (Solo registrar)</option>';
  if (typeof _cajasData !== 'undefined' && _cajasData.length > 0) {
    var grupos = {};
    _cajasData.filter(function(c){return c.activa!==false;}).forEach(function(c){
      var t = c.moneda || 'Otras';
      if(!grupos[t]) grupos[t] = [];
      grupos[t].push(c);
    });
    Object.keys(grupos).sort().forEach(function(gKey){
      opts += '<optgroup label="Cajas en '+gKey+'">';
      grupos[gKey].forEach(function(c){
        var sld = typeof _getSaldoCaja==='function' ? _getSaldoCaja(c.nombre) : parseFloat(c.saldo_inicial||0);
        opts += '<option value="'+c.nombre+'" data-mon="'+c.moneda+'">'+c.nombre+' ('+fN(sld,0)+' '+c.moneda+')</option>';
      });
      opts += '</optgroup>';
    });
  } else {
    var cajasStrings = typeof getAllCajas==='function'?getAllCajas():[];
    cajasStrings.forEach(function(cjStr){
      var cmon = cjStr.split(' ')[0];
      if(!['USD','EUR','CUP','CUPT'].includes(cmon)) cmon = 'USD';
      opts += '<option value="'+cjStr+'" data-mon="'+cmon+'">'+cjStr+'</option>';
    });
  }
  
  var html='<div style="max-width:400px;width:100%;background:var(--color-background-primary);border-radius:14px;padding:22px 20px;box-shadow:0 20px 60px rgba(0,0,0,.7);position:relative">'
    +'<button type="button" onclick="document.getElementById(\'cnt-pago-modal\').style.display=\'none\'" style="position:absolute;top:10px;right:12px;background:none;border:none;cursor:pointer;font-size:22px;color:var(--color-text-secondary)">×</button>'
    +'<div style="font-size:16px;font-weight:700;margin-bottom:16px">💸 Pagar Gasto de Contenedor</div>'
    +'<div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:16px">Pendiente: <strong>'+fN(falta,2)+' '+g.moneda+'</strong> ('+g.concepto+')</div>'
    
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">'
    +'<div><label class="lbl">Amortiza ('+g.moneda+')</label><input type="number" step="0.01" id="fcp-mon" data-moneda="'+g.moneda+'" class="adm-inp" value="'+falta.toFixed(2)+'" oninput="updCntPagoCaja()"></div>'
    +'<div><label class="lbl">Fecha</label><input type="date" id="fcp-fec" class="adm-inp" value="'+today()+'"></div>'
    +'</div>'
    
    +'<div style="margin-bottom:12px"><label class="lbl">Caja Origen</label><select id="fcp-caja" class="adm-sel" onchange="updCntPagoCaja()">'+opts+'</select></div>'
    +'<div id="fcp-caja-wrap" style="display:none;margin-bottom:12px;background:rgba(255,255,255,.05);padding:10px;border-radius:8px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
    +'<label class="lbl" style="color:var(--color-text-warning);margin:0">A extraer de caja <span id="fcp-caja-mon"></span> *</label>'
    +'<div style="font-size:11px;color:var(--color-text-secondary);display:flex;align-items:center;gap:4px" title="Tasa de conversión respecto a la deuda">Tasa: <input type="number" id="fcp-tasa" class="adm-inp" style="width:60px;padding:2px 4px;font-size:11px;height:20px" oninput="updCntPagoTasa()"></div>'
    +'</div>'
    +'<input type="number" step="0.01" id="fcp-moncaja" class="adm-inp" oninput="updCntPagoMonCaja()">'
    +'</div>'
    
    +'<div style="margin-bottom:12px;background:rgba(16,185,129,.1);padding:10px;border-radius:8px;border:1px solid rgba(16,185,129,.3)">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
    +'<label class="lbl" style="color:var(--color-text-success);margin:0">Equivalente USD (Para el costo global)</label>'
    +'<div style="font-size:11px;color:var(--color-text-secondary);display:flex;align-items:center;gap:4px" title="Tasa de conversión a USD">Tasa: <input type="number" id="fcp-tasa-usd" class="adm-inp" style="width:70px;padding:2px 4px;font-size:11px;height:20px" oninput="updCntPagoTasaUsd()"></div>'
    +'</div>'
    +'<input type="number" step="0.01" id="fcp-usd" class="adm-inp" oninput="updCntPagoUsd()">'
    +'<input type="hidden" id="fcp-usd-mod" value="0">'
    +'</div>'

    +'<div style="margin-bottom:16px"><label class="lbl">Nota / Referencia</label><input type="text" id="fcp-nota" class="adm-inp" placeholder="Transferencia BBVA"></div>'
    
    +'<button onclick="savePagoCnt()" style="width:100%;background:var(--color-primary);color:var(--color-text-primary);border:none;padding:10px;border-radius:8px;font-weight:600;cursor:pointer">Confirmar Pago</button>'
    +'</div>';
    
  mo.innerHTML=html;
  mo.style.display='flex';
  setTimeout(updCntPagoCaja, 50); // initial calc
}

window.updCntPagoCaja = function() {
  document.getElementById('fcp-usd-mod').value='0';
  var sel = document.getElementById('fcp-caja');
  var wrp = document.getElementById('fcp-caja-wrap');
  var inpCaja = document.getElementById('fcp-moncaja');
  var lblCaja = document.getElementById('fcp-caja-mon');
  var inpUSD = document.getElementById('fcp-usd');
  var usdMod = false;
  var elMon = document.getElementById('fcp-mon');
  
  if(!sel || !elMon) return;
  var deudaMon = elMon.getAttribute('data-moneda');
  var montoDeuda = parseFloat(elMon.value)||0;
  var opt = sel.value ? sel.options[sel.selectedIndex] : null;
  var cajaMon = opt ? opt.getAttribute('data-mon') : deudaMon;

  var almToUse=null;
  if(opt && typeof _cajasData !== 'undefined') {
    var cObj = _cajasData.find(function(x){return x.nombre===sel.value;});
    if(cObj) almToUse = cObj.almacen;
  }
  
  var usd = deudaMon==='USD' ? montoDeuda : (typeof toUSD==='function'?toUSD(montoDeuda,deudaMon,almToUse):montoDeuda/(RATES[deudaMon]||1));
  
  if(!sel.value) { 
    wrp.style.display='none'; 
    if(!usdMod) {
      inpUSD.value = usd.toFixed(2);
      if(document.getElementById('fcp-tasa-usd') && montoDeuda>0 && usd>0) {
        var isDeudaNac = (deudaMon==='CUP'||deudaMon==='CUPT');
        document.getElementById('fcp-tasa-usd').value = isDeudaNac ? (montoDeuda/usd).toFixed(4) : (usd/montoDeuda).toFixed(4);
      }
    }
    return; 
  }

  if(cajaMon !== deudaMon && cajaMon !== 'USD') {
    wrp.style.display='block';
    lblCaja.innerText = '(' + cajaMon + ')';
    var eqCaja = typeof fromUSD==='function'?fromUSD(usd,cajaMon,almToUse):usd*(RATES[cajaMon]||1);
    inpCaja.value = eqCaja.toFixed(2);
    
    var isCajaNac = (cajaMon==='CUP'||cajaMon==='CUPT');
    var isDeudaNac = (deudaMon==='CUP'||deudaMon==='CUPT');
    if(montoDeuda>0 && eqCaja>0) {
      var tasa = (!isCajaNac && isDeudaNac) ? (montoDeuda / eqCaja) : (eqCaja / montoDeuda);
      document.getElementById('fcp-tasa').value = tasa.toFixed(4);
    }
  } else {
    wrp.style.display='none';
    if (cajaMon === 'USD') inpCaja.value = usd.toFixed(2);
  }
  
  if (!usdMod) {
    inpUSD.value = usd.toFixed(2);
    if(document.getElementById('fcp-tasa-usd') && montoDeuda>0 && usd>0) {
      var isDeudaNac = (deudaMon==='CUP'||deudaMon==='CUPT');
      document.getElementById('fcp-tasa-usd').value = isDeudaNac ? (montoDeuda/usd).toFixed(4) : (usd/montoDeuda).toFixed(4);
    }
  }
};

window.updCntPagoMonCaja = function() {
  document.getElementById('fcp-usd-mod').value='1';
  var monCaja = parseFloat(document.getElementById('fcp-moncaja').value)||0;
  var sel = document.getElementById('fcp-caja');
  var opt = sel.value ? sel.options[sel.selectedIndex] : null;
  var cajaMon = opt ? opt.getAttribute('data-mon') : 'USD';
  var elMon = document.getElementById('fcp-mon');
  var montoDeuda = elMon ? (parseFloat(elMon.value)||0) : 0;
  var deudaMon = elMon ? elMon.getAttribute('data-moneda') : 'USD';
  
  var almToUse=null;
  if(opt && typeof _cajasData !== 'undefined') {
    var cObj = _cajasData.find(function(x){return x.nombre===sel.value;});
    if(cObj) almToUse = cObj.almacen;
  }
  
  if(montoDeuda>0 && monCaja>0) {
    var isCajaNac = (cajaMon==='CUP'||cajaMon==='CUPT');
    var isDeudaNac = (deudaMon==='CUP'||deudaMon==='CUPT');
    var tasa = (!isCajaNac && isDeudaNac) ? (montoDeuda / monCaja) : (monCaja / montoDeuda);
    document.getElementById('fcp-tasa').value = tasa.toFixed(4);
  }
};

window.updCntPagoTasa = function() {
  document.getElementById('fcp-usd-mod').value='1';
  var tasa = parseFloat(document.getElementById('fcp-tasa').value)||0;
  var elMon = document.getElementById('fcp-mon');
  if(!elMon) return;
  var montoDeuda = parseFloat(elMon.value)||0;
  
  var sel = document.getElementById('fcp-caja');
  var opt = sel.value ? sel.options[sel.selectedIndex] : null;
  var cajaMon = opt ? opt.getAttribute('data-mon') : elMon.getAttribute('data-moneda');
  var deudaMon = elMon.getAttribute('data-moneda');
  
  var isCajaNac = (cajaMon==='CUP'||cajaMon==='CUPT');
  var isDeudaNac = (deudaMon==='CUP'||deudaMon==='CUPT');
  
  var monCaja = 0;
  if (tasa > 0) {
    if (!isCajaNac && isDeudaNac) {
      monCaja = montoDeuda / tasa;
    } else {
      monCaja = montoDeuda * tasa;
    }
  }
  document.getElementById('fcp-moncaja').value = monCaja.toFixed(2);
  
  var almToUse=null;
  if(opt && typeof _cajasData !== 'undefined') {
    var cObj = _cajasData.find(function(x){return x.nombre===sel.value;});
    if(cObj) almToUse = cObj.almacen;
  }
};

window.updCntPagoTasaUsd = function() {
  document.getElementById('fcp-usd-mod').value='1';
  var tasa = parseFloat(document.getElementById('fcp-tasa-usd').value)||0;
  var elMon = document.getElementById('fcp-mon');
  if(!elMon) return;
  var deudaMon = elMon.getAttribute('data-moneda');
  var montoDeuda = parseFloat(elMon.value)||0;
  if(tasa > 0) {
    var isDeudaNac = (deudaMon==='CUP'||deudaMon==='CUPT');
    var usd = isDeudaNac ? (montoDeuda / tasa) : (montoDeuda * tasa);
    document.getElementById('fcp-usd').value = usd.toFixed(2);
    updCntPagoUsd(true);
  }
};

window.updCntPagoUsd = function(skipTasa) {
  document.getElementById('fcp-usd-mod').value='1';
  var usd = parseFloat(document.getElementById('fcp-usd').value)||0;
  var sel = document.getElementById('fcp-caja');
  var opt = sel.value ? sel.options[sel.selectedIndex] : null;
  var elMon = document.getElementById('fcp-mon');
  if(!elMon) return;
  var deudaMon = elMon.getAttribute('data-moneda');
  var cajaMon = opt ? opt.getAttribute('data-mon') : deudaMon;
  
  var almToUse=null;
  if(opt && typeof _cajasData !== 'undefined') {
    var cObj = _cajasData.find(function(x){return x.nombre===sel.value;});
    if(cObj) almToUse = cObj.almacen;
  }
  
  var montoDeuda = parseFloat(elMon.value)||0;
  if (!skipTasa) {
    var tasaInp = document.getElementById('fcp-tasa-usd');
    if(tasaInp && montoDeuda>0 && usd>0) {
      var isDeudaNac = (deudaMon==='CUP'||deudaMon==='CUPT');
      tasaInp.value = isDeudaNac ? (montoDeuda / usd).toFixed(4) : (usd / montoDeuda).toFixed(4);
    }
  }

  var wrp = document.getElementById('fcp-caja-wrap');
  var inpCaja = document.getElementById('fcp-moncaja');
  var lblCaja = document.getElementById('fcp-caja-mon');
  
  if(!sel.value) { 
    wrp.style.display='none'; 
    return; 
  }

  if(cajaMon !== deudaMon && cajaMon !== 'USD') {
    wrp.style.display='block';
    lblCaja.innerText = '(' + cajaMon + ')';
    var eqCaja = typeof fromUSD==='function'?fromUSD(usd,cajaMon,almToUse):usd*(RATES[cajaMon]||1);
    inpCaja.value = eqCaja.toFixed(2);
    
    var isCajaNac = (cajaMon==='CUP'||cajaMon==='CUPT');
    var isDeudaNac = (deudaMon==='CUP'||deudaMon==='CUPT');
    var montoDeuda = parseFloat(elMon.value)||0;
    if(montoDeuda>0 && eqCaja>0) {
      var tasa = (!isCajaNac && isDeudaNac) ? (montoDeuda / eqCaja) : (eqCaja / montoDeuda);
      document.getElementById('fcp-tasa').value = tasa.toFixed(4);
    }
  } else {
    wrp.style.display='none';
    if (cajaMon === 'USD') inpCaja.value = usd.toFixed(2);
  }
};

function savePagoCnt() {
  var c=CONTENEDORES.find(function(x){return x.id===_cntPagoCtx.cid;});
  if(!c)return;
  var g=(c.gastos||[]).find(function(x){return x.id===_cntPagoCtx.gid;});
  if(!g)return;
  
  var mon = parseFloat(document.getElementById('fcp-mon').value)||0; // Monto de deuda amortizado
  var finalUsd = parseFloat(document.getElementById('fcp-usd').value)||0;
  if(mon<=0){showToast('Monto inválido');return;}
  var fec = document.getElementById('fcp-fec').value||today();
  var caja = document.getElementById('fcp-caja').value;
  var sel = document.getElementById('fcp-caja');
  var cajaMon = caja ? sel.options[sel.selectedIndex].getAttribute('data-mon') : g.moneda;
  var monCaja = mon;
  
  if (caja && cajaMon !== g.moneda) {
    monCaja = parseFloat(document.getElementById('fcp-moncaja').value)||0;
    if(monCaja<=0){showToast('Monto de caja inválido');return;}
  }
  
  var nota = document.getElementById('fcp-nota').value.trim();
  
  var pagadoGasto = (g.pagos||[]).reduce(function(acc, pg){ return acc + parseFloat(pg.monto||0); }, 0);
  if (mon > g.monto - pagadoGasto + 0.05) {
    showToast('El pago excede el total del gasto'); return;
  }
  
  var ahora=new Date();
  var hora=String(ahora.getHours()).padStart(2,'0')+':'+String(ahora.getMinutes()).padStart(2,'0');
  
  // 1. Create payment obj (en moneda de la deuda para la tarjeta)
  var pgObj = {
    id:'pg-'+Date.now(), fecha:fec, hora:hora, monto:mon, mon:g.moneda, caja:caja, nota:nota||'Pago '+g.concepto,
    user:(typeof S!=='undefined'&&S.user?S.user:'Admin'), equivUSD: finalUsd
  };
  // Store original transaction info for reference
  if (caja && cajaMon !== g.moneda) {
    pgObj.montoCaja = monCaja;
    pgObj.monCaja = cajaMon;
  }
  
  // 2. Register in movimientos_ig (usando moneda y monto de CAJA)
  var movId=null;
  if(typeof igNextId!=='undefined'){
    movId=igNextId++;
    var descMov = (nota||'Pago '+g.concepto) + ' — ' + c.ref;
    MOVS.unshift({id:movId, fecha:fec, tipo:'Pago contenedor', desc:descMov,
      acreedor:g.acreedor||'', monto:monCaja, mon:cajaMon, equivUSD:parseFloat(finalUsd.toFixed(2)),
      cta:caja, sentido:'gasto', notas:c.ref});
    try{localStorage.setItem('erp_movs',JSON.stringify(MOVS.slice(0,1000)));}catch(e){}
    if(typeof _supaWrite==='function'){
      _supaWrite('POST','movimientos_ig',{
        fecha:fec, tipo:'Pago contenedor', descripcion:descMov,
        monto:monCaja, moneda:cajaMon, equiv_usd:parseFloat(finalUsd.toFixed(4)),
        cuenta:caja||'', vendedor:pgObj.user, notas:c.ref
      });
    }
    pgObj.movId = movId;
  }
  
  // 3. Register in mov_cajas
  if(caja) {
    var cRow = {
      tipo: 'retiro', fecha: fec, notas: 'Pago contenedor '+c.ref+' - '+g.concepto,
      usuario: pgObj.user, caja_origen: caja, caja_destino: null,
      monto_origen: monCaja, monto_destino: monCaja
    };
    if (typeof _cajasMovs !== 'undefined') _cajasMovs.unshift(cRow);
    if (typeof supaReq === 'function' && typeof _supaOnline !== 'undefined' && _supaOnline) {
      supaReq('POST','mov_cajas',cRow).catch(function(e){console.warn('mov_cajas:',e);});
    }
  }
  
  if(!g.pagos) g.pagos=[];
  g.pagos.push(pgObj);
  saveContenedor(c);
  document.getElementById('cnt-pago-modal').style.display='none';
  showToast('Pago registrado correctamente ✓');
  if(typeof renderLibro==='function')try{renderLibro();}catch(e){}
  if(typeof renderCajas==='function')try{renderCajas();}catch(e){}
}

function eliminarPagoCnt(cntId, gId, pgId) {
  var c=CONTENEDORES.find(function(x){return x.id===cntId;});
  if(!c)return;
  var g=(c.gastos||[]).find(function(x){return x.id===gId;});
  if(!g)return;
  var pgIdx=(g.pagos||[]).findIndex(function(x){return x.id===pgId;});
  if(pgIdx<0)return;
  var pg=g.pagos[pgIdx];
  if(!confirm('¿Eliminar este pago de '+fN(pg.monto,2)+' '+pg.mon+'?\nEsta acción también revertirá el movimiento en caja y el libro contable.')) return;
  
  var descMov = (pg.nota||'Pago '+g.concepto) + ' — ' + c.ref;
  var monCaja = pg.montoCaja || pg.monto;
  var cajaMon = pg.monCaja || pg.mon;

  // 1. Eliminar de MOVS (Libro IG)
  var mi = -1;
  if(pg.movId != null) mi = MOVS.findIndex(function(m){return m.id === pg.movId;});
  if(mi < 0) mi = MOVS.findIndex(function(m){return m.fecha === pg.fecha && m.monto === monCaja && m.desc === descMov;});
  if(mi >= 0) {
    MOVS.splice(mi, 1);
    try{localStorage.setItem('erp_movs',JSON.stringify(MOVS.slice(0,1000)));}catch(e){}
  }

  // 2. Eliminar de Supabase movimientos_ig
  if(typeof enqueue==='function') {
    enqueue({method:'DELETE',path:'movimientos_ig?descripcion=eq.'+encodeURIComponent(descMov)+'&fecha=eq.'+encodeURIComponent(pg.fecha)});
  }

  // 3. Eliminar de _cajasMovs y mov_cajas (Cajas)
  var cajaNota = 'Pago contenedor '+c.ref+' - '+g.concepto;
  if(typeof _cajasMovs!=='undefined'){
    var cIdx=_cajasMovs.findIndex(function(m){return m.fecha===pg.fecha && m.monto_origen===monCaja && m.notas===cajaNota;});
    if(cIdx>=0){
      var targetId = _cajasMovs[cIdx].id;
      _cajasMovs.splice(cIdx,1);
      if(targetId && typeof enqueue==='function') {
        enqueue({method:'DELETE',path:'mov_cajas?id=eq.'+targetId});
      } else if (typeof enqueue==='function') {
        enqueue({method:'DELETE',path:'mov_cajas?notas=eq.'+encodeURIComponent(cajaNota)+'&fecha=eq.'+encodeURIComponent(pg.fecha)});
      }
    } else if (typeof enqueue==='function') {
      enqueue({method:'DELETE',path:'mov_cajas?notas=eq.'+encodeURIComponent(cajaNota)+'&fecha=eq.'+encodeURIComponent(pg.fecha)});
    }
  }

  g.pagos.splice(pgIdx, 1);
  saveContenedor(c);
  showToast('Pago revertido en deuda, caja y libro ✓');
  if(typeof renderLibro==='function')try{renderLibro();}catch(e){}
  if(typeof renderCajas==='function')try{renderCajas();}catch(e){}
}
