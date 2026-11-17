import { KitchenView } from "@/components/admin-new/kitchen-view";
import type { OrderWithItems } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewKitchenPage() {
  const supabase = await createClient();

  const ordersRes = await supabase
    .from("orders")
    .select("*, order_items(*), delivery_zone:delivery_zones(name, fee)")
    // Lo confirmado y lo que ya se está preparando; lo listo sale de la pantalla.
    .in("status", ["accepted", "preparing"])
    .order("created_at");

  return (
    <KitchenView
      initialOrders={(ordersRes.data ?? []) as unknown as OrderWithItems[]}
      loadError={ordersRes.error?.message ?? null}
    />
  );
}
