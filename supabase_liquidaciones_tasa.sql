-- Tasa CUP/USD y ajuste/redondeo de cada liquidación (para el PDF y el
-- historial). Ejecutar en Supabase → SQL Editor. Es seguro repetirlo.

alter table public.liquidaciones add column if not exists tasa numeric;
alter table public.liquidaciones add column if not exists ajuste numeric;
