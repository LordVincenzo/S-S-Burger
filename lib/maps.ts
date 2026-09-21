/**
 * Enlaces de navegación para el repartidor.
 *
 * Se usa el formato universal de Google Maps: en el celular abre la app
 * si está instalada, y en el computador abre el mapa en el navegador.
 * No hace falta detectar el aparato.
 *
 * Va directo a la ruta (`/dir/`) y no a la búsqueda, porque quien toca
 * esto ya va saliendo con la comida.
 */
export function directionsUrl(address: string, city?: string | null) {
  // Sin ciudad, "Cra 17d #45-12" existe en media Colombia.
  const destination = [address, city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** Waze, para quien lo prefiera. */
export function wazeUrl(address: string, city?: string | null) {
  const destination = [address, city].filter(Boolean).join(", ");
  return `https://waze.com/ul?q=${encodeURIComponent(destination)}&navigate=yes`;
}
