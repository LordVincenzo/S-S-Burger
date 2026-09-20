"use client";

import { AlertCircle, Download, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { OrderWithItems, StoreSettings } from "@/lib/database.types";
import { cn, currency, formatTime, todayBogota } from "@/lib/format";
import { STATUS_LABEL, whatsappLink } from "@/lib/orders";
import { buildReport, ordersToCsv, reportToWhatsApp } from "@/lib/report";

type Props = {
  orders: OrderWithItems[];
  from: string;
  to: string;
  settings: StoreSettings | null;
  loadError: string | null;
};

/** Le resta días a una fecha YYYY-MM-DD sin salirse del calendario local. */
function shiftDay(day: string, delta: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function HistoryView({ orders, from, to, settings, loadError }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);

  const report = useMemo(() => buildReport(orders), [orders]);
  const today = todayBogota();

  const presets = [
    { label: "Hoy", from: today, to: today },
    { label: "Ayer", from: shiftDay(today, -1), to: shiftDay(today, -1) },
    { label: "7 días", from: shiftDay(today, -6), to: today },
    { label: "30 días", from: shiftDay(today, -29), to: today },
  ];

  const go = (nextFrom: string, nextTo: string) =>
    router.push(`/admin/historial?desde=${nextFrom}&hasta=${nextTo}`);

  function downloadCsv() {
    const blob = new Blob([ordersToCsv(orders)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = from === to ? `ventas_${from}.csv` : `ventas_${from}_a_${to}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const waHref = whatsappLink(
    settings?.whatsapp_phone,
    reportToWhatsApp(report, from, to),
  );

  return (
    <div>
      <div className="no-print mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">Historial y cierre</h1>
        <p className="text-xs text-ink-muted">
          Todo lo vendido, con respaldo descargable.
        </p>
      </div>

      <div className="no-print mb-5 flex flex-wrap items-end gap-3">
        <div className="flex gap-1 rounded-xl bg-cream p-1">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => go(preset.from, preset.to)}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-bold transition",
                from === preset.from && to === preset.to
                  ? "bg-white shadow-sm"
                  : "text-ink-muted",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <label className="text-xs font-bold text-ink-muted">
          Desde
          <input
            type="date"
            value={from}
            max={to}
            onChange={(event) => go(event.target.value, to)}
            className="mt-1 block rounded-xl border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
          />
        </label>

        <label className="text-xs font-bold text-ink-muted">
          Hasta
          <input
            type="date"
            value={to}
            min={from}
            max={today}
            onChange={(event) => go(from, event.target.value)}
            className="mt-1 block rounded-xl border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
          />
        </label>

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={downloadCsv}
            disabled={orders.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2.5 text-sm font-bold disabled:opacity-40"
          >
            <Download className="size-4" />
            Descargar Excel
          </button>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl bg-ok px-4 py-2.5 text-sm font-bold text-white"
          >
            <MessageCircle className="size-4" />
            Enviarme el cierre
          </a>
        </div>
      </div>

      {loadError && (
        <p className="no-print mb-4 flex items-start gap-2 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {loadError}
        </p>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pedidos" value={String(report.count)} />
        <Stat label="Venta total" value={currency(report.sales)} />
        <Stat label="Cobrado" value={currency(report.collected)} tone="ok" />
        <Stat label="Por cobrar" value={currency(report.pending)} tone="warn" />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Panel title="Desglose">
          <Line label="Comida" value={currency(report.food)} />
          <Line label="Domicilios" value={currency(report.delivery)} />
          <Line label="Ticket promedio" value={currency(report.average)} />
          <Line
            label="Entrega"
            value={`${report.deliveryCount} dom. · ${report.pickupCount} recoge`}
          />
          <Line
            label="Origen"
            value={`${report.onlineCount} web · ${report.count - report.onlineCount} manual`}
          />
          {report.cancelledCount > 0 && (
            <Line label="Cancelados" value={String(report.cancelledCount)} />
          )}
        </Panel>

        <Panel title="Medios de pago">
          {report.methods.length === 0 ? (
            <p className="text-xs text-ink-muted">Nada cobrado todavía.</p>
          ) : (
            report.methods.map((method) => (
              <Line
                key={method.method}
                label={`${method.method} (${method.count})`}
                value={currency(method.amount)}
              />
            ))
          )}
        </Panel>

        <Panel title="Más vendidos">
          {report.products.length === 0 ? (
            <p className="text-xs text-ink-muted">Sin ventas en este rango.</p>
          ) : (
            report.products
              .slice(0, 6)
              .map((product) => (
                <Line
                  key={product.name}
                  label={`${product.qty}× ${product.name}`}
                  value={currency(product.amount)}
                />
              ))
          )}
        </Panel>
      </div>

      <h2 className="mb-2 text-sm font-extrabold tracking-wide text-ink-muted uppercase">
        Pedidos ({orders.length})
      </h2>

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line py-16 text-center text-sm text-ink-muted">
          No hay pedidos en este rango.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {orders.map((order) => (
            <li key={order.id}>
              <button
                type="button"
                onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                    {order.code}
                    <span className="font-normal text-ink-muted">{order.customer_name}</span>
                    {order.status === "cancelled" && (
                      <span className="rounded-full bg-bad-soft px-2 py-0.5 text-[11px] font-bold text-bad">
                        {STATUS_LABEL.cancelled}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {formatTime(order.created_at)} ·{" "}
                    {order.order_type === "delivery" ? "Domicilio" : "Recoge"} ·{" "}
                    {order.channel === "online" ? "Web" : "Manual"}
                  </p>
                </div>

                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-bold",
                    order.payment_status === "paid"
                      ? "bg-ok-soft text-ok"
                      : "bg-warn-soft text-ink",
                  )}
                >
                  {order.payment_status === "paid"
                    ? (order.payment_method ?? "Pagado")
                    : "Pendiente"}
                </span>

                <span className="w-24 text-right text-sm font-extrabold tabular-nums">
                  {currency(order.total)}
                </span>
              </button>

              {expanded === order.id && (
                <div className="border-t border-line bg-cream px-4 py-3 text-xs">
                  <ul className="space-y-1">
                    {order.order_items.map((item) => (
                      <li key={item.id} className="flex justify-between gap-3">
                        <span>
                          {item.qty}× {item.product_name}
                          {item.notes && (
                            <span className="block text-ink-muted italic">{item.notes}</span>
                          )}
                        </span>
                        <span className="tabular-nums">{currency(item.line_total)}</span>
                      </li>
                    ))}
                  </ul>
                  {order.delivery_fee > 0 && (
                    <p className="mt-2 flex justify-between border-t border-line pt-2">
                      <span>Domicilio</span>
                      <span className="tabular-nums">{currency(order.delivery_fee)}</span>
                    </p>
                  )}
                  {order.delivery_address && (
                    <p className="mt-2 text-ink-muted">{order.delivery_address}</p>
                  )}
                  {order.customer_notes && (
                    <p className="mt-1 text-ink-muted italic">{order.customer_notes}</p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        tone === "ok" && "border-ok/30 bg-ok-soft",
        tone === "warn" && "border-warn/40 bg-warn-soft",
        !tone && "border-line bg-white",
      )}
    >
      <p className="text-[11px] font-bold tracking-wide text-ink-muted uppercase">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-extrabold tracking-tight",
          tone === "ok" && "text-ok",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <h2 className="mb-2 text-xs font-extrabold tracking-wide text-ink-muted uppercase">
        {title}
      </h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="min-w-0 truncate text-ink-muted">{label}</span>
      <span className="shrink-0 font-bold tabular-nums">{value}</span>
    </div>
  );
}
