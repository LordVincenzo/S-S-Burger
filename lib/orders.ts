import type { OrderStatus, OrderType } from "@/lib/database.types";
import { currency, normalizePhone } from "@/lib/format";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Sin confirmar",
  accepted: "Confirmado",
  preparing: "En preparación",
  ready: "Listo",
  on_the_way: "En camino",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

/** Texto que ve el cliente en la pantalla de seguimiento. */
export const STATUS_CUSTOMER_LABEL: Record<OrderStatus, string> = {
  pending: "Recibimos tu pedido, lo estamos confirmando",
  accepted: "¡Confirmado! Ya entra a la cocina",
  preparing: "Lo estamos preparando",
  ready: "Tu pedido está listo",
  on_the_way: "Va en camino",
  delivered: "Entregado. ¡Buen provecho!",
  cancelled: "Este pedido fue cancelado",
};

/** Siguiente paso lógico del pedido. null = no hay más que hacer. */
export function nextStatus(status: OrderStatus, type: OrderType): OrderStatus | null {
  switch (status) {
    case "pending":
      return "accepted";
    case "accepted":
      return "preparing";
    case "preparing":
      return "ready";
    case "ready":
      return type === "delivery" ? "on_the_way" : "delivered";
    case "on_the_way":
      return "delivered";
    default:
      return null;
  }
}

export const OPEN_STATUSES: OrderStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "on_the_way",
];

export const PAYMENT_METHODS = [
  "Efectivo",
  "Nequi",
  "Bancolombia",
  "Daviplata",
  "Transfiya",
  "Otro",
] as const;

/**
 * Mensaje que el local le manda al cliente desde el panel.
 *
 * Antes este enlace abría un chat en blanco; ahora llega con el estado
 * del pedido ya escrito, que es lo que uno alcanza a hacer entre pedido
 * y pedido.
 */
export function whatsappStatusMessage(order: {
  code: string;
  customer_name: string;
  status: OrderStatus;
  total: number;
  order_type: OrderType;
}) {
  const estado: Record<OrderStatus, string> = {
    pending: "lo estamos confirmando",
    accepted: "ya está confirmado y entra a la cocina",
    preparing: "lo estamos preparando",
    ready:
      order.order_type === "delivery"
        ? "está listo y sale para tu dirección"
        : "ya está listo para recoger",
    on_the_way: "va en camino",
    delivered: "fue entregado",
    cancelled: "fue cancelado",
  };

  return [
    `Hola ${order.customer_name}, te escribimos de S&S Burger.`,
    `Tu pedido *${order.code}* ${estado[order.status]}.`,
    `Total: ${currency(order.total)}`,
  ].join("\n");
}

/** Enlace wa.me al número de la tienda con el mensaje ya escrito. */
export function whatsappLink(phone: string | null | undefined, message: string) {
  const to = normalizePhone(phone);
  const text = encodeURIComponent(message);
  return to ? `https://wa.me/${to}?text=${text}` : `https://wa.me/?text=${text}`;
}
