const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');
const old = "toggleDeudaGroup(\\''+gid+'\\')";
const nw  = "toggleDeudaGroup(this.parentNode.dataset.gid)";
console.log('Found old pattern:', content.includes(old));
content = content.replace(old, nw);
fs.writeFileSync('index.html', content);
console.log('Verify:', content.includes(nw));
