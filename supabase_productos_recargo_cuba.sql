-- ═══════════════════════════════════════════════════════════════
-- Migración: Agregar columna recargo_cuba a productos
-- Para permitir establecer un recargo al seleccionar "EN CUBA"
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar columna recargo_cuba (texto, nullable)
ALTER TABLE productos 
  ADD COLUMN IF NOT EXISTS recargo_cuba TEXT DEFAULT NULL;

-- 2. Verificar
SELECT id, nombre, recargo_cuba
FROM productos
ORDER BY created_at DESC
LIMIT 10;
