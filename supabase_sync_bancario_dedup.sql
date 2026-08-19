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

-- ───────────────────────────────────────────────────────────────
-- 5. Limpieza de las filas de prueba (19-08-2026)
--    El paso 4 sacó dos apuntes con id de Revolut inventado, creados a
--    mano mientras se montaba la integración: 101 USD de "Gasto
--    operativo" en la caja USD REVOLUT que nunca movieron ningún saldo,
--    pero que sí suman en los informes de IG.
--    Revisar que siguen siendo estos dos y borrarlos.
-- ───────────────────────────────────────────────────────────────

SELECT id, fecha, tipo, descripcion, monto, moneda, cuenta, notas
FROM movimientos_ig
WHERE notas IN ('REV_ID:test', 'REV_ID:test2');

DELETE FROM movimientos_ig
WHERE notas IN ('REV_ID:test', 'REV_ID:test2');

-- ───────────────────────────────────────────────────────────────
-- 6. Corrección Wise (19-08-2026): conversiones con signo invertido
--    La primera importación usó la edge function vieja, que registró
--    las conversiones entre saldos propios ("To USD - Moved", tipo
--    INTERBALANCE) como retiros cuando son dinero que ENTRA al saldo
--    USD. Por eso USD WISE daba -1.466,77 (imposible en Wise).
--    Verificado contra la API: saldo real USD 26,55 / EUR 0.
-- ───────────────────────────────────────────────────────────────

-- 6a. Los dos apuntes con signo invertido (170 y 75,92 USD):
UPDATE movimientos_ig SET tipo = 'Ingreso no-venta'
WHERE id IN (233, 238) AND tipo = 'Gasto operativo';

UPDATE mov_cajas
SET tipo = 'deposito', caja_origen = NULL, caja_destino = 'USD WISE'
WHERE id IN (806, 811) AND tipo = 'retiro';

-- 6b. La pata EUR que /activities no muestra: el 25-06 se recibieron
--     150 EUR y se convirtieron a los 170 USD del apunte anterior.
--     El saldo real EUR de Wise es 0, así que esos 150 salieron.
INSERT INTO mov_cajas (fecha, tipo, caja_origen, caja_destino, monto_origen, monto_destino, notas, usuario)
SELECT '2026-06-25', 'retiro', 'EUR WISE', NULL, 150, 150,
       'Conversión EUR→USD 25/06 — pata EUR (corrección sync Wise)', 'Sistema'
WHERE NOT EXISTS (
  SELECT 1 FROM mov_cajas WHERE notas LIKE '%pata EUR (corrección sync Wise)%'
);

INSERT INTO movimientos_ig (fecha, tipo, descripcion, monto, moneda, equiv_usd, cuenta, vendedor, notas)
SELECT '2026-06-25', 'Gasto operativo', 'Conversión EUR→USD 25/06 — pata EUR', 150, 'EUR', 170, 'EUR WISE', 'Sistema',
       'Corrección sync Wise: pata EUR de la conversión'
WHERE NOT EXISTS (
  SELECT 1 FROM movimientos_ig WHERE notas = 'Corrección sync Wise: pata EUR de la conversión'
);

-- 6c. Verificar: EUR WISE debe quedar en 0 y USD WISE en -483,09.
--     El resto hasta los 26,55 reales es saldo anterior a la ventana de
--     actividades que da la API (~509,64 USD previos al 02-05); el botón
--     "Sincronizar Wise" del ERP ahora ofrece crear ese ajuste solo.
SELECT caja, sum(delta) AS saldo_erp FROM (
  SELECT caja_destino AS caja, monto_destino AS delta FROM mov_cajas WHERE caja_destino ILIKE '%wise%'
  UNION ALL
  SELECT caja_origen, -monto_origen FROM mov_cajas WHERE caja_origen ILIKE '%wise%'
) t GROUP BY caja;
