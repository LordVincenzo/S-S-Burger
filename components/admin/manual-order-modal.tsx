"use client";

import { AlertCircle, Loader2, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { createManualOrder } from "@/app/actions/admin";
import type { Category, DeliveryZone, OrderType, Product } from "@/lib/database.types";
import { cn, currency } from "@/lib/format";

type Props = {
  open: boolean;
  onClose: () => void;
  products: Product[];
  categories: Category[];
  zones: DeliveryZone[];
};

/** Pedido tomado por teléfono o en el mostrador. */
export function ManualOrderModal({ open, onClose, products, categories, zones }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("pickup");
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [markPaid, setMarkPaid] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? products.filter((p) => p.name.toLowerCase().includes(needle)) : products;
  }, [products, query]);

  const categoryName = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const subtotal = Object.entries(cart).reduce((acc, [id, qty]) => {
    const product = products.find((p) => p.id === id);
    return acc + (product ? product.price * qty : 0);
  }, 0);

  const fee = orderType === "delivery" ? (zones.find((z) => z.id === zoneId)?.fee ?? 0) : 0;

  if (!open) return null;

  function reset() {
    setCart({});
    setName("");
    setPhone("");
    setAddress("");
    setNotes("");
    setQuery("");
    setError(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const items = Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([product_id, qty]) => ({ product_id, qty }));

    startTransition(async () => {
      const result = await createManualOrder({
        customer_name: name || "Mostrador",
        customer_phone: phone || null,
        order_type: orderType,
        delivery_zone_id: orderType === "delivery" ? zoneId || null : null,
        delivery_address: orderType === "delivery" ? address : null,
        customer_notes: notes || null,
        mark_paid: markPaid,
        payment_method: markPaid ? "Efectivo" : null,
        items,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      reset();
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={submit}
        className="animate-in-up flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-lg font-extrabold">Pedido manual</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid size-9 place-items-center rounded-full bg-cream"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="grid flex-1 gap-4 overflow-y-auto p-5 md:grid-cols-2">
          <section>
            <div className="relative mb-3">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar producto"
                className="w-full rounded-xl border border-line py-2.5 pr-3 pl-9 text-sm outline-none focus:border-brand-400"
              />
            </div>

            <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {filtered.map((product) => {
                const qty = cart[product.id] ?? 0;
                return (
                  <li
                    key={product.id}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border p-2",
                      qty > 0 ? "border-brand-400 bg-brand-50" : "border-line",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{product.name}</p>
                      <p className="text-xs text-ink-muted">
                        {categoryName.get(product.category_id)} · {currency(product.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setCart((c) => {
                            const value = (c[product.id] ?? 0) - 1;
                            const next = { ...c };
                            if (value <= 0) delete next[product.id];
                            else next[product.id] = value;
                            return next;
                          })
                        }
                        disabled={qty === 0}
                        className="size-7 rounded-lg bg-cream text-sm font-bold disabled:opacity-30"
                        aria-label="Quitar uno"
                      >
                        −
                      </button>
                      <span className="min-w-5 text-center text-sm font-bold tabular-nums">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setCart((c) => ({ ...c, [product.id]: (c[product.id] ?? 0) + 1 }))
                        }
                        className="size-7 rounded-lg bg-brand-500 text-sm font-bold text-white"
                        aria-label="Agregar uno"
                      >
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="space-y-3">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre del cliente"
              maxLength={80}
              className={inputClass}
            />
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Celular (opcional)"
              inputMode="tel"
              className={inputClass}
            />

            <div className="grid grid-cols-2 gap-2">
              {(["pickup", "delivery"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setOrderType(type)}
                  className={cn(
                    "rounded-xl border py-2.5 text-sm font-bold transition",
                    orderType === type
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-line text-ink-muted",
                  )}
                >
                  {type === "pickup" ? "Mostrador" : "Domicilio"}
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
                    <option value="">Zona…</option>
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
              placeholder="Comentarios (sin cebolla, extra salsa…)"
              rows={2}
              maxLength={400}
              className={cn(inputClass, "resize-none")}
            />

            <label className="flex items-center gap-2 rounded-xl bg-cream px-3 py-2.5 text-sm font-semibold">
              <input
                type="checkbox"
                checked={markPaid}
                onChange={(event) => setMarkPaid(event.target.checked)}
                className="size-4 accent-current"
              />
              Ya pagó en efectivo
            </label>
          </section>
        </div>

        <footer className="space-y-3 border-t border-line px-5 py-4">
          {error && (
            <p className="flex items-start gap-2 rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending || subtotal === 0}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3.5 text-base font-bold text-white disabled:opacity-40"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Registrar pedido · {currency(subtotal + fee)}
          </button>
        </footer>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-400";
