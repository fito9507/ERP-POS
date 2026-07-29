const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('index.html', 'utf8');

const dom = new JSDOM(html, { runScripts: "dangerously" });

setTimeout(() => {
    try {
        const window = dom.window;
        const document = window.document;
        
        window.PRODS = [{
            n: 'Test Product',
            cat: 'Test',
            stk: 10,
            precio_mercado: 100,
            nombre_puerto: 'Mariel'
        }];
        
        if (!document.getElementById('admin-content')) {
            const adminContent = document.createElement('div');
            adminContent.id = 'admin-content';
            document.body.appendChild(adminContent);
        }

        window.eval(`
            editingProd = 0;
            try {
                renderFormProducto();
                const outHtml = document.getElementById('admin-content').innerHTML;
                console.log("RENDER SUCCESS. HTML length:", outHtml.length);
                require('fs').writeFileSync('test_output.html', outHtml);
            } catch(e) {
                console.error("RENDER CRASH:", e.stack);
            }
        `);
        
    } catch (e) {
        console.error("SETUP CRASH:", e);
    }
}, 1000);
