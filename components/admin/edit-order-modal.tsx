"use client";

import { AlertCircle, Loader2, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { editOrder } from "@/app/actions/admin";
import type { Category, OrderType, OrderWithItems, Product } from "@/lib/database.types";
import { cn, currency } from "@/lib/format";

type Props = {
  open: boolean;
  onClose: () => void;
  order: OrderWithItems;
  products: Product[];
  categories: Category[];
};

type Line = { productId: string; qty: number; notes: string };

export function EditOrderModal({ open, onClose, order, products, categories }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Se parte de lo que el pedido tiene hoy. Si un producto fue archivado
  // después, la línea sigue ahí pero ya no se puede volver a agregar.
  const [lines, setLines] = useState<Line[]>(() =>
    order.order_items.map((item) => ({
      productId: item.product_id ?? "",
      qty: item.qty,
      notes: item.notes ?? "",
    })),
  );

  const [name, setName] = useState(order.customer_name);
  const [phone, setPhone] = useState(order.customer_phone ?? "");
  const [orderType, setOrderType] = useState<OrderType>(order.order_type);
  const [address, setAddress] = useState(order.delivery_address ?? "");
  const [addressNotes, setAddressNotes] = useState(order.delivery_notes ?? "");
  const [comments, setComments] = useState(order.customer_notes ?? "");

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const categoryName = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? products.filter((p) => p.name.toLowerCase().includes(needle)) : products;
  }, [products, query]);

  const subtotal = lines.reduce(
    (acc, line) => acc + (byId.get(line.productId)?.price ?? 0) * line.qty,
    0,
  );
  const fee = orderType === "delivery" ? order.delivery_fee : 0;

  if (!open) return null;

  function bump(productId: string, delta: number) {
    setLines((current) => {
      const index = current.findIndex((line) => line.productId === productId);
      if (index === -1) {
        return delta > 0 ? [...current, { productId, qty: 1, notes: "" }] : current;
      }
      const qty = current[index].qty + delta;
      if (qty <= 0) return current.filter((_, i) => i !== index);
      return current.map((line, i) => (i === index ? { ...line, qty } : line));
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await editOrder(order.id, {
        customer_name: name,
        customer_phone: phone || null,
        order_type: orderType,
        delivery_address: orderType === "delivery" ? address : null,
        delivery_notes: orderType === "delivery" ? addressNotes : null,
        customer_notes: comments || null,
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
          <div>
            <h2 className="text-lg font-extrabold">Editar pedido</h2>
            <p className="text-xs text-ink-muted">{order.code}</p>
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

        <div className="grid flex-1 gap-4 overflow-y-auto p-5 md:grid-cols-2">
          <section>
            <p className="mb-2 text-sm font-extrabold">En el pedido</p>

            <ul className="mb-4 space-y-2">
              {lines.map((line) => {
                const product = byId.get(line.productId);
                return (
                  <li key={line.productId} className="rounded-xl border border-line p-2.5">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {product?.name ?? "Producto retirado de la carta"}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {currency((product?.price ?? 0) * line.qty)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => bump(line.productId, -1)}
                          className="size-7 rounded-lg bg-cream text-sm font-bold"
                          aria-label="Quitar uno"
                        >
                          −
                        </button>
                        <span className="min-w-5 text-center text-sm font-bold tabular-nums">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => bump(line.productId, 1)}
                          className="size-7 rounded-lg bg-brand-500 text-sm font-bold text-white"
                          aria-label="Agregar uno"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setLines((c) => c.filter((l) => l.productId !== line.productId))
                          }
                          className="grid size-7 place-items-center rounded-lg text-bad"
                          aria-label="Eliminar del pedido"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                    <input
                      value={line.notes}
                      onChange={(event) =>
                        setLines((c) =>
                          c.map((l) =>
                            l.productId === line.productId
                              ? { ...l, notes: event.target.value }
                              : l,
                          ),
                        )
                      }
                      placeholder="Sin cebolla…"
                      maxLength={160}
                      className="mt-2 w-full rounded-lg border border-line bg-cream px-2.5 py-1.5 text-xs outline-none focus:border-brand-400"
                    />
                  </li>
                );
              })}
            </ul>

            <p className="mb-2 text-sm font-extrabold">Agregar</p>
            <div className="relative mb-2">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar producto"
                className="w-full rounded-xl border border-line py-2 pr-3 pl-9 text-sm outline-none focus:border-brand-400"
              />
            </div>
            <ul className="max-h-48 space-y-1 overflow-y-auto pr-1">
              {filtered.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => bump(product.id, 1)}
                    className="flex w-full items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-left"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">{product.name}</span>
                    <span className="text-xs text-ink-muted">
                      {categoryName.get(product.category_id)}
                    </span>
                    <span className="text-sm font-bold">{currency(product.price)}</span>
                  </button>
                </li>
              ))}
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
              placeholder="Celular"
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
                  {type === "pickup" ? "Recoge" : "Domicilio"}
                </button>
              ))}
            </div>

            {orderType === "delivery" && (
              <>
                <input
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Dirección"
                  maxLength={200}
                  className={inputClass}
                />
                <input
                  value={addressNotes}
                  onChange={(event) => setAddressNotes(event.target.value)}
                  placeholder="Indicaciones para llegar"
                  maxLength={200}
                  className={inputClass}
                />
                {order.order_type === "pickup" && (
                  <p className="rounded-xl bg-warn-soft px-3 py-2 text-xs">
                    Al pasarlo a domicilio habrá que ponerle el valor del envío otra vez.
                  </p>
                )}
              </>
            )}

            <textarea
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              placeholder="Comentarios del pedido"
              rows={2}
              maxLength={400}
              className={cn(inputClass, "resize-none")}
            />
          </section>
        </div>

        <footer className="space-y-3 border-t border-line px-5 py-4">
          <dl className="flex justify-between text-sm">
            <dt className="text-ink-muted">
              Subtotal {fee > 0 && <>+ domicilio {currency(fee)}</>}
            </dt>
            <dd className="text-base font-extrabold">{currency(subtotal + fee)}</dd>
          </dl>

          {error && (
            <p className="flex items-start gap-2 rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || lines.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3.5 text-base font-bold text-white disabled:opacity-40"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Guardar cambios
          </button>
        </footer>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-400";
