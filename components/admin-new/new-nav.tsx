"use client";

import { LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { cn } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/admin/new", label: "Pedidos" },
  { href: "/admin/new/cocina", label: "Cocina" },
  { href: "/admin/new/entregas", label: "Entregas" },
  { href: "/admin/new/historial", label: "Historial" },
  { href: "/admin/new/carta", label: "Carta" },
  { href: "/admin/new/ajustes", label: "Ajustes" },
];

export function NewNav({ email, accepting }: { email: string; accepting: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-white">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-7 gap-y-2 px-4 py-3 sm:px-8">
        <div className="flex items-center gap-3">
          <Image
            src="/img/logo_ss.png"
            alt=""
            width={44}
            height={44}
            className="size-11 rounded-full object-cover"
          />
          <div className="leading-tight">
            <p className="text-lg font-extrabold">S&amp;S Burger</p>
            <p className="text-[13px] font-semibold text-ink-muted">Panel del local</p>
          </div>
        </div>

        <nav aria-label="Secciones" className="flex flex-1 flex-wrap gap-1">
          {LINKS.map(({ href, label }) => {
            const active = href === "/admin/new" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center rounded-[10px] px-3.5 text-[15px] transition",
                  active ? "bg-[#eceae6] font-extrabold" : "font-semibold hover:bg-cream",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-muted">
          <span className={cn("size-2 rounded-full", accepting ? "bg-ok" : "bg-bad")} />
          {accepting ? "Recibiendo pedidos" : "Tienda cerrada"}
        </span>

        <Link
          href="/admin"
          className="flex h-11 items-center rounded-[10px] border border-line px-3.5 text-sm font-bold"
        >
          Panel anterior
        </Link>

        <button
          type="button"
          onClick={signOut}
          aria-label={`Cerrar sesión de ${email}`}
          title={email}
          className="grid size-11 place-items-center rounded-[10px] text-ink-muted transition hover:bg-cream"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  );
}
