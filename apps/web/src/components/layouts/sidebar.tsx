"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Users, Mail, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/shared/logo";
import { getInitials } from "@/utils";
import Image from "next/image";

const navigation = [
  { name: "Pacientes", href: "/patients", icon: Users },
  { name: "Convites", href: "/invites", icon: Mail },
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
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
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
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-primary-100 text-primary-700 overflow-hidden">
            {profile?.avatar_url ? (
              <Image src={profile.avatar_url} alt="User avatar" width={40} height={40} priority />
            ) : (
              getInitials(profile?.name)
            )}
          </div>
          <div className="flex-1 truncate">
            <p className="truncate text-sm font-medium text-gray-900">{profile?.name}</p>
            <p className="truncate text-xs text-gray-500">{profile?.professional_type}</p>
          </div>
        </div>
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
