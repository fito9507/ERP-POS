-- ════════════════════════════════════════════════════════════════════
-- RESTAURACIÓN: KIT M8x40, M8x60 y M6x50 (Habana, lote # 13 Mixto 20'DV)
-- Ejecutar en Supabase → SQL Editor → Run  (2026-08-20)
--
-- Cuadre contra el inventario de Telegram de esta mañana:
--   M8x40: 88.930 y SIN ventas          → debe ser 88.930 (está 88.731)
--   M8x60: 90.800 − 200 (folio 15)      → debe ser 90.600 (está 90.401)
--   M6x50: 113.636 y SIN ventas         → debe ser 113.636 (está 113.635)
-- Los dos −199 se produjeron hoy 18:50–18:51 editando la línea 4 del
-- folio 15 (cambios de producto/cantidad cuyos ajustes de stock se
-- ejecutaron en paralelo y se pisaron). El folio quedó correcto en BD
-- (200× M8x60); solo el stock quedó descontado de más.
-- ════════════════════════════════════════════════════════════════════

UPDATE stock_almacen SET cantidad = 88930
WHERE producto_id = 950 AND almacen = 'Habana' AND lote = '# 13 Mixto 20''DV';

UPDATE stock_almacen SET cantidad = 90600
WHERE producto_id = 951 AND almacen = 'Habana' AND lote = '# 13 Mixto 20''DV';

UPDATE stock_almacen SET cantidad = 113636
WHERE producto_id = 949 AND almacen = 'Habana' AND lote = '# 13 Mixto 20''DV';

-- Rastro en auditoría:
INSERT INTO stock_movimientos (id, fecha, tipo, producto, almacen, cantidad, motivo, usuario, contenedor)
VALUES
  ('smov-fix-race-950', '2026-08-20', 'ajuste_alta', 'KIT TORNILLO&TUERCA M8x40', 'Habana', 199,
   'Restauración: ajustes en paralelo se pisaron editando folio 15 (sin venta que lo respalde)', 'Sistema', '# 13 Mixto 20''DV'),
  ('smov-fix-race-951', '2026-08-20', 'ajuste_alta', 'KIT TORNILLO&TUERCA M8x60', 'Habana', 199,
   'Restauración: ajustes en paralelo se pisaron editando folio 15 (venta real: 200 uds)', 'Sistema', '# 13 Mixto 20''DV'),
  ('smov-fix-race-949', '2026-08-20', 'ajuste_alta', 'KIT TORNILLO&TUERCA M6x50', 'Habana', 1,
   'Restauración: edición suelta del 20/08 17:04 sin venta que la respalde', 'Sistema', '# 13 Mixto 20''DV');

-- Verificación:
SELECT producto_id, lote, cantidad FROM stock_almacen
WHERE producto_id IN (949, 950, 951) AND almacen = 'Habana' AND cantidad <> 0
ORDER BY producto_id;
