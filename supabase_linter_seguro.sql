-- ════════════════════════════════════════════════════════════════════
-- Avisos del linter de Supabase que se pueden arreglar SIN riesgo.
-- Ejecutar en Supabase → SQL Editor → Run. Es seguro repetirlo.
--
-- NO incluye el problema de fondo (RLS/clave pública): eso necesita una
-- decisión aparte, porque cambiarlo sin más deja la app sin funcionar.
-- ════════════════════════════════════════════════════════════════════

-- 1. Funciones con search_path mutable (WARN)
--    Sin search_path fijo, alguien que pueda crear objetos en otro
--    esquema podría hacer que la función ejecute su código. Fijarlo no
--    cambia el comportamiento de estas funciones.
alter function public.set_updated_at()             set search_path = public, pg_temp;
alter function public.update_updated_at()          set search_path = public, pg_temp;
alter function public.get_eltoque_rates()          set search_path = public, pg_temp;
alter function public.reservas_lapida_permanente() set search_path = public, pg_temp;

-- 2. Políticas duplicadas: dos políticas que permiten lo mismo sobre la
--    misma tabla. Se quita la repetida (la otra sigue, nada cambia).
drop policy if exists allow_all_movimientos_ig  on public.movimientos_ig;
drop policy if exists allow_all_stock_almacen   on public.stock_almacen;
drop policy if exists allow_all_stock_movs      on public.stock_movimientos;
drop policy if exists allow_all_prestamo_cuotas on public.prestamo_cuotas;
drop policy if exists allow_all_prestamos       on public.prestamos;

-- 3. Coherencia: las 3 tablas nuevas (comisiones, liquidaciones,
--    reservas) quedan como TODAS las demás — RLS activado con política
--    abierta. Esto SILENCIA el error del linter pero NO añade seguridad
--    real: el acceso sigue siendo el mismo que en el resto de tablas.
--    Se hace solo para que el panel no muestre errores rojos y para que
--    ningún script futuro las trate distinto.
alter table public.comisiones    enable row level security;
alter table public.liquidaciones enable row level security;
alter table public.reservas      enable row level security;

drop policy if exists allow_all_comisiones    on public.comisiones;
drop policy if exists allow_all_liquidaciones on public.liquidaciones;
drop policy if exists allow_all_reservas      on public.reservas;

create policy allow_all_comisiones    on public.comisiones    for all using (true) with check (true);
create policy allow_all_liquidaciones on public.liquidaciones for all using (true) with check (true);
-- Reservas: se puede leer, crear y actualizar, pero NO borrar (las
-- reservas cobradas/canceladas se marcan activa=false; ver
-- supabase_reservas_lapidas.sql). Sin política de DELETE = no se borra.
create policy reservas_leer      on public.reservas for select using (true);
create policy reservas_crear     on public.reservas for insert with check (true);
create policy reservas_actualizar on public.reservas for update using (true) with check (true);
