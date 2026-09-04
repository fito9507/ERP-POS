-- ════════════════════════════════════════════════════════════════════
-- PIN opcional para el portal del inversor (segunda llave)
--
-- El enlace sigue siendo la llave principal; si a un inversor le pones
-- PIN (botón 🔒 en Administración → Inversores), el portal se lo pide
-- antes de enseñar nada. 5 fallos seguidos → 15 minutos de bloqueo.
-- El PIN nunca se guarda en claro: sha256(token + ':' + pin).
--
-- Ejecutar en Supabase → SQL Editor → Run. Es seguro repetirlo.
-- ════════════════════════════════════════════════════════════════════

alter table public.inversores add column if not exists pin_hash text;
alter table public.inversores add column if not exists pin_fallos integer default 0;
alter table public.inversores add column if not exists pin_bloqueado_hasta timestamptz;

-- Verificación
select 'columna pin_hash' as comprobacion,
       exists(select 1 from information_schema.columns
              where table_name='inversores' and column_name='pin_hash') as ok;
