-- =============================================================
-- S&S Burger — Editar un pedido ya creado
--
-- Pasa todo el tiempo: el cliente llama para agregar una gaseosa, se
-- equivocó en la dirección, o el encargado tecleó mal un pedido manual.
--
-- Igual que al crearlo, los precios NO vienen del navegador: se vuelven
-- a leer de la tabla de productos y el subtotal se recalcula aquí.
-- =============================================================

create or replace function public.edit_order(p_order_id uuid, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order    public.orders;
  v_item     jsonb;
  v_items    jsonb;
  v_product  public.products;
  v_qty      int;
  v_subtotal int := 0;
  v_new_type public.order_type;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede editar pedidos'
      using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'El pedido no existe' using errcode = 'P0001';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'Un pedido cancelado no se edita' using errcode = 'P0001';
  end if;

  -- Cambiar el contenido de un pedido ya cobrado altera una cifra que
  -- alguien ya pagó. Se obliga a deshacer el pago primero, para que el
  -- cambio quede explícito y no silencioso.
  if v_order.payment_status = 'paid' then
    raise exception 'Este pedido ya está cobrado. Deshaz el pago antes de editarlo.'
      using errcode = 'P0001';
  end if;

  v_new_type := coalesce(nullif(payload->>'order_type','')::public.order_type, v_order.order_type);

  -- ---------- datos del cliente y la entrega ----------
  update public.orders set
    customer_name = coalesce(
      nullif(btrim(coalesce(payload->>'customer_name','')), ''), customer_name),

    customer_phone = case
      when payload ? 'customer_phone'
        then nullif(regexp_replace(coalesce(payload->>'customer_phone',''), '[^0-9]', '', 'g'), '')
      else customer_phone end,

    order_type = v_new_type,

    delivery_address = case
      when v_new_type = 'pickup' then null
      when payload ? 'delivery_address'
        then nullif(btrim(coalesce(payload->>'delivery_address','')), '')
      else delivery_address end,

    delivery_notes = case
      when v_new_type = 'pickup' then null
      when payload ? 'delivery_notes'
        then nullif(btrim(coalesce(payload->>'delivery_notes','')), '')
      else delivery_notes end,

    customer_notes = case
      when payload ? 'customer_notes'
        then nullif(btrim(coalesce(payload->>'customer_notes','')), '')
      else customer_notes end,

    -- Al pasar a "recoge" no hay flete. Al pasar a domicilio, hay que
    -- volver a cotizarlo: la dirección es nueva.
    delivery_zone_id = case when v_new_type = 'pickup' then null else delivery_zone_id end,
    delivery_fee     = case when v_new_type = 'pickup' then 0 else delivery_fee end,
    delivery_quoted  = case
      when v_new_type = 'pickup' then true
      when v_order.order_type = 'pickup' and v_new_type = 'delivery' then false
      else delivery_quoted end
  where id = p_order_id;

  -- ---------- productos ----------
  v_items := payload->'items';

  if v_items is not null and jsonb_typeof(v_items) = 'array' then
    if jsonb_array_length(v_items) = 0 then
      raise exception 'El pedido no puede quedar sin productos' using errcode = 'P0001';
    end if;
    if jsonb_array_length(v_items) > 50 then
      raise exception 'Demasiados productos en un solo pedido' using errcode = 'P0001';
    end if;

    delete from public.order_items where order_id = p_order_id;

    for v_item in select * from jsonb_array_elements(v_items)
    loop
      v_qty := coalesce((v_item->>'qty')::int, 0);
      if v_qty <= 0 or v_qty > 99 then
        raise exception 'Cantidad inválida' using errcode = 'P0001';
      end if;

      -- El administrador sí puede agregar algo marcado como agotado:
      -- quizá quedaba uno.
      select * into v_product
        from public.products
       where id = nullif(v_item->>'product_id','')::uuid
         and is_active;

      if not found then
        raise exception 'Uno de los productos ya no existe' using errcode = 'P0001';
      end if;

      insert into public.order_items (order_id, product_id, product_name, unit_price, qty, notes)
      values (
        p_order_id, v_product.id, v_product.name, v_product.price, v_qty,
        nullif(btrim(coalesce(v_item->>'notes','')), '')
      );

      v_subtotal := v_subtotal + (v_product.price * v_qty);
    end loop;

    -- El trigger orders_sync_total recalcula total = subtotal + domicilio.
    update public.orders set subtotal = v_subtotal where id = p_order_id;
  end if;

  select * into v_order from public.orders where id = p_order_id;

  insert into public.order_events (order_id, from_status, to_status, note, actor)
  values (p_order_id, v_order.status, v_order.status, 'Pedido editado', auth.uid());

  return jsonb_build_object(
    'subtotal',        v_order.subtotal,
    'delivery_fee',    v_order.delivery_fee,
    'delivery_quoted', v_order.delivery_quoted,
    'total',           v_order.total
  );
end;
$$;

revoke all on function public.edit_order(uuid, jsonb) from public;
grant execute on function public.edit_order(uuid, jsonb) to authenticated;
