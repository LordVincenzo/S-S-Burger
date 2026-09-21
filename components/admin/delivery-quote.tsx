"use client";

import { Bike, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { quoteDelivery } from "@/app/actions/admin";
import type { DeliveryZone } from "@/lib/database.types";
import { cn, currency } from "@/lib/format";

/**
 * Bloque para ponerle valor al domicilio de un pedido que llegó de la web.
 *
 * Aparece resaltado porque hasta que no se resuelva, el cliente no sabe
 * cuánto va a pagar: es lo primero que hay que hacer con ese pedido.
 */
export function DeliveryQuote({
  orderId,
  zones,
  address,
  city,
  current,
  onDone,
}: {
  orderId: string;
  zones: DeliveryZone[];
  address: string | null;
  /** Municipio declarado por el cliente: acota las zonas que tienen sentido. */
  city?: string | null;
  /** Valor ya aplicado, cuando se está corrigiendo en vez de cotizando. */
  current?: number | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);

  function apply(input: { zoneId?: string; fee?: number }) {
    setError(null);
    startTransition(async () => {
      const result = await quoteDelivery(orderId, input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone?.();
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-warn/50 bg-warn-soft p-3">
      <p className="flex items-center gap-1.5 text-xs font-extrabold">
        <Bike className="size-3.5" />
        {current == null
          ? "Falta ponerle valor al domicilio"
          : `Cambiar el valor del domicilio (hoy ${currency(current)})`}
      </p>

      {address && (
        <p className="mt-1 text-xs text-ink-muted">
          {city ? `${address} — ${city}` : address}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {/* Solo las zonas del municipio del cliente: las de la otra ciudad
            no son una opción y solo estorban al elegir. */}
        {zones
          .filter((zone) => !city || !zone.city || zone.city === city)
          .map((zone) => (
          <button
            key={zone.id}
            type="button"
            disabled={pending}
            onClick={() => apply({ zoneId: zone.id })}
            className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold disabled:opacity-50"
          >
            {zone.name} · {currency(zone.fee)}
            </button>
          ))}

        <button
          type="button"
          disabled={pending}
          onClick={() => apply({ fee: 0 })}
          className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold disabled:opacity-50"
        >
          Sin costo
        </button>

        <div className="flex items-center gap-1">
          <input
            value={custom}
            onChange={(event) => setCustom(event.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="Otro valor"
            aria-label="Otro valor de domicilio"
            className="w-24 rounded-lg border border-line px-2.5 py-2 text-xs outline-none focus:border-brand-400"
          />
          <button
            type="button"
            disabled={pending || custom === ""}
            onClick={() => apply({ fee: Number(custom) })}
            className={cn(
              "rounded-lg bg-brand-500 px-3 py-2 text-xs font-bold text-white",
              "disabled:opacity-40",
            )}
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Aplicar"}
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-xs font-semibold text-bad">{error}</p>}
    </div>
  );
}
