import { AlertTriangle } from "lucide-react";

import { Storefront } from "@/components/shop/storefront";
import type { Category, DeliveryZone, Product, StoreSettings } from "@/lib/database.types";
import { createPublicClient } from "@/lib/supabase/public";

// La carta cambia poco: se sirve estática y se regenera cada minuto,
// así el cliente ve precios frescos sin pegarle a la base en cada visita.
export const revalidate = 60;

export default async function HomePage() {
  const supabase = createPublicClient();

  const [settingsRes, categoriesRes, productsRes, zonesRes] = await Promise.all([
    supabase.from("store_settings").select("*").maybeSingle(),
    supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
    supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("delivery_zones").select("*").eq("is_active", true).order("sort_order"),
  ]);

  const failed = settingsRes.error || categoriesRes.error || productsRes.error || zonesRes.error;

  if (failed) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertTriangle className="size-10 text-brand-500" />
        <h1 className="text-xl font-bold">No pudimos cargar la carta</h1>
        <p className="text-sm text-ink-muted">
          Revisa que las variables <code>NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> estén configuradas y que las migraciones de{" "}
          <code>supabase/migrations</code> se hayan ejecutado.
        </p>
        <p className="rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">{failed.message}</p>
      </main>
    );
  }

  return (
    <Storefront
      settings={settingsRes.data as StoreSettings | null}
      categories={(categoriesRes.data ?? []) as Category[]}
      products={(productsRes.data ?? []) as Product[]}
      zones={(zonesRes.data ?? []) as DeliveryZone[]}
    />
  );
}
