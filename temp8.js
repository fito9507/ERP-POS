
(function(){
  // Init Supabase — deferred so sync script loads first
  if(typeof renderLoginCards==='function') renderLoginCards();
  setTimeout(function(){ if(typeof supaInit==='function') supaInit(); else console.error('supaInit not found'); }, 1200);
  try{var fd=document.getElementById('f-desde');if(fd)fd.value='2025-01-01';var fh=document.getElementById('f-hasta');if(fh)fh.value='2026-12-31';var cd=document.getElementById('c-desde');if(cd)cd.value='2025-01-01';var ch=document.getElementById('c-hasta');if(ch)ch.value='2026-12-31';if(typeof setRangeLiq==='function')setRangeLiq();if(typeof initChkAll==='function')initChkAll();}catch(e){}
  try{var ld=document.getElementById('l-desde');if(ld)ld.value='2025-01-01';var lh=document.getElementById('l-hasta');if(lh)lh.value='2026-12-31';}catch(e){}
  try{if(typeof renderColores==='function')renderColores();if(typeof renderLista==='function')renderLista();}catch(e){}
})();
