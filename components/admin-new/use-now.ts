"use client";

import { useSyncExternalStore } from "react";

/*
 * Reloj compartido del panel nuevo, con la misma idea que <RelativeTime>:
 * en el servidor no hay hora (null) y en el navegador se refresca cada
 * 30 segundos con un único intervalo para toda la página.
 *
 * Aquí se devuelve el instante en vez del texto, porque además de decir
 * "hace 9 min" hay que decidir de qué color se pinta la espera.
 */

let now = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  now = Date.now();

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

export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => null,
  );
}
