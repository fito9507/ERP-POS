-- ═══════════════════════════════════════════════════════════════
-- Migración: Agregar cantidad_inicial a stock_almacen
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar columna nueva
ALTER TABLE stock_almacen 
  ADD COLUMN IF NOT EXISTS cantidad_inicial numeric DEFAULT 0;

-- 2. Migrar datos existentes: la cantidad inicial será igual a la cantidad actual
-- (Sólo para los que no tengan cantidad_inicial seteada o sea 0)
UPDATE stock_almacen
SET cantidad_inicial = cantidad
WHERE cantidad_inicial IS NULL OR cantidad_inicial = 0;

-- 3. Verificar
SELECT producto_id, almacen, lote, cantidad_inicial, cantidad
FROM stock_almacen
ORDER BY lote DESC
LIMIT 20;
