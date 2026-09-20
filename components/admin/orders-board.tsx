"use client";

import { AlertCircle, BellOff, BellRing, Plus, Wifi, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  Category,
  DeliveryZone,
  OrderWithItems,
  Product,
  StoreSettings,
} from "@/lib/database.types";
import { cn, currency, todayBogota } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

import { ManualOrderModal } from "./manual-order-modal";
import { OrderCard } from "./order-card";
import { useOrderAlert } from "./use-order-alert";

type Props = {
  initialOrders: OrderWithItems[];
  products: Product[];
  categories: Category[];
  zones: DeliveryZone[];
  settings: StoreSettings | null;
  loadError: string | null;
};

type Tab = "new" | "active" | "done";

const TABS: { id: Tab; label: string }[] = [
  { id: "new", label: "Nuevos" },
  { id: "active", label: "En curso" },
  { id: "done", label: "Terminados" },
];

export function OrdersBoard({
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
  const [tab, setTab] = useState<Tab>("new");
  const [manualOpen, setManualOpen] = useState(false);
  const [live, setLive] = useState(false);

  const knownIds = useRef(new Set(initialOrders.map((o) => o.id)));

  // Realtime: el pedido nuevo aparece sin que nadie recargue la página.
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("orders-board")
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

    return {
      new: initialOrders.filter((o) => o.status === "pending"),
      active: initialOrders.filter((o) =>
        ["accepted", "preparing", "ready", "on_the_way"].includes(o.status),
      ),
      done: initialOrders.filter(
        (o) => ["delivered", "cancelled"].includes(o.status) && isToday(o.created_at),
      ),
    } satisfies Record<Tab, OrderWithItems[]>;
  }, [initialOrders]);

  const totals = useMemo(() => {
    const today = initialOrders.filter((o) => o.status !== "cancelled");
    const sales = today.reduce((acc, o) => acc + o.total, 0);
    const collected = today
      .filter((o) => o.payment_status === "paid")
      .reduce((acc, o) => acc + o.total, 0);

    return {
      count: today.length,
      sales,
      collected,
      pending: sales - collected,
    };
  }, [initialOrders]);

  const visible = buckets[tab];

  return (
    <div>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Pedidos</h1>
          <p className="flex items-center gap-1.5 text-xs text-ink-muted">
            {live ? (
              <>
                <Wifi className="size-3.5 text-ok" />
                En vivo
              </>
            ) : (
              <>
                <WifiOff className="size-3.5" />
                Reconectando…
              </>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={enableSound}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition",
              soundOn
                ? "border-ok bg-ok-soft text-ok"
                : "border-warn bg-warn-soft text-ink",
            )}
          >
            {soundOn ? <BellRing className="size-4" /> : <BellOff className="size-4" />}
            {soundOn ? "Sonido activo" : "Activar sonido"}
          </button>

          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white"
          >
            <Plus className="size-4" />
            Pedido manual
          </button>
        </div>
      </div>

      {loadError && (
        <p className="no-print mb-4 flex items-start gap-2 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {loadError}
        </p>
      )}

      <div className="no-print mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Pedidos hoy" value={String(totals.count)} />
        <Stat label="Venta" value={currency(totals.sales)} />
        <Stat label="Cobrado" value={currency(totals.collected)} tone="ok" />
        <Stat label="Por cobrar" value={currency(totals.pending)} tone="warn" />
      </div>

      <div className="no-print mb-4 flex gap-1 rounded-xl bg-cream p-1">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition",
              tab === id ? "bg-white shadow-sm" : "text-ink-muted",
            )}
          >
            {label}
            {buckets[id].length > 0 && (
              <span
                className={cn(
                  "grid min-w-5 place-items-center rounded-full px-1.5 text-[11px]",
                  id === "new" ? "bg-brand-500 text-white" : "bg-line text-ink-muted",
                )}
              >
                {buckets[id].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="no-print rounded-2xl border border-dashed border-line py-16 text-center text-sm text-ink-muted">
          {tab === "new"
            ? "No hay pedidos sin confirmar. Todo al día."
            : tab === "active"
              ? "Nada en la cocina ahora mismo."
              : "Todavía no hay pedidos terminados hoy."}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              settings={settings}
              zones={zones}
              products={products}
              categories={categories}
            />
          ))}
        </div>
      )}

      <ManualOrderModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        products={products}
        categories={categories}
        zones={zones}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        tone === "ok" && "border-ok/30 bg-ok-soft",
        tone === "warn" && "border-warn/40 bg-warn-soft",
        !tone && "border-line bg-white",
      )}
    >
      <p className="text-[11px] font-bold tracking-wide text-ink-muted uppercase">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-extrabold tracking-tight",
          tone === "ok" && "text-ok",
        )}
      >
        {value}
      </p>
    </div>
  );
}
