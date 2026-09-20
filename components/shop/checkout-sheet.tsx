"use client";

import { AlertCircle, ArrowLeft, Bike, Loader2, Store, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { submitOrder } from "@/app/actions/order";
import type { DeliveryZone, OrderType, StoreSettings } from "@/lib/database.types";
import { cn, currency } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/orders";

import type { CartLine } from "./use-cart";
import type { Product } from "@/lib/database.types";

type Line = CartLine & { product: Product };

type Props = {
  open: boolean;
  onClose: () => void;
  lines: Line[];
  subtotal: number;
  settings: StoreSettings | null;
  zones: DeliveryZone[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onDrop: (id: string) => void;
  onNotes: (id: string, notes: string) => void;
  onSuccess: () => void;
};

export function CheckoutSheet({
  open,
  onClose,
  lines,
  subtotal,
  settings,
  zones,
  onAdd,
  onRemove,
  onDrop,
  onNotes,
  onSuccess,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<"cart" | "details">("cart");
  const [error, setError] = useState<string | null>(null);

  const deliveryAllowed = settings?.delivery_enabled ?? true;
  const pickupAllowed = settings?.pickup_enabled ?? true;

  // Los datos del cliente se recuerdan en este navegador: el mismo vecino
  // pide cada semana y no tiene por qué volver a escribir su dirección.
  // Se leen al inicializar el estado, no en un efecto: el panel está
  // cerrado en el primer render, así que no hay nada que rehidratar mal.
  const saved = useState(readSavedCustomer)[0];

  const [name, setName] = useState(saved.name ?? "");
  const [phone, setPhone] = useState(saved.phone ?? "");
  const [orderType, setOrderType] = useState<OrderType>(
    deliveryAllowed ? "delivery" : "pickup",
  );
  const [address, setAddress] = useState(saved.address ?? "");
  const [addressNotes, setAddressNotes] = useState(saved.addressNotes ?? "");
  const [comments, setComments] = useState("");
  const [payment, setPayment] = useState<string>(PAYMENT_METHODS[0]);
  const [cash, setCash] = useState("");

  // Cada vez que se vuelve a abrir el carrito, se empieza por el principio.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setStep("cart");
  }

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const isDelivery = orderType === "delivery";
  const minOrder = settings?.min_order ?? 0;
  const belowMinimum = subtotal < minOrder;

  // Solo orientativo. El valor real lo pone el local al ver la dirección,
  // así que aquí no se suma nada al total.
  const fees = zones.map((z) => z.fee);
  const feeRange =
    fees.length === 0
      ? null
      : Math.min(...fees) === Math.max(...fees)
        ? currency(fees[0])
        : `entre ${currency(Math.min(...fees))} y ${currency(Math.max(...fees))}`;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      window.localStorage.setItem(
        CUSTOMER_KEY,
        JSON.stringify({ name, phone, address, addressNotes }),
      );
    } catch {
      /* opcional */
    }

    startTransition(async () => {
      const result = await submitOrder({
        customer_name: name,
        customer_phone: phone,
        order_type: orderType,
        delivery_address: isDelivery ? address : null,
        delivery_notes: isDelivery ? addressNotes : null,
        customer_notes: comments || null,
        payment_method: payment,
        cash_received: payment === "Efectivo" && cash ? Number(cash) : null,
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

      onSuccess();
      router.push(`/pedido/${result.order.public_token}?nuevo=1`);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
      />

      <div className="animate-in-up relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl">
        <header className="flex items-center gap-3 border-b border-line px-5 py-4">
          {step === "details" && (
            <button
              type="button"
              onClick={() => setStep("cart")}
              className="grid size-9 place-items-center rounded-full bg-cream"
              aria-label="Volver al carrito"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}
          <h2 className="flex-1 text-lg font-extrabold">
            {step === "cart" ? "Tu pedido" : "Datos de entrega"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full bg-cream"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </header>

        {step === "cart" ? (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {lines.map((line) => (
                <div key={line.productId} className="rounded-2xl border border-line p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{line.product.name}</p>
                      <p className="text-xs text-ink-muted">
                        {currency(line.product.price)} c/u
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 rounded-full bg-cream p-1">
                        <button
                          type="button"
                          onClick={() => onRemove(line.productId)}
                          className="size-7 rounded-full bg-white text-sm font-bold"
                          aria-label="Quitar uno"
                        >
                          −
                        </button>
                        <span className="min-w-5 text-center text-sm font-bold tabular-nums">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => onAdd(line.productId)}
                          className="size-7 rounded-full bg-brand-500 text-sm font-bold text-white"
                          aria-label="Agregar uno"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDrop(line.productId)}
                        className="grid size-8 place-items-center rounded-full text-bad"
                        aria-label={`Eliminar ${line.product.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  <input
                    value={line.notes}
                    onChange={(event) => onNotes(line.productId, event.target.value)}
                    placeholder="Sin cebolla, salsa aparte..."
                    maxLength={160}
                    className="mt-2 w-full rounded-xl border border-line bg-cream px-3 py-2 text-sm outline-none focus:border-brand-400"
                  />
                </div>
              ))}
            </div>

            <footer className="space-y-3 border-t border-line px-5 py-4">
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">Subtotal</span>
                <span className="font-bold">{currency(subtotal)}</span>
              </div>
              {belowMinimum && (
                <p className="flex items-start gap-2 rounded-xl bg-warn-soft px-3 py-2 text-xs text-ink">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  El pedido mínimo es {currency(minOrder)}. Te faltan{" "}
                  {currency(minOrder - subtotal)}.
                </p>
              )}
              <button
                type="button"
                disabled={belowMinimum || lines.length === 0}
                onClick={() => setStep("details")}
                className="w-full rounded-2xl bg-brand-500 py-3.5 text-base font-bold text-white transition active:scale-[0.99] disabled:opacity-40"
              >
                Continuar
              </button>
            </footer>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <Field label="Tu nombre">
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                  autoComplete="name"
                  className={inputClass}
                  placeholder="Juan Pérez"
                />
              </Field>

              <Field label="Celular" hint="Para llamarte si hay alguna duda">
                <input
                  required
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  className={inputClass}
                  placeholder="300 123 4567"
                />
              </Field>

              <Field label="¿Cómo lo quieres?">
                <div className="grid grid-cols-2 gap-2">
                  <TypeOption
                    active={isDelivery}
                    disabled={!deliveryAllowed}
                    onClick={() => setOrderType("delivery")}
                    icon={<Bike className="size-5" />}
                    title="A domicilio"
                    subtitle="Te lo llevamos"
                  />
                  <TypeOption
                    active={orderType === "pickup"}
                    disabled={!pickupAllowed}
                    onClick={() => setOrderType("pickup")}
                    icon={<Store className="size-5" />}
                    title="Recoger"
                    subtitle="En el local"
                  />
                </div>
              </Field>

              {isDelivery && (
                <>
                  <Field label="Dirección">
                    <input
                      required
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      maxLength={200}
                      autoComplete="street-address"
                      className={inputClass}
                      placeholder="Calle 10 #5-23, Apto 301"
                    />
                  </Field>

                  <Field label="Indicaciones para llegar" hint="Opcional">
                    <input
                      value={addressNotes}
                      onChange={(event) => setAddressNotes(event.target.value)}
                      maxLength={200}
                      className={inputClass}
                      placeholder="Casa blanca, portón negro, timbre 2"
                    />
                  </Field>

                  <p className="rounded-xl bg-warn-soft px-3 py-2.5 text-xs">
                    El valor del domicilio lo confirma el local según tu dirección
                    {feeRange && <> — normalmente {feeRange}</>}. Lo verás en la pantalla
                    de seguimiento apenas te lo confirmen.
                  </p>
                </>
              )}

              <Field label="¿Cómo vas a pagar?">
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_METHODS.filter((m) => m !== "Otro").map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPayment(method)}
                      className={cn(
                        "rounded-full border px-3.5 py-2 text-sm font-semibold transition",
                        payment === method
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-line bg-white text-ink-muted",
                      )}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </Field>

              {payment === "Efectivo" && (
                <Field label="¿Con cuánto pagas?" hint="Para llevarte la devuelta exacta">
                  <input
                    value={cash}
                    onChange={(event) => setCash(event.target.value.replace(/\D/g, ""))}
                    inputMode="numeric"
                    className={inputClass}
                    placeholder="50000"
                  />
                </Field>
              )}

              <Field label="Comentarios del pedido" hint="Opcional">
                <textarea
                  value={comments}
                  onChange={(event) => setComments(event.target.value)}
                  maxLength={400}
                  rows={3}
                  className={cn(inputClass, "resize-none")}
                  placeholder="Todo sin cebolla, por favor"
                />
              </Field>

              {settings?.payment_instructions && (
                <p className="rounded-xl bg-cream px-3 py-2 text-xs text-ink-muted">
                  {settings.payment_instructions}
                </p>
              )}
            </div>

            <footer className="space-y-3 border-t border-line px-5 py-4">
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">Subtotal</dt>
                  <dd>{currency(subtotal)}</dd>
                </div>
                {isDelivery && (
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Domicilio</dt>
                    <dd className="font-semibold text-ink-muted">Lo confirma el local</dd>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold">
                  <dt>{isDelivery ? "Total sin domicilio" : "Total"}</dt>
                  <dd>{currency(subtotal)}</dd>
                </div>
              </dl>

              {error && (
                <p className="flex items-start gap-2 rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3.5 text-base font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                {pending
                  ? "Enviando..."
                  : `Confirmar pedido · ${currency(subtotal)}${isDelivery ? " + domicilio" : ""}`}
              </button>
              <p className="text-center text-[11px] text-ink-muted">
                Al confirmar, tu pedido llega directo al local. Después podrás avisarnos por
                WhatsApp.
              </p>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}

const CUSTOMER_KEY = "ssburger_customer_v1";

type SavedCustomer = Partial<
  Record<"name" | "phone" | "address" | "addressNotes" | "zoneId", string>
>;

function readSavedCustomer(): SavedCustomer {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CUSTOMER_KEY);
    return raw ? (JSON.parse(raw) as SavedCustomer) : {};
  } catch {
    return {};
  }
}

const inputClass =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2">
        <span className="text-sm font-bold">{label}</span>
        {hint && <span className="text-xs text-ink-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function TypeOption({
  active,
  disabled,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition disabled:opacity-40",
        active ? "border-brand-500 bg-brand-50" : "border-line bg-white",
      )}
    >
      <span className={active ? "text-brand-600" : "text-ink-muted"}>{icon}</span>
      <span className="text-sm font-bold">{title}</span>
      <span className="text-xs text-ink-muted">{disabled ? "No disponible" : subtitle}</span>
    </button>
  );
}
