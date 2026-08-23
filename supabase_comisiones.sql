-- ════════════════════════════════════════════════════════════════════
-- COMISIONES v2 — ejecutar UNA VEZ en Supabase → SQL Editor → Run
--
-- 1. Tabla `comisiones`: comisiones por COBRO de folio (cada abono de un
--    cliente asignado a un vendedor genera su comisión al registrarse).
-- 2. Tabla `liquidaciones`: existía SIN columnas — por eso el histórico
--    de liquidaciones nunca se guardó en la nube. Se recrea bien.
-- 3. Limpieza: comisiones arrastradas de Admin (16,80) y Pedro (5,40),
--    de cuando aún comisionaban → 'No aplica'.
-- ════════════════════════════════════════════════════════════════════

-- 1. comisiones por cobro de folio
create table if not exists comisiones (
  id         text primary key,          -- 'com-' + id del abono
  fecha      date,
  vendedor   text,
  origen     text default 'abono',
  abono_id   text,
  folio_id   text,
  cliente    text,
  almacen    text,
  base_usd   numeric,                   -- equivalente USD del abono
  pct        numeric,
  com_usd    numeric,                   -- base_usd × pct / 100
  moneda     text,                      -- moneda original del abono
  monto      numeric,                   -- importe original del abono
  caja       text,                      -- caja donde entró el cobro
  estado     text default 'Pendiente',  -- Pendiente → Liquidada (Pdte) → Pagada
  liq_id     text,
  created_at timestamptz default now()
);

-- 2. liquidaciones: recrear con columnas (estaba vacía y sin esquema útil)
drop table if exists liquidaciones;
create table liquidaciones (
  id          text primary key,
  vend        text,
  desde       date,
  hasta       date,
  semana      text,
  almacen     text,
  v_usd       numeric,
  com_usd     numeric,
  com_cup     numeric,
  mon         text,
  cuenta      text,
  com_detalle jsonb,
  estado      text,
  fecha       date,
  ventas      jsonb,
  coms        jsonb,
  created_at  timestamptz default now()
);

-- 3. limpieza de arrastres (Admin y Pedro ya no comisionan)
update ventas set est_com = 'No aplica'
 where vendedor in ('Admin', 'Pedro') and est_com = 'Pendiente';

-- Verificación
select 'comisiones' as tabla, count(*) from comisiones
union all select 'liquidaciones', count(*) from liquidaciones
union all select 'ventas pdte restantes', count(*) from ventas where est_com = 'Pendiente';
