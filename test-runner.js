/* ═══════════════════════════════════════════════
   TEST RUNNER ENGINE — Containers ERP Test Agent
   ═══════════════════════════════════════════════ */

// ── State ──
let _suites = [];
let _results = [];
let _running = false;
let _stopped = false;
let _startTime = 0;
let _passCount = 0;
let _failCount = 0;
let _skipCount = 0;

// ── ERP iframe access ──
function erpFrame(){ return document.getElementById('erp-frame'); }
function erpWin(){ return erpFrame().contentWindow; }
function erpDoc(){ return erpFrame().contentDocument; }

// Wait for iframe to load
// NOTE: USERS, PRODS, VENTAS, MOVS, RATES, S are inside a closure (IIFE) in the ERP
// and are NOT accessible via window.*. We detect load via real globals:
//   - toUSD (function) — core currency helper, defined globally
//   - _cajasData (array) — loaded from Supabase, set on window
function waitForErp(timeout){
  timeout = timeout || 25000;
  return new Promise(function(resolve, reject){
    var f = erpFrame();
    var t = setTimeout(function(){ reject(new Error('ERP iframe load timeout after ' + (timeout/1000) + 's — verify the ERP loads correctly at http://localhost:8765/')); }, timeout);
    function check(){
      try{
        var w = erpWin();
        // toUSD is a global function defined in ERP (not inside IIFE)
        // _cajasData is set on window after Supabase load
        if(typeof w.toUSD === 'function' && typeof w.goMod === 'function'){
          clearTimeout(t);
          resolve();
          return true;
        }
      } catch(e){}
      return false;
    }
    if(f.contentDocument && f.contentDocument.readyState === 'complete'){
      if(check()) return;
    }
    f.onload = function(){
      // Poll until ERP JS has fully initialized
      var poll = setInterval(function(){
        if(check()) clearInterval(poll);
      }, 300);
    };
  });
}

// ── Helpers to interact with ERP ──
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

function erpClick(selector){
  var el = erpDoc().querySelector(selector);
  if(!el) throw new Error('Element not found: ' + selector);
  el.click();
  return el;
}

function erpClickById(id){
  return erpClick('#' + id);
}

function erpSet(id, val){
  var el = erpDoc().getElementById(id);
  if(!el) throw new Error('Input not found: #' + id);
  el.value = val;
  el.dispatchEvent(new Event('input', {bubbles:true}));
  el.dispatchEvent(new Event('change', {bubbles:true}));
  return el;
}

function erpVal(id){
  var el = erpDoc().getElementById(id);
  return el ? el.value : undefined;
}

function erpText(id){
  var el = erpDoc().getElementById(id);
  return el ? el.textContent : '';
}

function erpVisible(id){
  var el = erpDoc().getElementById(id);
  if(!el) return false;
  var s = getComputedStyle(el);
  return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
}

function erpHasClass(el, cls){
  if(typeof el === 'string') el = erpDoc().getElementById(el);
  return el ? el.classList.contains(cls) : false;
}

// Call a global ERP function
function erpCall(fnName){
  var args = Array.prototype.slice.call(arguments, 1);
  var fn = erpWin()[fnName];
  if(typeof fn !== 'function') throw new Error('Function not found: ' + fnName);
  return fn.apply(erpWin(), args);
}

// Read a global ERP variable
// NOTE: USERS, PRODS, VENTAS, MOVS, RATES, S are in a closure — use erpGetClosure() for those
function erpGet(varName){
  return erpWin()[varName];
}

// Access closure variables via a helper function injected into the ERP window
// These are: USERS, PRODS, VENTAS, MOVS, RATES, S, MONEDAS, CATS_DEF, COM_DEF, TIPO_META
function erpGetClosure(varName){
  // Try direct window first
  var direct = erpWin()[varName];
  if(direct !== undefined) return direct;
  // Try via __erpExposed helper if we injected it
  var exposed = erpWin().__erpExposed;
  if(exposed && exposed[varName] !== undefined) return exposed[varName];
  return undefined;
}

// Inject a helper into the ERP iframe that exposes closure vars via window.__erpExposed
// Call this once after ERP loads
function erpInjectExposer(){
  var w = erpWin();
  if(w.__erpExposed) return; // already injected
  // We can't directly access closure vars, but we can expose them
  // by calling functions that return them or by monkey-patching
  // For now, expose what we can via the globals already available
  w.__erpExposed = {
    // Populated after calling erpSnapshotState()
  };
}

// Simulate POS PIN entry
function erpEnterPin(pin){
  var w = erpWin();
  for(var i = 0; i < pin.length; i++){
    w.pinKey(pin[i]);
  }
}

// Navigate to an ERP sidebar module
function erpNavModule(modId){
  var items = erpDoc().querySelectorAll('.sb-item');
  for(var i = 0; i < items.length; i++){
    if(items[i].getAttribute('onclick') && items[i].getAttribute('onclick').indexOf(modId) >= 0){
      items[i].click(); return true;
    }
  }
  // Fallback: direct
  var mod = erpDoc().getElementById(modId);
  if(mod){
    erpDoc().querySelectorAll('.module').forEach(function(m){ m.classList.remove('act'); });
    mod.classList.add('act');
    return true;
  }
  return false;
}

// ── Assertions ──
function assert(cond, msg){
  if(!cond) throw new Error('ASSERT FAILED: ' + (msg || 'condition was false'));
}

function assertEqual(actual, expected, msg){
  if(actual !== expected){
    throw new Error('ASSERT EQUAL FAILED: ' + (msg || '') +
      ' — expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual));
  }
}

function assertClose(actual, expected, tolerance, msg){
  tolerance = tolerance || 0.01;
  if(Math.abs(actual - expected) > tolerance){
    throw new Error('ASSERT CLOSE FAILED: ' + (msg || '') +
      ' — expected ~' + expected + ', got ' + actual + ' (tol=' + tolerance + ')');
  }
}

function assertGt(a, b, msg){
  if(!(a > b)) throw new Error('ASSERT GT FAILED: ' + (msg||'') + ' — ' + a + ' not > ' + b);
}

function assertIncludes(arr, val, msg){
  if(!arr || arr.indexOf(val) < 0)
    throw new Error('ASSERT INCLUDES FAILED: ' + (msg||'') + ' — ' + JSON.stringify(val) + ' not in array');
}

// ── Logging ──
function log(text, cls){
  var area = document.getElementById('log-area');
  var div = document.createElement('div');
  div.className = 'log-line ' + (cls || '');
  div.textContent = text;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function logInfo(t){ log('ℹ ' + t, 'log-info'); }
function logPass(t){ log('✓ ' + t, 'log-pass'); }
function logFail(t){ log('✗ ' + t, 'log-fail'); }
function logWarn(t){ log('⚠ ' + t, 'log-warn'); }
function logDim(t){ log('  ' + t, 'log-dim'); }
function logSuite(t){ log('━━ ' + t + ' ━━', 'log-suite'); }

// ── Suite registration ──
function suite(name, tests){
  _suites.push({name: name, tests: tests});
}

// ── Sidebar render ──
function renderSidebar(){
  var sb = document.getElementById('sidebar');
  var html = '';
  var idx = 0;
  _suites.forEach(function(s){
    html += '<div class="suite-hdr">' + s.name + '</div>';
    s.tests.forEach(function(t){
      var r = _results[idx] || {};
      var cls = r.status || '';
      var icon = cls === 'pass' ? '✓' : cls === 'fail' ? '✗' : cls === 'running' ? '⏳' : '○';
      var time = r.time ? (r.time/1000).toFixed(1) + 's' : '';
      html += '<div class="test-item ' + cls + '" data-idx="' + idx + '">'
        + '<span class="ti-icon">' + icon + '</span>'
        + '<span>' + t.name + '</span>'
        + '<span class="ti-time">' + time + '</span>'
        + '</div>';
      idx++;
    });
  });
  sb.innerHTML = html;
}

// ── Stats update ──
function updateStats(){
  document.getElementById('st-pass').textContent = '✓ ' + _passCount;
  document.getElementById('st-fail').textContent = '✗ ' + _failCount;
  document.getElementById('st-skip').textContent = '⏭ ' + _skipCount;
  var elapsed = ((Date.now() - _startTime) / 1000).toFixed(1);
  document.getElementById('st-time').textContent = elapsed + 's';
  var total = 0;
  _suites.forEach(function(s){ total += s.tests.length; });
  var done = _passCount + _failCount + _skipCount;
  var pct = total > 0 ? (done / total * 100) : 0;
  document.getElementById('progress-bar').style.width = pct + '%';
}

// ── Run all tests ──
async function runAll(){
  if(_running) return;
  _running = true;
  _stopped = false;
  _passCount = 0; _failCount = 0; _skipCount = 0;
  _results = [];
  _startTime = Date.now();

  clearLog();
  renderSidebar();
  updateStats();

  logInfo('Loading ERP in iframe...');
  try{
    await waitForErp(25000);
    logPass('ERP loaded successfully');
    // Show real global state (USERS/PRODS are in closure, not window.*)
    var cajas = erpGet('_cajasData');
    logDim('Cajas loaded: ' + (cajas ? cajas.length : 0));
    var cats = erpGet('CATS');
    logDim('CATS: ' + (cats ? cats.join(', ') : 'none'));
    var ratesAlm = erpGet('RATES_ALM');
    logDim('RATES_ALM almacenes: ' + (ratesAlm ? Object.keys(ratesAlm).join(', ') : 'none'));
    logDim('toUSD fn: ' + (typeof erpWin().toUSD));
    logDim('goMod fn: ' + (typeof erpWin().goMod));
  } catch(e){
    logFail('Failed to load ERP: ' + e.message);
    _running = false;
    return;
  }

  var idx = 0;
  for(var si = 0; si < _suites.length; si++){
    var s = _suites[si];
    logSuite(s.name);
    for(var ti = 0; ti < s.tests.length; ti++){
      if(_stopped){ _skipCount++; _results[idx] = {status:'skip'}; idx++; continue; }
      var t = s.tests[ti];
      _results[idx] = {status:'running'};
      renderSidebar();
      updateStats();
      var t0 = Date.now();
      try{
        logInfo('Running: ' + t.name);
        await t.fn();
        var elapsed = Date.now() - t0;
        _results[idx] = {status:'pass', time: elapsed};
        _passCount++;
        logPass(t.name + ' (' + (elapsed/1000).toFixed(1) + 's)');
      } catch(err){
        var elapsed2 = Date.now() - t0;
        _results[idx] = {status:'fail', time: elapsed2, error: err.message};
        _failCount++;
        logFail(t.name + ': ' + err.message);
      }
      renderSidebar();
      updateStats();
      idx++;
      await sleep(100);
    }
  }

  log('');
  var total = _passCount + _failCount + _skipCount;
  logInfo('═══ RESULTS: ' + _passCount + '/' + total + ' passed, '
    + _failCount + ' failed, ' + _skipCount + ' skipped ═══');
  if(_failCount === 0 && _passCount > 0) logPass('🎉 ALL TESTS PASSED!');
  else if(_failCount > 0) logFail('⚠ ' + _failCount + ' test(s) failed');

  _running = false;
}

function stopTests(){
  _stopped = true;
  logWarn('Tests stopped by user');
}

function clearLog(){
  document.getElementById('log-area').innerHTML = '';
}

// Init sidebar on load
window.addEventListener('load', function(){
  // Wait for test-suites.js to register suites
  setTimeout(function(){ renderSidebar(); }, 100);
});
