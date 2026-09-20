import { HistoryView } from "@/components/admin/history-view";
import type { OrderWithItems, StoreSettings } from "@/lib/database.types";
import { todayBogota } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Colombia no cambia de hora, así que el desfase es siempre -05:00. */
const startOf = (day: string) => `${day}T00:00:00-05:00`;
const endOf = (day: string) => `${day}T23:59:59.999-05:00`;

const isValidDay = (value?: string) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

export default async function AdminHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const params = await searchParams;
  const today = todayBogota();

  const from = isValidDay(params.desde) ? params.desde! : today;
  const to = isValidDay(params.hasta) ? params.hasta! : from;

  const supabase = await createClient();

  const [ordersRes, settingsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("*, order_items(*), delivery_zone:delivery_zones(name, fee)")
      .gte("created_at", startOf(from))
      .lte("created_at", endOf(to))
      .order("created_at", { ascending: false }),
    supabase.from("store_settings").select("*").maybeSingle(),
  ]);

  return (
    <HistoryView
      orders={(ordersRes.data ?? []) as unknown as OrderWithItems[]}
      from={from}
      to={to}
      settings={settingsRes.data as StoreSettings | null}
      loadError={ordersRes.error?.message ?? null}
    />
  );
}
