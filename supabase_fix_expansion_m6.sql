-- ════════════════════════════════════════════════════════════════════
-- AJUSTE: EXPANSIÓN MECÁNICA M6 (Ø8) x 50 mm CON ANILLA (id 1025)
-- Habana · lote "# 13 Mixto 20'DV"        Ejecutar en Supabase → SQL Editor
--
-- Auditoría (24/08/2026):
--   Entró del contenedor #13 ............ 300.000
--   Vendido (todas las ventas del libro)  269.111
--   Stock que debería haber .............  30.889
--   Stock en la BD ......................  17.090
--   FALTAN .............................. 13.799  ← se devuelven aquí
--
-- Causa probable: las devoluciones al stock fallaban en silencio (las
-- escrituras llevaban columnas inexistentes y daban 400) mientras los
-- descuentos sí entraban. Corregido en el código el 23/08.
--
-- La suma es RELATIVA (cantidad + 13799) a propósito: si se registran
-- ventas entre que se lee esto y se ejecuta, el resultado sigue siendo
-- correcto. No sustituir por un valor fijo.
-- ════════════════════════════════════════════════════════════════════

UPDATE stock_almacen
   SET cantidad = cantidad + 13799
 WHERE producto_id = 1025
   AND almacen = 'Habana'
   AND lote = '# 13 Mixto 20''DV';

-- Rastro en auditoría
INSERT INTO stock_movimientos (id, fecha, tipo, producto, almacen, cantidad, motivo, usuario, contenedor)
VALUES ('smov-fix-m6anilla-20260824', '2026-08-24', 'ajuste_alta',
        'EXPANSIÓN MECÁNICA M6 (Ø8) x 50 mm GALVANIZADA CON ANILLA', 'Habana', 13799,
        'Reposición: devoluciones al stock perdidas por el fallo de escritura (400) anterior al 23/08',
        'Sistema', '# 13 Mixto 20''DV');

-- Verificación (cantidad debe ser 30.889 si no hubo ventas entre medias)
SELECT producto_id, lote, cantidad, cantidad_inicial
  FROM stock_almacen
 WHERE producto_id = 1025 AND almacen = 'Habana';
