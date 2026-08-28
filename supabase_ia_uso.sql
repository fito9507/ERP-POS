-- ════════════════════════════════════════════════════════════════════
-- CONTROL DE GASTO DEL ASISTENTE — ejecutar en Supabase → SQL Editor
--
-- Lleva la cuenta de lo que gasta la IA cada día. El puente
-- (openai-proxy) suma aquí el coste de cada consulta y deja de llamar a
-- OpenAI cuando se alcanza el tope diario (IA_TOPE_DIARIO, 3 USD por
-- defecto), para que no vuelva a pasar lo del 27-28/08.
-- ════════════════════════════════════════════════════════════════════

create table if not exists ia_uso (
  fecha       date primary key,
  coste_usd   numeric default 0,
  actualizado timestamptz default now()
);

alter table ia_uso disable row level security;

-- Consulta útil: gasto de los últimos 15 días
select fecha, round(coste_usd::numeric, 4) as usd
  from ia_uso
 order by fecha desc
 limit 15;
