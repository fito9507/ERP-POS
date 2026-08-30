-- % de comisión propio por folio (anula las reglas solo para ese folio).
-- Vacío = se aplican las reglas de comisión del vendedor como siempre.
-- Ejecutar en Supabase → SQL Editor. Es seguro repetirlo.

alter table public.folios add column if not exists com_pct numeric;
