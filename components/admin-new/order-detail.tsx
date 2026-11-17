"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteOrder, markOrderUnpaid, updateOrderStatus } from "@/app/actions/admin";
import { DeliveryQuote } from "@/components/admin/delivery-quote";
import { EditOrderModal } from "@/components/admin/edit-order-modal";
import { PaymentModal } from "@/components/admin/payment-modal";
import { ReceiptModal } from "@/components/receipt-modal";
import { RelativeTime } from "@/components/relative-time";
import type {
  Category,
  DeliveryZone,
  OrderWithItems,
  Product,
  StoreSettings,
} from "@/lib/database.types";
import { cn, currency, formatTime, normalizePhone } from "@/lib/format";
import { directionsUrl } from "@/lib/maps";
import { nextStatus, whatsappLink, whatsappStatusMessage } from "@/lib/orders";

import { STATUS_CHIP, nextActionLabel, orderSteps } from "./status";

const OUTLINE =
  "grid h-11 place-items-center rounded-[10px] border border-line px-3 text-[13px] font-bold whitespace-nowrap";

/**
 * Detalle del pedido elegido en la lista.
 *
 * Hace lo mismo que la tarjeta del panel anterior (mismas acciones del
 * servidor y las mismas ventanas de pago, edición y comprobante), pero
 * en una columna fija para no perder de vista la lista.
 */
export function OrderDetail({
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
  // Sin valor de domicilio el total no es final: ni se confirma ni se cobra.
  const needsQuote = order.order_type === "delivery" && !order.delivery_quoted && !isClosed;
  const phone = normalizePhone(order.customer_phone);
  const paid = order.payment_status === "paid";
  const chip = STATUS_CHIP[order.status];

  const steps = orderSteps(order.order_type);
  const stepIndex = steps.indexOf(order.status);

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
      `¿Eliminar el pedido ${order.code} para siempre?\n\n` +
        "Para un pedido real es mejor cancelarlo: así queda el registro de que existió. " +
        "Esto es para pruebas o duplicados.",
    );
    if (!confirmed) return;
    run(() => deleteOrder(order.id));
  }

  return (
    <aside
      aria-label={`Detalle del pedido ${order.code}`}
      className="flex flex-col gap-3.5 rounded-2xl border border-line bg-white p-5"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold">{order.code}</h2>
          <span className={cn("rounded-md px-2.5 py-1 text-xs font-bold", chip.className)}>
            {chip.label}
          </span>
        </div>
        <p className="text-[13px] text-ink-muted">
          {formatTime(order.created_at)} · <RelativeTime iso={order.created_at} /> ·{" "}
          {order.channel === "manual" ? "Pedido manual" : "Pedido web"}
        </p>
        {order.status !== "cancelled" && (
          <div aria-hidden className="flex gap-1">
            {steps.map((step, index) => (
              <span
                key={step}
                className={cn(
                  "h-[5px] flex-1 rounded-full",
                  index < stepIndex ? "bg-ok" : index === stepIndex ? "bg-brand-500" : "bg-line",
                )}
              />
            ))}
          </div>
        )}
        {order.status === "cancelled" && order.cancel_reason && (
          <p className="text-[13px] text-bad">Motivo: {order.cancel_reason}</p>
        )}
      </div>

      <div className="flex items-center gap-2 border-y border-line py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold">{order.customer_name}</p>
          {order.customer_phone && (
            <p className="text-[13px] text-ink-muted">{order.customer_phone}</p>
          )}
        </div>
        {phone && (
          <>
            <a href={`tel:+${phone}`} className={OUTLINE}>
              Llamar
            </a>
            <a
              href={whatsappLink(phone, whatsappStatusMessage(order))}
              target="_blank"
              rel="noopener noreferrer"
              className={OUTLINE}
            >
              WhatsApp
            </a>
          </>
        )}
      </div>

      {order.order_type === "delivery" ? (
        <div className="flex items-end gap-2.5 text-sm">
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-xs font-bold text-ink-muted">
              Domicilio
              {order.delivery_city && ` · ${order.delivery_city}`}
              {order.delivery_zone && ` · zona ${order.delivery_zone.name}`}
            </p>
            <p className="font-bold">{order.delivery_address}</p>
            {order.delivery_notes && <p className="text-ink-muted">{order.delivery_notes}</p>}
          </div>
          {order.delivery_address && (
            <a
              href={directionsUrl(order.delivery_address, order.delivery_city)}
              target="_blank"
              rel="noopener noreferrer"
              className={OUTLINE}
            >
              Cómo llegar
            </a>
          )}
        </div>
      ) : (
        <p className="text-sm font-bold">Recoge en el local</p>
      )}

      {(needsQuote || quoteOpen) && (
        <DeliveryQuote
          orderId={order.id}
          zones={zones}
          address={order.delivery_address}
          city={order.delivery_city}
          current={needsQuote ? null : order.delivery_fee}
          onDone={() => setQuoteOpen(false)}
        />
      )}

      <ul className="space-y-2 border-t border-line pt-3 text-sm">
        {order.order_items.map((item) => (
          <li key={item.id} className="flex justify-between gap-3">
            <span>
              <span className="font-bold tabular-nums">{item.qty}×</span> {item.product_name}
              {item.notes && (
                <span className="block text-[13px] font-bold text-[#6b4a00]">{item.notes}</span>
              )}
            </span>
            <span className="tabular-nums">{currency(item.line_total)}</span>
          </li>
        ))}
      </ul>

      {order.customer_notes && (
        <p className="rounded-[10px] bg-warn-soft px-3 py-2.5 text-[13px] text-[#6b4a00]">
          <span className="font-bold">Comentario:</span> {order.customer_notes}
        </p>
      )}

      <dl className="space-y-1.5 text-sm">
        {order.order_type === "delivery" && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Domicilio</dt>
            <dd className="flex items-center gap-2 font-bold">
              {order.delivery_quoted ? currency(order.delivery_fee) : "Por definir"}
              {order.delivery_quoted && !isClosed && (
                <button
                  type="button"
                  onClick={() => setQuoteOpen((open) => !open)}
                  className="text-[13px] font-bold text-brand-600 underline underline-offset-2"
                >
                  {quoteOpen ? "Cerrar" : "Cambiar"}
                </button>
              )}
            </dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[15px] font-extrabold">Total</dt>
          <dd className="text-[22px] font-extrabold">
            {currency(order.total)}
            {needsQuote && <span className="text-sm font-bold"> + domicilio</span>}
          </dd>
        </div>
      </dl>

      <p
        className={cn(
          "rounded-[10px] px-3 py-2.5 text-[13px] font-bold",
          paid ? "bg-ok-soft text-[#14532d]" : "bg-warn-soft text-[#6b4a00]",
        )}
      >
        {paid
          ? `Pagado${order.payment_method ? ` con ${order.payment_method}` : ""}`
          : order.cash_received != null
            ? `Pendiente de pago · paga con ${currency(order.cash_received)}, devuelta ${currency(order.cash_received - order.total)}`
            : "Pendiente de pago"}
      </p>

      {error && (
        <p role="alert" className="rounded-[10px] bg-bad-soft px-3 py-2.5 text-[13px] text-bad">
          {error}
        </p>
      )}

      {next && (
        <button
          type="button"
          disabled={pending || needsQuote}
          title={needsQuote ? "Primero ponle valor al domicilio" : undefined}
          onClick={() => run(() => updateOrderStatus(order.id, next))}
          className="flex h-[52px] items-center justify-center gap-2 rounded-xl bg-brand-500 text-base font-bold text-white disabled:opacity-45"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {nextActionLabel(order.status, order.order_type)}
        </button>
      )}

      <div className="grid grid-cols-2 gap-2">
        {paid ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => markOrderUnpaid(order.id))}
            className={cn(OUTLINE, "text-sm")}
          >
            Deshacer pago
          </button>
        ) : (
          <button
            type="button"
            disabled={needsQuote || order.status === "cancelled"}
            title={needsQuote ? "Primero ponle valor al domicilio" : undefined}
            onClick={() => setPayOpen(true)}
            className={cn(OUTLINE, "text-sm disabled:opacity-45")}
          >
            Registrar pago
          </button>
        )}
        <button type="button" onClick={() => setReceiptOpen(true)} className={cn(OUTLINE, "text-sm")}>
          Comprobante
        </button>
      </div>

      <div className="flex flex-wrap gap-x-2 text-sm font-bold">
        {!isClosed && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setEditOpen(true)}
            className="h-11 px-2 text-ink-muted"
          >
            Editar pedido
          </button>
        )}
        {!isClosed && (
          <button type="button" disabled={pending} onClick={cancel} className="h-11 px-2 text-bad">
            Cancelar pedido
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={remove}
          className="h-11 px-2 text-ink-muted"
        >
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
        token={order.public_token}
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
          paid,
          paymentMethod: order.payment_method,
          paymentRef: order.payment_ref,
          paidAt: order.paid_at,
          cashReceived: order.cash_received,
          storeName: settings?.store_name ?? "S&S Burger",
          storeAddress: settings?.store_address,
          storePhone: settings?.whatsapp_phone,
        }}
      />
    </aside>
  );
}
