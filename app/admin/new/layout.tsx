import { NewNav } from "@/components/admin-new/new-nav";
import { createClient } from "@/lib/supabase/server";

/*
 * Panel nuevo, en paralelo al de siempre para poder compararlos.
 *
 * La sesión y el permiso de administrador ya los comprobó el layout de
 * /admin, del que este cuelga; aquí solo se pone el marco y la paleta.
 */
export default async function NewPanelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const [
    {
      data: { user },
    },
    { data: settings },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("store_settings").select("accepting_orders").maybeSingle(),
  ]);

  return (
    <div className="panel-new min-h-dvh">
      <NewNav email={user?.email ?? ""} accepting={settings?.accepting_orders ?? true} />
      <div className="mx-auto max-w-[1360px] px-4 py-7 sm:px-8">{children}</div>
    </div>
  );
}
