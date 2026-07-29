const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

const strToReplace = `  // Include supaId if we already have it (for upsert)
  if(v.supaId) row.id = v.supaId;

  if (_supaOnline) {
    try {
      var path = v.supaId ? 'ventas?id=eq.'+v.supaId : 'ventas';
      var method = v.supaId ? 'PATCH' : 'POST';
      var r = await supaReq(method, path, row);
      if (r.ok) {
        if(!v.supaId){
          var data = await r.json();
          if (data && data[0] && data[0].id){
            v.supaId = data[0].id;
            // Save back to local with supaId
            offlineSaveVentas();
          }
        }`;
        
const newStr = `  var path = v.supaId ? 'ventas?id=eq.'+v.supaId : 'ventas';
  var method = v.supaId ? 'PATCH' : 'POST';

  // Solo incluir row.id si NO es PATCH
  if(v.supaId && method !== 'PATCH') row.id = v.supaId;

  if (_supaOnline) {
    try {
      var r = await supaReq(method, path, row);
      if (r.ok) {
        if(!v.supaId){
          var data = await r.json();
          if (data && data[0] && data[0].id){
            v.supaId = data[0].id;
            offlineSaveVentas();
          }
        }`;

if (code.includes(strToReplace)) {
  code = code.replace(strToReplace, newStr);
  code = code.replace("enqueue({ method: 'POST', path: 'ventas', body: row });", "enqueue({ method: method, path: path, body: row });");
  code = code.replace("enqueue({ method: 'POST', path: 'ventas', body: row });", "enqueue({ method: method, path: path, body: row });");
  code = code.replace("enqueue({ method: 'POST', path: 'ventas', body: row });", "enqueue({ method: method, path: path, body: row });");
  fs.writeFileSync('index.html', code, 'utf8');
  console.log('Fixed successfully.');
} else {
  console.log('Not found.');
}
