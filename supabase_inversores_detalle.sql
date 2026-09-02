-- ════════════════════════════════════════════════════════════════════
-- MÓDULO INVERSORES — detalle pro (aditivo)
--
-- La foto pasa a guardarse como un bloque JSON flexible (`datos`), para
-- poder meter todos los KPIs pro (lista de materiales, vendido/restante
-- por producto, margen esperado y actual, etc.) sin tocar la base cada
-- vez. El ERP compone ese bloque ya CURADO según lo que cada inversor
-- puede ver.
--
-- `ver_detalle`: interruptor por inversor. Activado = ve el desglose y el
-- margen (para quien financia el contenedor completo). Apagado (por
-- defecto) = solo avance + su retorno, sin margen ni costes.
--
-- Ejecutar en Supabase → SQL Editor → Run. Es seguro repetirlo.
-- ════════════════════════════════════════════════════════════════════

alter table public.inversor_contenedor add column if not exists ver_detalle boolean default false;
alter table public.inversor_snapshot   add column if not exists datos jsonb;

-- Verificación
select 'columna datos en snapshot' as comprobacion,
       exists(select 1 from information_schema.columns
              where table_name='inversor_snapshot' and column_name='datos') as ok
union all
select 'columna ver_detalle en participacion',
       exists(select 1 from information_schema.columns
              where table_name='inversor_contenedor' and column_name='ver_detalle');
