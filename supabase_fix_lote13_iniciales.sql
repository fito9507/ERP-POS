-- ════════════════════════════════════════════════════════════════════
-- CORRECCIÓN: cantidades iniciales del lote "# 13 Mixto 20'DV"
-- Ejecutar en Supabase → SQL Editor → Run   (24/08/2026)
--
-- El campo cantidad_inicial de tres roscas es MENOR que la entrada que
-- quedó registrada en stock_movimientos el 29/06. Por eso la tabla de
-- "Rentabilidad por contenedor" mostraba más vendido que recibido:
--
--   ROSCA M6.3X25 (1")   entrada 135.593  ·  inicial guardado 123.195  (-12.398)
--   ROSCA M6.3X38 (1.5") entrada 106.666  ·  inicial guardado  89.770  (-16.896)
--   ROSCA M6.3X50 (2")   entrada  81.362  ·  inicial guardado  77.150  ( -4.212)
--
-- Y las diferencias coinciden EXACTAMENTE con las unidades que parecían
-- vendidas "de más", así que la entrada del log es la cifra buena.
-- Esto NO toca el stock actual: solo la referencia de cuánto trajo el
-- contenedor, que es lo que usan los porcentajes de la analítica.
-- ════════════════════════════════════════════════════════════════════

UPDATE stock_almacen SET cantidad_inicial = 135593
 WHERE producto_id = 955 AND almacen = 'Habana' AND lote = '# 13 Mixto 20''DV';  -- ROSCA CHAPA M6.3X25 (1")

UPDATE stock_almacen SET cantidad_inicial = 106666
 WHERE producto_id = 956 AND almacen = 'Habana' AND lote = '# 13 Mixto 20''DV';  -- ROSCA CHAPA M6.3X38 (1.5")

UPDATE stock_almacen SET cantidad_inicial = 81362
 WHERE producto_id = 957 AND almacen = 'Habana' AND lote = '# 13 Mixto 20''DV';  -- ROSCA CHAPA M6.3X50 (2")

-- Verificación
SELECT producto_id, lote, cantidad, cantidad_inicial
  FROM stock_almacen
 WHERE producto_id IN (955, 956, 957) AND almacen = 'Habana'
 ORDER BY producto_id, lote;
