
// Patch setEstCom to also sync to Supabase
(function(){
  var _orig = window.setEstCom;
  if (typeof _orig !== "function") return;
  window.setEstCom = function(id, est) {
    _orig(id, est);
    var v = VENTAS.find(function(x){ return x.id === id; });
    if (v && v.supaId && typeof supaReq !== "undefined" && _supaOnline) {
      supaReq("PATCH", "ventas?id=eq." + v.supaId, { est_com: est })
        .catch(function(e){ console.warn("setEstCom sync:", e); });
    }
  };
})();
