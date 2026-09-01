-- ════════════════════════════════════════════════════════════════════
-- SEGURIDAD · FASE 1 — el PIN deja de ser público
--
-- Problema: la tabla `usuarios` se leía desde el navegador con la clave
-- pública. Cualquiera podía bajarse los PIN hasheados y, al ser de 4
-- dígitos sin sal, sacarlos en menos de un segundo (probado).
--
-- Con este script:
--   · Nadie puede leer `usuarios` desde fuera: la app pide la lista sin
--     PIN a la función `erp-auth`, y el PIN se comprueba en el servidor.
--   · Se registran los intentos de login para frenar la fuerza bruta.
--   · Se prepara la sal del PIN (fase siguiente).
--
-- Ejecutar en Supabase → SQL Editor → Run. Es seguro repetirlo.
-- IMPORTANTE: antes de ejecutarlo, la app debe estar ya actualizada
-- (si no, la pantalla de login se queda sin usuarios).
-- ════════════════════════════════════════════════════════════════════

-- 1. Registro de intentos de login (lo escribe solo el servidor)
create table if not exists public.login_intentos (
  id      bigserial primary key,
  usuario text,
  ok      boolean default false,
  ip      text,
  creado  timestamptz default now()
);
create index if not exists idx_login_intentos_usuario on public.login_intentos (usuario, creado desc);

alter table public.login_intentos enable row level security;
revoke all on public.login_intentos from anon, authenticated;

-- 2. Sal para los PIN (la fase siguiente la rellena)
alter table public.usuarios add column if not exists pin_salt text;

-- 3. `usuarios` deja de ser accesible desde el navegador
--    (la función erp-auth la lee con la clave de servicio, que no pasa
--     por RLS, así que el login sigue funcionando)
alter table public.usuarios enable row level security;
drop policy if exists allow_all_usuarios on public.usuarios;
revoke all on public.usuarios from anon;

-- Los usuarios que ya han entrado (sesión válida) pueden leer la ficha
-- SIN el PIN a través de esta vista, para pantallas de administración.
create or replace view public.usuarios_publicos as
  select nombre, rol, almacen, color, tc, modulos, activo, puede_vender, a_comision
    from public.usuarios;

grant select on public.usuarios_publicos to authenticated;

-- Verificación
select 'usuarios legible por anon' as comprobacion,
       has_table_privilege('anon', 'public.usuarios', 'SELECT') as resultado
union all
select 'login_intentos creada', to_regclass('public.login_intentos') is not null;
