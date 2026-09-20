"use client";

import { Printer, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import { Receipt, type ReceiptData } from "@/components/receipt";

type Props = {
  open: boolean;
  onClose: () => void;
  data: ReceiptData;
};

export function ReceiptModal({ open, onClose, data }: Props) {
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

  return createPortal(
    <div
      id="print-portal"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm">
        <div className="no-print mb-3 flex justify-between gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-bold"
          >
            <Printer className="size-4" />
            Imprimir / Guardar PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid size-10 place-items-center rounded-xl bg-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <Receipt data={data} />
      </div>
    </div>,
    document.body,
  );
}
