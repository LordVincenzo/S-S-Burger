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
