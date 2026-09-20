-- =============================================================
-- S&S Burger — El valor del domicilio lo define el local
--
-- Antes el cliente elegía su zona ("Cercano" / "Lejano") en el checkout.
-- Está mal por dos razones: el cliente no conoce las zonas del negocio,
-- y aunque las conociera, marcar "Cercano" siempre le sale más barato.
--
-- Ahora el cliente solo escribe la dirección. El pedido entra con el
-- domicilio SIN cotizar y el local le pone el valor viendo la dirección.
-- =============================================================

-- ---------- 1. marca de "ya cotizado" ----------
-- No basta con mirar si delivery_fee = 0: un domicilio gratis es una
-- decisión válida del local y hay que poder distinguirla de "aún no lo han
-- mirado". Los pedidos que ya existen quedan como cotizados.
alter table public.orders
  add column if not exists delivery_quoted boolean not null default true;

comment on column public.orders.delivery_quoted is
  'false = el local todavía no le ha puesto valor al domicilio';

-- ---------- 2. el total siempre es subtotal + domicilio ----------
-- Al volverlo una invariante de la base, cambiar el valor del domicilio
-- no puede dejar el total desactualizado, venga el cambio de donde venga.
create or replace function public.sync_order_total()
returns trigger
language plpgsql
as $$
begin
  new.total := new.subtotal + new.delivery_fee;
  return new;
end;
$$;

drop trigger if exists orders_sync_total on public.orders;
create trigger orders_sync_total
  before insert or update on public.orders
  for each row execute function public.sync_order_total();

-- ---------- 3. create_order: el pedido online ya no trae zona ----------
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

    if v_admin then
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
  on conflict (day) do update set last_number = order_counters.last_number + 1
  returning last_number into v_number;

  v_code := to_char(public.today_bogota(), 'YYYYMMDD') || '-' || lpad(v_number::text, 3, '0');

  -- ---------- pago ----------
  v_timing := coalesce(nullif(payload->>'payment_timing','')::public.payment_timing, 'on_delivery');
  v_paid   := v_admin and coalesce((payload->>'mark_paid')::boolean, false);

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

-- ---------- 4. el local le pone precio al domicilio ----------
-- Va como función y no como UPDATE suelto para que la zona y la tarifa
-- no se puedan separar: o se aplica una zona real, o un valor a mano.
create or replace function public.quote_delivery(
  p_order_id uuid,
  p_zone_id  uuid default null,
  p_fee      integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zone  public.delivery_zones;
  v_fee   integer;
  v_order public.orders;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede cotizar el domicilio'
      using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'El pedido no existe' using errcode = 'P0001';
  end if;

  if v_order.order_type <> 'delivery' then
    raise exception 'Este pedido no es a domicilio' using errcode = 'P0001';
  end if;

  if p_zone_id is not null then
    select * into v_zone from public.delivery_zones where id = p_zone_id;
    if not found then
      raise exception 'La zona no existe' using errcode = 'P0001';
    end if;
    v_fee := v_zone.fee;
  else
    v_fee := coalesce(p_fee, 0);
  end if;

  if v_fee < 0 then
    raise exception 'El valor del domicilio no puede ser negativo' using errcode = 'P0001';
  end if;

  update public.orders
     set delivery_zone_id = p_zone_id,
         delivery_fee     = v_fee,
         delivery_quoted  = true
   where id = p_order_id
  returning * into v_order;

  return jsonb_build_object(
    'delivery_fee', v_order.delivery_fee,
    'total',        v_order.total
  );
end;
$$;

revoke all on function public.quote_delivery(uuid, uuid, integer) from public;
grant execute on function public.quote_delivery(uuid, uuid, integer) to authenticated;

-- ---------- 5. el cliente ve si el domicilio ya está cotizado ----------
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
    'delivery_quoted', o.delivery_quoted,
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
