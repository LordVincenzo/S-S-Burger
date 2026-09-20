"use client";

import { AlertCircle, Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";

import { markOrderPaid } from "@/app/actions/admin";
import { cn, currency } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/orders";

type Props = {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderCode: string;
  total: number;
  suggestedMethod?: string | null;
  suggestedCash?: number | null;
  onPaid: () => void;
};

export function PaymentModal({
  open,
  onClose,
  orderId,
  orderCode,
  total,
  suggestedMethod,
  suggestedCash,
  onPaid,
}: Props) {
  const [method, setMethod] = useState(suggestedMethod || PAYMENT_METHODS[0]);
  const [custom, setCustom] = useState("");
  const [reference, setReference] = useState("");
  const [cash, setCash] = useState(suggestedCash ? String(suggestedCash) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  const isCash = method === "Efectivo";
  const received = Number(cash || 0);
  const change = received - total;

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await markOrderPaid(orderId, {
        method: method === "Otro" ? custom || "Otro" : method,
        reference: reference || null,
        cashReceived: isCash && cash ? received : null,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onPaid();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 backdrop-blur-sm sm:items-center">
      <div className="animate-in-up w-full max-w-sm rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">Registrar pago</h2>
            <p className="text-sm text-ink-muted">
              Pedido {orderCode} · {currency(total)}
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

        <p className="mb-2 text-sm font-bold">Medio de pago</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMethod(option)}
              className={cn(
                "rounded-full border px-3.5 py-2 text-sm font-semibold transition",
                method === option
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-line text-ink-muted",
              )}
            >
              {option}
            </button>
          ))}
        </div>

        {method === "Otro" && (
          <input
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            placeholder="¿Cuál?"
            maxLength={40}
            className="mb-3 w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-brand-400"
          />
        )}

        {isCash ? (
          <label className="mb-3 block">
            <span className="mb-1.5 block text-sm font-bold">¿Con cuánto pagó?</span>
            <input
              value={cash}
              onChange={(event) => setCash(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder={String(total)}
              className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-brand-400"
            />
            {received > 0 && (
              <span
                className={cn(
                  "mt-1.5 block text-xs font-bold",
                  change >= 0 ? "text-ok" : "text-bad",
                )}
              >
                {change >= 0
                  ? `Devuelta: ${currency(change)}`
                  : `Faltan ${currency(Math.abs(change))}`}
              </span>
            )}
          </label>
        ) : (
          <label className="mb-3 block">
            <span className="mb-1.5 block text-sm font-bold">
              Referencia <span className="font-normal text-ink-muted">(opcional)</span>
            </span>
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              maxLength={60}
              placeholder="Últimos dígitos del comprobante"
              className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-brand-400"
            />
          </label>
        )}

        {error && (
          <p className="mb-3 flex items-start gap-2 rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ok py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Confirmar pago
        </button>
      </div>
    </div>
  );
}
