-- La tabla ventas tenía una restricción que rechazaba el estado de
-- comisión 'Liquidada (Pdte)' (el que usa la app cuando una venta entra
-- en una liquidación pendiente de pago). Resultado: las ventas nunca
-- quedaban marcadas en la nube y volvían a aparecer como pendientes.
-- Ejecutar en Supabase → SQL Editor. Es seguro repetirlo.

alter table public.ventas drop constraint if exists ventas_est_com_check;
alter table public.ventas add constraint ventas_est_com_check
  check (est_com is null or est_com in ('Pendiente', 'Liquidada (Pdte)', 'Pagada', 'No aplica'));
