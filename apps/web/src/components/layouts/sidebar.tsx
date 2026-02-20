"use client";

import Avatar from "@/components/shared/avatar";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Bell, Calendar, DollarSign, Home, LogOut, Mail, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navigation = [
  { name: "Home", href: "/home", icon: Home },
  { name: "Gestantes", href: "/patients", icon: Users },
  { name: "Agenda", href: "/appointments", icon: Calendar },
  { name: "Financeiro", href: "/billing", icon: DollarSign },
  { name: "Convites", href: "/invites", icon: Mail },
  { name: "Notificações", href: "/notifications", icon: Bell },
  { name: "Configurações", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, profile } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <div className="flex h-full w-64 flex-col border-r bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Logo href="/home" size="xl" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-sm transition-colors",
                isActive
                  ? "bg-muted text-muted-foreground"
                  : "text-gray-800 hover:bg-muted/40 hover:text-muted-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t p-4">
        <Link href="/profile" className="mb-3 flex items-center gap-3">
          <Avatar size={10} />
          <div className="flex-1 truncate">
            <p className="truncate font-medium text-gray-900 text-sm">{profile?.name}</p>
            <p className="truncate text-gray-500 text-xs">{profile?.professional_type}</p>
          </div>
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-gray-600"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  );
}
