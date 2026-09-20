import type { OrderWithItems } from "@/lib/database.types";
import { currency, formatDate } from "@/lib/format";

export type Report = ReturnType<typeof buildReport>;

/**
 * Cierre de caja de un rango de fechas.
 *
 * Los pedidos cancelados no cuentan como venta, pero se reportan aparte:
 * si un día se cancelan seis pedidos, eso es información, no ruido.
 *
 * La comida y el domicilio se suman por separado. Por eso el domicilio
 * dejó de ser un "producto" del catálogo: mezclados, el margen real del
 * negocio queda escondido dentro de la venta.
 */
export function buildReport(orders: OrderWithItems[]) {
  const valid = orders.filter((order) => order.status !== "cancelled");
  const cancelled = orders.filter((order) => order.status === "cancelled");

  const food = valid.reduce((acc, order) => acc + order.subtotal, 0);
  const delivery = valid.reduce((acc, order) => acc + order.delivery_fee, 0);
  const sales = food + delivery;

  const paidOrders = valid.filter((order) => order.payment_status === "paid");
  const collected = paidOrders.reduce((acc, order) => acc + order.total, 0);

  const byMethod = new Map<string, { count: number; amount: number }>();
  for (const order of paidOrders) {
    const key = order.payment_method || "Sin especificar";
    const current = byMethod.get(key) ?? { count: 0, amount: 0 };
    byMethod.set(key, { count: current.count + 1, amount: current.amount + order.total });
  }

  const byProduct = new Map<string, { qty: number; amount: number }>();
  for (const order of valid) {
    for (const item of order.order_items) {
      const current = byProduct.get(item.product_name) ?? { qty: 0, amount: 0 };
      byProduct.set(item.product_name, {
        qty: current.qty + item.qty,
        amount: current.amount + item.line_total,
      });
    }
  }

  return {
    count: valid.length,
    cancelledCount: cancelled.length,
    food,
    delivery,
    sales,
    collected,
    pending: sales - collected,
    average: valid.length ? Math.round(sales / valid.length) : 0,
    deliveryCount: valid.filter((order) => order.order_type === "delivery").length,
    pickupCount: valid.filter((order) => order.order_type === "pickup").length,
    onlineCount: valid.filter((order) => order.channel === "online").length,
    methods: [...byMethod.entries()]
      .map(([method, data]) => ({ method, ...data }))
      .sort((a, b) => b.amount - a.amount),
    products: [...byProduct.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty),
  };
}

/** Resumen corto para mandar por WhatsApp al cerrar el día. */
export function reportToWhatsApp(report: Report, from: string, to: string) {
  const period =
    from === to
      ? formatDate(`${from}T12:00:00-05:00`)
      : `${formatDate(`${from}T12:00:00-05:00`)} al ${formatDate(`${to}T12:00:00-05:00`)}`;

  const lines = [
    "*S&S Burger — Cierre*",
    period,
    "",
    `Pedidos: ${report.count}`,
    `Comida: ${currency(report.food)}`,
    ...(report.delivery > 0 ? [`Domicilios: ${currency(report.delivery)}`] : []),
    `*Venta total: ${currency(report.sales)}*`,
    "",
    `Cobrado: ${currency(report.collected)}`,
    ...(report.pending > 0 ? [`Por cobrar: ${currency(report.pending)}`] : []),
    "",
    ...(report.methods.length
      ? [
          "Medios de pago:",
          ...report.methods.map((m) => `• ${m.method}: ${currency(m.amount)} (${m.count})`),
          "",
        ]
      : []),
    ...(report.products.length
      ? [
          "Más vendidos:",
          ...report.products.slice(0, 5).map((p) => `• ${p.qty}x ${p.name}`),
        ]
      : []),
    ...(report.cancelledCount > 0 ? ["", `Cancelados: ${report.cancelledCount}`] : []),
  ];

  return lines.join("\n");
}

/**
 * Una fila por producto vendido, no por pedido.
 *
 * Así el archivo sirve para cuadrar caja *y* para analizar qué se vende,
 * que es lo que un CSV de una fila por pedido no deja hacer.
 */
export function ordersToCsv(orders: OrderWithItems[]) {
  const header = [
    "fecha",
    "hora",
    "pedido",
    "canal",
    "estado",
    "cliente",
    "telefono",
    "entrega",
    "direccion",
    "producto",
    "cantidad",
    "precio_unitario",
    "total_linea",
    "nota_producto",
    "subtotal_pedido",
    "domicilio",
    "total_pedido",
    "pago",
    "medio_pago",
    "referencia",
  ];

  const escape = (value: unknown) => {
    const text = value == null ? "" : String(value);
    return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const rows = orders.flatMap((order) => {
    const date = new Date(order.created_at);
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(date);
    const time = new Intl.DateTimeFormat("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Bogota",
    }).format(date);

    return order.order_items.map((item) =>
      [
        day,
        time,
        order.code,
        order.channel === "online" ? "Web" : "Manual",
        order.status,
        order.customer_name,
        order.customer_phone ?? "",
        order.order_type === "delivery" ? "Domicilio" : "Recoge",
        order.delivery_address ?? "",
        item.product_name,
        item.qty,
        item.unit_price,
        item.line_total,
        item.notes ?? "",
        order.subtotal,
        order.delivery_fee,
        order.total,
        order.payment_status === "paid" ? "PAGADO" : "PENDIENTE",
        order.payment_method ?? "",
        order.payment_ref ?? "",
      ]
        .map(escape)
        .join(","),
    );
  });

  // El BOM hace que Excel en Windows abra las tildes bien.
  return "﻿" + [header.join(","), ...rows].join("\r\n");
}
