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
