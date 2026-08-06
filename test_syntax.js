const fs = require('fs');
const html = fs.readFileSync('catalogo.html', 'utf8');

// Just parse the file to see if there's any obvious JS syntax error when executing it in Node (mocking the DOM)
// We'll extract encargoCardHTML
const match = html.match(/function encargoCardHTML.*?return rows;\s*\}/s);
if (match) {
  console.log("Found encargoCardHTML! (Wait, the regex didn't match the whole thing, but let's just see)");
}

const scriptMatch = html.match(/<script>(.*?)<\/script>/s);
if (scriptMatch) {
  try {
    // evaluate the script block
    new Function(scriptMatch[1]);
    console.log("catalogo.html script parses OK");
  } catch(e) {
    console.error("Syntax Error in catalogo.html script:", e);
  }
}
