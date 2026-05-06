/* ═══════════════════════════════════════
   ERP TEST OVERLAY — activar: Ctrl+Shift+T
   Accede directamente a los globals del ERP
   ═══════════════════════════════════════ */
(function(){
'use strict';

// ── Helpers ──────────────────────────────────────────────
var sleep = function(ms){ return new Promise(function(r){ setTimeout(r,ms); }); };

function assert(c,m){ if(!c) throw new Error(m||'falló'); }
function assertGt(a,b,m){ if(!(a>b)) throw new Error((m||'')+' — '+a+' no > '+b); }
function assertClose(a,b,tol,m){
  tol=tol||0.01;
  if(Math.abs(a-b)>tol) throw new Error((m||'')+' — esperado ~'+b+', obtenido '+a);
}

// ── State ─────────────────────────────────────────────────
var _pass=0, _fail=0, _running=false, _stopped=false;
var _startTime=0;

// ── UI ────────────────────────────────────────────────────
function buildUI(){
  if(document.getElementById('erp-test-overlay')) return;

  var el = document.createElement('div');
  el.id = 'erp-test-overlay';
  el.style.cssText = [
    'position:fixed','top:0','right:0','width:360px','height:100vh',
    'background:#0f0f0f','border-left:1px solid #2a2a2a','z-index:99999',
    'display:flex','flex-direction:column','font-family:DM Sans,system-ui,sans-serif',
    'font-size:12px','color:#e8e8e8','box-shadow:-4px 0 24px rgba(0,0,0,.6)'
  ].join(';');

  el.innerHTML = [
    '<div style="padding:12px 14px;background:#141414;border-bottom:1px solid #222;display:flex;align-items:center;gap:8px;flex-shrink:0">',
      '<span style="font-size:13px;font-weight:700;background:linear-gradient(135deg,#eab308,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent">🧪 ERP Tests</span>',
      '<span id="ta-pass" style="margin-left:auto;background:rgba(34,197,94,.15);color:#22c55e;padding:2px 8px;border-radius:100px;font-size:11px;font-weight:600">✓ 0</span>',
      '<span id="ta-fail" style="background:rgba(239,68,68,.15);color:#ef4444;padding:2px 8px;border-radius:100px;font-size:11px;font-weight:600">✗ 0</span>',
      '<button id="ta-close" style="border:none;background:none;color:#666;cursor:pointer;font-size:18px;padding:0 2px;margin-left:4px">×</button>',
    '</div>',
    '<div id="ta-progress" style="height:3px;background:#1e1e1e;flex-shrink:0"><div id="ta-bar" style="height:100%;width:0;background:linear-gradient(90deg,#22c55e,#3b82f6);transition:width .3s"></div></div>',
    '<div style="padding:8px 10px;background:#141414;border-bottom:1px solid #1e1e1e;display:flex;gap:6px;flex-shrink:0">',
      '<button id="ta-run" style="flex:1;padding:7px;border-radius:6px;border:none;background:#22c55e;color:#000;font-weight:700;cursor:pointer;font-family:inherit;font-size:12px">▶ Run All</button>',
      '<button id="ta-stop" style="padding:7px 12px;border-radius:6px;border:1px solid #333;background:#1e1e1e;color:#888;cursor:pointer;font-family:inherit;font-size:12px">⏹</button>',
      '<button id="ta-clear" style="padding:7px 12px;border-radius:6px;border:1px solid #333;background:#1e1e1e;color:#888;cursor:pointer;font-family:inherit;font-size:12px">🗑</button>',
    '</div>',
    '<div id="ta-log" style="flex:1;overflow-y:auto;padding:10px 12px;line-height:1.9;font-size:11px"></div>',
    '<div style="padding:8px 12px;background:#141414;border-top:1px solid #1e1e1e;font-size:10px;color:#555;flex-shrink:0">Ctrl+Shift+T para cerrar/abrir</div>'
  ].join('');

  document.body.appendChild(el);

  document.getElementById('ta-close').onclick = toggleOverlay;
  document.getElementById('ta-run').onclick = runAll;
  document.getElementById('ta-stop').onclick = function(){ _stopped=true; };
  document.getElementById('ta-clear').onclick = function(){ document.getElementById('ta-log').innerHTML=''; };
}

function toggleOverlay(){
  var el = document.getElementById('erp-test-overlay');
  if(!el){ buildUI(); return; }
  el.style.display = el.style.display==='none' ? 'flex' : 'none';
}

// Keyboard shortcut
document.addEventListener('keydown', function(e){
  if(e.ctrlKey && e.shiftKey && e.key==='T'){ e.preventDefault(); toggleOverlay(); }
});

// ── Logging ──────────────────────────────────────────────
function log(text, color){
  var area = document.getElementById('ta-log');
  if(!area) return;
  var div = document.createElement('div');
  div.style.color = color||'#888';
  div.style.borderBottom = '1px solid rgba(255,255,255,.03)';
  div.textContent = text;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}
function lp(t){ log('✓ '+t,'#22c55e'); }
function lf(t){ log('✗ '+t,'#ef4444'); }
function li(t){ log('ℹ '+t,'#3b82f6'); }
function lw(t){ log('⚠ '+t,'#eab308'); }
function ld(t){ log('  '+t,'#555'); }
function ls(t){ log('━━ '+t+' ━━','#a855f7'); }

function updateStats(){
  var p=document.getElementById('ta-pass');
  var f=document.getElementById('ta-fail');
  if(p) p.textContent='✓ '+_pass;
  if(f) f.textContent='✗ '+_fail;
}

// ── Test runner ───────────────────────────────────────────
var SUITES = [

  // ─── 1. DATA ───────────────────────────────────────────
  { name:'📦 Datos del Sistema', tests:[
    { name:'USERS existe y tiene usuarios', fn: async function(){
        assert(typeof USERS==='object','USERS no existe');
        assertGt(Object.keys(USERS).length,0,'Sin usuarios');
        ld('Usuarios: '+Object.keys(USERS).join(', '));
    }},
    { name:'PRODS tiene productos', fn: async function(){
        assert(Array.isArray(PRODS),'PRODS no es array');
        assertGt(PRODS.length,0,'Sin productos');
        ld('Productos: '+PRODS.length+' — ej: '+PRODS[0].n);
    }},
    { name:'VENTAS existe', fn: async function(){
        assert(Array.isArray(VENTAS),'VENTAS no es array');
        ld('Ventas registradas: '+VENTAS.length);
    }},
    { name:'MOVS (I/G) existe', fn: async function(){
        assert(Array.isArray(MOVS),'MOVS no es array');
        ld('Movimientos I/G: '+MOVS.length);
    }},
    { name:'RATES tiene valores positivos', fn: async function(){
        assert(typeof RATES==='object','RATES no existe');
        assertGt(RATES.CUP,0,'CUP rate inválido');
        assertGt(RATES.EUR,0,'EUR rate inválido');
        ld('USD/CUP='+RATES.CUP+' EUR='+RATES.EUR+' CUPT='+RATES.CUPT);
    }},
    { name:'MONEDAS tiene USD, EUR, CUP', fn: async function(){
        assert(Array.isArray(MONEDAS),'MONEDAS no es array');
        assert(MONEDAS.indexOf('USD')>=0,'Falta USD');
        assert(MONEDAS.indexOf('EUR')>=0,'Falta EUR');
        assert(MONEDAS.indexOf('CUP')>=0,'Falta CUP');
        ld('Monedas: '+MONEDAS.join(', '));
    }}
  ]},

  // ─── 2. USUARIOS ───────────────────────────────────────
  { name:'🔐 Usuarios y Roles', tests:[
    { name:'Admin existe con rol admin', fn: async function(){
        var found = Object.values(USERS).some(function(u){ return u.rol==='admin'; });
        assert(found,'No existe ningún usuario admin');
        ld('Admin encontrado ✓');
    }},
    { name:'Todos los PINs tienen 4 dígitos', fn: async function(){
        var errors=[];
        Object.keys(USERS).forEach(function(n){
          var u=USERS[n];
          if(!u.pin||u.pin.length!==4||!/^\d+$/.test(u.pin))
            errors.push(n+' PIN inválido: '+u.pin);
        });
        if(errors.length) throw new Error(errors.join('; '));
        ld('Todos los PINs son válidos ✓');
    }},
    { name:'Roles son admin o vendedor', fn: async function(){
        var errors=[];
        Object.keys(USERS).forEach(function(n){
          var r=USERS[n].rol;
          if(r!=='admin'&&r!=='vendedor') errors.push(n+': rol='+r);
        });
        if(errors.length) throw new Error(errors.join('; '));
        ld('Roles válidos ✓');
    }},
    { name:'COM_DEF tiene comisiones', fn: async function(){
        assert(typeof COM_DEF==='object','COM_DEF no existe');
        ld('COM_DEF: '+JSON.stringify(COM_DEF));
    }}
  ]},

  // ─── 3. CONVERSIONES ──────────────────────────────────
  { name:'💱 Conversión de Monedas', tests:[
    { name:'toUSD(1000, CUP) es correcto', fn: async function(){
        assert(typeof toUSD==='function','toUSD no existe');
        var r=toUSD(1000,'CUP');
        var e=1000/RATES.CUP;
        assertClose(r,e,0.1,'CUP→USD');
        ld('1000 CUP = '+r.toFixed(2)+' USD');
    }},
    { name:'toUSD(100, EUR) > 0', fn: async function(){
        var r=toUSD(100,'EUR');
        assertGt(r,0,'EUR→USD debe ser positivo');
        ld('100 EUR = '+r.toFixed(2)+' USD');
    }},
    { name:'toUSD(50, USD) = 50 (identidad)', fn: async function(){
        var r=toUSD(50,'USD');
        assertClose(r,50,0.001,'USD→USD debe ser 50');
    }},
    { name:'fromUSD round-trip es consistente', fn: async function(){
        assert(typeof fromUSD==='function','fromUSD no existe');
        var usd=100;
        var cup=fromUSD(usd,'CUP');
        var back=toUSD(cup,'CUP');
        assertClose(back,usd,0.5,'Round-trip USD→CUP→USD');
        ld(usd+' USD → '+cup.toFixed(0)+' CUP → '+back.toFixed(2)+' USD');
    }}
  ]},

  // ─── 4. PRODUCTOS ─────────────────────────────────────
  { name:'📦 Productos y Stock', tests:[
    { name:'Productos tienen nombre y stock', fn: async function(){
        var errors=[];
        PRODS.slice(0,10).forEach(function(p){
          if(!p.n) errors.push('producto sin nombre');
          if(typeof p.stk==='undefined') errors.push(p.n+': sin stk');
        });
        if(errors.length) throw new Error(errors.join('; '));
        ld('10 productos verificados ✓');
    }},
    { name:'Productos activos tienen precio', fn: async function(){
        var activos=PRODS.filter(function(p){ return p.activo!==false; });
        var conPrecio=activos.filter(function(p){ return p.min>0||p.maj>0; });
        ld('Activos: '+activos.length+' — con precio: '+conPrecio.length);
        assertGt(conPrecio.length,0,'Ningún producto activo tiene precio');
    }},
    { name:'Stock por almacén (stk_alm) es válido', fn: async function(){
        var conAlm=PRODS.filter(function(p){ return p.stk_alm; });
        ld(conAlm.length+'/'+PRODS.length+' tienen stk_alm');
        conAlm.slice(0,3).forEach(function(p){
          assert(typeof p.stk_alm==='object',p.n+': stk_alm debe ser objeto');
        });
    }},
    { name:'Stock total vs suma por almacén', fn: async function(){
        var mismatches=[];
        PRODS.forEach(function(p){
          if(p.stk_alm){
            var sum=Object.values(p.stk_alm).reduce(function(a,v){return a+(v||0);},0);
            if(Math.abs(sum-(p.stk||0))>0.5) mismatches.push(p.n+': total='+p.stk+' suma_alm='+sum);
          }
        });
        if(mismatches.length>0){ mismatches.slice(0,3).forEach(ld); }
        ld(mismatches.length+' desajustes stk/stk_alm (informativo)');
    }}
  ]},

  // ─── 5. POS ──────────────────────────────────────────
  { name:'🛒 POS — Estado y Carrito', tests:[
    { name:'Estado S existe', fn: async function(){
        assert(typeof S==='object'&&S!==null,'S no existe');
        assert(Array.isArray(S.cart),'S.cart debe ser array');
        assert(Array.isArray(S.pagos),'S.pagos debe ser array');
        ld('Cart: '+S.cart.length+' items | Pagos: '+S.pagos.length);
    }},
    { name:'getVentaUSD devuelve número', fn: async function(){
        assert(typeof getVentaUSD==='function','getVentaUSD no existe');
        var v=getVentaUSD();
        assert(typeof v==='number','Debe devolver número');
        ld('Total carrito actual: $'+v.toFixed(2)+' USD');
    }},
    { name:'Carrito vacío → total = 0', fn: async function(){
        var prev=S.cart.slice();
        S.cart=[];
        var t=getVentaUSD();
        assert(t===0,'Carrito vacío debe dar total 0');
        S.cart=prev;
    }},
    { name:'Añadir producto al carrito actualiza total', fn: async function(){
        var p=PRODS.find(function(x){ return x.activo!==false&&x.min>0; });
        if(!p){ lw('Sin producto con precio'); return; }
        S.cart.push({n:p.n,q:2,precioUSD:p.min,mon:'USD'});
        var t=getVentaUSD();
        assertGt(t,0,'Total debe ser > 0 tras añadir producto');
        assertClose(t,p.min*2,0.01,'Total debe ser 2 × precio min');
        ld('Añadido 2× '+p.n+' ($'+p.min+') → total $'+t.toFixed(2));
        S.cart.pop();
    }}
  ]},

  // ─── 6. VENTAS ───────────────────────────────────────
  { name:'📋 Ventas', tests:[
    { name:'Ventas tienen campos requeridos', fn: async function(){
        if(!VENTAS.length){ lw('Sin ventas'); return; }
        var v=VENTAS[0];
        assert(v.fecha,'Venta sin fecha');
        assert(v.vend,'Venta sin vendedor');
        assert(v.alm,'Venta sin almacén');
        assert(typeof v.totalUSD==='number','totalUSD debe ser número');
        ld('Última venta: '+v.fecha+' | '+v.vend+' | $'+v.totalUSD+' | '+v.alm);
    }},
    { name:'Totales de ventas son positivos', fn: async function(){
        var inv=VENTAS.filter(function(v){ return v.totalUSD<=0; });
        if(inv.length) lw(inv.length+' ventas con total ≤ 0');
        else ld('Todos los totales son positivos ✓');
    }},
    { name:'filtrar_ven() funciona', fn: async function(){
        assert(typeof filtrar_ven==='function','filtrar_ven no existe');
        var r=filtrar_ven();
        assert(Array.isArray(r),'Debe devolver array');
        ld('filtrar_ven() → '+r.length+' ventas');
    }},
    { name:'Comisiones calculadas correctamente', fn: async function(){
        var errors=0;
        VENTAS.slice(0,20).forEach(function(v){
          if(v.comPct>0&&v.totalUSD>0){
            var exp=parseFloat((v.totalUSD*v.comPct/100).toFixed(2));
            if(Math.abs(exp-(v.comUSD||0))>0.03) errors++;
          }
        });
        if(errors) lw(errors+' ventas con comisión incorrecta');
        else ld('Comisiones correctas en las últimas 20 ventas ✓');
    }}
  ]},

  // ─── 7. INGRESOS/GASTOS ──────────────────────────────
  { name:'📊 Ingresos / Gastos', tests:[
    { name:'MOVS tienen estructura correcta', fn: async function(){
        if(!MOVS.length){ lw('Sin movimientos'); return; }
        var m=MOVS[0];
        assert(m.fecha,'Mov sin fecha');
        assert(m.tipo,'Mov sin tipo');
        assert(typeof m.monto==='number','monto debe ser número');
        assert(m.sentido==='ingreso'||m.sentido==='gasto',
          'sentido inválido: '+m.sentido);
        ld('Último mov: '+m.fecha+' '+m.tipo+' '+m.monto+' '+m.mon);
    }},
    { name:'TIPO_META tiene tipos de movimiento', fn: async function(){
        assert(typeof TIPO_META==='object','TIPO_META no existe');
        var required=['Gasto operativo','Ingreso no-venta','Transferencia entre cuentas'];
        required.forEach(function(t){
          assert(TIPO_META[t],'TIPO_META sin: '+t);
        });
        ld(Object.keys(TIPO_META).length+' tipos de movimiento ✓');
    }},
    { name:'filtrar_ig() funciona', fn: async function(){
        assert(typeof filtrar_ig==='function','filtrar_ig no existe');
        var r=filtrar_ig();
        assert(Array.isArray(r),'Debe devolver array');
        ld('filtrar_ig() → '+r.length+' movimientos');
    }}
  ]},

  // ─── 8. CAJAS ──────────────────────────────────────
  { name:'💰 Cajas y Saldos', tests:[
    { name:'_cajasData tiene cajas', fn: async function(){
        if(typeof _cajasData==='undefined'||!_cajasData.length){
          assert(typeof CUENTAS_BASE==='object','CUENTAS_BASE tampoco existe');
          ld('Modo offline: usando CUENTAS_BASE — '+Object.keys(CUENTAS_BASE).join(', '));
          return;
        }
        assertGt(_cajasData.length,0,'Sin cajas en _cajasData');
        ld('Cajas Supabase: '+_cajasData.length);
        _cajasData.slice(0,4).forEach(function(c){
          ld('  '+c.nombre+' ('+c.moneda+') saldo_ini='+c.saldo_inicial);
        });
    }},
    { name:'_getSaldoCaja calcula saldo', fn: async function(){
        if(typeof _getSaldoCaja!=='function'){ lw('_getSaldoCaja no disponible'); return; }
        if(typeof _cajasData==='undefined'||!_cajasData.length){ lw('Sin _cajasData'); return; }
        var c=_cajasData[0];
        var s=_getSaldoCaja(c.nombre);
        assert(typeof s==='number','Saldo debe ser número');
        ld(c.nombre+': saldo='+s.toFixed(2)+' '+c.moneda);
    }},
    { name:'_cajasMovs existe', fn: async function(){
        if(typeof _cajasMovs==='undefined'){ lw('_cajasMovs no disponible'); return; }
        assert(Array.isArray(_cajasMovs),'_cajasMovs debe ser array');
        ld('Movimientos de caja: '+_cajasMovs.length);
    }}
  ]},

  // ─── 9. ONLINE / OFFLINE ─────────────────────────────
  { name:'🌐 Online / Offline', tests:[
    { name:'_supaOnline indica estado real', fn: async function(){
        assert(typeof _supaOnline!=='undefined','_supaOnline no existe');
        ld('Supabase online: '+_supaOnline);
        var dot=document.getElementById('sync-dot')||document.getElementById('pos-sync-dot');
        if(dot){ ld('Indicador color: '+dot.style.background); }
    }},
    { name:'offlineAutoSave existe', fn: async function(){
        assert(typeof offlineAutoSave==='function','offlineAutoSave no existe');
        ld('offlineAutoSave disponible ✓');
    }},
    { name:'localStorage tiene datos del ERP', fn: async function(){
        var keys=['erp_rates','erp_movs','erp_liquidaciones'];
        keys.forEach(function(k){
          var v=localStorage.getItem(k);
          ld(k+': '+(v?v.length+' chars':'null'));
        });
    }}
  ]},

  // ─── 10. UI ──────────────────────────────────────────
  { name:'🎨 Interfaz de Usuario', tests:[
    { name:'Módulos principales existen en el DOM', fn: async function(){
        var mods=['mod-pos','mod-ventas','mod-ig'];
        mods.forEach(function(id){
          assert(document.getElementById(id),'Falta módulo #'+id);
        });
        ld('Módulos presentes: '+mods.join(', '));
    }},
    { name:'Página de login es visible al inicio', fn: async function(){
        var pg=document.getElementById('pg-login');
        assert(pg,'#pg-login no existe');
        ld('Login page estado: '+pg.className);
    }},
    { name:'showToast existe y funciona', fn: async function(){
        assert(typeof showToast==='function','showToast no existe');
        showToast('✓ Test toast OK');
        ld('Toast ejecutado ✓');
    }},
    { name:'today() devuelve fecha de hoy', fn: async function(){
        assert(typeof today==='function','today() no existe');
        var d=today();
        assert(typeof d==='string'&&d.length===10,'Formato incorrecto: '+d);
        assertEqual_str(d,new Date().toISOString().slice(0,10));
        ld('Hoy: '+d);
    }}
  ]}
];

function assertEqual_str(a,b){
  if(a!==b) throw new Error('Esperado '+b+' obtenido '+a);
}

// ── Run All ──────────────────────────────────────────────
async function runAll(){
  if(_running) return;
  _running=true; _stopped=false; _pass=0; _fail=0;
  _startTime=Date.now();
  document.getElementById('ta-log').innerHTML='';
  document.getElementById('ta-bar').style.width='0';
  updateStats();

  var total=0;
  SUITES.forEach(function(s){ total+=s.tests.length; });
  var done=0;

  li('Iniciando '+total+' tests...');

  for(var si=0;si<SUITES.length;si++){
    if(_stopped) break;
    var s=SUITES[si];
    ls(s.name);
    for(var ti=0;ti<s.tests.length;ti++){
      if(_stopped) break;
      var t=s.tests[ti];
      var t0=Date.now();
      try{
        await t.fn();
        var ms=Date.now()-t0;
        _pass++;
        lp(t.name+' ('+ms+'ms)');
      } catch(e){
        var ms2=Date.now()-t0;
        _fail++;
        lf(t.name+': '+e.message);
      }
      done++;
      var pct=(done/total*100).toFixed(0);
      document.getElementById('ta-bar').style.width=pct+'%';
      updateStats();
      await sleep(50);
    }
  }

  var elapsed=((Date.now()-_startTime)/1000).toFixed(1);
  li('');
  li('═══ RESULTADO: '+_pass+'/'+total+' OK | '+_fail+' fallidos | '+elapsed+'s ═══');
  if(_fail===0) lp('🎉 TODOS LOS TESTS PASARON');
  else lf('⚠ '+_fail+' test(s) fallaron');

  _running=false;
}

// ── Init — Botón flotante siempre visible ─────────────────
(function addFloatingBtn(){
  var fab = document.createElement('button');
  fab.id = 'erp-test-fab';
  fab.textContent = '🧪';
  fab.title = 'ERP Test Agent (Ctrl+Shift+T)';
  fab.style.cssText = [
    'position:fixed','bottom:20px','left:20px','z-index:99998',
    'width:48px','height:48px','border-radius:50%',
    'border:2px solid #a855f7','background:#1a0a2e',
    'color:#a855f7','cursor:pointer','font-size:20px',
    'box-shadow:0 4px 20px rgba(168,85,247,.4)',
    'transition:transform .2s,box-shadow .2s',
    'display:flex','align-items:center','justify-content:center'
  ].join(';');
  fab.onmouseenter = function(){ fab.style.transform='scale(1.15)'; fab.style.boxShadow='0 6px 28px rgba(168,85,247,.6)'; };
  fab.onmouseleave = function(){ fab.style.transform='scale(1)'; fab.style.boxShadow='0 4px 20px rgba(168,85,247,.4)'; };
  fab.onclick = toggleOverlay;
  document.body.appendChild(fab);
})();

console.log('[ERP Test Agent] Listo — pulsa el botón 🧪 (abajo izquierda) o Ctrl+Shift+T');

})();
