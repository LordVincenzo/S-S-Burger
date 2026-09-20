import { notFound } from "next/navigation";

import { OrderTracker } from "@/components/shop/order-tracker";
import type { PublicOrder, StoreSettings } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tu pedido", robots: { index: false } };

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ nuevo?: string }>;
}) {
  const { token } = await params;
  const { nuevo } = await searchParams;

  const supabase = await createClient();

  const [orderRes, settingsRes] = await Promise.all([
    supabase.rpc("get_order_public", { p_token: token }),
    supabase.from("store_settings").select("*").maybeSingle(),
  ]);

  if (orderRes.error || !orderRes.data) notFound();

  return (
    <OrderTracker
      token={token}
      initialOrder={orderRes.data as PublicOrder}
      settings={settingsRes.data as StoreSettings | null}
      justCreated={nuevo === "1"}
    />
  );
}
