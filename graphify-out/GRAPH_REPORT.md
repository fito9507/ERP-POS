# Graph Report - ERP-POS  (2026-08-19)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1772 nodes · 4632 edges · 91 communities (80 shown, 11 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `04f3c4ca`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- all.js
- temp_check.js
- temp9.js
- showToast
- showToast
- test_syntax.js
- test_syntax_catalogo.js
- test_syntax_catalogo2.js
- temp.js
- temp7.js
- offlineSaveClientes
- today
- today
- offlineSaveClientes
- fN
- test-runner.js
- temp5.js
- temp6.js
- temp3.js
- goStep
- fN
- temp20.js
- fromUSD
- temp2.js
- fromUSD
- renderVentas
- renderAdminProductos
- temp24.js
- renderAdminProductos
- goStep
- renderAdminCajas
- test-overlay.js
- renderVentas
- temp22.js
- renderPago
- renderProds
- temp10.js
- getAllCajas
- test_syntax_index.js
- temp1.js
- renderCart
- _getMonedaFromCaja
- savePrestamos
- saveContenedor
- ventaCreditoPOS
- test_eval.js
- renderGestionCajas
- renderGestionCajas
- addNFLCli
- registrarMovStock
- test_full.js
- cierre-diario/index.ts
- renderAdminUsuarios
- test-cierre.ts
- test_render.js
- test_tPago.js
- dependencies
- fix_ig_cols.js
- temp11.js
- temp21.js
- test_jsdom.js
- fix.js
- fix_onclick.js
- test.js
- shareStockWhatsApp

## God Nodes (most connected - your core abstractions)
1. `showToast()` - 83 edges
2. `showToast()` - 82 edges
3. `fN()` - 78 edges
4. `fN()` - 76 edges
5. `supaReq()` - 68 edges
6. `supaReq()` - 68 edges
7. `today()` - 38 edges
8. `today()` - 38 edges
9. `toUSD()` - 31 edges
10. `toUSD()` - 29 edges

## Surprising Connections (you probably didn't know these)
- `_dRecalcReservas()` --indirect_call--> `recalcReservasGlobales()`  [INFERRED]
  all.js → all.js  _Bridges community 10 → community 3_
- `_dRecalcReservas()` --indirect_call--> `recalcReservasGlobales()`  [INFERRED]
  temp_check.js → temp_check.js  _Bridges community 13 → community 4_
- `admAddCat()` --calls--> `showToast()`  [EXTRACTED]
  all.js → all.js  _Bridges community 0 → community 3_
- `renderFichaFolios()` --calls--> `_cntBadge()`  [EXTRACTED]
  all.js → all.js  _Bridges community 0 → community 10_
- `_confirmarReserva()` --calls--> `fN()`  [EXTRACTED]
  all.js → all.js  _Bridges community 0 → community 14_

## Import Cycles
- None detected.

## Communities (91 total, 11 thin omitted)

### Community 0 - "all.js"
Cohesion: 0.03
Nodes (109): addCart(), admAddCat(), admDelCat(), admElimUser(), admGuardarUser(), ADMIN_COLORES, agregarGastoCnt(), buildSidebar() (+101 more)

### Community 1 - "temp_check.js"
Cohesion: 0.02
Nodes (105): addNFLCli(), _adjMcTasa(), admAddCat(), admDelCat(), admElimUser(), admGuardarUser(), ADMIN_COLORES, admRemoveCat() (+97 more)

### Community 2 - "temp9.js"
Cohesion: 0.05
Nodes (66): addComRegla(), _adjMcTasa(), admAddCat(), admChkAllProds(), admCloneProd(), admCrearCaja(), admDelCat(), admDesactivarCaja() (+58 more)

### Community 3 - "showToast"
Cohesion: 0.06
Nodes (76): addComRegla(), admCrearCaja(), admDesactivarCaja(), admDesarchivarCaja(), admEditarCaja(), admElimProd(), admGuardarAjustesAlm(), admGuardarEditCaja() (+68 more)

### Community 4 - "showToast"
Cohesion: 0.06
Nodes (75): addComRegla(), admChkAllProds(), admCloneProd(), admCrearCaja(), admDesactivarCaja(), admDesarchivarCaja(), admDeselProds(), admEditarCaja() (+67 more)

### Community 5 - "test_syntax.js"
Cohesion: 0.07
Nodes (64): addToCart(), addToCartIdx(), cardHTML(), CART, chgQty(), chgQtyIdx(), closeCart(), closeCartOutside() (+56 more)

### Community 6 - "test_syntax_catalogo.js"
Cohesion: 0.07
Nodes (64): addToCart(), addToCartIdx(), cardHTML(), CART, chgQty(), chgQtyIdx(), closeCart(), closeCartOutside() (+56 more)

### Community 7 - "test_syntax_catalogo2.js"
Cohesion: 0.07
Nodes (64): addToCart(), addToCartIdx(), cardHTML(), CART, chgQty(), chgQtyIdx(), closeCart(), closeCartOutside() (+56 more)

### Community 8 - "temp.js"
Cohesion: 0.05
Nodes (25): addComRegla(), admAddCat(), admDelCat(), admGuardarTasas(), agregarGastoCnt(), _buildBackupJSON(), buildReceiptHtml(), delComRegla() (+17 more)

### Community 9 - "temp7.js"
Cohesion: 0.09
Nodes (51): abrirCliente(), addLF(), addNFLCli(), calcEquivCli(), CLIENTES, COLORES, crearCliente(), crearFolioCli() (+43 more)

### Community 10 - "offlineSaveClientes"
Cohesion: 0.10
Nodes (54): abrirCliente(), addLF(), _asignarCntFolio(), crearCliente(), crearFolioCli(), cruzarSaldoFolio(), _dRecalcReservas(), elimA() (+46 more)

### Community 11 - "today"
Cohesion: 0.11
Nodes (52): abrirPagoModal(), _addAuditLog(), admCrearDeuda(), admCrearPrestamo(), admGuardarDeuda(), _autoMarcarCuotas(), _calcCntRentabilidad(), calcCuotas() (+44 more)

### Community 12 - "today"
Cohesion: 0.11
Nodes (52): abrirPagoModal(), _addAuditLog(), admCrearDeuda(), admCrearPrestamo(), admGuardarDeuda(), _autoMarcarCuotas(), calcCuotas(), confirmarPagarLiq() (+44 more)

### Community 13 - "offlineSaveClientes"
Cohesion: 0.11
Nodes (51): abrirCliente(), addLF(), _asignarCntFolio(), crearCliente(), crearFolioCli(), cruzarSaldoFolio(), _dRecalcReservas(), elimA() (+43 more)

### Community 14 - "fN"
Cohesion: 0.07
Nodes (42): abrirEditarPagoModal(), _adjChange(), _adjMcTasa(), admGuardarTasas(), admPreviewTasas(), _calcMcDestino(), _checkCierre(), enviarCierreDiario() (+34 more)

### Community 15 - "test-runner.js"
Cohesion: 0.09
Nodes (34): clearLog(), erpCall(), erpClick(), erpClickById(), erpDoc(), erpEnterPin(), erpFrame(), erpGet() (+26 more)

### Community 16 - "temp5.js"
Cohesion: 0.10
Nodes (33): aplicarComGlobal(), cambiarEstadoSel(), confirmarPagarLiq(), deselAll(), eliminarLiq(), eliminarSel(), eliminarV(), exportVentasCSV() (+25 more)

### Community 17 - "temp6.js"
Cohesion: 0.13
Nodes (31): abrirPagoModal(), admCrearDeuda(), _autoMarcarCuotas(), CUENTAS_BASE, DEUDAS, eliminar(), eliminarPago(), exportCSV() (+23 more)

### Community 18 - "temp3.js"
Cohesion: 0.08
Nodes (20): buildSidebar(), _cntToRow(), erpSetUser(), MOD_DEFS, MONEDAS, PAGES, _prestamoToRow(), PRODS (+12 more)

### Community 19 - "goStep"
Cohesion: 0.09
Nodes (34): addCart(), cancelRes(), changeLoteCart(), chQty(), closeRes(), _cntBadge(), cobrarReserva(), commitQty() (+26 more)

### Community 20 - "fN"
Cohesion: 0.09
Nodes (30): abrirEditarPagoModal(), _adjChange(), admGuardarTasas(), admPreviewTasas(), fetchElToqueAndSave(), fN(), getAllCajas(), _getSaldoCaja() (+22 more)

### Community 21 - "temp20.js"
Cohesion: 0.13
Nodes (24): _addAuditLog(), addCustomCaja(), admAddCaja(), admCrearPrestamo(), admGuardarDeuda(), admRegistrarMovStock(), admRemoveCaja(), applyStockMov() (+16 more)

### Community 22 - "fromUSD"
Cohesion: 0.18
Nodes (25): addPago(), addVuelto(), buildReceiptHtml(), calcEquivCli(), confirmar(), dFor(), fillP(), fillV() (+17 more)

### Community 23 - "temp2.js"
Cohesion: 0.19
Nodes (23): _autoSync(), _checkCierre(), enqueue(), enviarCierreDiario(), flushQueue(), getOrCreateProductoId(), loadQueue(), showSyncStatus() (+15 more)

### Community 24 - "fromUSD"
Cohesion: 0.18
Nodes (25): addPago(), addVuelto(), buildReceiptHtml(), calcEquivCli(), confirmar(), dFor(), fillP(), fillV() (+17 more)

### Community 25 - "renderVentas"
Cohesion: 0.13
Nodes (21): aplicarComGlobal(), cambiarEstadoSel(), deselAll(), eliminarSel(), eliminarV(), exportVentasCSV(), filtrar_ven(), getSelIds() (+13 more)

### Community 26 - "renderAdminProductos"
Cohesion: 0.14
Nodes (19): admChkAllProds(), admDeselProds(), admElimProd(), admFiltrarProds(), admGetSelProds(), admGuardarProd(), admRemoveCat(), admSelProdToggle() (+11 more)

### Community 27 - "temp24.js"
Cohesion: 0.14
Nodes (7): agregarGastoCnt(), editarGastoCnt(), shareStockWhatsApp(), showEditContenedor(), _showFormCnt(), _showFormGasto(), showNuevoContenedor()

### Community 28 - "renderAdminProductos"
Cohesion: 0.15
Nodes (17): admChkAllProds(), admCloneProd(), admDeselProds(), admFiltrarProds(), admGetSelProds(), admGuardarProd(), admRemoveCat(), admSelProdToggle() (+9 more)

### Community 29 - "goStep"
Cohesion: 0.15
Nodes (14): confirmar(), erpLogout(), goPago(), goProductos(), goStep(), initPago(), logout(), nuevaVenta() (+6 more)

### Community 30 - "renderAdminCajas"
Cohesion: 0.15
Nodes (17): admCrearCaja(), admDesactivarCaja(), admDesarchivarCaja(), admEditarCaja(), admGuardarEditCaja(), admRegistrarMovCaja(), _cajasFromLocal(), _getHistorialListHtml() (+9 more)

### Community 31 - "test-overlay.js"
Cohesion: 0.23
Nodes (11): buildUI(), ld(), lf(), li(), log(), lp(), ls(), lw() (+3 more)

### Community 32 - "renderVentas"
Cohesion: 0.16
Nodes (15): aplicarComGlobal(), cambiarEstadoSel(), exportVentasCSV(), filtrar_ven(), getSelIds(), limpiarFiltros(), registrarVenta(), renderEstComCell() (+7 more)

### Community 33 - "temp22.js"
Cohesion: 0.20
Nodes (7): offlineAutoSave(), offlineSaveClientes(), offlineSaveProds(), offlineSaveVentas(), _renderCntCard(), renderContenedores(), showOfflineBanner()

### Community 34 - "renderPago"
Cohesion: 0.37
Nodes (13): addPago(), addVuelto(), fillP(), fillV(), _getCajasForMon(), getCobUSD(), getPendCobro(), getPendVuelto() (+5 more)

### Community 35 - "renderProds"
Cohesion: 0.15
Nodes (15): cancelRes(), closeRes(), _cntBadge(), cobrarReserva(), _confirmarReserva(), getP(), getPorEscala(), openRes() (+7 more)

### Community 36 - "temp10.js"
Cohesion: 0.24
Nodes (5): _buildBackupJSON(), enviarBackupTelegram(), exportBackupSQL(), importJSON(), renderBackup()

### Community 37 - "getAllCajas"
Cohesion: 0.24
Nodes (11): addCustomCaja(), admAddCaja(), admRemoveCaja(), getAllCajas(), getCustomCajas(), registrarPagoCnt(), renderGestionCajas(), saveCustomCajas() (+3 more)

### Community 40 - "renderCart"
Cohesion: 0.31
Nodes (10): addCart(), chQty(), commitQty(), editPriceMon(), _getCartPriceUSD(), renderCart(), renderCartTotalsOnly(), setCartMon() (+2 more)

### Community 41 - "_getMonedaFromCaja"
Cohesion: 0.22
Nodes (10): _adjMcTasa(), _calcMcDestino(), _getCajaNombres(), _getMonedaFromCaja(), _getTasaDefault(), _onMcCajaChange(), _onMcDestManual(), _onMcTipoChange() (+2 more)

### Community 42 - "savePrestamos"
Cohesion: 0.31
Nodes (9): _addAuditLog(), admCrearPrestamo(), admGuardarDeuda(), calcCuotas(), crearPrestamo(), eliminarPrestamo(), pagarCuota(), renderPrestamos() (+1 more)

### Community 43 - "saveContenedor"
Cohesion: 0.22
Nodes (9): eliminarContenedor(), eliminarGastoCnt(), eliminarPagoCnt(), _renderCntCard(), renderContenedores(), saveContenedor(), saveFormContenedor(), saveFormGasto() (+1 more)

### Community 44 - "ventaCreditoPOS"
Cohesion: 0.39
Nodes (8): _dRecalcReservas(), _recalcReservas(), _supaUpsert(), syncPushAllClientes(), syncSaveAbono(), syncSaveCliente(), syncSaveFolio(), ventaCreditoPOS()

### Community 45 - "test_eval.js"
Cohesion: 0.25
Nodes (3): fnBody, fs, html

### Community 46 - "renderGestionCajas"
Cohesion: 0.43
Nodes (7): addCustomCaja(), admAddCaja(), admRemoveCaja(), getCustomCajas(), renderGestionCajas(), renderGestionCajasWrap(), saveCustomCajas()

### Community 47 - "renderGestionCajas"
Cohesion: 0.43
Nodes (7): addCustomCaja(), admAddCaja(), admRemoveCaja(), getCustomCajas(), renderGestionCajas(), renderGestionCajasWrap(), saveCustomCajas()

### Community 48 - "addNFLCli"
Cohesion: 0.40
Nodes (6): addNFLCli(), _getPrecioNF(), _getProdNames(), renderFichaNF(), renderNFLCli(), updNFTotCli()

### Community 49 - "registrarMovStock"
Cohesion: 0.40
Nodes (6): admRegistrarMovStock(), applyStockMov(), registrarMovStock(), renderStock(), renderStockMovimientos(), _saveMovLote()

### Community 50 - "test_full.js"
Cohesion: 0.33
Nodes (5): dom, fs, html, { JSDOM }, path

### Community 52 - "renderAdminUsuarios"
Cohesion: 0.40
Nodes (5): admElimUser(), admGuardarUser(), getSelectedModulos(), renderAdminUsuarios(), renderFormUsuario()

### Community 54 - "test_render.js"
Cohesion: 0.40
Nodes (4): dom, fs, html, jsdom

### Community 56 - "dependencies"
Cohesion: 0.50
Nodes (3): jsdom, dependencies, jsdom

### Community 57 - "fix_ig_cols.js"
Cohesion: 0.50
Nodes (3): chunks, content, fs

### Community 60 - "test_jsdom.js"
Cohesion: 0.50
Nodes (3): dom, input, jsdom

## Knowledge Gaps
- **140 isolated node(s):** `ADMIN_COLORES`, `CLIENTES`, `COLORES`, `CUENTAS_BASE`, `DEUDAS` (+135 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `showToast()` connect `showToast` to `temp_check.js`, `today`, `offlineSaveClientes`, `renderGestionCajas`, `goStep`, `fN`, `renderVentas`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **Why does `supaReq()` connect `showToast` to `temp_check.js`, `today`, `offlineSaveClientes`, `fN`, `renderVentas`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **Why does `shareStockWhatsApp()` connect `shareStockWhatsApp` to `temp.js`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **What connects `ADMIN_COLORES`, `CLIENTES`, `COLORES` to the rest of the system?**
  _140 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `all.js` be split into smaller, more focused modules?**
  _Cohesion score 0.026714370900417412 - nodes in this community are weakly interconnected._
- **Should `temp_check.js` be split into smaller, more focused modules?**
  _Cohesion score 0.024888888888888887 - nodes in this community are weakly interconnected._
- **Should `temp9.js` be split into smaller, more focused modules?**
  _Cohesion score 0.052289815447710185 - nodes in this community are weakly interconnected._