"use client";

import { useSyncExternalStore } from "react";

import { timeAgo } from "@/lib/format";

/*
 * Un solo reloj compartido para toda la página.
 *
 * "hace 6 min" no se puede calcular en el servidor: para cuando el HTML
 * llega al navegador ya no es cierto, y React se queja de que el servidor
 * y el cliente dicen cosas distintas. Así que en el servidor no se muestra
 * nada y el valor aparece al montar, refrescándose solo cada 30 segundos.
 *
 * Un único intervalo para todas las tarjetas, en vez de uno por pedido.
 */

let now = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);

  timer ??= setInterval(() => {
    now = Date.now();
    listeners.forEach((notify) => notify());
  }, 30_000);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export function RelativeTime({ iso }: { iso: string }) {
  const clock = useSyncExternalStore(
    subscribe,
    () => now,
    () => null,
  );

  if (clock === null) return null;

  return <>{timeAgo(iso, clock)}</>;
}
