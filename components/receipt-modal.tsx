"use client";

import { Check, Download, Image as ImageIcon, Loader2, Printer, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Receipt, type ReceiptData } from "@/components/receipt";

type Props = {
  open: boolean;
  onClose: () => void;
  data: ReceiptData;
  /** Token del pedido: con él se arma la URL de la imagen del comprobante. */
  token?: string;
};

type Sent = "compartido" | "copiado" | "descargado" | null;

export function ReceiptModal({ open, onClose, data, token }: Props) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Sent>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // La regla de impresión de globals.css se apoya en esta clase.
    document.body.classList.add("printing");
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.classList.remove("printing");
      document.body.style.overflow = previous;
    };
  }, [open]);

  // El modal solo se abre por un clic, así que para entonces ya estamos
  // en el navegador; la guarda cubre el render del servidor.
  if (!open || typeof document === "undefined") return null;

  const imageUrl = token ? `/pedido/${token}/comprobante` : null;
  const fileName = `comprobante-${data.code}.png`;

  function download(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Manda la imagen por el mejor camino que tenga el aparato.
   *
   * En celular abre la hoja de "compartir" del sistema con la imagen
   * adjunta, que es la única forma de mandarla por WhatsApp sin pasos
   * intermedios: un enlace wa.me no puede llevar archivos.
   *
   * En computador no existe esa hoja, así que se copia al portapapeles
   * para pegarla directo en WhatsApp Web. Y si tampoco se puede, se
   * descarga.
   */
  async function send() {
    if (!imageUrl) return;
    setBusy(true);
    setError(null);
    setSent(null);

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("No se pudo generar la imagen");
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Comprobante ${data.code}` });
        setSent("compartido");
        return;
      }

      if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setSent("copiado");
        return;
      }

      download(blob);
      setSent("descargado");
    } catch (sendError) {
      // Cancelar la hoja de compartir lanza AbortError: no es un fallo.
      if (sendError instanceof DOMException && sendError.name === "AbortError") return;
      setError(sendError instanceof Error ? sendError.message : "No se pudo enviar");
    } finally {
      setBusy(false);
    }
  }

  async function saveImage() {
    if (!imageUrl) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("No se pudo generar la imagen");
      download(await response.blob());
      setSent("descargado");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo descargar");
    } finally {
      setBusy(false);
    }
  }

  const sentLabel: Record<NonNullable<Sent>, string> = {
    compartido: "Compartido",
    copiado: "Imagen copiada — pégala en WhatsApp",
    descargado: "Imagen descargada",
  };

  return createPortal(
    <div
      id="print-portal"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm">
        <div className="no-print mb-3 flex flex-col gap-2">
          <div className="flex gap-2">
            {imageUrl && (
              <button
                type="button"
                onClick={send}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-ok py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Enviar al cliente
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-white"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex gap-2">
            {imageUrl && (
              <button
                type="button"
                onClick={saveImage}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-bold disabled:opacity-60"
              >
                <ImageIcon className="size-4" />
                Descargar imagen
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-bold"
            >
              <Printer className="size-4" />
              Imprimir
            </button>
          </div>

          {sent && (
            <p className="flex items-center justify-center gap-1.5 rounded-xl bg-ok-soft px-3 py-2 text-xs font-bold text-ok">
              <Check className="size-3.5" />
              {sentLabel[sent]}
            </p>
          )}
          {error && (
            <p className="rounded-xl bg-bad-soft px-3 py-2 text-center text-xs font-bold text-bad">
              {error}
            </p>
          )}
        </div>

        <Receipt data={data} />

        {imageUrl && (
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="no-print mt-3 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-white/80"
          >
            <Download className="size-3.5" />
            Abrir la imagen en otra pestaña
          </a>
        )}
      </div>
    </div>,
    document.body,
  );
}
