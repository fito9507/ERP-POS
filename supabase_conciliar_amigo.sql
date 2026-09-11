-- ════════════════════════════════════════════════════════════════════
-- CONCILIAR "Amigo construcción" (Habana → ABANCA, 11.330 / entra 10.985)
--
-- El abono llegó al banco el 09/09 y el sync lo importó ese día como
-- ingreso suelto:   movimientos_ig 517  +  mov_cajas 1015   (ABANCA +10.985)
-- Hoy 11/09 se registró la transferencia a mano:  mov_cajas 1026
-- (Habana −11.330 / ABANCA +10.985) con sus apuntes 531/532/533.
-- Resultado: ABANCA tenía los 10.985 DOS veces.
--
-- Se conserva la transferencia manual (cuenta la historia entera: sale de
-- Habana, comisión 345, entra en ABANCA) marcada como conciliada con el
-- id del banco, y se retira el ingreso suelto que había importado el sync.
-- Copia de seguridad de lo borrado: BACKUP_abono_amigo_10985.json
--
-- Ejecutar en Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════

-- ── ANTES ──
select 'ANTES mov_cajas' as paso, id, fecha, tipo, caja_origen, caja_destino, monto_origen, monto_destino, notas
from mov_cajas where id in (1015, 1026) order by id;
select 'ANTES movimientos_ig' as paso, id, fecha, tipo, monto, cuenta, descripcion, notas
from movimientos_ig where id in (517, 531) order by id;

-- ── 1) la transferencia manual queda conciliada con el id del banco ──
update mov_cajas
   set notas = notas || ' (conciliado ABANCA_ID:ES2120805043933940202989-2026-09-09T195257763623-0200-109850)'
 where id = 1026 and notas not like '%ABANCA_ID%';
update movimientos_ig
   set notas = notas || ' ABANCA_ID:ES2120805043933940202989-2026-09-09T195257763623-0200-109850'
 where id = 531 and notas not like '%ABANCA_ID%';

-- ── 2) fuera el ingreso suelto que importó el sync (ya está representado por 1026) ──
delete from movimientos_ig where id = 517;
delete from mov_cajas      where id = 1015;

-- ── DESPUÉS: ABANCA debe quedar en 38.863,58 (igual que el banco) ──
select 'USD ABANCA en el ERP' as comprobacion,
       round((select saldo_inicial from cajas where nombre = 'USD ABANCA')
           + coalesce((select sum(monto_destino) from mov_cajas where caja_destino = 'USD ABANCA'), 0)
           - coalesce((select sum(monto_origen)  from mov_cajas where caja_origen  = 'USD ABANCA'), 0), 2)::text as resultado
union all
select 'apuntes con el id del banco (debe ser 2: 1026 y 531)',
       ((select count(*) from mov_cajas where notas like '%T195257763623-0200-109850%')
      + (select count(*) from movimientos_ig where notas like '%T195257763623-0200-109850%'))::text;
