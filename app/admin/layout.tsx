import { ShieldAlert } from "lucide-react";

import { AdminNav } from "@/components/admin/admin-nav";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Panel", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // La página de login vive bajo /admin pero no lleva navegación.
  if (!user) return <>{children}</>;

  const { data: isAdmin } = await supabase.rpc("is_admin");

  if (!isAdmin) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <ShieldAlert className="size-10 text-brand-500" />
        <h1 className="text-xl font-extrabold">Cuenta sin permisos</h1>
        <p className="text-sm text-ink-muted">
          Iniciaste sesión como <strong>{user.email}</strong>, pero esta cuenta no está
          registrada como administradora.
        </p>
        <p className="rounded-xl bg-cream px-4 py-3 text-left font-mono text-xs break-all">
          insert into public.admins (user_id, label)
          <br />
          values (&apos;{user.id}&apos;, &apos;{user.email}&apos;);
        </p>
        <p className="text-xs text-ink-muted">
          Ejecuta esa línea en el editor SQL de Supabase y vuelve a cargar.
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-dvh">
      <AdminNav email={user.email ?? ""} />
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}
