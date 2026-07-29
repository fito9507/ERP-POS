
// Hide liquidation controls for non-admin after login
(function(){
  var _origSetUser = window.erpSetUser;
  window.erpSetUser = function(name, bg, tc) {
    _origSetUser && _origSetUser(name, bg, tc);
    var isAdm = typeof USERS!=='undefined' && USERS[name] && USERS[name].rol==='admin';
    // Show unified Liquidaciones & Comisiones tab
    setTimeout(function(){
      var btn = document.getElementById('btn-liq-nav');
      if (btn) {
        btn.style.display = '';
        btn.innerHTML = isAdm ? 'Liquidaciones / Comisiones' : '🏆 Mis Comisiones';
      }
      // Hide liquidar buttons inside comisiones page
      document.querySelectorAll('.btn-liq,.liq-btn,[onclick*="liquidar"]').forEach(function(el){
        el.style.display = isAdm ? '' : 'none';
      });
    }, 100);
  };
})();
