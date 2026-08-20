-- ════════════════════════════════════════════════════════════════════
-- CORRECCIÓN: stock duplicado en Habana (contenedor # 13 Mixto 20'DV)
-- Ejecutar en Supabase → SQL Editor → Run  (2026-08-20)
--
-- Qué pasó: al migrar el inventario al sistema de lotes, la fila vieja
-- "SIN LOTE" de estos 2 productos NUNCA se puso a cero, así que el mismo
-- stock físico está contado DOS veces (la app suma todas las filas):
--
--   KIT TORNILLO&TUERCA M6x30 (id 828):
--     SIN LOTE = 266.466  (libro viejo: 266.666 iniciales − 200 del folio 9)
--     Lote #13 = 266.240  (libro vivo:  266.466 − 226 del folio 15)  ← REAL
--     → la app muestra ~532.706 uds (¡266k fantasma!)
--
--   KIT TORNILLO&TUERCA M6x50 (id 949):
--     SIN LOTE = 113.636  ·  Lote #13 = 113.635  ← REAL
--     → la app muestra ~227.271 uds
--
-- La fila del lote es la buena (es la que descuentan las ventas).
-- Se pone a 0 la fila legacy SIN LOTE. No se toca nada más.
-- ════════════════════════════════════════════════════════════════════

UPDATE stock_almacen SET cantidad = 0
WHERE producto_id = 828 AND almacen = 'Habana' AND lote = 'SIN LOTE';

UPDATE stock_almacen SET cantidad = 0
WHERE producto_id = 949 AND almacen = 'Habana' AND lote = 'SIN LOTE';

-- Rastro en auditoría (opcional pero recomendado):
INSERT INTO stock_movimientos (id, fecha, tipo, producto, almacen, cantidad, motivo, usuario, contenedor)
VALUES
  ('smov-fix-dup-828', '2026-08-20', 'ajuste_baja', 'KIT TORNILLO&TUERCA M6x30', 'Habana', -266466,
   'Corrección doble conteo: fila legacy SIN LOTE no se anuló al migrar al lote # 13', 'Sistema', 'SIN LOTE'),
  ('smov-fix-dup-949', '2026-08-20', 'ajuste_baja', 'KIT TORNILLO&TUERCA M6x50', 'Habana', -113636,
   'Corrección doble conteo: fila legacy SIN LOTE no se anuló al migrar al lote # 13', 'Sistema', 'SIN LOTE');

-- Verificación (debe devolver solo las filas del lote #13 con cantidad > 0):
SELECT producto_id, almacen, lote, cantidad
FROM stock_almacen
WHERE producto_id IN (828, 949)
ORDER BY producto_id, lote;
