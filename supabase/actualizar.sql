-- =============================================================
-- S&S Burger — Corrección: el canal decide, no quién mira
-- Seguro de ejecutar varias veces.
-- =============================================================

-- =============================================================
-- S&S Burger — El canal decide el comportamiento, no quién mira
--
-- Bug encontrado probando: si el dueño hacía un pedido desde la
-- carta pública teniendo su sesión de administrador abierta en el
-- mismo navegador, las cookies viajaban también en el checkout y
-- create_order lo trataba como un pedido tomado por el local.
-- Resultado: el domicilio entraba como "ya cotizado" y el panel
-- nunca pedía el valor del flete.
--
-- La raíz: la función decidía según QUIÉN hace la petición
-- (is_admin()) en vez de según POR DÓNDE entró el pedido (channel).
-- Un pedido que llega por la carta pública es un pedido de cliente,
-- lo esté mirando quien lo esté mirando.
--
-- is_admin() queda solo para lo que de verdad es un permiso:
-- autorizar el uso del canal manual.
-- =============================================================

-- ---------- create_order ----------
create or replace function public.create_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Solo autoriza el uso del canal manual. El comportamiento del pedido
  -- lo decide v_channel, no quién esté haciendo la petición.
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
  v_quoted   boolean := true;
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

    if v_channel = 'manual' then
      -- El local sí elige la zona al tomar un pedido por teléfono.
      v_zone_id := nullif(payload->>'delivery_zone_id', '')::uuid;
      if v_zone_id is not null then
        select * into v_zone from public.delivery_zones where id = v_zone_id and is_active;
        if not found then
          raise exception 'La zona de domicilio no está disponible' using errcode = 'P0001';
        end if;
        v_fee := v_zone.fee;
      end if;
    else
      -- El cliente no cotiza su propio domicilio: lo define el local.
      v_quoted := false;
    end if;
  end if;

  -- ---------- anti-spam ----------
  -- Se aplica a todo lo que entra por la carta, aunque quien pida
  -- tenga sesión de administrador abierta en ese navegador.
  if v_channel = 'online' and v_phone is not null then
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
  on conflict (day) do update set last_number = order_counters.last_number + 1
  returning last_number into v_number;

  v_code := to_char(public.today_bogota(), 'YYYYMMDD') || '-' || lpad(v_number::text, 3, '0');

  -- ---------- pago ----------
  v_timing := coalesce(nullif(payload->>'payment_timing','')::public.payment_timing, 'on_delivery');
  v_paid   := v_channel = 'manual' and coalesce((payload->>'mark_paid')::boolean, false);

  -- ---------- cabecera ----------
  insert into public.orders (
    code, channel, order_type, customer_name, customer_phone,
    delivery_zone_id, delivery_address, delivery_notes, customer_notes,
    subtotal, delivery_fee, total, delivery_quoted,
    status, payment_status, payment_timing, payment_method, payment_ref,
    cash_received, paid_at
  ) values (
    v_code, v_channel, v_type, v_name, v_phone,
    v_zone_id, v_address,
    nullif(btrim(coalesce(payload->>'delivery_notes','')), ''),
    nullif(btrim(coalesce(payload->>'customer_notes','')), ''),
    0, v_fee, 0, v_quoted,
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
       and (is_available or v_channel = 'manual');

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

  -- ---------- pedido mínimo (sobre la comida, sin contar el flete) ----------
  if v_channel = 'online' and v_subtotal < coalesce(v_settings.min_order, 0) then
    raise exception 'El pedido mínimo es de $%', coalesce(v_settings.min_order, 0)
      using errcode = 'P0001';
  end if;

  -- El trigger orders_sync_total recalcula total = subtotal + delivery_fee.
  update public.orders
     set subtotal = v_subtotal,
         accepted_at = case when v_channel = 'manual' then now() else null end
   where id = v_order_id;

  v_total := v_subtotal + v_fee;

  return jsonb_build_object(
    'id',           v_order_id,
    'code',         v_code,
    'public_token', v_token,
    'subtotal',     v_subtotal,
    'delivery_fee', v_fee,
    'delivery_quoted', v_quoted,
    'total',        v_total
  );
end;
$$;

revoke all on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to anon, authenticated;
