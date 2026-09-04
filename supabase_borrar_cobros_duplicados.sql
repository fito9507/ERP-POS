-- ════════════════════════════════════════════════════════════════════
-- BORRAR COBROS DUPLICADOS del 03/09/2026 (dos incidentes)
--
-- 1) "Cobro cliente — Adolfo — 60% Pedido Ferretería #1" ($76.837)
--    se registró 3 veces en 320 ms (19:01). Copias en:
--      movimientos_ig: 490, 491, 492  → se conserva 490
--      mov_cajas:      984, 985, 986  → se conserva 985
--    USD Placetas estaba inflada +$153.674.
--
-- 2) "Cobro cliente — Yudiel Garcia Rodríguez — Pago" ($556,20)
--    se registró 2 veces en el informe y 4 en la caja (22:05). Copias en:
--      movimientos_ig: 496, 497            → se conserva 496
--      mov_cajas:      990, 991, 992, 993  → se conserva 990
--    USD Habana estaba inflada +$1.668,60.
--
-- Copia de seguridad de las 12 filas: BACKUP_triple_adolfo.json y
-- BACKUP_duplicado_yudiel.json (scratchpad de la sesión de Claude).
--
-- Ejecutar en Supabase → SQL Editor → Run. La verificación final debe
-- decir 1 fila restante por cobro en cada tabla.
-- ════════════════════════════════════════════════════════════════════

-- ── ANTES (para ver lo que hay) ──
select 'ANTES movimientos_ig' as paso, id, created_at, equiv_usd, cuenta, descripcion
from movimientos_ig where id in (490,491,492,496,497)
order by id;

select 'ANTES mov_cajas' as paso, id, created_at, monto_destino, caja_destino, notas
from mov_cajas where id in (984,985,986,990,991,992,993)
order by id;

-- ── BORRADO (solo las copias de más) ──
delete from movimientos_ig where id in (491, 492, 497);
delete from mov_cajas      where id in (984, 986, 991, 992, 993);

-- ── PREVENCIÓN: sello anti-duplicado ─────────────────────────────────
-- Cada operación de dinero llevará un op_id único generado al crearla.
-- Si la cola offline reenvía una copia (respuesta perdida, doble toque),
-- el índice único la RECHAZA y el duplicado se vuelve imposible.
alter table public.mov_cajas      add column if not exists op_id text;
alter table public.movimientos_ig add column if not exists op_id text;
create unique index if not exists mov_cajas_op_id_uq      on public.mov_cajas(op_id)      where op_id is not null;
create unique index if not exists movimientos_ig_op_id_uq on public.movimientos_ig(op_id) where op_id is not null;

-- ── DESPUÉS (verificación: debe quedar 1 y 1 de cada cobro) ──
select 'QUEDA Adolfo en movimientos_ig' as comprobacion, count(*) as filas
from movimientos_ig where descripcion ilike '%Adolfo%60%25 Pedido Ferreter%' or id = 490
union all
select 'QUEDA Adolfo en mov_cajas', count(*)
from mov_cajas where notas ilike '%Adolfo%Ferreter%'
union all
select 'QUEDA Yudiel en movimientos_ig', count(*)
from movimientos_ig where descripcion ilike '%Yudiel%'
union all
select 'QUEDA Yudiel en mov_cajas', count(*)
from mov_cajas where notas ilike '%Yudiel%';
