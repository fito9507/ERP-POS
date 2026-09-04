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

-- ── Portal común (marinmetal.com/investment): entrada SOLO con PIN ──
-- Límite de intentos POR IP para frenar a quien pruebe PINs a lo loco:
-- 5 fallos → 15 minutos de bloqueo para esa IP. Solo la escribe el
-- servidor (clave de servicio); cerrada al público.
create table if not exists public.portal_intentos (
  ip              text primary key,
  fallos          integer default 0,
  bloqueado_hasta timestamptz,
  actualizado     timestamptz default now()
);
alter table public.portal_intentos enable row level security;
revoke all on public.portal_intentos from anon, authenticated;

-- Verificación
select 'columna pin_hash' as comprobacion,
       exists(select 1 from information_schema.columns
              where table_name='inversores' and column_name='pin_hash') as ok
union all
select 'tabla portal_intentos',
       exists(select 1 from information_schema.tables
              where table_name='portal_intentos');
