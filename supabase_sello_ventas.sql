-- ════════════════════════════════════════════════════════════════════
-- SELLO ANTI-DUPLICADO EN VENTAS + borrar la venta triplicada del 09/09
--
-- 1) La venta [HAB09-006][13:36] (4500× KIT M6x50, $255,32) entró 3 veces
--    (ids 691, 692, 693: reenvíos de la cola a +18s y +2h).
--    SE CONSERVA la 691 (la primera) y se borran 692 y 693.
--    Copia de seguridad de las 3 filas: BACKUP_venta_triple_HAB09006.json.
--
-- 2) Sello op_id en ventas: cada venta lleva un sello único generado al
--    crearla; si cualquier cola la reenvía, la base rechaza la copia.
--    (Es la misma vacuna que ya llevan mov_cajas y movimientos_ig.)
--
-- Ejecutar en Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════

-- ── ANTES: ver las 3 filas ──
select 'ANTES' as paso, id, created_at, total_usd, notas
from ventas where id in (691, 692, 693) order by id;

-- ── Borrar SOLO las 2 copias de más ──
delete from ventas where id in (692, 693);

-- ── Sello anti-duplicado ──
alter table public.ventas add column if not exists op_id text;
create unique index if not exists ventas_op_id_uq on public.ventas(op_id) where op_id is not null;

-- ── DESPUÉS: debe quedar 1 fila del ticket y existir el sello ──
select 'QUEDA HAB09-006' as comprobacion, count(*)::text as resultado
from ventas where notas like '%HAB09-006%'
union all
select 'sello op_id en ventas',
       exists(select 1 from information_schema.columns
              where table_name='ventas' and column_name='op_id')::text;
