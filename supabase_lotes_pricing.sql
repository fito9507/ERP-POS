-- ═══════════════════════════════════════════════════════════════
-- Migración: Agregar costo, precio_venta y fecha_entrada a stock_almacen
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar columnas nuevas
ALTER TABLE stock_almacen 
  ADD COLUMN IF NOT EXISTS costo NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS precio_venta NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fecha_entrada TIMESTAMPTZ DEFAULT NOW();

-- 2. Migrar datos existentes: copiar precios del producto a sus lotes
UPDATE stock_almacen sa
SET 
  costo = COALESCE(p.precio_ddp, p.precio_cif, 0),
  precio_venta = COALESCE(p.precio_min, p.precio_maj, 0),
  fecha_entrada = COALESCE(sa.created_at, NOW())
FROM productos p
WHERE sa.producto_id = p.id
  AND (sa.costo IS NULL OR sa.costo = 0);

-- 3. Verificar
SELECT sa.producto_id, p.nombre, sa.almacen, sa.lote, sa.cantidad, sa.costo, sa.precio_venta, sa.fecha_entrada
FROM stock_almacen sa
JOIN productos p ON p.id = sa.producto_id
ORDER BY p.nombre, sa.almacen, sa.lote
LIMIT 20;
