-- Pago fraccionado de liquidaciones (13-09-2026)
-- Al pagar una liquidación se puede repartir entre varias cajas y monedas.
-- El detalle (caja, moneda, monto, tasa, equivalente) se guarda aquí; la
-- columna "cuenta" sigue llevando un texto legible con el mismo reparto.
-- La app funciona aunque no se ejecute: guarda sin detalle y avisa.
alter table public.liquidaciones add column if not exists pagos jsonb;
