import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

/**
 * Cliente sin sesión, para datos públicos (la carta).
 *
 * El cliente normal de servidor lee cookies, y eso obliga a Next a
 * renderizar la página en cada visita. La carta no depende de quién
 * mire, así que usando este cliente la página se puede cachear y
 * regenerar cada minuto.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}
