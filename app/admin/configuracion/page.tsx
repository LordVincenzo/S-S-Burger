import { SettingsForm } from "@/components/admin/settings-form";
import type { DeliveryZone, StoreSettings } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const supabase = await createClient();

  const [settingsRes, zonesRes] = await Promise.all([
    supabase.from("store_settings").select("*").maybeSingle(),
    supabase.from("delivery_zones").select("*").order("sort_order"),
  ]);

  return (
    <SettingsForm
      settings={settingsRes.data as StoreSettings | null}
      zones={(zonesRes.data ?? []) as DeliveryZone[]}
    />
  );
}
