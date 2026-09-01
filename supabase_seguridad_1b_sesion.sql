-- ════════════════════════════════════════════════════════════════════
-- SEGURIDAD · PASO 1b — que la sesión pueda leer y escribir
--
-- Al pasar la app a trabajar con sesión (rol "authenticated"), varias
-- tablas dejaron de verse: ya tenían RLS activado con una política que
-- SOLO daba acceso al rol anónimo. Con sesión, el registro de ventas y
-- otros salían vacíos.
--
-- Este paso SOLO AÑADE acceso para quien ha entrado con su PIN. No quita
-- nada, no cierra nada: la clave pública sigue funcionando igual que
-- hasta ahora, así que es imposible quedarse fuera. El cierre de verdad
-- (quitar el acceso público) es el paso 2, que se ejecuta después de
-- comprobar que todo va bien.
--
-- Ejecutar en Supabase → SQL Editor → Run. Es seguro repetirlo.
-- ════════════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array[
    'ventas','productos','stock_almacen','stock_movimientos','movimientos_stock','stock',
    'clientes','folios','folio_lineas','abonos','mov_cajas','movimientos_ig','movimientos_fx',
    'cajas','cajas_custom','contenedores','com_reglas','comisiones','liquidaciones',
    'prestamos','prestamo_cuotas','reservas','tasas','tasas_almacen','sync_queue','accesos'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;

    -- permiso de tabla para el rol con sesión
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    -- política para el rol con sesión (por si la tabla tiene RLS activado;
    -- si no lo tiene, la política simplemente no estorba). No se toca
    -- ninguna política existente: solo se (re)crea la nuestra.
    execute format('drop policy if exists con_sesion on public.%I', t);
    execute format(
      'create policy con_sesion on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Secuencias: para poder crear filas con id automático estando con sesión
do $$
declare s text;
begin
  for s in select sequence_name from information_schema.sequences where sequence_schema='public' loop
    execute format('grant usage, select on sequence public.%I to authenticated', s);
  end loop;
end $$;

-- La vista agregada del catálogo (si aún no existe, se crea en el paso 2;
-- aquí solo aseguramos el permiso por si ya estuviera creada)
do $$ begin
  if to_regclass('public.comprometido_publico') is not null then
    grant select on public.comprometido_publico to anon, authenticated;
  end if;
end $$;

-- Verificación: la sesión ahora ve las ventas
select 'con sesión puede leer ventas'  as comprobacion, has_table_privilege('authenticated','public.ventas','SELECT') as resultado
union all select 'con sesión puede escribir ventas', has_table_privilege('authenticated','public.ventas','INSERT')
union all select 'la clave pública SIGUE leyendo ventas (no se ha cerrado nada)', has_table_privilege('anon','public.ventas','SELECT');
