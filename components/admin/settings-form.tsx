"use client";

import { Check, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveDeliveryZone, saveSettings } from "@/app/actions/admin";
import type { DeliveryZone, StoreSettings } from "@/lib/database.types";
import { cn, currency } from "@/lib/format";

type Props = { settings: StoreSettings | null; zones: DeliveryZone[] };

export function SettingsForm({ settings, zones }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    store_name: settings?.store_name ?? "S&S Burger",
    whatsapp_phone: settings?.whatsapp_phone ?? "",
    store_address: settings?.store_address ?? "",
    accepting_orders: settings?.accepting_orders ?? true,
    delivery_enabled: settings?.delivery_enabled ?? true,
    pickup_enabled: settings?.pickup_enabled ?? true,
    min_order: String(settings?.min_order ?? 0),
    prep_time_minutes: String(settings?.prep_time_minutes ?? 25),
    payment_instructions: settings?.payment_instructions ?? "",
    closed_message: settings?.closed_message ?? "",
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await saveSettings({
        ...form,
        whatsapp_phone: form.whatsapp_phone || null,
        store_address: form.store_address || null,
        payment_instructions: form.payment_instructions || null,
        closed_message: form.closed_message || null,
        min_order: Number(form.min_order || 0),
        prep_time_minutes: Number(form.prep_time_minutes || 0),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight">Ajustes</h1>
      <p className="mb-5 text-xs text-ink-muted">
        Todo esto lo ve el cliente en la carta pública.
      </p>

      <form onSubmit={submit} className="space-y-6">
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="mb-4 text-sm font-extrabold tracking-wide text-ink-muted uppercase">
            El negocio
          </h2>

          <div className="space-y-3">
            <Field label="Nombre">
              <input
                value={form.store_name}
                onChange={(event) => set("store_name", event.target.value)}
                maxLength={60}
                className={inputClass}
              />
            </Field>

            <Field
              label="WhatsApp del local"
              hint="A este número le llega el mensaje del cliente"
            >
              <input
                value={form.whatsapp_phone}
                onChange={(event) => set("whatsapp_phone", event.target.value)}
                inputMode="tel"
                placeholder="573001234567"
                className={inputClass}
              />
            </Field>

            <Field label="Dirección">
              <input
                value={form.store_address}
                onChange={(event) => set("store_address", event.target.value)}
                maxLength={160}
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="mb-4 text-sm font-extrabold tracking-wide text-ink-muted uppercase">
            Pedidos
          </h2>

          <div className="space-y-3">
            <Toggle
              label="Recibiendo pedidos"
              hint="Apágalo para cerrar la tienda sin bajar la página"
              checked={form.accepting_orders}
              onChange={(value) => set("accepting_orders", value)}
            />
            <Toggle
              label="Domicilio disponible"
              checked={form.delivery_enabled}
              onChange={(value) => set("delivery_enabled", value)}
            />
            <Toggle
              label="Recoger en el local"
              checked={form.pickup_enabled}
              onChange={(value) => set("pickup_enabled", value)}
            />

            <div className="grid grid-cols-2 gap-3">
              <Field label="Pedido mínimo" hint="0 = sin mínimo">
                <input
                  value={form.min_order}
                  onChange={(event) =>
                    set("min_order", event.target.value.replace(/\D/g, ""))
                  }
                  inputMode="numeric"
                  className={inputClass}
                />
              </Field>
              <Field label="Tiempo estimado" hint="minutos">
                <input
                  value={form.prep_time_minutes}
                  onChange={(event) =>
                    set("prep_time_minutes", event.target.value.replace(/\D/g, ""))
                  }
                  inputMode="numeric"
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Mensaje cuando está cerrado">
              <input
                value={form.closed_message}
                onChange={(event) => set("closed_message", event.target.value)}
                maxLength={200}
                className={inputClass}
              />
            </Field>

            <Field label="Nota de pago" hint="Aparece en el checkout del cliente">
              <textarea
                value={form.payment_instructions}
                onChange={(event) => set("payment_instructions", event.target.value)}
                rows={2}
                maxLength={300}
                className={cn(inputClass, "resize-none")}
              />
            </Field>
          </div>
        </section>

        {error && <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Guardar cambios
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-ok">
              <Check className="size-4" />
              Guardado
            </span>
          )}
        </div>
      </form>

      <ZonesSection zones={zones} />
    </div>
  );
}

function ZonesSection({ zones }: { zones: DeliveryZone[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(zone: Partial<DeliveryZone> & { name: string; fee: number }) {
    setError(null);
    startTransition(async () => {
      const result = await saveDeliveryZone({
        id: zone.id,
        name: zone.name,
        fee: zone.fee,
        is_active: zone.is_active ?? true,
        sort_order: zone.sort_order ?? zones.length + 1,
      });
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  function addZone() {
    const name = window.prompt("Nombre de la zona (ej. Centro)");
    if (!name) return;
    const fee = window.prompt("Valor del domicilio en pesos (ej. 3000)");
    if (fee === null) return;
    save({ name, fee: Number(fee.replace(/\D/g, "") || 0) });
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold tracking-wide text-ink-muted uppercase">
            Zonas de domicilio
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            El domicilio ya no es un producto de la carta: va aparte, para que los
            reportes separen lo que vendiste de comida de lo que cobraste por llevarla.
          </p>
        </div>
        <button
          type="button"
          onClick={addZone}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold"
        >
          <Plus className="size-4" />
          Zona
        </button>
      </div>

      {zones.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line py-6 text-center text-xs text-ink-muted">
          Sin zonas. Si no agregas ninguna, el domicilio va sin costo.
        </p>
      ) : (
        <ul className="space-y-2">
          {zones.map((zone) => (
            <li
              key={zone.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3",
                zone.is_active ? "border-line" : "border-dashed border-line opacity-60",
              )}
            >
              <span className="flex-1 text-sm font-semibold">{zone.name}</span>
              <span className="text-sm font-bold text-brand-600">{currency(zone.fee)}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const fee = window.prompt(`Nuevo valor para ${zone.name}`, String(zone.fee));
                  if (fee === null) return;
                  save({ ...zone, fee: Number(fee.replace(/\D/g, "") || 0) });
                }}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold"
              >
                Cambiar
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => save({ ...zone, is_active: !zone.is_active })}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold"
              >
                {zone.is_active ? "Desactivar" : "Activar"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad">{error}</p>
      )}
    </section>
  );
}

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

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-cream px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          checked ? "bg-ok" : "bg-line",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white transition-all",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-bold">{label}</span>
        {hint && <span className="block text-xs text-ink-muted">{hint}</span>}
      </span>
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-400";
