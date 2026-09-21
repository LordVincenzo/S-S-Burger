-- =============================================================
-- S&S Burger — Instalación completa
--
-- Generado con scripts/build-sql.sh — no editar a mano.
-- Sirve para montar un proyecto NUEVO desde cero.
-- Si tu base ya está instalada, ejecuta solo la migración que falte.
-- =============================================================

-- >>>>>>>>>>>>>>>>>>>>  supabase/migrations/0001_schema.sql  <<<<<<<<<<<<<<<<<<<<

-- =============================================================
-- S&S Burger — Esquema base
-- Todos los montos son enteros en pesos colombianos (sin decimales).
-- =============================================================

create extension if not exists pgcrypto;

-- ---------- helpers ----------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Administradores: cualquier usuario de auth.users listado aquí entra al panel.
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  label      text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

-- ---------- catálogo ----------

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.categories(id) on delete restrict,
  name         text not null,
  slug         text not null unique,
  description  text,
  price        integer not null check (price >= 0),
  image_url    text,
  -- is_available = "hay hoy"  |  is_active = "existe en la carta"
  is_available boolean not null default true,
  is_active    boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists products_category_idx on public.products (category_id, sort_order);

-- ---------- domicilios ----------

create table if not exists public.delivery_zones (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  fee        integer not null check (fee >= 0),
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- configuración del negocio (fila única) ----------

create table if not exists public.store_settings (
  id                   boolean primary key default true check (id),
  store_name           text not null default 'S&S Burger',
  whatsapp_phone       text,
  store_address        text,
  accepting_orders     boolean not null default true,
  delivery_enabled     boolean not null default true,
  pickup_enabled       boolean not null default true,
  min_order            integer not null default 0 check (min_order >= 0),
  prep_time_minutes    integer not null default 25,
  payment_instructions text,
  closed_message       text default 'Estamos cerrados en este momento. ¡Te esperamos pronto!',
  updated_at           timestamptz not null default now()
);

-- ---------- pedidos ----------

do $$ begin
  create type public.order_status as enum (
  'pending',     -- entró, el admin todavía no lo acepta
  'accepted',    -- aceptado, en cola
  'preparing',   -- en preparación
  'ready',       -- listo para recoger / despachar
  'on_the_way',  -- en camino (solo domicilio)
  'delivered',   -- entregado
  'cancelled'
);
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'paid');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.order_channel as enum ('online', 'manual');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.order_type as enum ('pickup', 'delivery');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.payment_timing as enum ('prepaid', 'on_delivery');
exception when duplicate_object then null;
end $$;

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  -- código legible del día: 20260920-001
  code             text not null unique,
  -- token secreto: deja al cliente seguir su pedido sin crear cuenta
  public_token     uuid not null unique default gen_random_uuid(),

  channel          public.order_channel  not null default 'online',
  order_type       public.order_type     not null,

  customer_name    text not null,
  customer_phone   text,

  delivery_zone_id uuid references public.delivery_zones(id) on delete set null,
  delivery_address text,
  delivery_notes   text,
  customer_notes   text,

  subtotal         integer not null check (subtotal >= 0),
  delivery_fee     integer not null default 0 check (delivery_fee >= 0),
  total            integer not null check (total >= 0),

  status           public.order_status not null default 'pending',
  cancel_reason    text,

  payment_status   public.payment_status not null default 'pending',
  payment_timing   public.payment_timing not null default 'on_delivery',
  payment_method   text,
  payment_ref      text,
  cash_received    integer check (cash_received is null or cash_received >= 0),
  paid_at          timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  accepted_at      timestamptz,
  ready_at         timestamptz,
  delivered_at     timestamptz,

  constraint delivery_needs_address
    check (order_type <> 'delivery' or delivery_address is not null),
  -- el pedido online siempre trae teléfono; el manual puede no tenerlo
  constraint online_needs_phone
    check (channel <> 'online' or (customer_phone is not null and length(customer_phone) >= 7))
);

create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_open_idx on public.orders (status) where status not in ('delivered', 'cancelled');

create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  -- se conserva la referencia, pero nombre y precio quedan congelados:
  -- cambiar el precio de un producto no debe reescribir el historial.
  product_id   uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price   integer not null check (unit_price >= 0),
  qty          integer not null check (qty > 0 and qty <= 99),
  notes        text,
  line_total   integer generated always as (unit_price * qty) stored
);

create index if not exists order_items_order_idx on public.order_items (order_id);

-- bitácora de cambios de estado
create table if not exists public.order_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status   public.order_status,
  note        text,
  actor       uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists order_events_order_idx on public.order_events (order_id, created_at);

-- consecutivo diario para el código del pedido
create table if not exists public.order_counters (
  day         date primary key,
  last_number integer not null default 0
);

-- ---------- triggers updated_at ----------

drop trigger if exists categories_touch on public.categories;
create trigger categories_touch     before update on public.categories     for each row execute function public.touch_updated_at();
drop trigger if exists products_touch on public.products;
create trigger products_touch       before update on public.products       for each row execute function public.touch_updated_at();
drop trigger if exists delivery_zones_touch on public.delivery_zones;
create trigger delivery_zones_touch before update on public.delivery_zones for each row execute function public.touch_updated_at();
drop trigger if exists store_settings_touch on public.store_settings;
create trigger store_settings_touch before update on public.store_settings for each row execute function public.touch_updated_at();
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch         before update on public.orders         for each row execute function public.touch_updated_at();

-- >>>>>>>>>>>>>>>>>>>>  supabase/migrations/0002_rls.sql  <<<<<<<<<<<<<<<<<<<<

-- =============================================================
-- S&S Burger — Row Level Security
--
-- Regla general:
--   * El público puede LEER la carta y la configuración de la tienda.
--   * El público NO toca la tabla de pedidos directamente: solo puede
--     crear pedidos a través de la función create_order(), que recalcula
--     los precios en el servidor, y consultar EL SUYO con su token.
--   * El administrador tiene acceso completo.
-- =============================================================

alter table public.admins         enable row level security;
alter table public.categories     enable row level security;
alter table public.products       enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.order_events   enable row level security;
alter table public.order_counters enable row level security;

-- ---------- admins ----------
-- Sin políticas: nadie la lee por API. is_admin() es security definer.

-- ---------- catálogo (lectura pública) ----------

drop policy if exists "categorias visibles para todos" on public.categories;
create policy "categorias visibles para todos"
  on public.categories for select
  using (is_active or public.is_admin());

drop policy if exists "admin administra categorias" on public.categories;
create policy "admin administra categorias"
  on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "productos visibles para todos" on public.products;
create policy "productos visibles para todos"
  on public.products for select
  using (is_active or public.is_admin());

drop policy if exists "admin administra productos" on public.products;
create policy "admin administra productos"
  on public.products for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "zonas visibles para todos" on public.delivery_zones;
create policy "zonas visibles para todos"
  on public.delivery_zones for select
  using (is_active or public.is_admin());

drop policy if exists "admin administra zonas" on public.delivery_zones;
create policy "admin administra zonas"
  on public.delivery_zones for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- configuración ----------

drop policy if exists "configuracion visible para todos" on public.store_settings;
create policy "configuracion visible para todos"
  on public.store_settings for select
  using (true);

drop policy if exists "admin edita configuracion" on public.store_settings;
create policy "admin edita configuracion"
  on public.store_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- pedidos (solo administrador) ----------
-- El cliente nunca lee esta tabla directamente: usa get_order_public(token).

drop policy if exists "admin ve pedidos" on public.orders;
create policy "admin ve pedidos"
  on public.orders for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin ve items" on public.order_items;
create policy "admin ve items"
  on public.order_items for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin ve bitacora" on public.order_events;
create policy "admin ve bitacora"
  on public.order_events for select
  using (public.is_admin());

-- order_counters queda sin políticas: solo lo toca create_order().

-- ---------- realtime ----------
-- El panel se entera de los pedidos nuevos sin recargar.
-- Realtime respeta RLS, así que solo el administrador autenticado recibe los eventos.
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null;
end $$;

-- >>>>>>>>>>>>>>>>>>>>  supabase/migrations/0003_functions.sql  <<<<<<<<<<<<<<<<<<<<

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

-- >>>>>>>>>>>>>>>>>>>>  supabase/migrations/0004_storage.sql  <<<<<<<<<<<<<<<<<<<<

-- =============================================================
-- S&S Burger — Almacenamiento de imágenes de productos
--
-- Con esto el administrador sube las fotos desde el panel en vez de
-- copiarlas a /public/img y volver a desplegar el proyecto.
-- =============================================================

insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do nothing;

-- Las fotos de la carta son públicas: cualquiera las ve.
drop policy if exists "fotos de productos visibles" on storage.objects;
create policy "fotos de productos visibles"
  on storage.objects for select
  using (bucket_id = 'productos');

-- Subir, reemplazar y borrar queda solo para el administrador.
drop policy if exists "admin sube fotos" on storage.objects;
create policy "admin sube fotos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'productos' and public.is_admin());

drop policy if exists "admin reemplaza fotos" on storage.objects;
create policy "admin reemplaza fotos"
  on storage.objects for update to authenticated
  using (bucket_id = 'productos' and public.is_admin())
  with check (bucket_id = 'productos' and public.is_admin());

drop policy if exists "admin borra fotos" on storage.objects;
create policy "admin borra fotos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'productos' and public.is_admin());

-- >>>>>>>>>>>>>>>>>>>>  supabase/migrations/0005_domicilio_lo_define_el_local.sql  <<<<<<<<<<<<<<<<<<<<

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

-- >>>>>>>>>>>>>>>>>>>>  supabase/migrations/0006_seguimiento_en_vivo.sql  <<<<<<<<<<<<<<<<<<<<

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

-- >>>>>>>>>>>>>>>>>>>>  supabase/migrations/0007_editar_pedidos.sql  <<<<<<<<<<<<<<<<<<<<

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

-- >>>>>>>>>>>>>>>>>>>>  supabase/migrations/0008_canal_decide.sql  <<<<<<<<<<<<<<<<<<<<

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

-- >>>>>>>>>>>>>>>>>>>>  supabase/migrations/0009_ciudad_por_direccion.sql  <<<<<<<<<<<<<<<<<<<<

-- =============================================================
-- S&S Burger — La ciudad es de la dirección, no del negocio
--
-- El local reparte en más de un municipio (Soledad y Barranquilla), y
-- ahí una "ciudad del negocio" no sirve de nada: mirando "Cra 17d
-- #45-12" nadie sabe cuál de los dos es, y justamente de eso depende
-- la tarifa del domicilio y a dónde navega el repartidor.
--
-- Así que la ciudad pasa a vivir en dos sitios:
--   * En la zona de domicilio, porque cada municipio tiene su tarifa.
--   * En el pedido, porque es lo que el cliente declara al pedir.
--
-- El cliente sigue sin cotizarse a sí mismo: solo dice dónde vive, que
-- es el único dato que nadie puede saber por él.
-- =============================================================

alter table public.delivery_zones
  add column if not exists city text;

comment on column public.delivery_zones.city is
  'Municipio al que aplica esta zona. Null = vale para cualquiera.';

alter table public.orders
  add column if not exists delivery_city text;

comment on column public.orders.delivery_city is
  'Municipio declarado por el cliente. Decide la tarifa y la navegación.';

-- ---------- create_order: recibe y valida el municipio ----------
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
  v_city     text;
  v_cities   text[];
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

    v_city := nullif(btrim(coalesce(payload->>'delivery_city', '')), '');

    if v_channel = 'manual' then
      -- El local sí elige la zona al tomar un pedido por teléfono.
      v_zone_id := nullif(payload->>'delivery_zone_id', '')::uuid;
      if v_zone_id is not null then
        select * into v_zone from public.delivery_zones where id = v_zone_id and is_active;
        if not found then
          raise exception 'La zona de domicilio no está disponible' using errcode = 'P0001';
        end if;
        v_fee := v_zone.fee;
        v_city := coalesce(v_city, v_zone.city);
      end if;
    else
      -- El cliente no le pone precio a su domicilio: eso lo hace el local
      -- viendo la dirección. Pero sí dice en qué municipio está, porque
      -- es lo único que nadie puede adivinar por él y de lo que depende
      -- la tarifa.
      v_quoted := false;

      select array_agg(distinct city) into v_cities
        from public.delivery_zones
       where is_active and city is not null;

      if v_cities is not null and array_length(v_cities, 1) > 0 then
        if v_city is null then
          raise exception 'Falta decir en qué municipio estás' using errcode = 'P0001';
        end if;
        if not (v_city = any (v_cities)) then
          raise exception 'Por ahora no hacemos domicilios a %', v_city using errcode = 'P0001';
        end if;
      end if;
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
    delivery_zone_id, delivery_address, delivery_city, delivery_notes, customer_notes,
    subtotal, delivery_fee, total, delivery_quoted,
    status, payment_status, payment_timing, payment_method, payment_ref,
    cash_received, paid_at
  ) values (
    v_code, v_channel, v_type, v_name, v_phone,
    v_zone_id, v_address, v_city,
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

  -- ---------- pedido mínimo (sobre la comida, sin contar el domicilio) ----------
  if v_channel = 'online' and v_subtotal < coalesce(v_settings.min_order, 0) then
    raise exception 'El pedido mínimo es de $%', coalesce(v_settings.min_order, 0)
      using errcode = 'P0001';
  end if;

  -- El trigger orders_sync_total recalcula total = subtotal + domicilio.
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

-- ---------- quote_delivery: la zona completa el municipio ----------
-- Si el pedido entró sin municipio, la zona que aplica el local lo rellena.
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
         delivery_city    = coalesce(delivery_city, v_zone.city),
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

-- ---------- el municipio viaja al seguimiento del cliente ----------
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
    'delivery_city',  o.delivery_city,
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

-- >>>>>>>>>>>>>>>>>>>>  supabase/seed.sql  <<<<<<<<<<<<<<<<<<<<

-- =============================================================
-- S&S Burger — Datos iniciales
-- Migra la carta que hoy está escrita a mano en legacy/src/App.js
-- =============================================================

insert into public.store_settings (id, store_name, whatsapp_phone, accepting_orders, payment_instructions)
values (true, 'S&S Burger', null, true,
        'Efectivo, Nequi, Bancolombia o Daviplata. Al confirmar te enviamos los datos.')
on conflict (id) do nothing;

-- ---------- categorías ----------
insert into public.categories (name, slug, sort_order) values
  ('Combos',      'combos',      1),
  ('Burgers',     'burgers',     2),
  ('Hot Dogs',    'hot-dogs',    3),
  ('Salchipapas', 'salchipapas', 4),
  ('Bebidas',     'bebidas',     5),
  ('Extras',      'extras',      6)
on conflict (slug) do nothing;

-- ---------- productos ----------
insert into public.products (category_id, name, slug, price, image_url, sort_order)
select c.id, p.name, p.slug, p.price, p.image_url, p.sort_order
from (values
  ('combos',      'Combo Sencillo',                 'combo-sencillo',          9000,  '/img/combo_sencillo.jpg',      1),
  ('combos',      'Combo Tocisuizo',                'combo-tocisuizo',        17000,  '/img/combo_tocisuizo.jpg',     2),
  ('combos',      'Combo S&S Burguer',              'combo-ss-burguer',       17000,  '/img/combo_s_s_burguer.png',   3),

  ('burgers',     'Hamburguesa Clásica con papitas','hamburguesa-clasica',    15000,  '/img/hamburgesa_clasica.png',  1),
  ('burgers',     'S&S Burguer con papitas',        'ss-burguer',             18000,  '/img/s_s_burguer.jpg',         2),
  ('burgers',     'S&S Maxi Burguer con papitas',   'ss-maxi-burguer',        22000,  '/img/s_s_maxi_burguer.jpg',    3),

  ('hot-dogs',    'Perro Sencillo',                 'perro-sencillo',          6000,  '/img/perro_sencillo.jpg',      1),
  ('hot-dogs',    'Choriperro',                     'choriperro',             10000,  null,                           2),
  ('hot-dogs',    'Perro Suizo',                    'perro-suizo',            12000,  '/img/perro_suizo.jpg',         3),
  ('hot-dogs',    'Perro Mixto S&S',                'perro-mixto-ss',         12000,  '/img/perro_mixto_ss.jpg',      4),
  ('hot-dogs',    'Tocisuizo',                      'tocisuizo',              14000,  '/img/tocisuizo2.jpg',          5),
  ('hot-dogs',    'Italo Suizo',                    'italo-suizo',            14000,  '/img/italo_suizo.jpg',         6),

  ('salchipapas', 'S&S Salchipapa Sencilla',        'salchipapa-sencilla',    12000,  '/img/salchipapa.png',          1),
  ('salchipapas', 'Choripapa',                      'choripapa',              14000,  '/img/salchipapa.png',          2),
  ('salchipapas', 'S&S Mixta Salchipapa',           'salchipapa-mixta',       20000,  '/img/salchipapa.png',          3),
  ('salchipapas', 'Chiken Suiz',                    'chiken-suiz',            22000,  '/img/salchipapa.png',          4),
  ('salchipapas', 'S&S Especial Salchipapa',        'salchipapa-especial',    32000,  '/img/salchipapa.png',          5),

  ('bebidas',     'Gaseosa',                        'gaseosa',                 3000,  '/img/gaseosa2.png',            1),

  ('extras',      'Papitas Fritas',                 'papitas-fritas',          4000,  '/img/papitas.jpg',             1)
) as p(cat_slug, name, slug, price, image_url, sort_order)
join public.categories c on c.slug = p.cat_slug
on conflict (slug) do nothing;

-- ---------- zonas de domicilio ----------
-- Antes el domicilio era un "producto" más, lo que impedía separar
-- venta real de flete en los reportes. Ahora vive aparte.
insert into public.delivery_zones (name, fee, sort_order)
select * from (values
  ('Cercano', 1000, 1),
  ('Lejano',  2000, 2)
) as z(name, fee, sort_order)
-- La tabla no tiene una restricción única por nombre, así que la guarda
-- va aquí: sembrar dos veces no debe duplicar las zonas.
where not exists (select 1 from public.delivery_zones);
