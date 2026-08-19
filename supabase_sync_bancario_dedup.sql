-- ═══════════════════════════════════════════════════════════════
-- Migración: red de seguridad contra el doble apunte del sync bancario
-- Ejecutar en Supabase SQL Editor, paso por paso
-- ═══════════════════════════════════════════════════════════════
--
-- Cada transacción importada de Revolut o Wise deja un marcador
-- "REV_ID:xxx" / "WISE_ID:xxx" en las notas, tanto en movimientos_ig
-- como en mov_cajas. El cliente ya deduplica contra la base de datos,
-- pero eso es una comprobación, no una garantía: dos pestañas abiertas
-- o dos clics seguidos pueden colarse entre la lectura y la escritura.
--
-- Estos índices únicos son la garantía. Si algo intenta meter dos veces
-- la misma transacción, Postgres la rechaza y el saldo no se infla.

-- ───────────────────────────────────────────────────────────────
-- 1. ANTES DE NADA: ¿hay ya duplicados?
--    Los índices no se crean si existen. Si estas consultas devuelven
--    filas, hay que borrar las sobrantes a mano (dejando una de cada)
--    y revisar el saldo de las cajas afectadas.
-- ───────────────────────────────────────────────────────────────

SELECT substring(notas from '(?:REV_ID|WISE_ID):[A-Za-z0-9_-]+') AS marcador,
       count(*)        AS veces,
       array_agg(id)   AS ids
FROM movimientos_ig
WHERE notas ~ '(REV_ID|WISE_ID):'
GROUP BY 1
HAVING count(*) > 1;

SELECT substring(notas from '(?:REV_ID|WISE_ID):[A-Za-z0-9_-]+') AS marcador,
       count(*)        AS veces,
       array_agg(id)   AS ids,
       sum(monto_destino) AS total_depositado
FROM mov_cajas
WHERE notas ~ '(REV_ID|WISE_ID):'
GROUP BY 1
HAVING count(*) > 1;

-- ───────────────────────────────────────────────────────────────
-- 2. Los índices únicos (solo cuando el paso 1 no devuelva nada)
-- ───────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS movimientos_ig_banco_marcador_uidx
  ON movimientos_ig ((substring(notas from '(?:REV_ID|WISE_ID):[A-Za-z0-9_-]+')))
  WHERE notas ~ '(REV_ID|WISE_ID):';

CREATE UNIQUE INDEX IF NOT EXISTS mov_cajas_banco_marcador_uidx
  ON mov_cajas ((substring(notas from '(?:REV_ID|WISE_ID):[A-Za-z0-9_-]+')))
  WHERE notas ~ '(REV_ID|WISE_ID):';

-- ───────────────────────────────────────────────────────────────
-- 3. Verificar que quedaron creados
-- ───────────────────────────────────────────────────────────────

SELECT tablename, indexname
FROM pg_indexes
WHERE indexname IN ('movimientos_ig_banco_marcador_uidx', 'mov_cajas_banco_marcador_uidx');

-- ───────────────────────────────────────────────────────────────
-- 4. Auditoría útil: marcadores huérfanos.
--    Un apunte en movimientos_ig cuyo marcador no aparece en mov_cajas
--    significa que la transacción se dio por importada pero el saldo de
--    la caja no se movió. El ERP intenta deshacer eso solo; si algo se
--    escapó, aparece aquí.
-- ───────────────────────────────────────────────────────────────

SELECT m.id, m.fecha, m.cuenta, m.moneda, m.monto, m.notas
FROM movimientos_ig m
WHERE m.notas ~ '(REV_ID|WISE_ID):'
  AND NOT EXISTS (
    SELECT 1 FROM mov_cajas c
    WHERE c.notas LIKE '%' || substring(m.notas from '(?:REV_ID|WISE_ID):[A-Za-z0-9_-]+') || '%'
  )
ORDER BY m.fecha DESC;
