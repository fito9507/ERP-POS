-- ════════════════════════════════════════════════════════════════════
-- MÓDULO INVERSORES — datos (aditivo, no toca el ERP)
--
-- El inversor NUNCA toca estas tablas: las lee una función con su token
-- privado (clave de servicio), que solo le devuelve SU foto curada. Aquí
-- no vive ningún dato sensible (ni coste, ni proveedor, ni margen): el
-- ERP calcula la foto y escribe solo lo que el inversor puede ver.
--
-- Ejecutar en Supabase → SQL Editor → Run. Es seguro repetirlo.
-- ════════════════════════════════════════════════════════════════════

-- 1. Inversores (personas)
create table if not exists public.inversores (
  id          bigserial primary key,
  nombre      text not null,
  token       text unique default replace(gen_random_uuid()::text,'-',''),  -- enlace privado
  telegram_chat text,                       -- chat/grupo privado para avisos
  activo      boolean default true,
  notas       text,
  created_at  timestamptz default now()
);

-- 2. Participación de un inversor en un contenedor (muchos-a-muchos)
--    modelo de retorno por inversor:
--      'pct_ganancia' → recibe participacion_pct % de la ganancia del contenedor
--      'retorno_fijo' → recibe un retorno fijo pactado (retorno_fijo_usd)
--      'pct_revenue'  → recibe participacion_pct % de los ingresos
create table if not exists public.inversor_contenedor (
  id             bigserial primary key,
  inversor_id    bigint references public.inversores(id) on delete cascade,
  contenedor_ref text not null,             -- contenedores.ref (ej. "#19 Mixto 40'HC")
  aporte_usd     numeric default 0,         -- capital que puso
  modelo         text default 'pct_ganancia',
  participacion_pct numeric default 0,      -- su % (para pct_ganancia / pct_revenue)
  retorno_fijo_usd  numeric default 0,      -- para retorno_fijo
  notas          text,
  created_at     timestamptz default now(),
  unique (inversor_id, contenedor_ref)
);

-- 3. La FOTO curada que el ERP escribe por (inversor, contenedor).
--    Solo campos que el inversor puede ver. Nada de coste/margen/proveedor.
create table if not exists public.inversor_snapshot (
  id               bigserial primary key,
  inversor_id      bigint references public.inversores(id) on delete cascade,
  contenedor_ref   text not null,
  contenedor_nombre text,
  estado           text,
  unidades_total   numeric default 0,
  unidades_vendidas numeric default 0,
  pct_colocado     numeric default 0,       -- % del contenedor ya vendido
  stock_restante   numeric default 0,
  ritmo_7d         numeric default 0,       -- uds/día últimas 2 semanas
  fecha_estim_fin  date,                    -- venta total estimada al ritmo actual
  revenue_cobrado  numeric default 0,       -- ingresos cobrados del contenedor
  aporte_usd       numeric default 0,       -- SU capital
  recuperado_usd   numeric default 0,       -- SU capital ya recuperado
  retorno_usd      numeric default 0,       -- SU ganancia hasta ahora
  retorno_proy_usd numeric default 0,       -- SU ganancia proyectada al vender todo
  actualizado      timestamptz default now(),
  unique (inversor_id, contenedor_ref)
);

-- ── Seguridad: cerradas al público; el ERP (con sesión) las gestiona,
--    la función inversor-portal las lee con clave de servicio ──────────
do $$
declare t text;
begin
  foreach t in array array['inversores','inversor_contenedor','inversor_snapshot'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists con_sesion on public.%I', t);
    execute format('create policy con_sesion on public.%I for all to authenticated using (true) with check (true)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

do $$
declare s text;
begin
  for s in select sequence_name from information_schema.sequences
           where sequence_schema='public' and sequence_name like 'inversor%' loop
    execute format('grant usage, select on sequence public.%I to authenticated', s);
  end loop;
end $$;

-- Verificación
select 'anon puede leer inversores' as comprobacion, has_table_privilege('anon','public.inversores','SELECT') as resultado
union all select 'con sesión gestiona inversores', has_table_privilege('authenticated','public.inversores','INSERT');
