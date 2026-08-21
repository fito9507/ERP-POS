-- ════════════════════════════════════════════════════════════════════
-- SYNC ABANCA AUTOMÁTICO — sin abrir la app
-- Ejecutar UNA VEZ en Supabase → SQL Editor → Run
--
-- Programa la función enablebanking-sync 3 veces al día (08:00, 14:00 y
-- 20:00 hora española = 06:00/12:00/18:00 UTC). La función ya hace el
-- cuadre completo en el servidor: compara banco↔base por ABANCA_ID e
-- inserta lo que falte en movimientos_ig y mov_cajas. Los dispositivos
-- solo leen; ya no pueden perder movimientos.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- si ya existía una versión anterior del job, quitarla
select cron.unschedule(jobid) from cron.job where jobname = 'abanca-sync-auto';

select cron.schedule(
  'abanca-sync-auto',
  '0 6,12,18 * * *',
  $$
  select net.http_post(
    url     := 'https://gpkslaqfqfdeoleiayng.supabase.co/functions/v1/enablebanking-sync',
    body    := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);

-- Verificación: debe aparecer el job programado
select jobname, schedule, active from cron.job where jobname = 'abanca-sync-auto';

-- (Para ver las últimas ejecuciones más adelante:)
-- select status, return_message, start_time from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname='abanca-sync-auto')
--   order by start_time desc limit 5;
