"use client";

import { AlertCircle, Loader2, Maximize } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { updateOrderStatus } from "@/app/actions/admin";
import type { OrderWithItems } from "@/lib/database.types";
import { cn } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { WAIT_LATE_MINUTES, WAIT_WARN_MINUTES, minutesSince, waitLevel } from "@/lib/wait";

import { useNow } from "./use-now";

const TONE = {
  ok: "bg-ok-soft text-[#14532d]",
  warn: "bg-warn-soft text-[#6b4a00]",
  late: "bg-bad-soft text-[#8c1d18]",
} as const;

/**
 * Pantalla de cocina: solo lo que hay que preparar, en grande.
 *
 * Muestra los pedidos confirmados y en preparación, el más antiguo
 * primero, con el tiempo de espera por colores. Sin precios ni datos
 * de pago: aquí no hacen falta.
 */
export function KitchenView({
  initialOrders,
  loadError,
}: {
  initialOrders: OrderWithItems[];
  loadError: string | null;
}) {
  const router = useRouter();
  const now = useNow();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("kitchen-view")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () =>
        router.refresh(),
      )
      .subscribe();

    // Red de seguridad por si Realtime se cae.
    const timer = setInterval(() => router.refresh(), 60_000);

    return () => {
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  function advance(order: OrderWithItems) {
    setError(null);
    setPendingId(order.id);
    startTransition(async () => {
      const result = await updateOrderStatus(
        order.id,
        order.status === "accepted" ? "preparing" : "ready",
      );
      if (!result.ok) setError(result.error ?? "No se pudo actualizar el pedido");
      else router.refresh();
      setPendingId(null);
    });
  }

  async function fullscreen() {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      /* el navegador no lo permite: la pantalla sigue funcionando igual */
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold">Cocina</h1>
          <p className="text-[13px] font-semibold text-ink-muted">
            {initialOrders.length}{" "}
            {initialOrders.length === 1 ? "pedido en preparación" : "pedidos en preparación"} · el
            más antiguo primero
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[13px] font-bold">
          <span className={cn("rounded-lg px-2.5 py-1.5", TONE.ok)}>A tiempo</span>
          <span className={cn("rounded-lg px-2.5 py-1.5", TONE.warn)}>
            Desde {WAIT_WARN_MINUTES} min
          </span>
          <span className={cn("rounded-lg px-2.5 py-1.5", TONE.late)}>
            Desde {WAIT_LATE_MINUTES} min
          </span>
          <button
            type="button"
            onClick={fullscreen}
            className="flex h-11 items-center gap-2 rounded-[10px] border border-line bg-white px-4 text-sm"
          >
            <Maximize className="size-4" />
            Pantalla completa
          </button>
        </div>
      </div>

      {(loadError || error) && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[10px] bg-bad-soft px-3 py-2.5 text-sm text-bad"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {loadError ?? error}
        </p>
      )}

      {initialOrders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line py-24 text-center text-ink-muted">
          Nada en la cocina ahora mismo.
        </p>
      ) : (
        <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
          {initialOrders.map((order) => {
            // La espera cuenta desde que se confirmó; si no hay marca, desde que entró.
            const since = order.accepted_at ?? order.created_at;
            const minutes = now === null ? null : minutesSince(since, now);
            const level = minutes === null ? "ok" : waitLevel(minutes);
            const busy = pendingId === order.id;

            return (
              <article
                key={order.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white"
              >
                <header className={cn("flex items-center gap-2.5 px-4 py-3", TONE[level])}>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-extrabold">{order.code}</h2>
                    <p className="truncate text-[13px] font-bold">
                      {order.order_type === "delivery" ? "Domicilio" : "Recoge"} ·{" "}
                      {order.customer_name}
                    </p>
                  </div>
                  {minutes !== null && (
                    <p className="text-[26px] font-extrabold tabular-nums">
                      {minutes}
                      <span className="text-sm"> min</span>
                    </p>
                  )}
                </header>

                <ul className="flex flex-col gap-2.5 px-4 py-3.5">
                  {order.order_items.map((item) => (
                    <li key={item.id} className="flex flex-col gap-1 text-[17px] leading-snug font-bold">
                      <span>
                        <span className="font-extrabold tabular-nums">{item.qty}×</span>{" "}
                        {item.product_name}
                      </span>
                      {item.notes && (
                        <span className="self-start rounded-md bg-warn-soft px-2 py-0.5 text-sm font-extrabold text-[#6b4a00]">
                          {item.notes}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                {order.customer_notes && (
                  <p className="mx-4 mb-3.5 rounded-[10px] bg-warn-soft px-3 py-2 text-sm font-bold text-[#6b4a00]">
                    {order.customer_notes}
                  </p>
                )}

                <div className="mt-auto px-4 pb-4">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => advance(order)}
                    className={cn(
                      "flex h-[52px] w-full items-center justify-center gap-2 rounded-xl text-base font-bold disabled:opacity-45",
                      order.status === "accepted"
                        ? "border border-line bg-white"
                        : "bg-brand-500 text-white",
                    )}
                  >
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    {order.status === "accepted" ? "Empezar a preparar" : "Listo"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
