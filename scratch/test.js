const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
try {
  // Extract all scripts
  const scripts = html.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi);
  for(let i=0; i<scripts.length; i++) {
    const code = scripts[i].replace(/<script[\s\S]*?>/, '').replace(/<\/script>/, '');
    try {
      new Function(code);
      console.log("Script", i, "syntax OK");
    } catch(e) {
      console.log("Script", i, "Syntax Error:", e.message);
      // Let's print the line with the error
      const lines = code.split('\n');
      console.log(lines.slice(Math.max(0, 8360-15), 8360+15).join('\n'));
    }
  }
} catch(e) {
  console.log(e);
}
