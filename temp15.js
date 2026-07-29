
(function(){
  var _o = window.erpSetUser;
  window.erpSetUser = function(n,bg,tc){
    if(_o)_o(n,bg,tc);
    var isAdm = typeof USERS!=="undefined"&&USERS[n]&&USERS[n].rol==="admin";
    setTimeout(function(){
      var form=document.getElementById("liq-create-form");
      if(form)form.style.display=isAdm?"":"none";
      document.querySelectorAll('[onclick*="liquidarGrupo"],[onclick*="liquidarTodo"],[onclick*="guardarLiq"]')
        .forEach(function(el){el.style.display=isAdm?"":"none";});
    },200);
  };
})();
