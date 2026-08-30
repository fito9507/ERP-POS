-- Tasa CUP/USD usada en cada liquidación (para el PDF y el historial).
-- Ejecutar en Supabase → SQL Editor. Es seguro repetirlo.

alter table public.liquidaciones add column if not exists tasa numeric;
