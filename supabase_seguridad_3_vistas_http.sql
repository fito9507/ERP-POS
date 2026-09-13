-- ════════════════════════════════════════════════════════════════════
-- Seguridad, fase 3 (13-09-2026): cierres encontrados en la revisión.
-- Puntos 1, 3 y 4 aplicados ya en producción con erp-sql (es seguro repetirlos).
-- El punto 2 queda pendiente de ejecutar a mano en el SQL Editor.
-- Para deshacer cualquier punto: el GRANT contrario.
-- ════════════════════════════════════════════════════════════════════

-- 1. CRÍTICO. La vista usuarios_publicos es actualizable (SELECT simple
--    sobre usuarios) y corre con permisos del dueño, o sea, salta el RLS
--    de usuarios. Con la clave pública se podía cambiar rol, activo,
--    módulos... de cualquier usuario (probado: PATCH → 200).
--    Solo lectura para todos; catalogo.html solo la lee.
revoke insert, update, delete, truncate, references, trigger on public.usuarios_publicos from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.comprometido_publico from anon, authenticated;
-- y que las vistas apliquen los permisos de quien consulta, no del dueño
alter view public.usuarios_publicos    set (security_invoker = false);
alter view public.comprometido_publico set (security_invoker = false);
-- (security_invoker=true rompería el catálogo: anon no puede leer usuarios
--  ni folios/abonos. Se deja en false a propósito y se protege por grants.)

-- 2. ALTO — PENDIENTE DE EJECUTAR A MANO (SQL Editor de Supabase).
--    La extensión http vive en public y anon/authenticated pueden ejecutar
--    http_get/http_post... por RPC: peticiones HTTP desde la propia base a
--    cualquier destino (probado: rpc/http_get → 200).
--    Un REVOKE no sirve: las funciones son de supabase_admin y postgres no
--    es su dueño, así que Postgres lo ignora en silencio (comprobado).
--    Lo que sí puede postgres es reinstalar la extensión en el esquema
--    `extensions`, que el API REST no expone (ensayado en una transacción
--    deshecha: el DROP está permitido). Nada usa estas funciones por RPC
--    (las tareas programadas usan net.http_*). get_eltoque_rates depende
--    de ella y nadie la llama (la tasa la trae la Edge Function
--    update-tasas), así que se elimina con ella.
--    Ejecutar estas tres líneas en Supabase → SQL Editor → Run:
drop function if exists public.get_eltoque_rates();
drop extension if exists http;
create extension http with schema extensions;
--    Comprobación: POST /rest/v1/rpc/http_get con la clave pública debe
--    devolver 404 (antes 200).

-- 3. MEDIO. Cualquier sesión (también un vendedor) tenía TRUNCATE sobre
--    todas las tablas, y el RLS no protege contra TRUNCATE.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;

-- 4. Tablas con RLS pero sin ninguna política (nadie las ve, ni la app):
--    deudas y gastos_contenedor no se usan; ia_config sí (memoria del
--    asistente IA) y por eso hoy no carga/guarda. Misma política que el
--    resto y fuera los permisos de anon.
revoke all on public.deudas, public.gastos_contenedor, public.ia_config, public.ia_uso from anon;
drop policy if exists con_sesion on public.ia_config;
create policy con_sesion on public.ia_config for all to authenticated using (true) with check (true);
