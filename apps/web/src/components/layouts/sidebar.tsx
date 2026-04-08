"use client";

import Avatar from "@/components/shared/avatar";
import { Logo } from "@/components/shared/logo";
import { useAuth } from "@/hooks/use-auth";
import { isStaff } from "@/lib/access-control";
import { cn } from "@/lib/utils";
import { Button } from "@ventre/ui/button";
import {
  BriefcaseMedicalIcon,
  Calendar,
  DollarSign,
  Home,
  LogOut,
  Mail,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

const navigationProfessionals = [
  { name: "Home", href: "/home", icon: Home },
  { name: "Gestantes", href: "/patients", icon: Users },
  { name: "Agenda", href: "/appointments", icon: Calendar },
  { name: "Financeiro", href: "/billing", icon: DollarSign },
  { name: "Convites", href: "/invites", icon: Mail },
];

const navigationStaff = [
  { name: "Home", href: "/home", icon: Home },
  { name: "Profissionais", href: "/users", icon: BriefcaseMedicalIcon },
  { name: "Gestantes", href: "/patients", icon: Users },
  { name: "Agenda", href: "/appointments", icon: Calendar },
  { name: "Financeiro", href: "/billing", icon: DollarSign },
];

export function Sidebar() {
  const pathname = usePathname();
  const { signOut, profile } = useAuth();

  const navigation = useMemo(
    () => (isStaff(profile) ? navigationStaff : navigationProfessionals),
    [profile],
  );

  if (pathname === "/onboarding") {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="hidden h-full w-64 flex-col border-r bg-white md:flex">
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
              prefetch
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t p-4">
        <Link href="/profile" className="mb-3 flex items-center gap-3" prefetch>
          <Avatar src={profile?.avatar_url ?? ""} name={profile?.name ?? ""} size={10} />
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
