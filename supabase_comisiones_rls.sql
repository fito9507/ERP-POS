-- Comisiones y liquidaciones: quitar RLS (la app usa la clave pública) y
-- añadir las columnas nuevas de liquidaciones. NO borra nada.
-- Ejecutar en Supabase → SQL Editor. Es seguro repetirlo.
--
-- Si alguna vez las comisiones "desaparecen" (la pestaña sale vacía y la
-- app avisa de que no puede guardar), casi seguro es que RLS se activó:
-- este script lo arregla sin tocar los datos.

alter table public.comisiones    disable row level security;
alter table public.liquidaciones disable row level security;

alter table public.liquidaciones add column if not exists tasa   numeric;
alter table public.liquidaciones add column if not exists ajuste numeric;
alter table public.liquidaciones add column if not exists lote   text;
