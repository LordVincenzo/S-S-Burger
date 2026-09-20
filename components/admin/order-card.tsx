"use client";

import {
  Bike,
  Check,
  ChevronRight,
  Loader2,
  MessageCircle,
  Phone,
  Pencil,
  Receipt as ReceiptIcon,
  Store,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteOrder, markOrderUnpaid, updateOrderStatus } from "@/app/actions/admin";
import type {
  Category,
  DeliveryZone,
  OrderWithItems,
  Product,
  StoreSettings,
} from "@/lib/database.types";
import { cn, currency, formatTime, normalizePhone } from "@/lib/format";
import { STATUS_LABEL, nextStatus, whatsappLink, whatsappStatusMessage } from "@/lib/orders";
import { RelativeTime } from "@/components/relative-time";

import { DeliveryQuote } from "./delivery-quote";
import { EditOrderModal } from "./edit-order-modal";

import { PaymentModal } from "./payment-modal";
import { ReceiptModal } from "@/components/receipt-modal";

const STATUS_TONE: Record<string, string> = {
  pending: "bg-brand-50 text-brand-700 border-brand-200",
  accepted: "bg-cream text-ink border-line",
  preparing: "bg-warn-soft text-ink border-warn/40",
  ready: "bg-ok-soft text-ok border-ok/30",
  on_the_way: "bg-ok-soft text-ok border-ok/30",
  delivered: "bg-cream text-ink-muted border-line",
  cancelled: "bg-bad-soft text-bad border-bad/30",
};

export function OrderCard({
  order,
  settings,
  zones,
  products,
  categories,
}: {
  order: OrderWithItems;
  settings: StoreSettings | null;
  zones: DeliveryZone[];
  products: Product[];
  categories: Category[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [payOpen, setPayOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = nextStatus(order.status, order.order_type);
  const isClosed = order.status === "delivered" || order.status === "cancelled";
  // Mientras no se sepa cuánto cobra el domicilio, el total no es final:
  // ni se confirma el pedido ni se cobra.
  const needsQuote = order.order_type === "delivery" && !order.delivery_quoted && !isClosed;
  const phone = normalizePhone(order.customer_phone);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "No se pudo completar la acción");
      else router.refresh();
    });
  }

  function cancel() {
    const reason = window.prompt("¿Por qué se cancela el pedido? (opcional)") ?? undefined;
    if (reason === undefined) return;
    run(() => updateOrderStatus(order.id, "cancelled", reason));
  }

  function remove() {
    const confirmed = window.confirm(
      `¿Eliminar el pedido ${order.code} para siempre?

` +
        "Para un pedido real es mejor cancelarlo: así queda el registro de que existió. " +
        "Esto es para pruebas o duplicados.",
    );
    if (!confirmed) return;
    run(() => deleteOrder(order.id));
  }

  return (
    <article
      className={cn(
        "flex flex-col rounded-2xl border bg-white",
        order.status === "pending" ? "border-brand-400 ring-2 ring-brand-100" : "border-line",
      )}
    >
      <header className="flex items-start gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-extrabold">{order.code}</h3>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-bold",
                STATUS_TONE[order.status],
              )}
            >
              {STATUS_LABEL[order.status]}
            </span>
            {order.channel === "manual" && (
              <span className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                Manual
              </span>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
            <span className="font-semibold text-ink">{order.customer_name}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              {order.order_type === "delivery" ? (
                <>
                  <Bike className="size-3" /> Domicilio
                  {order.delivery_zone && ` (${order.delivery_zone.name})`}
                </>
              ) : (
                <>
                  <Store className="size-3" /> Recoge
                </>
              )}
            </span>
            <span aria-hidden>·</span>
            <span>
              {formatTime(order.created_at)} · <RelativeTime iso={order.created_at} />
            </span>
          </p>
        </div>

        <p className="text-right text-lg font-extrabold whitespace-nowrap">
          {currency(order.total)}
        </p>
      </header>

      <div className="flex-1 space-y-3 px-4 py-3">
        <ul className="space-y-1.5 text-sm">
          {order.order_items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>
                <span className="font-bold tabular-nums">{item.qty}×</span> {item.product_name}
                {item.notes && (
                  <span className="block text-xs text-brand-600 italic">↳ {item.notes}</span>
                )}
              </span>
              <span className="tabular-nums text-ink-muted">{currency(item.line_total)}</span>
            </li>
          ))}
        </ul>

        {order.customer_notes && (
          <p className="rounded-xl bg-warn-soft px-3 py-2 text-xs">
            <span className="font-bold">Comentario:</span> {order.customer_notes}
          </p>
        )}

        {order.order_type === "delivery" && (
          <p className="rounded-xl bg-cream px-3 py-2 text-xs">
            <span className="font-bold">Dirección:</span> {order.delivery_address}
            {order.delivery_notes && (
              <span className="block text-ink-muted">{order.delivery_notes}</span>
            )}
            {order.delivery_quoted && (
              <span className="mt-1 flex flex-wrap items-center gap-x-2 text-ink-muted">
                <span>
                  Domicilio {currency(order.delivery_fee)} · Comida{" "}
                  {currency(order.subtotal)}
                </span>
                {!isClosed && (
                  <button
                    type="button"
                    onClick={() => setQuoteOpen((open) => !open)}
                    className="font-bold text-brand-600 underline underline-offset-2"
                  >
                    {quoteOpen ? "Cerrar" : "Cambiar"}
                  </button>
                )}
              </span>
            )}
          </p>
        )}

        {(needsQuote || quoteOpen) && (
          <DeliveryQuote
            orderId={order.id}
            zones={zones}
            address={order.delivery_address}
            current={needsQuote ? null : order.delivery_fee}
            onDone={() => setQuoteOpen(false)}
          />
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {order.payment_status === "paid" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2.5 py-1 font-bold text-ok">
              <Check className="size-3" />
              Pagado
              {order.payment_method ? ` · ${order.payment_method}` : ""}
            </span>
          ) : (
            <span className="rounded-full bg-warn-soft px-2.5 py-1 font-bold">
              Pendiente de pago
            </span>
          )}

          {order.payment_status === "pending" && order.cash_received != null && (
            <span className="text-ink-muted">
              Paga con {currency(order.cash_received)} · devuelta{" "}
              {currency(order.cash_received - order.total)}
            </span>
          )}
        </div>

        {error && <p className="rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad">{error}</p>}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
        {next && (
          <button
            type="button"
            disabled={pending || needsQuote}
            title={needsQuote ? "Primero ponle valor al domicilio" : undefined}
            onClick={() => run(() => updateOrderStatus(order.id, next))}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ChevronRight className="size-4" />
            )}
            {order.status === "pending" ? "Aceptar pedido" : STATUS_LABEL[next]}
          </button>
        )}

        {order.payment_status === "pending" ? (
          <button
            type="button"
            disabled={needsQuote}
            title={needsQuote ? "Primero ponle valor al domicilio" : undefined}
            onClick={() => setPayOpen(true)}
            className="rounded-xl border border-ok/40 bg-ok-soft px-3 py-2.5 text-sm font-bold text-ok disabled:opacity-40"
          >
            Registrar pago
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setReceiptOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2.5 text-sm font-bold"
            >
              <ReceiptIcon className="size-4" />
              Comprobante
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => markOrderUnpaid(order.id))}
              aria-label="Deshacer el pago"
              title="Deshacer el pago"
              className="grid size-10 place-items-center rounded-xl border border-line text-ink-muted"
            >
              <Undo2 className="size-4" />
            </button>
          </>
        )}

        {phone && (
          <>
            <a
              href={`tel:+${phone}`}
              aria-label="Llamar al cliente"
              className="grid size-10 place-items-center rounded-xl border border-line text-ink-muted"
            >
              <Phone className="size-4" />
            </a>
            <a
              href={whatsappLink(phone, whatsappStatusMessage(order))}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Escribir por WhatsApp"
              className="grid size-10 place-items-center rounded-xl border border-line text-ink-muted"
            >
              <MessageCircle className="size-4" />
            </a>
          </>
        )}

      </footer>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-4 py-2 text-xs">
        {!isClosed && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1 font-semibold text-ink-muted hover:text-ink"
          >
            <Pencil className="size-3" />
            Editar
          </button>
        )}
        {!isClosed && (
          <button
            type="button"
            disabled={pending}
            onClick={cancel}
            className="inline-flex items-center gap-1 font-semibold text-ink-muted hover:text-bad"
          >
            <X className="size-3" />
            Cancelar
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={remove}
          className="inline-flex items-center gap-1 font-semibold text-ink-muted hover:text-bad"
        >
          <Trash2 className="size-3" />
          Eliminar
        </button>
      </div>

      <PaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        orderId={order.id}
        orderCode={order.code}
        total={order.total}
        suggestedMethod={order.payment_method}
        suggestedCash={order.cash_received}
        onPaid={() => {
          setPayOpen(false);
          setReceiptOpen(true);
        }}
      />

      <EditOrderModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        order={order}
        products={products}
        categories={categories}
      />

      <ReceiptModal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        data={{
          code: order.code,
          createdAt: order.created_at,
          customerName: order.customer_name,
          customerPhone: order.customer_phone,
          orderType: order.order_type,
          address: order.delivery_address,
          notes: order.customer_notes,
          items: order.order_items,
          subtotal: order.subtotal,
          deliveryFee: order.delivery_fee,
          deliveryQuoted: order.delivery_quoted,
          total: order.total,
          paid: order.payment_status === "paid",
          paymentMethod: order.payment_method,
          paymentRef: order.payment_ref,
          paidAt: order.paid_at,
          cashReceived: order.cash_received,
          storeName: settings?.store_name ?? "S&S Burger",
          storeAddress: settings?.store_address,
          storePhone: settings?.whatsapp_phone,
        }}
      />
    </article>
  );
}
