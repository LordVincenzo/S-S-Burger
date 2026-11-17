import type { OrderStatus, OrderType } from "@/lib/database.types";

/** Etiqueta corta del estado, para las fichas de la lista. */
export const STATUS_CHIP: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: "Nuevo", className: "bg-brand-50 text-brand-700" },
  accepted: { label: "Confirmado", className: "bg-warn-soft text-[#6b4a00]" },
  preparing: { label: "En cocina", className: "bg-warn-soft text-[#6b4a00]" },
  ready: { label: "Listo", className: "bg-ok-soft text-[#14532d]" },
  on_the_way: { label: "En camino", className: "bg-cream text-ink" },
  delivered: { label: "Entregado", className: "bg-cream text-ink-muted" },
  cancelled: { label: "Cancelado", className: "bg-bad-soft text-bad" },
};

/** Lo que dice el botón principal: la acción, no el nombre del estado. */
export function nextActionLabel(status: OrderStatus, type: OrderType) {
  switch (status) {
    case "pending":
      return "Aceptar pedido";
    case "accepted":
      return "Pasar a cocina";
    case "preparing":
      return "Marcar como listo";
    case "ready":
      return type === "delivery" ? "Salió a entregar" : "Entregado";
    case "on_the_way":
      return "Entregado";
    default:
      return "";
  }
}

/** Pasos del pedido en orden, para la barra de avance del detalle. */
export function orderSteps(type: OrderType): OrderStatus[] {
  return type === "delivery"
    ? ["pending", "accepted", "preparing", "ready", "on_the_way", "delivered"]
    : ["pending", "accepted", "preparing", "ready", "delivered"];
}
