"use client";
import { cn } from "@/lib/utils";
import { Home, Mail, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();

  const navigation = [
    { name: "Início", href: "/home", icon: Home, isActive: pathname.startsWith("/home") },
    {
      name: "Gestantes",
      href: "/patients",
      icon: Users,
      isActive: pathname.startsWith("/patients"),
    },
    // { name: "AI", href: "/ai", icon: BrainCircuit, isActive: pathname.startsWith("/ai") },
    { name: "Convites", href: "/invites", icon: Mail, isActive: pathname.startsWith("/invites") },
    {
      name: "Ajustes",
      href: "/settings",
      icon: Settings,
      isActive: pathname.startsWith("/settings"),
    },
  ];

  return (
    <div className="fixed bottom-0 w-full p-4 sm:hidden">
      <div className="flex justify-between gap-2 overflow-scroll rounded-full border border-white bg-primary/10 p-1.5 shadow-md shadow-primary/10 backdrop-blur-md">
        {navigation.map((navItem) => {
          return (
            <Link
              key={`bottom-nav-tem-${navItem.name}`}
              href={navItem.href}
              className={cn(
                "flex size-12 items-center justify-center rounded-full border border-primary/20 bg-white",
                "transition-all duration-500 ease-out",
                navItem.isActive && "size-auto flex-1 bg-primary px-4 shadow",
              )}
            >
              <navItem.icon
                className={cn(
                  "size-5 text-primary transition-colors duration-500 ease-out",
                  navItem.isActive && "text-white",
                )}
              />
              <div
                className={cn(
                  "overflow-hidden font-medium font-poppins text-white text-xs transition-all duration-500 ease-out",
                  navItem.isActive ? "max-w-24 pl-2 opacity-100" : "max-w-0 opacity-0",
                )}
              >
                {navItem.name}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
