"use client";

import { AlertCircle, BellOff, BellRing } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ManualOrderModal } from "@/components/admin/manual-order-modal";
import { useOrderAlert } from "@/components/admin/use-order-alert";
import type {
  Category,
  DeliveryZone,
  OrderStatus,
  OrderWithItems,
  Product,
  StoreSettings,
} from "@/lib/database.types";
import { cn, currency, formatTime, timeAgo, todayBogota } from "@/lib/format";
import { OPEN_STATUSES } from "@/lib/orders";
import { createClient } from "@/lib/supabase/client";
import { minutesSince, waitLevel } from "@/lib/wait";

import { OrderDetail } from "./order-detail";
import { STATUS_CHIP } from "./status";
import { useNow } from "./use-now";

type Props = {
  initialOrders: OrderWithItems[];
  products: Product[];
  categories: Category[];
  zones: DeliveryZone[];
  settings: StoreSettings | null;
  loadError: string | null;
};

type FilterId = "open" | "new" | "kitchen" | "ready" | "on_the_way" | "done";

const FILTERS: { id: FilterId; label: string; statuses: OrderStatus[] }[] = [
  { id: "open", label: "Todos", statuses: OPEN_STATUSES },
  { id: "new", label: "Nuevos", statuses: ["pending"] },
  { id: "kitchen", label: "En cocina", statuses: ["accepted", "preparing"] },
  { id: "ready", label: "Listos", statuses: ["ready"] },
  { id: "on_the_way", label: "En camino", statuses: ["on_the_way"] },
  { id: "done", label: "Terminados hoy", statuses: ["delivered", "cancelled"] },
];

const WAIT_TONE = {
  ok: "font-semibold text-ink-muted",
  warn: "font-bold text-[#6b4a00]",
  late: "font-bold text-bad",
} as const;

const isOpen = (order: OrderWithItems) => OPEN_STATUSES.includes(order.status);

export function OrdersView({
  initialOrders,
  products,
  categories,
  zones,
  settings,
  loadError,
}: Props) {
  const router = useRouter();
  // play y notify son estables (useCallback); si se usara el objeto entero
  // como dependencia, el canal de Realtime se recrearía en cada render.
  const { enabled: soundOn, enable: enableSound, play, notify } = useOrderAlert();
  const now = useNow();
  const [filter, setFilter] = useState<FilterId>("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [live, setLive] = useState(false);

  const knownIds = useRef(new Set(initialOrders.map((o) => o.id)));

  // Realtime: el pedido nuevo aparece sin que nadie recargue la página.
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("orders-view")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          const row = payload.new as { id?: string; code?: string; total?: number } | null;

          if (payload.eventType === "INSERT" && row?.id && !knownIds.current.has(row.id)) {
            knownIds.current.add(row.id);
            play();
            notify("Pedido nuevo", `${row.code} · ${currency(row.total ?? 0)}`);
          }

          router.refresh();
        },
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, play, notify]);

  // Red de seguridad: si Realtime se cae, el panel igual se refresca solo.
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(timer);
  }, [router]);

  useEffect(() => {
    initialOrders.forEach((order) => knownIds.current.add(order.id));
  }, [initialOrders]);

  const buckets = useMemo(() => {
    const today = todayBogota();
    const isToday = (iso: string) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date(iso)) ===
      today;

    const result = {} as Record<FilterId, OrderWithItems[]>;
    for (const { id, statuses } of FILTERS) {
      result[id] = initialOrders
        .filter((o) => statuses.includes(o.status) && (id !== "done" || isToday(o.created_at)))
        // En curso: el que más lleva esperando va arriba. Terminados: el más reciente.
        .sort((a, b) =>
          id === "done"
            ? b.created_at.localeCompare(a.created_at)
            : a.created_at.localeCompare(b.created_at),
        );
    }
    return result;
  }, [initialOrders]);

  const totals = useMemo(() => {
    const valid = initialOrders.filter((o) => o.status !== "cancelled");
    const sales = valid.reduce((acc, o) => acc + o.total, 0);
    const collected = valid
      .filter((o) => o.payment_status === "paid")
      .reduce((acc, o) => acc + o.total, 0);

    return { count: valid.length, sales, collected, pending: sales - collected };
  }, [initialOrders]);

  const visible = buckets[filter];
  // Si el pedido elegido ya no está (lo eliminaron o cambió el filtro),
  // el detalle cae en el primero de la lista en vez de quedarse vacío.
  const selected =
    initialOrders.find((o) => o.id === selectedId && visible.some((v) => v.id === o.id)) ??
    visible[0] ??
    null;

  return (
    <div className="grid items-start gap-7 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_380px]">
      <div className="no-print flex flex-col gap-5">
        <div role="group" aria-label="Filtrar por estado" className="flex flex-col gap-0.5">
          <p className="px-3 pb-2 text-xs font-bold tracking-wider text-ink-muted uppercase">
            Estado
          </p>
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={cn(
                "flex h-11 items-center justify-between rounded-[10px] px-3 text-[15px]",
                filter === id ? "bg-[#eceae6] font-extrabold" : "font-semibold hover:bg-cream",
              )}
            >
              {label}
              <span className="text-[13px] font-semibold text-ink-muted">
                {buckets[id].length}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-white p-4">
          <p className="text-xs font-bold tracking-wider text-ink-muted uppercase">Hoy</p>
          <dl className="space-y-2 text-sm">
            <Row label="Pedidos" value={String(totals.count)} />
            <Row label="Venta" value={currency(totals.sales)} />
            <Row label="Cobrado" value={currency(totals.collected)} className="text-[#14532d]" />
            <Row label="Por cobrar" value={currency(totals.pending)} className="text-[#6b4a00]" />
          </dl>
          <Link href="/admin/new/historial" className="text-[13px] font-bold underline">
            Ver el cierre del día
          </Link>
        </div>

        <button
          type="button"
          onClick={enableSound}
          aria-pressed={soundOn}
          className={cn(
            "flex min-h-11 items-center gap-2.5 rounded-[14px] border px-4 py-2.5 text-left text-sm font-bold",
            soundOn ? "border-line bg-white" : "border-warn bg-warn-soft",
          )}
        >
          {soundOn ? (
            <BellRing className="size-4 shrink-0 text-ok" />
          ) : (
            <BellOff className="size-4 shrink-0" />
          )}
          <span>
            {soundOn ? "Sonido de aviso activo" : "Activar sonido de aviso"}
            <span className="block text-xs font-medium text-ink-muted">
              Suena con cada pedido nuevo
            </span>
          </span>
        </button>
      </div>

      <main className="no-print flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-extrabold">
              {filter === "done" ? "Terminados hoy" : "Pedidos en curso"}
            </h1>
            <p className="text-[13px] font-semibold text-ink-muted">
              {visible.length} {visible.length === 1 ? "pedido" : "pedidos"}
              {!live && " · reconectando…"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="h-11 rounded-[10px] bg-brand-500 px-[18px] text-sm font-bold text-white"
          >
            Tomar pedido
          </button>
        </div>

        {loadError && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-[10px] bg-bad-soft px-3 py-2.5 text-sm text-bad"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {loadError}
          </p>
        )}

        {visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line py-16 text-center text-sm text-ink-muted">
            {filter === "done"
              ? "Todavía no hay pedidos terminados hoy."
              : filter === "new"
                ? "No hay pedidos sin confirmar. Todo al día."
                : "No hay pedidos en este estado."}
          </p>
        ) : (
          visible.map((order) => {
            const chip = STATUS_CHIP[order.status];
            const minutes = now === null ? null : minutesSince(order.created_at, now);
            const level = minutes === null || !isOpen(order) ? "ok" : waitLevel(minutes);
            const needsQuote =
              order.order_type === "delivery" && !order.delivery_quoted && isOpen(order);
            const active = selected?.id === order.id;

            return (
              <button
                key={order.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedId(order.id)}
                className={cn(
                  "flex items-center gap-3.5 rounded-[14px] border bg-white px-4 py-3 text-left",
                  active ? "border-brand-500 ring-1 ring-brand-500" : "border-line",
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-extrabold">{order.code}</span>
                    <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold", chip.className)}>
                      {chip.label}
                    </span>
                    <span className={cn("text-[13px]", WAIT_TONE[level])}>
                      {now === null ? formatTime(order.created_at) : timeAgo(order.created_at, now)}
                    </span>
                  </span>
                  <span className="text-sm font-semibold">
                    {order.customer_name} ·{" "}
                    {order.order_type === "delivery"
                      ? needsQuote
                        ? "Domicilio, falta el valor"
                        : "Domicilio"
                      : "Recoge"}
                  </span>
                  <span className="truncate text-[13px] text-ink-muted">
                    {order.order_items.map((i) => `${i.qty}× ${i.product_name}`).join(" · ")}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-base font-extrabold">{currency(order.total)}</span>
                  <span
                    className={cn(
                      "text-xs font-bold",
                      order.payment_status === "paid" ? "text-[#14532d]" : "text-[#6b4a00]",
                    )}
                  >
                    {order.payment_status === "paid"
                      ? `Pagado${order.payment_method ? ` · ${order.payment_method}` : ""}`
                      : "Por cobrar"}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </main>

      <div className="lg:col-start-2 xl:sticky xl:top-24 xl:col-start-3">
        {selected ? (
          // La clave reinicia las ventanas abiertas al cambiar de pedido.
          <OrderDetail
            key={selected.id}
            order={selected}
            settings={settings}
            zones={zones}
            products={products}
            categories={categories}
          />
        ) : (
          <p className="no-print rounded-2xl border border-dashed border-line px-5 py-16 text-center text-sm text-ink-muted">
            Elige un pedido de la lista para ver su detalle.
          </p>
        )}
      </div>

      <ManualOrderModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        products={products}
        categories={categories}
        zones={zones}
        settings={settings}
      />
    </div>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={cn("font-extrabold", className)}>{value}</dd>
    </div>
  );
}
