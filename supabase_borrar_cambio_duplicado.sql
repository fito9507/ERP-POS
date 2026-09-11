-- ════════════════════════════════════════════════════════════════════
-- BORRAR EL CAMBIO DUPLICADO del 11/09/2026 (Remesa Daimy)
--
-- "CUP Habana → EUR BBVA · 116.250,00 → 150,00 · tasa 775"
-- se registró 2 veces con 7 MILÉSIMAS de diferencia (09:02:22.988 y .995):
--      mov_cajas: 1022 y 1023  → SE CONSERVA la 1022
-- Marca de operación compartida: [OP:OPmtwq9rkc2nlu]
--
-- Efecto de la copia de más: CUP Habana salía 116.250 CUP de menos y
-- EUR BBVA 150 € de más. Al borrarla, las dos cajas vuelven a cuadrar.
--
-- Copia de seguridad de las filas: BACKUP_cambio_daimy.json
--
-- NOTA: este cambio NO llegó a escribirse en el Libro I/G (sus apuntes se
-- perdieron al fallar la red, porque no se encolaban). Ya está corregido
-- en la app: ahora esas escrituras se encolan y reintentan.
--
-- Ejecutar en Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════

-- ── ANTES: ver las 2 filas ──
select 'ANTES' as paso, id, created_at, caja_origen, caja_destino,
       monto_origen, monto_destino, tasa_usada, notas
from mov_cajas where id in (1022, 1023) order by id;

-- ── Borrar SOLO la copia de más ──
delete from mov_cajas where id = 1023;

-- ── DESPUÉS: debe quedar 1 sola ──
select 'QUEDA Remesa Daimy 11/09' as comprobacion, count(*) as filas
from mov_cajas where notas like '%OPmtwq9rkc2nlu%';
