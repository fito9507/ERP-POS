
function renderEstComCell(v) {
  var isAdm = typeof S!=="undefined" && S.user && USERS[S.user] && USERS[S.user].rol==="admin";
  var col = v.estCom==="Pagada" ? "var(--color-text-success)" : v.estCom==="No aplica" ? "var(--color-text-tertiary)" : "var(--color-text-warning)";
  if (isAdm) {
    return '<select class="est-sel" onchange="setEstCom('+v.id+',this.value)" style="color:'+col+'">'
      + '<option'+(v.estCom==="Pendiente"?' selected':'')+'>Pendiente</option>'
      + '<option'+(v.estCom==="Pagada"?' selected':'')+'>Pagada</option>'
      + '<option'+(v.estCom==="No aplica"?' selected':'')+'>No aplica</option>'
      + '</select>';
  }
  return '<span style="font-size:11px;font-weight:500;color:'+col+'">'+v.estCom+'</span>';
}
