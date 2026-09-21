import { CheckCircle2 } from "lucide-react";
import Image from "next/image";

import { currency, formatDateTime } from "@/lib/format";

export type ReceiptData = {
  code: string;
  createdAt: string;
  customerName: string;
  customerPhone?: string | null;
  orderType: "pickup" | "delivery";
  address?: string | null;
  notes?: string | null;
  items: { product_name: string; qty: number; unit_price: number; line_total: number; notes?: string | null }[];
  subtotal: number;
  deliveryFee: number;
  /** false = el local todavía no le ha puesto valor al domicilio */
  deliveryQuoted?: boolean;
  total: number;
  paid: boolean;
  paymentMethod?: string | null;
  paymentRef?: string | null;
  paidAt?: string | null;
  cashReceived?: number | null;
  storeName: string;
  storeAddress?: string | null;
  storePhone?: string | null;
};

/**
 * Comprobante de venta.
 *
 * OJO: esto NO es una factura electrónica DIAN (no tiene CUFE ni
 * resolución). Es un comprobante interno para el cliente y para el
 * control del negocio. Si algún día se necesita facturación legal,
 * se integra con un proveedor tecnológico autorizado.
 *
 * Se imprime con CSS (@media print en globals.css) en vez de
 * html2canvas: sale nítido, pesa nada y funciona en impresora térmica.
 */
export function Receipt({ data }: { data: ReceiptData }) {
  return (
    <div className="print-sheet mx-auto w-full max-w-sm rounded-2xl border border-line bg-white p-6 text-ink">
      <div className="text-center">
        <Image
          src="/img/logo_ss.png"
          alt=""
          width={64}
          height={64}
          className="mx-auto mb-2 size-16 object-contain"
        />
        <h2 className="text-lg font-extrabold tracking-tight">{data.storeName}</h2>
        {data.storeAddress && <p className="text-xs text-ink-muted">{data.storeAddress}</p>}
        {data.storePhone && <p className="text-xs text-ink-muted">Tel. {data.storePhone}</p>}
      </div>

      <div className="my-4 border-y border-dashed border-line py-3 text-center">
        <p className="text-[11px] font-bold tracking-widest text-ink-muted uppercase">
          Comprobante de venta
        </p>
        <p className="text-xl font-extrabold">{data.code}</p>
        <p className="text-xs text-ink-muted">{formatDateTime(data.createdAt)}</p>
      </div>

      <dl className="space-y-1 text-xs">
        <Row label="Cliente" value={data.customerName} />
        {data.customerPhone && <Row label="Celular" value={data.customerPhone} />}
        <Row
          label="Entrega"
          value={data.orderType === "delivery" ? "Domicilio" : "Recoge en el local"}
        />
        {data.address && <Row label="Dirección" value={data.address} />}
      </dl>

      <table className="mt-4 w-full text-xs">
        <thead>
          <tr className="border-b border-line text-left text-ink-muted">
            <th className="pb-1 font-semibold">Producto</th>
            <th className="pb-1 text-center font-semibold">Cant</th>
            <th className="pb-1 text-right font-semibold">Valor</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, index) => (
            <tr key={index} className="align-top">
              <td className="py-1.5">
                {item.product_name}
                {item.notes && <p className="text-[10px] text-ink-muted italic">{item.notes}</p>}
              </td>
              <td className="py-1.5 text-center tabular-nums">{item.qty}</td>
              <td className="py-1.5 text-right tabular-nums">{currency(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-3 space-y-1 border-t border-dashed border-line pt-3 text-xs">
        <Row label="Subtotal" value={currency(data.subtotal)} />
        {data.orderType === "delivery" && data.deliveryQuoted === false ? (
          <Row label="Domicilio" value="Por confirmar" />
        ) : (
          data.deliveryFee > 0 && <Row label="Domicilio" value={currency(data.deliveryFee)} />
        )}
        <div className="flex justify-between pt-1 text-base font-extrabold">
          <dt>Total</dt>
          <dd className="tabular-nums">
            {currency(data.total)}
            {data.orderType === "delivery" && data.deliveryQuoted === false && (
              <span className="text-xs font-semibold text-ink-muted"> + domicilio</span>
            )}
          </dd>
        </div>
      </dl>

      {data.notes && (
        <p className="mt-3 rounded-lg bg-cream px-3 py-2 text-[11px] text-ink-muted">
          <span className="font-bold">Comentarios:</span> {data.notes}
        </p>
      )}

      <div className="mt-4 border-t border-dashed border-line pt-3">
        {data.paid ? (
          <div className="flex items-start gap-2 rounded-xl bg-ok-soft px-3 py-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" />
            <div className="text-xs">
              <p className="font-bold text-ok">PAGADO</p>
              <p className="text-ink-muted">
                {data.paymentMethod ?? "Efectivo"}
                {data.paymentRef ? ` · Ref. ${data.paymentRef}` : ""}
              </p>
              {data.paidAt && <p className="text-ink-muted">{formatDateTime(data.paidAt)}</p>}
              {data.cashReceived != null && data.cashReceived > data.total && (
                <p className="text-ink-muted">
                  Recibido {currency(data.cashReceived)} · Cambio{" "}
                  {currency(data.cashReceived - data.total)}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="rounded-xl bg-warn-soft px-3 py-2 text-center text-xs font-bold">
            PENDIENTE DE PAGO
          </p>
        )}
      </div>

      <p className="mt-4 text-center text-[10px] leading-relaxed text-ink-muted">
        Documento no válido como factura electrónica.
        <br />
        ¡Gracias por tu compra!
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
