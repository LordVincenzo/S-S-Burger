import { ProductsManager } from "@/components/admin/products-manager";
import type { Category, Product } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const supabase = await createClient();

  const [categoriesRes, productsRes] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("products").select("*").order("sort_order"),
  ]);

  return (
    <ProductsManager
      categories={(categoriesRes.data ?? []) as Category[]}
      products={(productsRes.data ?? []) as Product[]}
    />
  );
}
