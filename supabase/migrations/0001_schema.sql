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
