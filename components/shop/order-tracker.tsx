"use client";

import { Check, Home, MessageCircle, Receipt as ReceiptIcon, XCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ReceiptModal } from "@/components/receipt-modal";
import { RelativeTime } from "@/components/relative-time";
import type { OrderStatus, PublicOrder, StoreSettings } from "@/lib/database.types";
import { cn, currency, formatTime } from "@/lib/format";
import { STATUS_CUSTOMER_LABEL, whatsappLink } from "@/lib/orders";
import { createClient } from "@/lib/supabase/client";

type Props = {
  token: string;
  initialOrder: PublicOrder;
  settings: StoreSettings | null;
  justCreated: boolean;
};

const PICKUP_STEPS: OrderStatus[] = ["pending", "accepted", "preparing", "ready", "delivered"];
const DELIVERY_STEPS: OrderStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "on_the_way",
  "delivered",
];

const STEP_TITLE: Partial<Record<OrderStatus, string>> = {
  pending: "Recibido",
  accepted: "Confirmado",
  preparing: "En preparación",
  ready: "Listo",
  on_the_way: "En camino",
  delivered: "Entregado",
};

export function OrderTracker({ token, initialOrder, settings, justCreated }: Props) {
  const [order, setOrder] = useState(initialOrder);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [live, setLive] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(() => new Date().toISOString());

  const closed = order.status === "delivered" || order.status === "cancelled";

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc("get_order_public", { p_token: token });
    if (data) {
      setOrder(data as PublicOrder);
      setUpdatedAt(new Date().toISOString());
    }
  }, [token]);

  /*
   * Seguimiento en vivo.
   *
   * El cliente es anónimo: RLS no le deja leer la tabla de pedidos, así
   * que no puede escucharla por Realtime como hace el panel. En su lugar
   * escucha un canal cuyo nombre es su propio token secreto. El aviso no
   * trae datos — solo dice "algo cambió" — y entonces vuelve a pedir su
   * pedido por get_order_public(), que ya filtra lo que puede ver.
   * Ver supabase/migrations/0006_seguimiento_en_vivo.sql.
   */
  useEffect(() => {
    if (closed) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`pedido:${token}`)
      .on("broadcast", { event: "actualizado" }, () => void refetch())
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      setLive(false);
      void supabase.removeChannel(channel);
    };
  }, [token, closed, refetch]);

  // Red de seguridad: si el socket se cae o el celular durmió la pestaña,
  // al volver a mirar la pantalla se consulta de nuevo.
  useEffect(() => {
    if (closed) return;

    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch();
    };

    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => void refetch(), 45_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [closed, refetch]);

  const steps = order.order_type === "delivery" ? DELIVERY_STEPS : PICKUP_STEPS;
  const currentIndex = steps.indexOf(order.status);
  const cancelled = order.status === "cancelled";
  const upNext = currentIndex >= 0 ? steps[currentIndex + 1] : undefined;
  // Entregado no es "aquí vas", es "llegaste": el último paso se pinta
  // cumplido, no en curso. Un círculo de color de marca junto a "¡Buen
  // provecho!" se lee como si algo hubiera fallado.
  const finished = order.status === "delivered";
  const pendingFee = order.order_type === "delivery" && !order.delivery_quoted;

  const waHref = whatsappLink(
    settings?.whatsapp_phone,
    `Hola, escribo por el pedido ${order.code}.`,
  );

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-5">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5">
          <Image
            src="/img/logo_ss.png"
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 object-contain"
            priority
          />
          <span className="truncate text-base font-extrabold tracking-tight">
            {settings?.store_name ?? "S&S Burger"}
          </span>
        </Link>

        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Escribirnos por WhatsApp"
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-white text-ink-muted"
        >
          <MessageCircle className="size-4" />
        </a>
      </header>

      {justCreated && (
        <p className="animate-in-up mb-3 rounded-xl bg-ok-soft px-4 py-2.5 text-center text-sm font-bold text-ok">
          ¡Pedido recibido! Ya le llegó al local.
        </p>
      )}

      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-ink-muted uppercase">
              Pedido
            </p>
            <p className="text-2xl font-extrabold tracking-tight">{order.code}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-extrabold">{currency(order.total)}</p>
            {pendingFee && (
              <p className="text-[11px] text-ink-muted">+ domicilio por confirmar</p>
            )}
          </div>
        </div>

        {cancelled ? (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-bad-soft px-3 py-2.5 text-sm font-bold text-bad">
            <XCircle className="size-4 shrink-0" />
            {STATUS_CUSTOMER_LABEL.cancelled}
          </p>
        ) : (
          <>
            <ol className="mt-5 flex items-center" aria-label="Estado del pedido">
              {steps.map((step, index) => {
                const done = finished || index < currentIndex;
                const active = !finished && index === currentIndex;
                return (
                  <li
                    key={step}
                    className={cn("flex items-center", index < steps.length - 1 && "flex-1")}
                  >
                    <span
                      title={STEP_TITLE[step]}
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full border-2 transition",
                        done && "border-ok bg-ok text-white",
                        active && "border-brand-500 bg-brand-500 text-white",
                        !done && !active && "border-line bg-white",
                      )}
                    >
                      {done ? (
                        <Check className="size-4" />
                      ) : (
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            active ? "animate-pulse bg-white" : "bg-line",
                          )}
                        />
                      )}
                    </span>
                    {index < steps.length - 1 && (
                      <span
                        className={cn("mx-1 h-0.5 flex-1 rounded", done ? "bg-ok" : "bg-line")}
                      />
                    )}
                  </li>
                );
              })}
            </ol>

            <p className="mt-4 text-base font-extrabold text-balance">
              {STATUS_CUSTOMER_LABEL[order.status]}
            </p>
            {upNext && (
              <p className="text-sm text-ink-muted">Sigue: {STEP_TITLE[upNext]}</p>
            )}
          </>
        )}

        <p className="mt-4 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
          <span>Pedido a las {formatTime(order.created_at)}</span>
          {!closed && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    live ? "animate-pulse bg-ok" : "bg-line",
                  )}
                  aria-hidden
                />
                {live ? (
                  "En vivo"
                ) : (
                  <>
                    actualizado <RelativeTime iso={updatedAt} />
                  </>
                )}
              </span>
            </>
          )}
        </p>
      </section>

      {order.payment_status === "paid" && (
        <p className="mt-3 rounded-xl bg-ok-soft px-4 py-2.5 text-center text-sm font-bold text-ok">
          Pago confirmado
        </p>
      )}

      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={() => setReceiptOpen(true)}
          className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-white py-3 text-sm font-bold"
        >
          <ReceiptIcon className="size-4" />
          Ver comprobante
        </button>
        <Link
          href="/"
          className="flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-semibold text-ink-muted"
        >
          <Home className="size-4" />
          Volver a la carta
        </Link>
      </div>

      <ReceiptModal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        data={{
          code: order.code,
          createdAt: order.created_at,
          customerName: order.customer_name,
          orderType: order.order_type,
          address: order.delivery_address,
          notes: order.customer_notes,
          items: order.items,
          subtotal: order.subtotal,
          deliveryFee: order.delivery_fee,
          deliveryQuoted: order.delivery_quoted,
          total: order.total,
          paid: order.payment_status === "paid",
          paymentMethod: order.payment_method,
          paymentRef: order.payment_ref,
          paidAt: order.paid_at,
          storeName: settings?.store_name ?? "S&S Burger",
          storeAddress: settings?.store_address,
          storePhone: settings?.whatsapp_phone,
        }}
      />
    </div>
  );
}
