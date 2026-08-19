# Integración ABANCA Open Banking (PSD2)

Sincroniza saldos y movimientos de las cuentas Abanca (a la vista **y de
crédito**, códigos C000/R000 del portal) con las cajas del ERP, igual que
Revolut y Wise. Solo lectura: no inicia pagos.

Portal: <https://openbanking.abanca.com/developer>

## Configuración (una sola vez)

### 1. Crear la APP en el portal

Panel de control → **Nueva APP**:

- **Nombre**: `ERP Xportprise` (o el que quieras)
- **Descripción**: `Sincronización de movimientos con el ERP`
- **URLs redirección login** (el campo rojo):

      https://gpkslaqfqfdeoleiayng.supabase.co/functions/v1/abanca-callback

- En el paso 2 (**Seleccionar APIs**) marcar las de **consulta de cuentas**
  (accounts / balance / transactions). Las de pagos no hacen falta.

Al terminar, el portal da un **client_id** y un **client_secret**.

### 2. Guardar los secrets en Supabase

Dashboard → Edge Functions → Secrets:

| Secret | Valor |
|---|---|
| `ABANCA_CLIENT_ID` | el de la APP |
| `ABANCA_CLIENT_SECRET` | el de la APP |
| `ABANCA_BASE_URL` | normalmente no hace falta: el default `https://api.abanca.com` está **verificado** (los endpoints responden 401 sin credenciales) |
| `ABANCA_TOKEN_URL` | normalmente no hace falta: `https://api.abanca.com/oauth2/token` verificado |

### 3. Autorizar el acceso (SCA)

Abrir en el navegador:

    https://gpkslaqfqfdeoleiayng.supabase.co/functions/v1/abanca-callback

y pulsar «Entrar en Abanca →»: lleva al login oficial
(`accounts.abanca.com`, verificado, scopes Accounts+Transactions). Al
terminar, Abanca redirige de vuelta al callback, que canjea el código
(`POST /oauth2/token` con `grant_type=authorization_code&APLICACION=...`
y cabecera `AuthKey`) y **muestra el refresh_token en pantalla**.
Copiarlo en Secrets como `ABANCA_REFRESH_TOKEN`.

Rutas de la API (de la Documentación oficial): producción
`https://api.abanca.com/v2/psd2` · sandbox `.../sandbox/v2/psd2`
(secret `ABANCA_INSTANCE=Sandbox` para probar; usuarios de prueba 1/12345,
2/abcde, 3/67890). Las cuentas de EMPRESA vienen como `contracts` en el
ticket y el sync las recorre solo con la cabecera `x-clienteContratoId`.

> PSD2 obliga a renovar el consentimiento cada ~90 días: cuando el sync
> empiece a fallar con error de token, repetir solo este paso 3.

### 4. Mapear las cuentas a las cajas del ERP

Hay varias cajas EUR de Abanca (ABANCA, ABANCA YANO, CRÉDITO ABANCA), así
que cada cuenta del banco se asigna a su caja por IBAN:

- En el ERP: **clic derecho** sobre el botón «🏦 Sincronizar Abanca»
  (o `abancaMapear()` en la consola).
- Va preguntando, cuenta por cuenta (muestra IBAN, alias y saldo real),
  el nombre EXACTO de la caja del ERP. Vacío = ignorar esa cuenta.
- El mapeo queda en el navegador (`localStorage.erp_abanca_map`).

### 5. Listo

- **Clic** en «🏦 Sincronizar Abanca» importa los movimientos de los
  últimos 30 días (deduplicados por `ABANCA_ID:` como Revolut/Wise) y
  compara el saldo de cada caja mapeada con el real, ofreciendo el ajuste.
- Con el mapeo configurado, entra también en el **auto-sync** al abrir la
  app (tras Revolut y Wise).

## Piezas

| Pieza | Dónde |
|---|---|
| Edge function de sync | `supabase/functions/abanca-sync/index.ts` |
| Callback OAuth (una vez) | `supabase/functions/abanca-callback/index.ts` (desplegada con `--no-verify-jwt`) |
| Cliente | `syncAbancaApi`, `_abancaCajaPara`, `_abancaCompararSaldos`, `abancaMapear` en `index.html` |
