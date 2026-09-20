-- =============================================================
-- S&S Burger — Funciones de negocio
--
-- create_order() es la ÚNICA puerta de entrada para crear pedidos.
-- Ignora cualquier precio que mande el navegador y lo recalcula
-- leyendo la tabla de productos. Sin esto, cualquiera podría pedir
-- una hamburguesa por $1.000 editando la petición.
-- =============================================================

-- Fecha "de hoy" en hora de Colombia, no en UTC.
-- Sin esto el consecutivo diario cambiaría a las 7 de la noche.
create or replace function public.today_bogota()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Bogota')::date;
$$;

-- -------------------------------------------------------------
-- create_order(payload jsonb) -> jsonb
--
-- payload esperado:
-- {
--   "channel": "online" | "manual",            (manual = solo admin)
--   "customer_name": "Juan",
--   "customer_phone": "3001234567",
--   "order_type": "pickup" | "delivery",
--   "delivery_zone_id": "uuid|null",
--   "delivery_address": "Calle 1 #2-3",
--   "delivery_notes": "casa blanca, portón negro",
--   "customer_notes": "sin cebolla",
--   "payment_timing": "prepaid" | "on_delivery",
--   "payment_method": "efectivo" | "nequi" | ...,   (opcional)
--   "cash_received": 50000,                          (opcional, para la devuelta)
--   "mark_paid": true,                               (solo admin)
--   "items": [{ "product_id": "uuid", "qty": 2, "notes": "sin salsa" }]
-- }
-- -------------------------------------------------------------
create or replace function public.create_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin    boolean := public.is_admin();
  v_settings public.store_settings;
  v_channel  public.order_channel;
  v_type     public.order_type;
  v_timing   public.payment_timing;
  v_name     text;
  v_phone    text;
  v_zone     public.delivery_zones;
  v_zone_id  uuid;
  v_address  text;
  v_items    jsonb;
  v_item     jsonb;
  v_product  public.products;
  v_qty      int;
  v_subtotal int := 0;
  v_fee      int := 0;
  v_total    int;
  v_recent   int;
  v_number   int;
  v_code     text;
  v_order_id uuid;
  v_token    uuid;
  v_paid     boolean;
begin
  select * into v_settings from public.store_settings where id limit 1;

  -- ---------- canal ----------
  v_channel := coalesce(nullif(payload->>'channel','')::public.order_channel, 'online');
  if v_channel = 'manual' and not v_admin then
    raise exception 'Solo el administrador puede registrar pedidos manuales'
      using errcode = '42501';
  end if;

  if v_channel = 'online' and not coalesce(v_settings.accepting_orders, true) then
    raise exception '%', coalesce(v_settings.closed_message, 'La tienda no está recibiendo pedidos en este momento')
      using errcode = 'P0001';
  end if;

  -- ---------- cliente ----------
  v_name := nullif(btrim(coalesce(payload->>'customer_name', '')), '');
  if v_name is null then
    raise exception 'Falta el nombre del cliente' using errcode = 'P0001';
  end if;
  if length(v_name) > 80 then
    v_name := left(v_name, 80);
  end if;

  v_phone := nullif(regexp_replace(coalesce(payload->>'customer_phone', ''), '[^0-9]', '', 'g'), '');
  if v_channel = 'online' and (v_phone is null or length(v_phone) < 7) then
    raise exception 'El teléfono no es válido' using errcode = 'P0001';
  end if;

  -- ---------- tipo de entrega ----------
  v_type := coalesce(nullif(payload->>'order_type','')::public.order_type, 'pickup');

  if v_channel = 'online' then
    if v_type = 'delivery' and not coalesce(v_settings.delivery_enabled, true) then
      raise exception 'El domicilio no está disponible en este momento' using errcode = 'P0001';
    end if;
    if v_type = 'pickup' and not coalesce(v_settings.pickup_enabled, true) then
      raise exception 'Recoger en el local no está disponible en este momento' using errcode = 'P0001';
    end if;
  end if;

  if v_type = 'delivery' then
    v_address := nullif(btrim(coalesce(payload->>'delivery_address', '')), '');
    if v_address is null then
      raise exception 'Falta la dirección de entrega' using errcode = 'P0001';
    end if;

    v_zone_id := nullif(payload->>'delivery_zone_id', '')::uuid;
    if v_zone_id is not null then
      select * into v_zone from public.delivery_zones where id = v_zone_id and is_active;
      if not found then
        raise exception 'La zona de domicilio no está disponible' using errcode = 'P0001';
      end if;
      v_fee := v_zone.fee;
    elsif exists (select 1 from public.delivery_zones where is_active) then
      raise exception 'Debes elegir la zona de domicilio' using errcode = 'P0001';
    end if;
  end if;

  -- ---------- anti-spam ----------
  -- Un formulario público sin fricción se llena de pedidos falsos.
  if not v_admin and v_phone is not null then
    select count(*) into v_recent
      from public.orders
     where customer_phone = v_phone
       and created_at > now() - interval '10 minutes';
    if v_recent >= 5 then
      raise exception 'Ya enviaste varios pedidos seguidos. Espera unos minutos o llámanos.'
        using errcode = 'P0001';
    end if;
  end if;

  -- ---------- items ----------
  v_items := coalesce(payload->'items', '[]'::jsonb);
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'El pedido no tiene productos' using errcode = 'P0001';
  end if;
  if jsonb_array_length(v_items) > 50 then
    raise exception 'Demasiados productos en un solo pedido' using errcode = 'P0001';
  end if;

  -- ---------- consecutivo del día ----------
  insert into public.order_counters (day, last_number)
  values (public.today_bogota(), 1)
  -- En ON CONFLICT la tabla se referencia por su nombre sin esquema.
  on conflict (day) do update set last_number = order_counters.last_number + 1
  returning last_number into v_number;

  v_code := to_char(public.today_bogota(), 'YYYYMMDD') || '-' || lpad(v_number::text, 3, '0');

  -- ---------- pago ----------
  v_timing := coalesce(nullif(payload->>'payment_timing','')::public.payment_timing, 'on_delivery');
  v_paid   := v_admin and coalesce((payload->>'mark_paid')::boolean, false);

  -- ---------- cabecera (con totales en 0, se ajustan al final) ----------
  insert into public.orders (
    code, channel, order_type, customer_name, customer_phone,
    delivery_zone_id, delivery_address, delivery_notes, customer_notes,
    subtotal, delivery_fee, total,
    status, payment_status, payment_timing, payment_method, payment_ref,
    cash_received, paid_at
  ) values (
    v_code, v_channel, v_type, v_name, v_phone,
    v_zone_id, v_address,
    nullif(btrim(coalesce(payload->>'delivery_notes','')), ''),
    nullif(btrim(coalesce(payload->>'customer_notes','')), ''),
    0, v_fee, 0,
    case when v_channel = 'manual' then 'accepted'::public.order_status
         else 'pending'::public.order_status end,
    case when v_paid then 'paid'::public.payment_status
         else 'pending'::public.payment_status end,
    v_timing,
    nullif(btrim(coalesce(payload->>'payment_method','')), ''),
    nullif(btrim(coalesce(payload->>'payment_ref','')), ''),
    nullif(payload->>'cash_received','')::int,
    case when v_paid then now() else null end
  )
  returning id, public_token into v_order_id, v_token;

  -- ---------- líneas: el precio sale de la base, nunca del navegador ----------
  for v_item in select * from jsonb_array_elements(v_items)
  loop
    v_qty := coalesce((v_item->>'qty')::int, 0);
    if v_qty <= 0 or v_qty > 99 then
      raise exception 'Cantidad inválida' using errcode = 'P0001';
    end if;

    select * into v_product
      from public.products
     where id = nullif(v_item->>'product_id','')::uuid
       and is_active
       and (is_available or v_admin);

    if not found then
      raise exception 'Uno de los productos ya no está disponible' using errcode = 'P0001';
    end if;

    insert into public.order_items (order_id, product_id, product_name, unit_price, qty, notes)
    values (
      v_order_id, v_product.id, v_product.name, v_product.price, v_qty,
      nullif(btrim(coalesce(v_item->>'notes','')), '')
    );

    v_subtotal := v_subtotal + (v_product.price * v_qty);
  end loop;

  -- ---------- pedido mínimo ----------
  if v_channel = 'online' and v_subtotal < coalesce(v_settings.min_order, 0) then
    raise exception 'El pedido mínimo es de $%', coalesce(v_settings.min_order, 0)
      using errcode = 'P0001';
  end if;

  v_total := v_subtotal + v_fee;

  update public.orders
     set subtotal = v_subtotal,
         total    = v_total,
         accepted_at = case when v_channel = 'manual' then now() else null end
   where id = v_order_id;

  return jsonb_build_object(
    'id',           v_order_id,
    'code',         v_code,
    'public_token', v_token,
    'subtotal',     v_subtotal,
    'delivery_fee', v_fee,
    'total',        v_total
  );
end;
$$;

revoke all on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to anon, authenticated;

-- -------------------------------------------------------------
-- get_order_public(token) -> jsonb
-- Deja al cliente seguir su pedido con el enlace que recibió,
-- sin exponerle la tabla de pedidos ni los datos de nadie más.
-- -------------------------------------------------------------
create or replace function public.get_order_public(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'code',           o.code,
    'status',         o.status,
    'order_type',     o.order_type,
    'customer_name',  o.customer_name,
    'delivery_address', o.delivery_address,
    'customer_notes', o.customer_notes,
    'subtotal',       o.subtotal,
    'delivery_fee',   o.delivery_fee,
    'total',          o.total,
    'payment_status', o.payment_status,
    'payment_method', o.payment_method,
    'payment_ref',    o.payment_ref,
    'paid_at',        o.paid_at,
    'created_at',     o.created_at,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'product_name', i.product_name,
               'unit_price',   i.unit_price,
               'qty',          i.qty,
               'notes',        i.notes,
               'line_total',   i.line_total
             ) order by i.product_name), '[]'::jsonb)
        from public.order_items i where i.order_id = o.id
    )
  )
  from public.orders o
  where o.public_token = p_token;
$$;

revoke all on function public.get_order_public(uuid) from public;
grant execute on function public.get_order_public(uuid) to anon, authenticated;

-- -------------------------------------------------------------
-- Bitácora y marcas de tiempo automáticas
-- El admin solo hace UPDATE del estado; el resto se registra solo.
-- -------------------------------------------------------------
create or replace function public.track_order_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    new.accepted_at  := coalesce(new.accepted_at,  case when new.status = 'accepted'  then now() end);
    new.ready_at     := coalesce(new.ready_at,     case when new.status = 'ready'     then now() end);
    new.delivered_at := coalesce(new.delivered_at, case when new.status = 'delivered' then now() end);

    insert into public.order_events (order_id, from_status, to_status, note, actor)
    values (new.id, old.status, new.status, new.cancel_reason, auth.uid());
  end if;

  if new.payment_status is distinct from old.payment_status then
    new.paid_at := case when new.payment_status = 'paid' then coalesce(new.paid_at, now()) else null end;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_track_changes on public.orders;
create trigger orders_track_changes
  before update on public.orders
  for each row execute function public.track_order_changes();
