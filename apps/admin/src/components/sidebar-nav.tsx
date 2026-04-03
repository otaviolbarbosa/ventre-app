"use client";

import { cn } from "@/lib/utils";
import { supabase } from "@ventre/supabase";
import { Building2, CreditCard, Heart, Home, LogOut, Receipt, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/users", label: "Usuários", icon: Users },
  { href: "/enterprises", label: "Empresas", icon: Building2 },
  { href: "/plans", label: "Planos", icon: CreditCard },
  { href: "/subscriptions", label: "Assinaturas", icon: Receipt },
  { href: "/patients", label: "Pacientes", icon: Heart },
];

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="fixed top-0 left-0 flex h-screen w-60 flex-col border-border border-r bg-sidebar">
      <div className="flex h-16 items-center border-sidebar-border border-b px-6">
        <span className="font-semibold text-lg text-sidebar-primary">Nascere Admin</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 font-medium text-sm transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-sidebar-border border-t px-3 py-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 font-medium text-sidebar-foreground text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
