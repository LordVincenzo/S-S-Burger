import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next 16 llama a este archivo "proxy" (antes era middleware).
 * Corre antes de la página: refresca la sesión y cierra la puerta de /admin.
 */
export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Solo el panel. La carta y el seguimiento son públicos y no tienen
  // sesión que refrescar: hacerlos pasar por aquí sería una consulta
  // de autenticación desperdiciada en cada visita.
  matcher: ["/admin/:path*"],
};
