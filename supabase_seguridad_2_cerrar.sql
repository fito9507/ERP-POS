-- ════════════════════════════════════════════════════════════════════
-- SEGURIDAD · FASE 2 — cerrar la base de datos al público
--
-- Hasta ahora, con la clave que va dentro del index.html (pública, es su
-- naturaleza) cualquiera podía LEER y ESCRIBIR todas las tablas: ventas,
-- clientes con teléfonos, cajas, préstamos, el libro entero.
--
-- A partir de aquí:
--   · Sin haber entrado con PIN no se puede tocar nada.
--   · Se mantiene abierta SOLO la lectura de lo que necesita el catálogo
--     web público (catalogo.html): productos, existencias y contenedores.
--   · Quien ha entrado con su PIN (sesión de erp-auth) trabaja igual que
--     hasta ahora.
--
-- REQUISITO: la app publicada debe ser la que usa sesión (erp-auth).
-- Si algo fuera mal, para volver atrás:
--     grant select, insert, update, delete on all tables in schema public to anon;
--
-- Ejecutar en Supabase → SQL Editor → Run. Es seguro repetirlo.
-- ════════════════════════════════════════════════════════════════════

-- 1. Todas las tablas: RLS encendido y política para usuarios con sesión
do $$
declare t text;
begin
  foreach t in array array[
    'ventas','productos','stock_almacen','stock_movimientos','movimientos_stock','stock',
    'clientes','folios','folio_lineas','abonos','mov_cajas','movimientos_ig','movimientos_fx',
    'cajas','cajas_custom','contenedores','com_reglas','comisiones','liquidaciones',
    'prestamos','prestamo_cuotas','reservas','tasas','tasas_almacen','sync_queue','accesos','usuarios'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;

    execute format('alter table public.%I enable row level security', t);

    -- fuera las políticas viejas que dejaban entrar a cualquiera
    execute format(
      'do $inner$ declare p record; begin
         for p in select policyname from pg_policies where schemaname=''public'' and tablename=%L loop
           execute format(''drop policy if exists %%I on public.%I'', p.policyname);
         end loop;
       end $inner$;', t, t);

    -- quien ha entrado con PIN puede trabajar
    execute format(
      'create policy con_sesion on public.%I for all to authenticated using (true) with check (true)', t);

    -- el público ya no toca la tabla
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- 2. Secuencias: para que se puedan crear filas con id automático
do $$
declare s text;
begin
  for s in select sequence_name from information_schema.sequences where sequence_schema='public' loop
    execute format('grant usage, select on sequence public.%I to authenticated', s);
  end loop;
end $$;

-- 3. Catálogo web público: solo LECTURA de lo que enseña la tienda
grant select on public.productos     to anon;
grant select on public.stock_almacen to anon;
grant select on public.contenedores  to anon;
grant select on public.tasas         to anon;
grant select on public.tasas_almacen to anon;

drop policy if exists catalogo_publico on public.productos;
drop policy if exists catalogo_publico on public.stock_almacen;
drop policy if exists catalogo_publico on public.contenedores;
drop policy if exists catalogo_publico on public.tasas;
drop policy if exists catalogo_publico on public.tasas_almacen;

create policy catalogo_publico on public.productos     for select to anon using (true);
create policy catalogo_publico on public.stock_almacen for select to anon using (true);
create policy catalogo_publico on public.contenedores  for select to anon using (true);
create policy catalogo_publico on public.tasas         for select to anon using (true);
create policy catalogo_publico on public.tasas_almacen for select to anon using (true);

-- 3.b El catálogo necesita saber cuántas unidades hay comprometidas en
--     folios (para no vender dos veces lo mismo). En vez de abrir la
--     tabla de folios al público —que llevaría clientes y precios—, se
--     publica solo el total por producto.
create or replace view public.comprometido_publico as
  select f.almacen,
         (coalesce(f.tipo_reserva,'') = 'prereserva') as en_transito,
         coalesce(l->>'prod', l->>'producto', l->>'n') as producto,
         sum(coalesce((l->>'q')::numeric, 0)) as cantidad
    from public.folios f
    cross join lateral jsonb_array_elements(
      case jsonb_typeof(to_jsonb(f.lineas)) when 'array' then to_jsonb(f.lineas) else '[]'::jsonb end) l
   where coalesce(f.estado,'') not in ('pagado','Pagado')
     and coalesce(l->>'prod', l->>'producto', l->>'n') is not null
   group by 1,2,3;

grant select on public.comprometido_publico to anon, authenticated;

-- 4. Usuarios: ni siquiera con sesión se leen los PIN desde el navegador.
--    (la función erp-auth los usa con la clave de servicio)
revoke all on public.usuarios from anon, authenticated;
drop policy if exists con_sesion on public.usuarios;

-- 5. Registro de intentos de login: solo el servidor
revoke all on public.login_intentos from anon, authenticated;

-- Verificación
select 'anon puede leer ventas'    as comprobacion, has_table_privilege('anon','public.ventas','SELECT')    as resultado
union all select 'anon puede escribir ventas', has_table_privilege('anon','public.ventas','INSERT')
union all select 'anon puede leer usuarios',   has_table_privilege('anon','public.usuarios','SELECT')
union all select 'anon puede leer productos (catálogo)', has_table_privilege('anon','public.productos','SELECT')
union all select 'con sesión puede escribir ventas', has_table_privilege('authenticated','public.ventas','INSERT');
