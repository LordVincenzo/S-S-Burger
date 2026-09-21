import { DeliveriesView } from "@/components/admin/deliveries-view";
import type { OrderWithItems } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminDeliveriesPage() {
  const supabase = await createClient();

  const ordersRes = await supabase
    .from("orders")
    .select("*, order_items(*), delivery_zone:delivery_zones(name, fee)")
    .eq("order_type", "delivery")
    // Lo que todavía no ha llegado a su destino. Lo entregado y lo
    // cancelado sale de la lista solo.
    .in("status", ["accepted", "preparing", "ready", "on_the_way"])
    .order("created_at");

  return (
    <DeliveriesView
      initialOrders={(ordersRes.data ?? []) as unknown as OrderWithItems[]}
      loadError={ordersRes.error?.message ?? null}
    />
  );
}
