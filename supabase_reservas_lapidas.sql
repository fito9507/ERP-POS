-- Blindaje de las reservas contra versiones viejas de la app.
--
-- Problema: una reserva cobrada/cancelada queda en la nube como lápida
-- (activa=false). Un móvil con la versión ANTIGUA de la app todavía
-- hace DELETE de la fila y resube su copia local con activa=true, y la
-- reserva "resucita" en todos los dispositivos (pasó 2 veces con la de
-- «Cliente vilito placetas»).
--
-- Solución en la propia base de datos, que manda sobre cualquier cliente:
--   1. Una lápida no puede volver a activarse (trigger).
--   2. Nadie puede borrar filas de reservas con la clave pública
--      (revoke DELETE): borrar = poner activa=false.
--
-- Ejecutar en Supabase → SQL Editor. Es seguro repetirlo.

create or replace function public.reservas_lapida_permanente()
returns trigger language plpgsql as $$
begin
  -- Si ya estaba desactivada, se queda desactivada aunque un cliente
  -- viejo intente resubirla como activa.
  if (old.activa = false) and (new.activa = true) then
    new.activa := false;
  end if;
  return new;
end $$;

drop trigger if exists trg_reservas_lapida on public.reservas;
create trigger trg_reservas_lapida
  before update on public.reservas
  for each row execute function public.reservas_lapida_permanente();

-- La app nueva nunca borra reservas (pone activa=false). Quitar el
-- permiso de DELETE a la clave pública deja sin efecto el DELETE de
-- las versiones antiguas (la fila-lápida sobrevive).
revoke delete on public.reservas from anon, authenticated;
