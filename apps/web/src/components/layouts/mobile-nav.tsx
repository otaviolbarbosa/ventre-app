"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Users, Mail, LogOut, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SheetClose } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/shared/logo";

const navigation = [
  { name: "Início", href: "/home", icon: Home },
  { name: "Pacientes", href: "/patients", icon: Users },
  { name: "Convites", href: "/invites", icon: Mail },
];

export function MobileNav() {
  const pathname = usePathname();
  const { signOut, profile } = useAuth();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <SheetClose asChild>
          <Link href="/home" className="flex items-center space-x-2">
            <Logo href="/home" size="xl" />
          </Link>
        </SheetClose>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <SheetClose key={item.name} asChild>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            </SheetClose>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            {profile?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex-1 truncate">
            <p className="truncate text-sm font-medium text-gray-900">{profile?.name}</p>
            <p className="truncate text-xs text-gray-500">{profile?.professional_type}</p>
          </div>
        </div>
        <SheetClose asChild>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-gray-600"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </SheetClose>
      </div>
    </div>
  );
}
