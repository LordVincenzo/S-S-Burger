"use client";

import { usePathname } from "next/navigation";

import { AdminNav } from "./admin-nav";

/**
 * Marco del panel de siempre: barra de navegación y columna centrada.
 *
 * El panel nuevo vive en /admin/new y trae su propio marco, así que ahí
 * este componente se aparta y deja pasar el contenido tal cual.
 */
export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/admin/new" || pathname.startsWith("/admin/new/")) return <>{children}</>;

  return (
    <div className="min-h-dvh">
      <AdminNav email={email} />
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}
