
(function(){
  const _pk=pinKey;
  window.pinKey=function(k){
    _pk(k);
    if(typeof S!=='undefined'&&S.user){
      const u=USERS[S.user];
      if(u){
        erpSetUser(S.user,u.color,u.tc);
        // If admin, show all modules
        if(typeof adminInit==='function') adminInit();
      }
    }
  };
})();
