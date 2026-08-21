-- ════════════════════════════════════════════════════════════════════
-- CUADRE BANCARIO AUTOMÁTICO — TODOS los bancos, sin abrir la app
-- Ejecutar UNA VEZ en Supabase → SQL Editor → Run
-- (sustituye a supabase_cron_abanca.sql; este lo desactiva si existía)
--
-- Programa banco-cuadre 3 veces al día (08:00, 14:00 y 20:00 hora
-- española). Esa función llama a los syncs de Wise, Revolut y Abanca,
-- normaliza igual que el ERP e inserta en el servidor lo que falte
-- (dedup por WISE_ID: / REV_ID: / ABANCA_ID:). Los dispositivos solo
-- leen; ya no pueden perder movimientos de ningún banco.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- quitar versiones anteriores del job (incluido el de solo-Abanca)
select cron.unschedule(jobid) from cron.job
 where jobname in ('abanca-sync-auto', 'bancos-cuadre-auto');

select cron.schedule(
  'bancos-cuadre-auto',
  '0 6,12,18 * * *',
  $$
  select net.http_post(
    url     := 'https://gpkslaqfqfdeoleiayng.supabase.co/functions/v1/banco-cuadre',
    body    := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);

-- Verificación: debe aparecer el job programado y activo
select jobname, schedule, active from cron.job where jobname = 'bancos-cuadre-auto';

-- (Para revisar ejecuciones más adelante:)
-- select status, return_message, start_time from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname='bancos-cuadre-auto')
--   order by start_time desc limit 5;
