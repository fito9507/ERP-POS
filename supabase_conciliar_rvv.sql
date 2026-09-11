-- ════════════════════════════════════════════════════════════════════
-- ENLAZAR "RVV" (ACEM → ABANCA) con el abono que el banco trajo el 03/09
--
-- Banco (03/09):  mov_cajas 981 + movimientos_ig 488   →  ABANCA +35.418,64
-- Manual (11/09): mov_cajas 1028  (ACEM −35443.64 / ABANCA +35393.64)
--   registrado con el código viejo: restó la comisión dos veces (debía entrar 35.418,64).
-- Resultado: ABANCA tenía el abono DOS veces, y la copia manual con 25 de menos.
--
-- Se conserva la transferencia manual con el importe que confirmó el banco
-- (35.418,64), con la fecha real y marcada como conciliada; y se retira el
-- ingreso suelto que importó el sync. Copia de seguridad: BACKUP_rvv_0309.json
--
-- Ejecutar en Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════

-- ANTES
select 'ANTES' as paso, id, fecha, tipo, caja_origen, caja_destino, monto_origen, monto_destino, notas
from mov_cajas where id in (981, 1028) order by id;

-- 1) la transferencia manual: entra lo que dijo el banco, fecha real, conciliada
update mov_cajas
   set monto_destino = 35418.64,
       fecha = '2026-09-03',
       notas = notas || ' (conciliado ABANCA_ID:ES2120805043933940202989-2026-09-03T171836342424-0200-3541864)'
 where id = 1028 and notas not like '%ABANCA_ID%';
update movimientos_ig set fecha = '2026-09-03' where notas like '%[OP:OPmtx9q6xq14kc]%';
update movimientos_ig set notas = notas || ' ABANCA_ID:ES2120805043933940202989-2026-09-03T171836342424-0200-3541864' where id = 539 and notas not like '%ABANCA_ID%';

-- 2) fuera el ingreso suelto que importó el sync (ya representado por la transferencia)
delete from movimientos_ig where id = 488;
delete from mov_cajas      where id = 981;

-- DESPUÉS: ABANCA debe seguir en 38.863,58 (igual que el banco)
select 'USD ABANCA en el ERP' as comprobacion,
       round((select saldo_inicial from cajas where nombre = 'USD ABANCA')
           + coalesce((select sum(monto_destino) from mov_cajas where caja_destino = 'USD ABANCA'), 0)
           - coalesce((select sum(monto_origen)  from mov_cajas where caja_origen  = 'USD ABANCA'), 0), 2)::text as resultado
union all
select 'USD ACEM en el ERP',
       round((select saldo_inicial from cajas where nombre = 'USD ACEM')
           + coalesce((select sum(monto_destino) from mov_cajas where caja_destino = 'USD ACEM'), 0)
           - coalesce((select sum(monto_origen)  from mov_cajas where caja_origen  = 'USD ACEM'), 0), 2)::text;
