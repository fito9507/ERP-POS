


// ═══ SHARED GLOBALS ═══
const RATES={USD:1,EUR:0.870,CUP:509.56,CUPT:595,DTO_PREVENTA:0};
var RATES_ALM={Habana:{USD:0,EUR:0,MLC:0},Placetas:{USD:0,EUR:0,MLC:0},Xportprise:{USD:0,EUR:0,MLC:0}};
try{ var _ra=JSON.parse(localStorage.getItem('erp_rates_alm')||'{}'); if(Object.keys(_ra).length) RATES_ALM=_ra; }catch(e){}
var RATES_EURUSD=0;
try{ var _eu=parseFloat(localStorage.getItem('erp_eurusd')||'0'); if(_eu>0) RATES_EURUSD=_eu; }catch(e){}
function toUSD(m,mon,alm){
  if(mon==='USD') return m;
  var _alm=alm||S.alm||'';
  var adjUSD=_alm&&RATES_ALM[_alm]&&RATES_ALM[_alm]['USD']?RATES_ALM[_alm]['USD']:0;
  var cupRate = Math.round((RATES.CUP+adjUSD)*100)/100;
  if(mon==='CUP') return m/cupRate;
  if(mon==='CUPT'){
    var pct=_alm&&RATES_ALM[_alm]&&RATES_ALM[_alm]['CUPT']!=null?RATES_ALM[_alm]['CUPT']:10;
    return m/(cupRate*(1+pct/100));
  }
  if(mon==='MLC'){
    var adjMLC=_alm&&RATES_ALM[_alm]&&RATES_ALM[_alm]['MLC']?RATES_ALM[_alm]['MLC']:0;
    return m/(RATES.CUPT+adjMLC);
  }
  if(mon==='EUR'){
    var adjEUR=_alm&&RATES_ALM[_alm]&&RATES_ALM[_alm]['EUR']?RATES_ALM[_alm]['EUR']:0;
    var cupEUR=Math.round(((RATES_EURUSD>0.5?RATES_EURUSD*RATES.CUP:RATES.CUP*1.13)+adjEUR)*100)/100;
    return m*cupEUR/cupRate;
  }
  return m/(RATES[mon]||1);
}
function fromUSD(u,mon,alm){
  if(mon==='USD') return u;
  var _alm=alm||'';
  var adjUSD = _alm&&RATES_ALM[_alm]&&RATES_ALM[_alm]['USD'] ? RATES_ALM[_alm]['USD'] : 0;
  var adjEUR = _alm&&RATES_ALM[_alm]&&RATES_ALM[_alm]['EUR'] ? RATES_ALM[_alm]['EUR'] : 0;
  var adjMLC = _alm&&RATES_ALM[_alm]&&RATES_ALM[_alm]['MLC'] ? RATES_ALM[_alm]['MLC'] : 0;
  var cupt_pct = _alm&&RATES_ALM[_alm]&&RATES_ALM[_alm]['CUPT']!=null ? RATES_ALM[_alm]['CUPT'] : 10;
  if(mon==='CUP')  return Math.round(u * Math.round((RATES.CUP+adjUSD)*100)/100);
  if(mon==='CUPT'){
    // CUPT = CUP price × (1 + cupt_pct%)
    var _cupRate = Math.round((RATES.CUP+adjUSD)*100)/100;
    var cupPrice = u * _cupRate;
    return Math.round(cupPrice*(1+cupt_pct/100));
  }
  if(mon==='MLC')  return parseFloat((u*(RATES.CUPT+adjMLC)).toFixed(0));
  if(mon==='EUR'){
    // EUR = USD / RATES_EURUSD (authoritative rate from Supabase tasas)
    // RATES_EURUSD = CUP_EUR / CUP_USD (includes panel adjustment)
    // adjEUR adds extra CUP per EUR for this almacen
    var cupUSD = Math.round((RATES.CUP + adjUSD) * 100) / 100;
    var cupEUR = Math.round(((RATES_EURUSD > 0.5 ? RATES_EURUSD * RATES.CUP : RATES.CUP * 1.13) + adjEUR) * 100) / 100;
    var eurResult = Math.round((u * cupUSD / cupEUR) * 100) / 100;
    return eurResult;
  }
  return u*(RATES[mon]||1);
}
function fN(n,d=2){if(n==null||isNaN(n))return'—';var v=parseFloat(n);var maxD=d;if(d>0&&d<4){var rounded=Math.round(v*10000)/10000;var str=rounded.toString();if(str.includes('.')){var decs=str.split('.')[1].length;if(decs>d&&decs<=4)maxD=decs;}}return v.toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:maxD});}
function dFor(m){return m==='CUP'||m==='CUPT'?0:2;}

let _gToastTimer;
function showToast(msg){
  let t=document.getElementById('g-toast');
  if(!t){t=document.createElement('div');t.id='g-toast';
    t.style.cssText='position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--color-background-primary);border:1px solid var(--color-border-secondary);border-radius:var(--border-radius-lg);padding:9px 18px;font-size:12px;z-index:9999;opacity:0;transition:opacity .2s;pointer-events:none;white-space:nowrap;color:var(--color-text-primary)';
    document.body.appendChild(t);}
  t.textContent=msg;t.style.opacity=1;
  clearTimeout(_gToastTimer);_gToastTimer=setTimeout(()=>t.style.opacity=0,2800);
}

function fD(s){if(!s)return'—';const d=new Date(s+'T00:00:00');return d.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit'});}

function today(){return new Date().toISOString().slice(0,10);}


// ── Debounced render helpers (prevent focus loss on mobile) ──
var _renderTimers = {};
function _dRender(fn, delay) {
  delay = delay || 280;
  var key = fn.name || String(fn);
  clearTimeout(_renderTimers[key]);
  _renderTimers[key] = setTimeout(function() { fn(); }, delay);
}


