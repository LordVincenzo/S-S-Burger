"use client";

import {
  AlertCircle,
  Check,
  ChefHat,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { updateOrderStatus } from "@/app/actions/admin";
import type { OrderWithItems } from "@/lib/database.types";
import { cn, currency, normalizePhone } from "@/lib/format";
import { directionsUrl } from "@/lib/maps";
import { whatsappLink, whatsappStatusMessage } from "@/lib/orders";
import { RelativeTime } from "@/components/relative-time";
import { createClient } from "@/lib/supabase/client";

type Props = {
  initialOrders: OrderWithItems[];
  loadError: string | null;
};

/**
 * La vista del que reparte, pensada para un celular en la mano y con
 * casco puesto: botones grandes y solo lo que necesita para salir.
 *
 * Vive dentro del panel a propósito. El repartidor de este negocio es
 * alguien de la casa, así que entra con la misma cuenta compartida en
 * vez de manejar enlaces sueltos por pedido.
 */
export function DeliveriesView({ initialOrders, loadError }: Props) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("entregas")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () =>
        router.refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  const groups = useMemo(
    () => ({
      onTheWay: initialOrders.filter((order) => order.status === "on_the_way"),
      ready: initialOrders.filter((order) => order.status === "ready"),
      cooking: initialOrders.filter((order) =>
        ["accepted", "preparing"].includes(order.status),
      ),
    }),
    [initialOrders],
  );

  const toCollect = [...groups.onTheWay, ...groups.ready]
    .filter((order) => order.payment_status === "pending")
    .reduce((acc, order) => acc + order.total, 0);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Entregas</h1>
        <p className="text-xs text-ink-muted">
          {groups.ready.length} para salir · {groups.onTheWay.length} en camino
          {toCollect > 0 && ` · ${currency(toCollect)} por cobrar`}
        </p>
      </div>

      {loadError && (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {loadError}
        </p>
      )}

      {groups.ready.length === 0 && groups.onTheWay.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line py-14 text-center text-sm text-ink-muted">
          {groups.cooking.length > 0
            ? "Nada listo todavía. Hay pedidos en cocina."
            : "No hay domicilios pendientes."}
        </p>
      )}

      {groups.onTheWay.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-extrabold tracking-wide text-ink-muted uppercase">
            En camino
          </h2>
          <div className="space-y-3">
            {groups.onTheWay.map((order) => (
              <DeliveryCard key={order.id} order={order} />
            ))}
          </div>
        </section>
      )}

      {groups.ready.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-extrabold tracking-wide text-ink-muted uppercase">
            Listos para salir
          </h2>
          <div className="space-y-3">
            {groups.ready.map((order) => (
              <DeliveryCard key={order.id} order={order} />
            ))}
          </div>
        </section>
      )}

      {groups.cooking.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-extrabold tracking-wide text-ink-muted uppercase">
            <ChefHat className="size-3.5" />
            En cocina ({groups.cooking.length})
          </h2>
          <ul className="space-y-1.5">
            {groups.cooking.map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-bold">{order.code}</span>{" "}
                  <span className="text-ink-muted">{order.delivery_address}</span>
                </span>
                <span className="shrink-0 text-xs text-ink-muted">
                  <RelativeTime iso={order.created_at} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function DeliveryCard({ order }: { order: OrderWithItems }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const phone = normalizePhone(order.customer_phone);
  const unpaid = order.payment_status === "pending";
  const change =
    unpaid && order.cash_received != null ? order.cash_received - order.total : null;

  const next = order.status === "ready" ? "on_the_way" : "delivered";
  const nextLabel = order.status === "ready" ? "Salí con el pedido" : "Entregado";

  function advance() {
    setError(null);
    startTransition(async () => {
      const result = await updateOrderStatus(order.id, next);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-extrabold">{order.code}</p>
            <p className="text-sm text-ink-muted">
              {order.customer_name} · <RelativeTime iso={order.created_at} />
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-extrabold">{currency(order.total)}</p>
            <p
              className={cn(
                "text-[11px] font-bold",
                unpaid ? "text-ink" : "text-ok",
              )}
            >
              {unpaid ? "COBRAR" : "YA PAGÓ"}
            </p>
          </div>
        </div>

        {/* La dirección es lo más importante de esta pantalla. */}
        <div className="rounded-xl bg-cream p-3">
          <p className="flex items-start gap-2 text-base leading-snug font-bold">
            <MapPin className="mt-0.5 size-4 shrink-0 text-brand-500" />
            {order.delivery_city
              ? `${order.delivery_address} — ${order.delivery_city}`
              : order.delivery_address}
          </p>
          {order.delivery_notes && (
            <p className="mt-1 pl-6 text-sm text-ink-muted">{order.delivery_notes}</p>
          )}
        </div>

        {unpaid && (
          <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm font-bold">
            Cobrar {currency(order.total)}
            {change != null && change >= 0 && (
              <span className="block font-semibold">
                Paga con {currency(order.cash_received!)} · lleva{" "}
                {currency(change)} de devuelta
              </span>
            )}
          </p>
        )}

        <ul className="text-sm text-ink-muted">
          {order.order_items.map((item) => (
            <li key={item.id}>
              {item.qty}× {item.product_name}
              {item.notes && <span className="text-brand-600 italic"> ({item.notes})</span>}
            </li>
          ))}
        </ul>

        {order.customer_notes && (
          <p className="rounded-xl bg-warn-soft px-3 py-2 text-xs">{order.customer_notes}</p>
        )}

        {error && <p className="rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad">{error}</p>}
      </div>

      <div className="flex gap-2 border-t border-line p-3">
        <a
          href={directionsUrl(order.delivery_address ?? "", order.delivery_city)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-bold text-white"
        >
          <Navigation className="size-4" />
          Cómo llegar
        </a>

        {phone && (
          <>
            <a
              href={`tel:+${phone}`}
              aria-label="Llamar al cliente"
              className="grid size-12 shrink-0 place-items-center rounded-xl border border-line text-ink-muted"
            >
              <Phone className="size-5" />
            </a>
            <a
              href={whatsappLink(phone, whatsappStatusMessage(order))}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Escribir por WhatsApp"
              className="grid size-12 shrink-0 place-items-center rounded-xl border border-line text-ink-muted"
            >
              <MessageCircle className="size-5" />
            </a>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={advance}
        disabled={pending}
        className={cn(
          "flex w-full items-center justify-center gap-2 py-4 text-base font-bold text-white disabled:opacity-60",
          order.status === "ready" ? "bg-ink" : "bg-ok",
        )}
      >
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
        {nextLabel}
      </button>
    </article>
  );
}
