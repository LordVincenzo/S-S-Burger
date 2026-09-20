"use client";

import { Minus, Plus, UtensilsCrossed } from "lucide-react";
import Image from "next/image";

import type { Product } from "@/lib/database.types";
import { cn, currency } from "@/lib/format";

type Props = {
  product: Product;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
};

export function ProductCard({ product, qty, onAdd, onRemove }: Props) {
  const soldOut = !product.is_available;

  return (
    <article
      className={cn(
        "flex gap-3 rounded-2xl border bg-white p-3 transition",
        qty > 0 ? "border-brand-400 ring-2 ring-brand-100" : "border-line",
        soldOut && "opacity-60",
      )}
    >
      <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-cream sm:size-28">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="112px"
            className="object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-ink-muted">
            <UtensilsCrossed className="size-7" />
          </div>
        )}
        {soldOut && (
          <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-white">
            Agotado
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div>
          <h3 className="text-sm leading-tight font-bold text-balance sm:text-base">
            {product.name}
          </h3>
          {product.description && (
            <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{product.description}</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-extrabold text-brand-600">
            {currency(product.price)}
          </span>

          {soldOut ? (
            <span className="text-xs font-semibold text-ink-muted">No disponible</span>
          ) : qty > 0 ? (
            <div className="flex items-center gap-1 rounded-full bg-cream p-1">
              <button
                type="button"
                onClick={onRemove}
                aria-label={`Quitar un ${product.name}`}
                className="grid size-8 place-items-center rounded-full bg-white text-ink shadow-sm transition active:scale-95"
              >
                <Minus className="size-4" />
              </button>
              <span className="min-w-6 text-center text-sm font-bold tabular-nums">{qty}</span>
              <button
                type="button"
                onClick={onAdd}
                aria-label={`Agregar otro ${product.name}`}
                className="grid size-8 place-items-center rounded-full bg-brand-500 text-white shadow-sm transition active:scale-95"
              >
                <Plus className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className="flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition active:scale-95"
            >
              <Plus className="size-4" />
              Agregar
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
