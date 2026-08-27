-- ════════════════════════════════════════════════════════════════════
-- RESERVAS EN LA NUBE — ejecutar UNA VEZ en Supabase → SQL Editor
--
-- Hasta ahora las reservas del POS ("Solo Reservar") vivían SOLO en el
-- navegador que las creaba: no se veían desde otro dispositivo y se
-- perdían al cerrar sesión o limpiar la caché, dejando stock apartado
-- sin ninguna lista que lo explicara.
-- ════════════════════════════════════════════════════════════════════

create table if not exists reservas (
  id          text primary key,
  fecha       text,                    -- como se muestra en el POS (dd/mm)
  usuario     text,
  almacen     text,
  cliente     text,
  nota        text,
  contenedor  text,
  lineas      jsonb,                   -- [{n, q, precioUSD, ...}]
  total_usd   numeric,
  activa      boolean default true,
  created_at  timestamptz default now()
);

-- Sin RLS, como el resto de tablas del ERP (si no, la app no puede escribir)
alter table reservas disable row level security;

-- Verificación
select count(*) as reservas from reservas;
