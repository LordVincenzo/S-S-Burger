import { OrdersView } from "@/components/admin-new/orders-view";
import type {
  Category,
  DeliveryZone,
  OrderWithItems,
  Product,
  StoreSettings,
} from "@/lib/database.types";
import { todayBogota } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewOrdersPage() {
  const supabase = await createClient();

  // Colombia no cambia de hora, así que el desfase es siempre -05:00.
  const startOfToday = `${todayBogota()}T00:00:00-05:00`;

  const [ordersRes, productsRes, categoriesRes, zonesRes, settingsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("*, order_items(*), delivery_zone:delivery_zones(name, fee)")
      // Los pedidos de hoy, más cualquiera que haya quedado abierto de antes.
      .or(
        `created_at.gte.${startOfToday},status.in.(pending,accepted,preparing,ready,on_the_way)`,
      )
      .order("created_at", { ascending: false }),
    supabase.from("products").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("delivery_zones").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("store_settings").select("*").maybeSingle(),
  ]);

  return (
    <OrdersView
      initialOrders={(ordersRes.data ?? []) as unknown as OrderWithItems[]}
      products={(productsRes.data ?? []) as Product[]}
      categories={(categoriesRes.data ?? []) as Category[]}
      zones={(zonesRes.data ?? []) as DeliveryZone[]}
      settings={settingsRes.data as StoreSettings | null}
      loadError={ordersRes.error?.message ?? null}
    />
  );
}
