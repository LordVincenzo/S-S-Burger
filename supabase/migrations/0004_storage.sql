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
