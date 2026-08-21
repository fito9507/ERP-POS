-- ════════════════════════════════════════════════════════════════════
-- ABANCA 21/08: insertar los 3 movimientos de hoy que el sync del móvil
-- no llegó a escribir (amortización del crédito + recibo).
-- Ejecutar en Supabase → SQL Editor → Run
--
-- Son EXACTAMENTE los cuerpos que genera el circuito de sincronización
-- (verificado ejecutando el código real con los datos del banco), con su
-- marcador ABANCA_ID: — el próximo sync los verá como ya importados y no
-- los duplicará.
-- ════════════════════════════════════════════════════════════════════

INSERT INTO movimientos_ig (fecha, tipo, descripcion, monto, moneda, equiv_usd, cuenta, vendedor, notas) VALUES
  ('2026-08-21', 'Gasto operativo', 'ME 260503G', 221.84, 'EUR', 249.2584, 'EUR ABANCA', 'Sistema',
   'ABANCA_ID:ES8720805043943040076381-2026-08-21T094134581505-0200-22184'),
  ('2026-08-21', 'Gasto operativo', 'AMORTIZACION', 9000, 'EUR', 10112.3596, 'EUR ABANCA', 'Sistema',
   'ABANCA_ID:ES8720805043943040076381-2026-08-21T094411405617-0200-90000'),
  ('2026-08-21', 'Ingreso no-venta', 'AMORTIZACION', 9000, 'EUR', 10112.3596, 'EUR CRÉDITO ABANCA', 'Sistema',
   'ABANCA_ID:ES6020805043995500163656-2026-08-21T094411409132-90000');

INSERT INTO mov_cajas (fecha, tipo, caja_origen, caja_destino, monto_origen, monto_destino, notas, usuario) VALUES
  ('2026-08-21', 'retiro', 'EUR ABANCA', NULL, 221.84, 221.84,
   'ME 260503G (ABANCA_ID:ES8720805043943040076381-2026-08-21T094134581505-0200-22184)', 'Sistema'),
  ('2026-08-21', 'retiro', 'EUR ABANCA', NULL, 9000, 9000,
   'AMORTIZACION (ABANCA_ID:ES8720805043943040076381-2026-08-21T094411405617-0200-90000)', 'Sistema'),
  ('2026-08-21', 'deposito', NULL, 'EUR CRÉDITO ABANCA', 9000, 9000,
   'AMORTIZACION (ABANCA_ID:ES6020805043995500163656-2026-08-21T094411409132-90000)', 'Sistema');

-- Verificación (deben salir las 3 parejas):
SELECT fecha, tipo, caja_origen, caja_destino, monto_origen, left(notas, 45) AS nota
FROM mov_cajas WHERE fecha = '2026-08-21' AND notas LIKE '%ABANCA_ID%' ORDER BY id;
