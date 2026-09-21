"use client";

import { AlertCircle, Bike, Loader2, Receipt as ReceiptIcon, Search, Store, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { createManualOrder } from "@/app/actions/admin";
import { ReceiptModal } from "@/components/receipt-modal";
import type {
  Category,
  CreateOrderResult,
  DeliveryZone,
  OrderType,
  Product,
} from "@/lib/database.types";
import { cn, currency } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/orders";

type Props = {
  open: boolean;
  onClose: () => void;
  products: Product[];
  categories: Category[];
  zones: DeliveryZone[];
  settings: { store_name?: string; store_address?: string | null; whatsapp_phone?: string | null } | null;
};

type Line = { productId: string; qty: number; notes: string };

/**
 * Pedido tomado por teléfono o en el mostrador.
 *
 * Pensada para el computador del local: catálogo a la izquierda con
 * toda la carta a la vista, pedido y cobro a la derecha. El encargado
 * está atendiendo a alguien mientras la usa, así que todo tiene que
 * caber sin desplazarse ni cambiar de pestaña.
 */
export function ManualOrderModal({
  open,
  onClose,
  products,
  categories,
  zones,
  settings,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>("todas");
  const [lines, setLines] = useState<Line[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("pickup");
  const [zoneId, setZoneId] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [charging, setCharging] = useState(true);
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [cash, setCash] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateOrderResult | null>(null);
  const [snapshot, setSnapshot] = useState<Line[]>([]);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter(
      (product) =>
        (categoryId === "todas" || product.category_id === categoryId) &&
        (!needle || product.name.toLowerCase().includes(needle)),
    );
  }, [products, categoryId, query]);

  const subtotal = lines.reduce(
    (acc, line) => acc + (byId.get(line.productId)?.price ?? 0) * line.qty,
    0,
  );
  const fee = orderType === "delivery" ? (zones.find((z) => z.id === zoneId)?.fee ?? 0) : 0;
  const total = subtotal + fee;
  const received = Number(cash || 0);
  const change = received - total;

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => searchRef.current?.focus(), 80);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !created) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, created]);

  if (!open) return null;

  function bump(productId: string, delta: number) {
    setLines((current) => {
      const index = current.findIndex((line) => line.productId === productId);
      if (index === -1) return delta > 0 ? [...current, { productId, qty: 1, notes: "" }] : current;
      const qty = current[index].qty + delta;
      if (qty <= 0) return current.filter((_, i) => i !== index);
      return current.map((line, i) => (i === index ? { ...line, qty } : line));
    });
  }

  function reset() {
    setLines([]);
    setName("");
    setPhone("");
    setAddress("");
    setNotes("");
    setQuery("");
    setCash("");
    setOrderType("pickup");
    setError(null);
    setCreated(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createManualOrder({
        customer_name: name || "Mostrador",
        customer_phone: phone || null,
        order_type: orderType,
        delivery_zone_id: orderType === "delivery" ? zoneId || null : null,
        delivery_address: orderType === "delivery" ? address : null,
        customer_notes: notes || null,
        mark_paid: charging,
        payment_method: charging ? method : null,
        cash_received: charging && method === "Efectivo" && cash ? received : null,
        items: lines.map((line) => ({
          product_id: line.productId,
          qty: line.qty,
          notes: line.notes || null,
        })),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Se guarda el pedido recién creado para poder mandarle el
      // comprobante al cliente sin salir de esta pantalla.
      setSnapshot(lines);
      setCreated(result.data);
      router.refresh();
    });
  }

  if (created) {
    return (
      <Created
        order={created}
        lines={snapshot}
        byId={byId}
        customerName={name || "Mostrador"}
        phone={phone}
        orderType={orderType}
        address={address}
        notes={notes}
        paid={charging}
        method={method}
        cashReceived={charging && method === "Efectivo" && cash ? received : null}
        settings={settings}
        onAnother={reset}
        onClose={() => {
          reset();
          onClose();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-3 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="animate-in-up flex h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white"
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div>
            <h2 className="text-lg font-extrabold">Pedido manual</h2>
            <p className="text-xs text-ink-muted">
              Para mostrador o teléfono. Entra por la misma bandeja que los de la web.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid size-9 place-items-center rounded-full bg-cream"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_420px]">
          {/* ---------------- catálogo ---------------- */}
          <section className="flex min-h-0 flex-col border-r border-line">
            <div className="border-b border-line p-4">
              <div className="relative">
                <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    // Enter agrega el primer resultado: se puede tomar un
                    // pedido entero sin soltar el teclado.
                    if (event.key === "Enter" && visible[0]) {
                      event.preventDefault();
                      bump(visible[0].id, 1);
                      setQuery("");
                    }
                  }}
                  placeholder="Buscar producto y Enter para agregar"
                  className="w-full rounded-xl border border-line py-2.5 pr-3 pl-10 text-sm outline-none focus:border-brand-400"
                />
              </div>

              <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
                {[{ id: "todas", name: "Todo" }, ...categories].map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setCategoryId(category.id)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition",
                      categoryId === category.id
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-line text-ink-muted hover:bg-cream",
                    )}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((product) => {
                  const qty = lines.find((line) => line.productId === product.id)?.qty ?? 0;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => bump(product.id, 1)}
                      className={cn(
                        "relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition",
                        qty > 0
                          ? "border-brand-400 bg-brand-50"
                          : "border-line hover:border-brand-200 hover:bg-cream",
                        !product.is_available && "opacity-60",
                      )}
                    >
                      <span className="text-sm leading-tight font-bold text-balance">
                        {product.name}
                      </span>
                      <span className="text-sm font-extrabold text-brand-600">
                        {currency(product.price)}
                      </span>
                      {!product.is_available && (
                        <span className="text-[10px] font-bold text-ink-muted uppercase">
                          Agotado
                        </span>
                      )}
                      {qty > 0 && (
                        <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-brand-500 text-xs font-extrabold text-white">
                          {qty}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {visible.length === 0 && (
                <p className="py-16 text-center text-sm text-ink-muted">
                  Nada coincide con «{query}».
                </p>
              )}
            </div>
          </section>

          {/* ---------------- pedido y cobro ---------------- */}
          <section className="flex min-h-0 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <div>
                <p className="mb-2 text-xs font-extrabold tracking-wide text-ink-muted uppercase">
                  El pedido
                </p>

                {lines.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line py-8 text-center text-xs text-ink-muted">
                    Toca un producto de la izquierda para agregarlo.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {lines.map((line) => {
                      const product = byId.get(line.productId);
                      return (
                        <li key={line.productId} className="rounded-xl border border-line p-2.5">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold">{product?.name}</p>
                              <p className="text-xs text-ink-muted">
                                {currency(product?.price ?? 0)} c/u
                              </p>
                            </div>
                            <span className="text-sm font-extrabold tabular-nums">
                              {currency((product?.price ?? 0) * line.qty)}
                            </span>
                          </div>

                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex items-center gap-1 rounded-lg bg-cream p-1">
                              <button
                                type="button"
                                onClick={() => bump(line.productId, -1)}
                                className="size-7 rounded-md bg-white text-sm font-bold"
                                aria-label="Quitar uno"
                              >
                                −
                              </button>
                              <span className="min-w-6 text-center text-sm font-bold tabular-nums">
                                {line.qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => bump(line.productId, 1)}
                                className="size-7 rounded-md bg-brand-500 text-sm font-bold text-white"
                                aria-label="Agregar uno"
                              >
                                +
                              </button>
                            </div>

                            <input
                              value={line.notes}
                              onChange={(event) =>
                                setLines((current) =>
                                  current.map((item) =>
                                    item.productId === line.productId
                                      ? { ...item, notes: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              placeholder="Sin cebolla…"
                              maxLength={160}
                              className="min-w-0 flex-1 rounded-lg border border-line bg-cream px-2.5 py-1.5 text-xs outline-none focus:border-brand-400"
                            />

                            <button
                              type="button"
                              onClick={() =>
                                setLines((c) => c.filter((l) => l.productId !== line.productId))
                              }
                              className="grid size-8 shrink-0 place-items-center rounded-lg text-bad"
                              aria-label="Eliminar"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="space-y-2 border-t border-line pt-4">
                <p className="text-xs font-extrabold tracking-wide text-ink-muted uppercase">
                  Cliente
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Nombre"
                    maxLength={80}
                    className={inputClass}
                  />
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Celular"
                    inputMode="tel"
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { type: "pickup" as const, label: "Mostrador", Icon: Store },
                      { type: "delivery" as const, label: "Domicilio", Icon: Bike },
                    ]
                  ).map(({ type, label, Icon }) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setOrderType(type)}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-bold transition",
                        orderType === type
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-line text-ink-muted",
                      )}
                    >
                      <Icon className="size-4" />
                      {label}
                    </button>
                  ))}
                </div>

                {orderType === "delivery" && (
                  <>
                    {zones.length > 0 && (
                      <select
                        value={zoneId}
                        onChange={(event) => setZoneId(event.target.value)}
                        className={inputClass}
                      >
                        <option value="">Zona — sin costo</option>
                        {zones.map((zone) => (
                          <option key={zone.id} value={zone.id}>
                            {zone.name} — {currency(zone.fee)}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      placeholder="Dirección"
                      maxLength={200}
                      className={inputClass}
                    />
                  </>
                )}

                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Comentarios del pedido"
                  rows={2}
                  maxLength={400}
                  className={cn(inputClass, "resize-none")}
                />
              </div>

              <div className="space-y-2 border-t border-line pt-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={charging}
                    onChange={(event) => setCharging(event.target.checked)}
                    className="size-4"
                  />
                  Cobrar ahora
                </label>

                {charging && (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {PAYMENT_METHODS.filter((option) => option !== "Otro").map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setMethod(option)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                            method === option
                              ? "border-brand-500 bg-brand-50 text-brand-700"
                              : "border-line text-ink-muted",
                          )}
                        >
                          {option}
                        </button>
                      ))}
                    </div>

                    {method === "Efectivo" && (
                      <div className="flex items-center gap-2">
                        <input
                          value={cash}
                          onChange={(event) => setCash(event.target.value.replace(/\D/g, ""))}
                          inputMode="numeric"
                          placeholder="¿Con cuánto paga?"
                          className={cn(inputClass, "flex-1")}
                        />
                        {received > 0 && (
                          <span
                            className={cn(
                              "shrink-0 rounded-lg px-3 py-2 text-xs font-extrabold",
                              change >= 0 ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad",
                            )}
                          >
                            {change >= 0
                              ? `Devuelta ${currency(change)}`
                              : `Faltan ${currency(-change)}`}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <footer className="space-y-2 border-t border-line bg-cream/60 p-4">
              {error && (
                <p className="flex items-start gap-2 rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {error}
                </p>
              )}

              <dl className="space-y-0.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Subtotal</dt>
                  <dd className="tabular-nums">{currency(subtotal)}</dd>
                </div>
                {orderType === "delivery" && (
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Domicilio</dt>
                    <dd className="tabular-nums">{currency(fee)}</dd>
                  </div>
                )}
                <div className="flex justify-between pt-1 text-2xl font-extrabold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{currency(total)}</dd>
                </div>
              </dl>

              <button
                type="submit"
                disabled={pending || lines.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3.5 text-base font-bold text-white disabled:opacity-40"
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                Registrar pedido
              </button>
            </footer>
          </section>
        </div>
      </form>
    </div>
  );
}

/** Pantalla posterior: el pedido ya entró y toca mandarle el comprobante. */
function Created({
  order,
  lines,
  byId,
  customerName,
  phone,
  orderType,
  address,
  notes,
  paid,
  method,
  cashReceived,
  settings,
  onAnother,
  onClose,
}: {
  order: CreateOrderResult;
  lines: Line[];
  byId: Map<string, Product>;
  customerName: string;
  phone: string;
  orderType: OrderType;
  address: string;
  notes: string;
  paid: boolean;
  method: string;
  cashReceived: number | null;
  settings: Props["settings"];
  onAnother: () => void;
  onClose: () => void;
}) {
  const [receiptOpen, setReceiptOpen] = useState(true);

  const items = lines.map((line) => {
    const product = byId.get(line.productId);
    return {
      product_name: product?.name ?? "",
      qty: line.qty,
      unit_price: product?.price ?? 0,
      line_total: (product?.price ?? 0) * line.qty,
      notes: line.notes || null,
    };
  });

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
        <div className="animate-in-up w-full max-w-sm rounded-3xl bg-white p-6 text-center">
          <p className="text-sm font-bold text-ok">Pedido registrado</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight">{order.code}</p>
          <p className="text-sm text-ink-muted">{currency(order.total)}</p>

          <button
            type="button"
            onClick={() => setReceiptOpen(true)}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3 text-sm font-bold text-white"
          >
            <ReceiptIcon className="size-4" />
            Ver y enviar comprobante
          </button>
          <button
            type="button"
            onClick={onAnother}
            className="mt-2 w-full rounded-2xl border border-line py-3 text-sm font-bold"
          >
            Registrar otro pedido
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full py-2 text-sm font-semibold text-ink-muted"
          >
            Cerrar
          </button>
        </div>
      </div>

      <ReceiptModal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        token={order.public_token}
        data={{
          code: order.code,
          createdAt: new Date().toISOString(),
          customerName,
          customerPhone: phone || null,
          orderType,
          address: orderType === "delivery" ? address : null,
          notes: notes || null,
          items,
          subtotal: order.subtotal,
          deliveryFee: order.delivery_fee,
          deliveryQuoted: order.delivery_quoted,
          total: order.total,
          paid,
          paymentMethod: paid ? method : null,
          cashReceived,
          storeName: settings?.store_name ?? "S&S Burger",
          storeAddress: settings?.store_address,
          storePhone: settings?.whatsapp_phone,
        }}
      />
    </>
  );
}

const inputClass =
  "w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none transition focus:border-brand-400";
