-- Vendedor por folio (quién hizo la venta a crédito).
-- Hasta ahora la comisión de los abonos de un folio iba al "dueño" del
-- cliente, porque el folio no guardaba vendedor en la nube. Con esta
-- columna cada folio lleva el suyo, se puede reasignar desde la ficha
-- del cliente y los abonos comisionan a quien corresponda.
--
-- Ejecutar en Supabase → SQL Editor. Es seguro repetirlo.

alter table public.folios add column if not exists vendedor text;

-- Opcional: arrancar con el dueño del cliente como vendedor de sus
-- folios existentes (es lo que venía aplicándose de hecho).
update public.folios f
   set vendedor = c.owner
  from public.clientes c
 where c.id = f.cliente_id
   and f.vendedor is null
   and c.owner is not null
   and c.owner <> '';
