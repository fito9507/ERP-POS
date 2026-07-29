
// ═══ PERMISOS POR MÓDULO EN ADMIN ═══
// Añadir al formulario de usuario en renderFormUsuario

const MOD_LABELS = {
  pos:      {icon:'🛒', label:'POS'},
  stock:    {icon:'📦', label:'Stock (consulta)'},
  ventas:   {icon:'📊', label:'Ventas'},
  clientes: {icon:'👤', label:'Cuentas clientes'},
  ig:       {icon:'💰', label:'Ingresos / Gastos'},
  backup:   {icon:'💾', label:'Backup / Export'},
  admin:    {icon:'⚙️', label:'Administración'},
};

function buildModulosCheckboxes(selectedMods) {
  var html = '<div style="grid-column:1/-1"><label class="adm-lbl-f" style="margin-bottom:8px;display:block">Módulos habilitados</label>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
  Object.keys(MOD_LABELS).forEach(function(key) {
    var m = MOD_LABELS[key];
    var checked = selectedMods.indexOf(key) >= 0;
    html += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;padding:6px 8px;background:var(--color-background-secondary);border-radius:var(--border-radius-md)">'
      + '<input type="checkbox" class="mod-chk" value="' + key + '"' + (checked?' checked':'') + ' style="width:16px;height:16px;cursor:pointer;accent-color:var(--color-text-info)">'
      + m.icon + ' ' + m.label
      + '</label>';
  });
  html += '</div></div>';
  return html;
}

function getSelectedModulos() {
  var checked = document.querySelectorAll('.mod-chk:checked');
  var mods = [];
  checked.forEach(function(el) { mods.push(el.value); });
  return mods;
}

