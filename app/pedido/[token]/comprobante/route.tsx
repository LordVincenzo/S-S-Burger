import { ImageResponse } from "next/og";

import type { PublicOrder, StoreSettings } from "@/lib/database.types";
import { currency, formatDateTime } from "@/lib/format";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Comprobante como imagen PNG.
 *
 * Se genera en el servidor en vez de capturar la pantalla con
 * html2canvas (que es lo que hacía la app anterior, y por eso tenía que
 * arrancar la hoja de estilos: los colores oklch la rompían). Así sale
 * igual siempre, sin depender del navegador ni del tamaño de pantalla
 * de quien lo envía.
 *
 * La llave es el token del pedido, igual que la pantalla de seguimiento:
 * quien tiene el enlace tiene el comprobante.
 *
 * Dos reglas del motor de dibujo (satori) que hay que respetar aquí:
 *   1. Todo elemento con más de un hijo necesita display explícito.
 *      Un texto interpolado —`{a} y {b}`— cuenta como varios hijos, así
 *      que abajo todo el texto se arma antes, en una sola cadena.
 *   2. No entiende oklch, que es lo que usa el resto de la app. Por eso
 *      la paleta está repetida aquí en hexadecimal.
 */

const INK = "#2b1d17";
const MUTED = "#7a6a62";
const LINE = "#e5ded8";
const BRAND = "#b23c1c";
const OK = "#1f8a4c";
const CREAM = "#faf7f4";

const row = { display: "flex", justifyContent: "space-between", width: "100%" } as const;
const col = { display: "flex", flexDirection: "column", width: "100%" } as const;

/**
 * El logo, en base64 dentro de la propia imagen.
 *
 * Satori no puede leer del disco: en Vercel, lo que vive en public/ no
 * está en el sistema de archivos de la función. Se pide por HTTP a este
 * mismo servidor —de ahí que haga falta la URL de la petición— y se
 * incrusta. Si por lo que sea no llega, el comprobante sale sin logo en
 * vez de no salir.
 */
async function loadLogo(origin: string) {
  try {
    const response = await fetch(new URL("/img/logo_ss.png", origin));
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = createPublicClient();

  const [orderRes, settingsRes, logo] = await Promise.all([
    supabase.rpc("get_order_public", { p_token: token }),
    supabase.from("store_settings").select("*").maybeSingle(),
    loadLogo(request.url),
  ]);

  if (orderRes.error || !orderRes.data) {
    return new Response("Pedido no encontrado", { status: 404 });
  }

  const order = orderRes.data as PublicOrder;
  const settings = settingsRes.data as StoreSettings | null;

  const paid = order.payment_status === "paid";
  const pendingFee = order.order_type === "delivery" && !order.delivery_quoted;
  const showFee = pendingFee || order.delivery_fee > 0;

  // Texto ya resuelto: nada de interpolar dentro del JSX.
  const storeName = settings?.store_name ?? "S&S Burger";
  const phoneLine = settings?.whatsapp_phone ? `Tel. ${settings.whatsapp_phone}` : null;
  const deliveryLabel = order.order_type === "delivery" ? "Domicilio" : "Recoge en el local";
  const totalLabel = pendingFee
    ? `${currency(order.total)} + dom.`
    : currency(order.total);
  const paymentLabel = paid
    ? order.payment_method
      ? `PAGADO · ${order.payment_method}`
      : "PAGADO"
    : "PENDIENTE DE PAGO";

  /*
   * El alto se calcula a mano: satori no crece con el contenido, y lo que
   * sobre del lienzo se recorta sin avisar.
   *
   * Se estima de más a propósito. El pie lleva marginTop:auto, así que el
   * sobrante queda como aire encima de la firma en vez de cortar el total.
   */
  const height =
    700 +
    order.items.length * 42 +
    order.items.filter((item) => item.notes).length * 24 +
    (showFee ? 34 : 0) +
    (order.customer_notes ? 66 : 0) +
    (order.delivery_address ? 34 : 0) +
    (settings?.store_address ? 28 : 0) +
    (phoneLine ? 26 : 0) +
    (logo ? 110 : 0);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#ffffff",
          padding: "40px 44px",
          color: INK,
          fontSize: 22,
        }}
      >
        <div style={{ ...col, alignItems: "center" }}>
          {logo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logo} alt="" width={96} height={96} style={{ marginBottom: 10 }} />
          ) : null}
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>{storeName}</div>
          {settings?.store_address ? (
            <div style={{ fontSize: 20, color: MUTED, marginTop: 4 }}>
              {settings.store_address}
            </div>
          ) : null}
          {phoneLine ? (
            <div style={{ fontSize: 20, color: MUTED, marginTop: 2 }}>{phoneLine}</div>
          ) : null}
        </div>

        <div
          style={{
            ...col,
            alignItems: "center",
            borderTop: `2px dashed ${LINE}`,
            borderBottom: `2px dashed ${LINE}`,
            padding: "18px 0",
            margin: "24px 0",
          }}
        >
          <div style={{ fontSize: 18, color: MUTED, letterSpacing: 3, fontWeight: 700 }}>
            COMPROBANTE DE VENTA
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, marginTop: 4 }}>{order.code}</div>
          <div style={{ fontSize: 20, color: MUTED }}>{formatDateTime(order.created_at)}</div>
        </div>

        <div style={row}>
          <div style={{ color: MUTED }}>Cliente</div>
          <div style={{ fontWeight: 700 }}>{order.customer_name}</div>
        </div>
        <div style={{ ...row, marginTop: 6 }}>
          <div style={{ color: MUTED }}>Entrega</div>
          <div style={{ fontWeight: 700 }}>{deliveryLabel}</div>
        </div>
        {order.delivery_address ? (
          <div style={{ ...row, marginTop: 6 }}>
            <div style={{ color: MUTED }}>Dirección</div>
            <div style={{ fontWeight: 700, maxWidth: 420, textAlign: "right" }}>
              {order.delivery_address}
            </div>
          </div>
        ) : null}

        <div
          style={{ ...col, marginTop: 24, borderTop: `2px solid ${LINE}`, paddingTop: 14 }}
        >
          {order.items.map((item, index) => (
            <div key={index} style={{ ...col, marginTop: 10 }}>
              <div style={row}>
                <div style={{ maxWidth: 470 }}>
                  {`${item.qty}× ${item.product_name}`}
                </div>
                <div style={{ fontWeight: 700 }}>{currency(item.line_total)}</div>
              </div>
              {item.notes ? (
                <div style={{ fontSize: 18, color: BRAND, marginTop: 2 }}>
                  {`↳ ${item.notes}`}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div
          style={{ ...col, marginTop: 18, borderTop: `2px dashed ${LINE}`, paddingTop: 14 }}
        >
          <div style={row}>
            <div style={{ color: MUTED }}>Subtotal</div>
            <div>{currency(order.subtotal)}</div>
          </div>
          {showFee ? (
            <div style={{ ...row, marginTop: 6 }}>
              <div style={{ color: MUTED }}>Domicilio</div>
              <div>{pendingFee ? "Por confirmar" : currency(order.delivery_fee)}</div>
            </div>
          ) : null}
          <div style={{ ...row, marginTop: 10, fontSize: 34, fontWeight: 800 }}>
            <div>Total</div>
            <div>{totalLabel}</div>
          </div>
        </div>

        {order.customer_notes ? (
          <div
            style={{
              display: "flex",
              backgroundColor: CREAM,
              borderRadius: 12,
              padding: "12px 16px",
              marginTop: 16,
              fontSize: 19,
              color: MUTED,
            }}
          >
            {order.customer_notes}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 20,
            padding: "14px 0",
            borderRadius: 12,
            backgroundColor: paid ? "#e8f6ee" : "#fdf4dd",
            color: paid ? OK : INK,
            fontSize: 24,
            fontWeight: 800,
          }}
        >
          {paymentLabel}
        </div>

        <div style={{ ...col, alignItems: "center", marginTop: "auto", paddingTop: 18 }}>
          <div style={{ fontSize: 17, color: MUTED }}>
            Documento no válido como factura electrónica
          </div>
          <div style={{ fontSize: 17, color: MUTED, marginTop: 2 }}>¡Gracias por tu compra!</div>
        </div>
      </div>
    ),
    {
      width: 720,
      height,
      headers: {
        // El comprobante cambia mientras el pedido vive: caché corta.
        "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
        "Content-Disposition": `inline; filename="comprobante-${order.code}.png"`,
      },
    },
  );
}
