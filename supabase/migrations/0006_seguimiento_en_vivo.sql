-- =============================================================
-- S&S Burger — Seguimiento del cliente en tiempo real
--
-- El panel del local escucha la tabla `orders` por Realtime porque el
-- administrador está autenticado y RLS lo deja leerla. El cliente no:
-- es anónimo y no tiene (ni debe tener) permiso de lectura sobre los
-- pedidos de nadie, incluido el suyo.
--
-- La solución es no dejarlo escuchar la tabla, sino emitir un aviso a un
-- canal cuyo nombre ES su propio token secreto: `pedido:<public_token>`.
--
-- Por qué el canal es público y no privado:
--   Un canal privado se autoriza con políticas RLS sobre realtime.messages,
--   una tabla del rol supabase_realtime_admin que el editor SQL no puede
--   modificar. Pero aquí la protección no la daría esa política, sino el
--   nombre del canal: es un UUID de 122 bits que solo conoce quien tiene
--   el enlace del pedido. Es exactamente la misma llave que ya protege a
--   get_order_public().
--
--   Y aunque alguien adivinara un token, no ganaría nada: el aviso va
--   VACÍO. Solo dice "algo cambió". Los datos siguen saliendo únicamente
--   por get_order_public(), que decide qué puede ver el cliente.
-- =============================================================

create or replace function public.notify_order_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo interesa avisar de lo que el cliente ve en su pantalla.
  if new.status          is distinct from old.status
  or new.payment_status  is distinct from old.payment_status
  or new.delivery_fee    is distinct from old.delivery_fee
  or new.delivery_quoted is distinct from old.delivery_quoted
  or new.total           is distinct from old.total then
    perform realtime.send(
      jsonb_build_object('at', now()),      -- carga sin datos, a propósito
      'actualizado',                        -- evento
      'pedido:' || new.public_token::text,  -- canal = el token del cliente
      false                                 -- canal público
    );
  end if;

  return null;
end;
$$;

drop trigger if exists orders_notify_change on public.orders;
create trigger orders_notify_change
  after update on public.orders
  for each row execute function public.notify_order_change();
