-- ════════════════════════════════════════════════════════════════════
-- DESBLOQUEAR LA TABLA DE RESERVAS
-- Ejecutar en Supabase → SQL Editor → Run
--
-- La tabla `reservas` se creó pero quedó con RLS (Row Level Security)
-- activo y sin políticas, así que la app rechaza cada escritura con
-- "new row violates row-level security policy". Es lo mismo que pasó
-- con `comisiones` y `liquidaciones`.
--
-- Se desactiva RLS, igual que en el resto de tablas del ERP.
-- ════════════════════════════════════════════════════════════════════

alter table reservas disable row level security;

-- Verificación: debe decir rowsecurity = false
select relname as tabla, relrowsecurity as rls_activo
  from pg_class
 where relname = 'reservas';
