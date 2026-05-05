"use client";

import Avatar from "@/components/shared/avatar";
import { Logo } from "@/components/shared/logo";
import { useAuth } from "@/hooks/use-auth";
import { isStaff } from "@/lib/access-control";
import { cn } from "@/lib/utils";
import type { ProfessionalType } from "@/types";
import { professionalTypeLabels } from "@/utils/team";
import { Button } from "@ventre/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@ventre/ui/tooltip";
import {
  BriefcaseMedicalIcon,
  Calendar,
  CircleDollarSign,
  Home,
  LogOut,
  Mail,
  PanelLeft,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const navigationProfessionals = [
  { name: "Home", href: "/home", icon: Home },
  { name: "Gestantes", href: "/patients", icon: Users },
  { name: "Agenda", href: "/appointments", icon: Calendar },
  { name: "Financeiro", href: "/billing", icon: CircleDollarSign },
  { name: "Convites", href: "/invites", icon: Mail },
];

const navigationStaff = [
  { name: "Home", href: "/home", icon: Home },
  { name: "Profissionais", href: "/users", icon: BriefcaseMedicalIcon },
  { name: "Gestantes", href: "/patients", icon: Users },
  { name: "Agenda", href: "/appointments", icon: Calendar },
  { name: "Financeiro", href: "/billing", icon: CircleDollarSign },
];

export function Sidebar() {
  const pathname = usePathname();
  const { signOut, profile } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored !== null) setIsCollapsed(stored === "true");
  }, []);

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

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "hidden h-full flex-col border-r bg-white transition-all duration-300 md:flex",
          isCollapsed ? "w-16" : "w-64",
        )}
      >
        {/* Logo + toggle */}
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b",
            isCollapsed ? "justify-center px-3" : "justify-between px-4",
          )}
        >
          {!isCollapsed && <Logo href="/home" size="xl" />}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-gray-500 hover:text-gray-800"
            onClick={toggleCollapsed}
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            <PanelLeft
              className={cn(
                "h-4 w-4 transition-transform duration-300",
                isCollapsed && "rotate-180",
              )}
            />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-4">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const linkEl = (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center rounded-lg px-3 py-2 font-medium text-sm transition-colors",
                  isCollapsed ? "justify-center gap-0 px-2" : "gap-3",
                  isActive
                    ? "bg-muted text-muted-foreground"
                    : "text-gray-800 hover:bg-muted/40 hover:text-muted-foreground",
                )}
                prefetch
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && item.name}
              </Link>
            );

            if (!isCollapsed) return linkEl;

            return (
              <Tooltip key={item.name}>
                <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                <TooltipContent side="right">{item.name}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* User section */}
        <div className={cn("border-t", isCollapsed ? "p-2" : "p-4")}>
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/profile" prefetch>
                    <Avatar src={profile?.avatar_url ?? ""} name={profile?.name ?? ""} size={8} />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{profile?.name ?? "Perfil"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-600"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sair</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <>
              <Link href="/profile" className="mb-3 flex items-center gap-3" prefetch>
                <Avatar src={profile?.avatar_url ?? ""} name={profile?.name ?? ""} size={10} />
                <div className="flex-1 truncate">
                  <p className="truncate font-medium text-gray-900 text-sm">{profile?.name}</p>
                  <p className="truncate text-gray-500 text-xs">
                    {professionalTypeLabels[profile?.professional_type as ProfessionalType]}
                  </p>
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
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
