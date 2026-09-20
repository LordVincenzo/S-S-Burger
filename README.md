# S&S Burger

Plataforma de pedidos: carta pública para el cliente y panel en tiempo real para el local.

- **Cliente** (`/`) — carta, carrito, domicilio o recoger, comentarios por producto, seguimiento del pedido y aviso opcional por WhatsApp.
- **Panel** (`/admin`) — pedidos en vivo con aviso sonoro, cambio de estado, registro de pago, comprobante imprimible, pedido manual, edición de la carta y ajustes del negocio.

Stack: Next.js 16 (App Router) · React 19 · Tailwind 4 · Supabase (Postgres, Auth, Realtime, Storage) · TypeScript.

---

## Puesta en marcha

### 1. Crear el proyecto de Supabase

1. Entra a [supabase.com](https://supabase.com) y crea un proyecto (región `East US` o `São Paulo` para Colombia).
2. Abre **SQL Editor** y ejecuta, **en este orden**, el contenido de:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_functions.sql`
   - `supabase/migrations/0004_storage.sql`
   - `supabase/seed.sql` *(carga la carta actual y las zonas de domicilio)*

### 2. Variables de entorno

Copia `.env.example` a `.env.local` y pega los valores de **Project Settings → API**:

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> La clave `anon` es pública por diseño: va en el navegador. Lo que protege los datos
> es RLS, no la clave. La `service_role` **nunca** se usa en este proyecto.

### 3. Crear el usuario administrador

1. En Supabase: **Authentication → Users → Add user**, con correo y contraseña.
2. Arranca la app (`npm run dev`) y entra a `/admin/login` con ese usuario.
3. La pantalla te mostrará la línea SQL exacta con tu `user_id`. Ejecútala en el SQL Editor:

```sql
insert into public.admins (user_id, label) values ('<tu-user-id>', 'Encargado');
```

4. Recarga. Ya tienes el panel.

### 4. Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run lint
npm run build
```

---

## Cómo está pensado

**El pedido no depende de WhatsApp.** Cuando el cliente confirma, el pedido se guarda en
Supabase y suena en el panel al instante. WhatsApp es un botón opcional *después*: si el
cliente nunca lo presiona, el pedido igual entró. Esto evita el punto de falla clásico del
enlace `wa.me`, donde un cliente que no presiona "enviar" es una venta perdida sin rastro.

**Los precios se calculan en el servidor.** El navegador solo manda ids y cantidades. La
función `create_order()` vuelve a leer los precios de la base y arma el total allá. Sin
esto, cualquiera pediría una hamburguesa por $1.000 editando la petición.

**Los pedidos guardan una foto del producto, no una referencia.** `order_items` congela el
nombre y el precio del momento de la compra: subir un precio hoy no reescribe la venta de
ayer.

**El domicilio no es un producto.** Vive en `delivery_zones` con su propia columna en el
pedido, para que los reportes separen la venta de comida del flete.

**El consecutivo del día usa la hora de Colombia**, no UTC. Con UTC, el número del día
cambiaría a las 7 de la noche.

**RLS hace la autorización, no el frontend.** El público lee la carta y crea pedidos por
RPC; todo lo demás exige estar en la tabla `admins`. El proxy (`proxy.ts`) solo redirige,
no autoriza.

---

## Sobre el comprobante

Lo que imprime el sistema es un **comprobante de venta**, no una factura electrónica DIAN
(no lleva CUFE ni resolución de facturación). Sirve para el cliente y para el control
interno del negocio. Si algún día se necesita facturación legal, se integra con un
proveedor tecnológico autorizado (Alegra, Siigo, Factus).

---

## Estructura

```
app/
  page.tsx                  carta pública
  pedido/[token]/           seguimiento del cliente (sin login)
  admin/                    panel: pedidos, carta, ajustes
  actions/                  Server Actions (order.ts público, admin.ts protegido)
components/
  shop/                     carrito, checkout, seguimiento
  admin/                    tablero, tarjetas de pedido, gestión de carta
  receipt.tsx               comprobante compartido (imprimible con CSS)
lib/
  supabase/                 clientes para navegador, servidor y proxy
  database.types.ts         tipos de la base
  orders.ts                 estados, mensajes de WhatsApp
supabase/
  migrations/               esquema, RLS, funciones, storage
  seed.sql                  carta inicial
legacy/                     app anterior de Create React App (solo referencia)
```

## Despliegue

Vercel, importando el repositorio. Hay que registrar `NEXT_PUBLIC_SUPABASE_URL` y
`NEXT_PUBLIC_SUPABASE_ANON_KEY` en **Project Settings → Environment Variables**.

## Pendiente

- Importar a Supabase el historial que quedó en el `localStorage` del navegador del
  encargado (la app vieja está en `legacy/`). Si no se hace, ese historial se pierde.
- Reportes de cierre de caja por día y por rango.
- Aviso al celular con el panel cerrado (PWA con push o bot de Telegram).
- Falta la foto de `choriperro`: el producto quedó sembrado sin imagen.
