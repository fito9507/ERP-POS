// Robot de pruebas del ERP-POS.
// Abre la app en un navegador real (Chromium) contra los datos reales
// de Supabase en modo SOLO LECTURA: el guardián (tests/guardian.js)
// intercepta toda escritura y la registra sin enviarla.
//   npx playwright test            -> todas las pruebas
//   npx playwright test humo       -> solo la de humo
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 180000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8787',
    headless: true,
    viewport: { width: 1280, height: 900 },
    locale: 'es-ES',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node tests/servidor.js',
    url: 'http://127.0.0.1:8787/index.html',
    reuseExistingServer: true,
    timeout: 20000,
  },
});
