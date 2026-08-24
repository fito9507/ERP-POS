-- ════════════════════════════════════════════════════════════════════
-- COMISIONES: desbloquear escritura + retroactivo de cobros ya hechos
-- Ejecutar en Supabase → SQL Editor → Run  (2026-08-24)
--
-- 1. Las tablas `comisiones` y `liquidaciones` se crearon con RLS activo
--    y SIN políticas, así que la app (clave anónima) NO puede escribir en
--    ellas: por eso `comisiones` estaba vacía y ningún abono generaba
--    comisión. Se desactiva RLS, igual que el resto de tablas del ERP.
-- 2. Se cargan las 16 comisiones de los abonos YA cobrados de clientes
--    de Keiler (2,215.99 USD al 4%), como Pendiente, para que entren en
--    la próxima liquidación.
-- ════════════════════════════════════════════════════════════════════

-- 1. Desbloquear escritura desde la app
alter table comisiones    disable row level security;
alter table liquidaciones disable row level security;

-- 2. Comisiones retroactivas por cobros (4% sobre el equivalente USD)
insert into comisiones
  (id, fecha, vendedor, origen, abono_id, folio_id, cliente, almacen,
   base_usd, pct, com_usd, moneda, monto, caja, estado)
values
  ('com-a2', '2026-06-11', 'Keiler', 'abono', 'a2', 'f-credito-1781180216552', 'Cliente Oriente', 'Habana', 371.25, 4, 14.85, 'CUPT', 300000.0, 'CUPT ACEM', 'Pendiente'),
  ('com-a1', '2026-06-11', 'Keiler', 'abono', 'a1', 'f-credito-1781180216552', 'Cliente Oriente', 'Habana', 402.19, 4, 16.0876, 'CUPT', 325000.0, 'CUPT ACEM', 'Pendiente'),
  ('com-a4', '2026-06-12', 'Keiler', 'abono', 'a4', 'f-credito-1781180216552', 'Cliente Oriente', 'Habana', 30.2899, 4, 1.2116, 'CUPT', 20900.0, 'CUPT ALEXITO', 'Pendiente'),
  ('com-a5', '2026-06-12', 'Keiler', 'abono', 'a5', 'f-credito-1781180216552', 'Cliente Oriente', 'Habana', 34.6763, 4, 1.3871, 'CUPT', 24100.0, 'CUPT ALEXITO', 'Pendiente'),
  ('com-a3', '2026-06-12', 'Keiler', 'abono', 'a3', 'f-credito-1781180216552', 'Cliente Oriente', 'Habana', 109.65, 4, 4.386, 'CUPT', 75000.0, 'CUPT ALEXITO', 'Pendiente'),
  ('com-a8', '2026-06-16', 'Keiler', 'abono', 'a8', '4', 'Chino', 'Habana', 6000.0, 4, 240.0, 'USD', 6000.0, '', 'Pendiente'),
  ('com-a7', '2026-06-16', 'Keiler', 'abono', 'a7', '5', 'Cliente Oriente', 'Habana', 612.0562, 4, 24.4822, 'USD', 612.0562, '', 'Pendiente'),
  ('com-a9', '2026-06-17', 'Keiler', 'abono', 'a9', 'f-credito-1781720336768', 'Yoni Puerto Padre', 'Habana', 450.0, 4, 18.0, 'USD', 450.0, 'ZELLE GLOBAL TRADE', 'Pendiente'),
  ('com-a10', '2026-06-24', 'Keiler', 'abono', 'a10', '5', 'Cliente Oriente', 'Habana', 9940.0, 4, 397.6, 'USD', 9940.0, 'USD Habana', 'Pendiente'),
  ('com-a11', '2026-06-26', 'Keiler', 'abono', 'a11', 'f-credito-1781720336768', 'Yoni Puerto Padre', 'Habana', 176.0, 4, 7.04, 'USD', 176.0, 'ZELLE GLOBAL TRADE', 'Pendiente'),
  ('com-a12', '2026-07-02', 'Keiler', 'abono', 'a12', 'f-credito-1781720336768', 'Yoni Puerto Padre', 'Habana', 2720.0, 4, 108.8, 'USD', 2720.0, 'ZELLE GLOBAL TRADE', 'Pendiente'),
  ('com-a25', '2026-08-17', 'Keiler', 'abono', 'a25', '9', 'Chino', 'Habana', 160.0, 4, 6.4, 'USD', 160.0, 'USD Habana', 'Pendiente'),
  ('com-a27', '2026-08-21', 'Keiler', 'abono', 'a27', '9', 'Chino', 'Habana', 9.41, 4, 0.3764, 'USD', 9.41, 'USD Habana', 'Pendiente'),
  ('com-a28', '2026-08-21', 'Keiler', 'abono', 'a28', '15', 'Chino', 'Habana', 78.14, 4, 3.1256, 'USD', 78.14, 'USD Habana', 'Pendiente'),
  ('com-a29', '2026-08-21', 'Keiler', 'abono', 'a29', '5', 'Cliente Oriente', 'Habana', 24306.1, 4, 972.244, 'USD', 24306.1, 'USD Habana', 'Pendiente'),
  ('com-a31', '2026-08-23', 'Keiler', 'abono', 'a31', '13', 'Cliente Silicona Holguín', 'Habana', 10000.0, 4, 400.0, 'USD', 10000.0, 'USD Habana', 'Pendiente')
on conflict (id) do nothing;

-- Verificación
select vendedor, estado, count(*) as n, round(sum(com_usd), 2) as total_usd
  from comisiones group by vendedor, estado;
