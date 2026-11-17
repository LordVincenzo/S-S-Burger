/**
 * Tiempo de espera de un pedido, para pintarlo por colores en el panel
 * nuevo y en la pantalla de cocina.
 *
 * Los límites están fijos aquí por ahora; si más adelante se guardan en
 * store_settings, este es el único sitio que hay que cambiar.
 */
export const WAIT_WARN_MINUTES = 8;
export const WAIT_LATE_MINUTES = 12;

export type WaitLevel = "ok" | "warn" | "late";

export function waitLevel(minutes: number): WaitLevel {
  if (minutes >= WAIT_LATE_MINUTES) return "late";
  if (minutes >= WAIT_WARN_MINUTES) return "warn";
  return "ok";
}

export const minutesSince = (iso: string, now: number) =>
  Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
