"use client";

import { ClipboardList, History, LogOut, Settings, UtensilsCrossed } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { cn } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/admin", label: "Pedidos", icon: ClipboardList },
  { href: "/admin/historial", label: "Historial", icon: History },
  { href: "/admin/productos", label: "Carta", icon: UtensilsCrossed },
  { href: "/admin/configuracion", label: "Ajustes", icon: Settings },
];

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Image
          src="/img/logo_ss.png"
          alt=""
          width={36}
          height={36}
          className="size-9 object-contain"
        />

        <nav className="flex flex-1 gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition",
                  active ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:bg-cream",
                )}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <span className="hidden text-xs text-ink-muted md:inline">{email}</span>
        <button
          type="button"
          onClick={signOut}
          aria-label="Cerrar sesión"
          className="grid size-9 place-items-center rounded-xl text-ink-muted transition hover:bg-cream"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  );
}
