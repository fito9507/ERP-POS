-- ═══════════════════════════════════════════════════════════════
-- Migración: Agregar columna contenedor a folios
-- Para vincular folios de clientes con contenedores/lotes
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar columna contenedor (texto, nullable)
ALTER TABLE folios 
  ADD COLUMN IF NOT EXISTS contenedor TEXT DEFAULT NULL;

-- 2. Verificar
SELECT id, cliente_id, almacen, descripcion, contenedor
FROM folios
ORDER BY fecha DESC
LIMIT 10;
