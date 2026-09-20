import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** $ 18.000 */
export function currency(value: number | null | undefined) {
  return cop.format(value ?? 0);
}

const timeFmt = new Intl.DateTimeFormat("es-CO", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

const dateTimeFmt = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

const dateFmt = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Bogota",
});

/**
 * Intl mete espacios especiales (fino e irrompible) alrededor del "p. m.",
 * y la versión de ICU de Node no siempre usa el mismo que la del navegador.
 * Eso hace que el HTML del servidor y el del cliente no coincidan y React
 * avise de un error de hidratación. Normalizarlos deja ambos idénticos.
 */
const normalizeSpaces = (value: string) => value.replace(/[  ]/g, " ");

export const formatTime = (iso: string) => normalizeSpaces(timeFmt.format(new Date(iso)));
export const formatDateTime = (iso: string) =>
  normalizeSpaces(dateTimeFmt.format(new Date(iso)));
export const formatDate = (iso: string) => normalizeSpaces(dateFmt.format(new Date(iso)));

/**
 * "hace 4 min" — para saber cuánto lleva esperando un pedido.
 *
 * Recibe el instante de referencia en vez de leer Date.now() por dentro:
 * el servidor y el navegador nunca renderizan en el mismo milisegundo, así
 * que quien llama decide con qué reloj se compara. Ver <RelativeTime>.
 */
export function timeAgo(iso: string, now: number) {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

/** Fecha de hoy en Colombia, como YYYY-MM-DD. */
export function todayBogota() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

/** Deja solo dígitos y antepone el indicativo de Colombia si hace falta. */
export function normalizePhone(raw: string | null | undefined) {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("57")) return digits;
  if (digits.length === 10) return `57${digits}`;
  return digits;
}
