"use client";
import { cn } from "@/lib/utils";
import { Calendar, Home, Mail, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Avatar from "../shared/avatar";

export default function BottomNav() {
  const pathname = usePathname();
  const [hasPendingInvites, setHasPendingInvites] = useState(false);

  useEffect(() => {
    async function fetchInvites() {
      try {
        const response = await fetch("/api/team/invites");
        if (response.ok) {
          const data = await response.json();
          setHasPendingInvites(data.invites?.length > 0);
        }
      } catch {
        // Silently fail
      }
    }
    fetchInvites();
  }, []);

  const isProfileActive = pathname.startsWith("/profile");

  const navigation = [
    { name: "Início", href: "/home", icon: Home, isActive: pathname.startsWith("/home") },
    {
      name: "Gestantes",
      href: "/patients",
      icon: Users,
      isActive: pathname.startsWith("/patients"),
    },
    {
      name: "Agenda",
      href: "/appointments",
      icon: Calendar,
      isActive: pathname.startsWith("/appointments"),
    },
    {
      name: "Convites",
      href: "/invites",
      icon: Mail,
      isActive: pathname.startsWith("/invites"),
      hasNewContent: hasPendingInvites,
    },
  ];

  return (
    <div className="fixed bottom-2 w-full p-4 sm:hidden">
      <div className="flex justify-between gap-2 overflow-scroll rounded-full border border-white bg-primary/10 p-1.5 shadow-md shadow-primary/10 backdrop-blur-md">
        {navigation.map((navItem) => {
          return (
            <Link
              key={`bottom-nav-tem-${navItem.name}`}
              href={navItem.href}
              className={cn(
                "relative flex size-12 items-center justify-center rounded-full border border-primary/20 bg-white",
                "transition-all duration-500 ease-out",
                navItem.isActive && "gradient-primary size-auto flex-1 px-4 opacity-100 shadow-md",
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
                  "flex-1 overflow-hidden text-center font-medium font-poppins text-white text-xs transition-all duration-500 ease-out",
                  navItem.isActive ? "max-w-24 pl-2 opacity-100" : "max-w-0 opacity-0",
                )}
              >
                {navItem.name}
              </div>
              {!navItem.isActive && navItem.hasNewContent && (
                <div className="absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full bg-red-500" />
              )}
            </Link>
          );
        })}
        <Link
          href="/profile"
          className={cn(
            "relative flex size-12 items-center justify-center rounded-full border border-primary/20 bg-white",
            "transition-all duration-500 ease-out",
            isProfileActive && "gradient-primary size-auto flex-1 px-4 opacity-100 shadow-md",
          )}
        >
          <Avatar size={10} className="border-none" />
          <div
            className={cn(
              "flex-1 overflow-hidden text-center font-medium font-poppins text-white text-xs transition-all duration-500 ease-out",
              isProfileActive ? "max-w-24 pl-2 opacity-100" : "max-w-0 opacity-0",
            )}
          >
            Profile
          </div>
        </Link>
      </div>
    </div>
  );
}
