"use client";

import { Clock, Search, ShoppingBag } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";

import type { Category, DeliveryZone, Product, StoreSettings } from "@/lib/database.types";
import { cn, currency } from "@/lib/format";

import { CheckoutSheet } from "./checkout-sheet";
import { ProductCard } from "./product-card";
import { useCart } from "./use-cart";

type Props = {
  settings: StoreSettings | null;
  categories: Category[];
  products: Product[];
  zones: DeliveryZone[];
};

export function Storefront({ settings, categories, products, zones }: Props) {
  const [query, setQuery] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const cart = useCart(products);

  const isOpen = settings?.accepting_orders ?? true;

  const grouped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = needle
      ? products.filter((p) => p.name.toLowerCase().includes(needle))
      : products;

    return categories
      .map((category) => ({
        category,
        items: matching.filter((p) => p.category_id === category.id),
      }))
      .filter((group) => group.items.length > 0);
  }, [categories, products, query]);

  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Image
            src="/img/logo_ss.png"
            alt=""
            width={44}
            height={44}
            className="size-11 rounded-xl object-contain"
            priority
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold tracking-tight">
              {settings?.store_name ?? "S&S Burger"}
            </h1>
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span
                className={cn(
                  "size-2 rounded-full",
                  isOpen ? "bg-ok" : "bg-bad",
                )}
                aria-hidden
              />
              {isOpen ? "Abierto ahora" : "Cerrado"}
              {isOpen && settings?.prep_time_minutes ? (
                <>
                  <span aria-hidden>·</span>
                  <Clock className="size-3" />
                  {settings.prep_time_minutes} min aprox.
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-4 pb-3">
          <div className="relative">
            <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar en la carta"
              className="w-full rounded-full border border-line bg-cream py-2.5 pr-4 pl-10 text-sm outline-none transition focus:border-brand-400 focus:bg-white"
            />
          </div>
        </div>

        {grouped.length > 1 && (
          <nav className="no-scrollbar mx-auto max-w-3xl overflow-x-auto px-4 pb-3">
            <ul className="flex gap-2">
              {grouped.map(({ category }) => (
                <li key={category.id}>
                  <a
                    href={`#cat-${category.slug}`}
                    className="block rounded-full border border-line bg-white px-4 py-1.5 text-sm font-semibold whitespace-nowrap"
                  >
                    {category.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      {!isOpen && (
        <p className="mx-auto mt-4 max-w-3xl rounded-2xl bg-warn-soft px-4 py-3 text-sm font-semibold text-ink">
          {settings?.closed_message ?? "Estamos cerrados en este momento."}
        </p>
      )}

      <main className="mx-auto max-w-3xl px-4 py-6">
        {grouped.length === 0 ? (
          <p className="py-20 text-center text-sm text-ink-muted">
            No encontramos nada con «{query}».
          </p>
        ) : (
          grouped.map(({ category, items }) => (
            <section key={category.id} id={`cat-${category.slug}`} className="scroll-mt-44 pb-8">
              <h2 className="mb-3 text-xl font-extrabold tracking-tight">{category.name}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    qty={cart.cart[product.id]?.qty ?? 0}
                    onAdd={() => cart.add(product.id)}
                    onRemove={() => cart.remove(product.id)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {cart.count > 0 && isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-4">
          <button
            type="button"
            onClick={() => setCheckoutOpen(true)}
            className="animate-in-up mx-auto flex w-full max-w-3xl items-center gap-3 rounded-2xl bg-brand-500 px-5 py-4 text-white shadow-lg shadow-brand-500/30 transition active:scale-[0.99]"
          >
            <span className="relative">
              <ShoppingBag className="size-5" />
              <span className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-white text-[11px] font-extrabold text-brand-600">
                {cart.count}
              </span>
            </span>
            <span className="flex-1 text-left text-base font-bold">Ver mi pedido</span>
            <span className="text-base font-extrabold">{currency(cart.subtotal)}</span>
          </button>
        </div>
      )}

      <CheckoutSheet
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        lines={cart.lines}
        subtotal={cart.subtotal}
        settings={settings}
        zones={zones}
        onAdd={cart.add}
        onRemove={cart.remove}
        onDrop={cart.drop}
        onNotes={cart.setNotes}
        onSuccess={cart.clear}
      />

      <footer className="mx-auto max-w-3xl px-4 pb-8 text-center text-xs text-ink-muted">
        {settings?.store_address && <p>{settings.store_address}</p>}
        <p className="mt-1">
          {settings?.store_name ?? "S&S Burger"} · Pedidos en línea
        </p>
      </footer>
    </div>
  );
}
