"use client";
import { cn } from "@/lib/utils";
import { Calendar, DollarSign, Ellipsis, Home, Mail, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Avatar from "../shared/avatar";

export default function BottomNav() {
  const pathname = usePathname();
  const [hasPendingInvites, setHasPendingInvites] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    if (moreOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [moreOpen]);

  const handleMoreToggle = useCallback(() => {
    setMoreOpen((prev) => !prev);
  }, []);

  const isProfileActive = pathname.startsWith("/profile");

  const mainNav = [
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

  const overflowNav = [
    {
      name: "Financeiro",
      href: "/billing",
      icon: DollarSign,
      isActive: pathname.startsWith("/billing"),
    },
  ];

  const isOverflowActive = overflowNav.some((item) => item.isActive) || isProfileActive;

  return (
    <div className="fixed bottom-2 w-full p-4 sm:hidden">
      <div ref={moreRef} className="relative">
        <div
          className={cn(
            "-mr-1.5 absolute right-2 bottom-full mb-2 flex flex-col gap-1.5 rounded-[2rem] border border-white bg-primary/10 p-2.5 shadow-md shadow-primary/10 backdrop-blur-md transition-opacity duration-300",
            moreOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          {overflowNav.map((navItem) => (
            <Link
              key={`overflow-nav-${navItem.name}`}
              href={navItem.href}
              onClick={() => setMoreOpen(false)}
              className={cn(
                "relative flex h-11 items-center gap-2 rounded-full border border-primary/20 bg-white px-3",
                "transition-all duration-500 ease-out",
                navItem.isActive && "gradient-primary shadow-md",
              )}
            >
              <navItem.icon
                className={cn(
                  "size-5 text-primary transition-colors duration-500 ease-out",
                  navItem.isActive && "text-white",
                )}
              />
              <span
                className={cn(
                  "text-center font-medium font-poppins text-primary text-xs",
                  navItem.isActive && "text-white",
                )}
              >
                {navItem.name}
              </span>
            </Link>
          ))}
          <Link
            href="/profile"
            onClick={() => setMoreOpen(false)}
            className={cn(
              "relative flex h-11 items-center gap-1 rounded-full border border-primary/20 bg-white px-1",
              "transition-all duration-500 ease-out",
              isProfileActive && "gradient-primary shadow-md",
            )}
          >
            <Avatar size={8} className="border-none" />
            <span
              className={cn(
                "flex-1 text-center font-medium font-poppins text-primary text-xs",
                isProfileActive && "text-white",
              )}
            >
              Perfil
            </span>
          </Link>
        </div>

        <div className="flex justify-between gap-2 overflow-scroll rounded-full border border-white bg-primary/10 p-1.5 shadow-md shadow-primary/10 backdrop-blur-md">
          {mainNav.map((navItem) => (
            <Link
              key={`bottom-nav-${navItem.name}`}
              href={navItem.href}
              className={cn(
                "relative flex size-12 items-center justify-center rounded-full border border-primary/20 bg-white",
                "transition-all duration-500 ease-out",
                navItem.isActive &&
                  "gradient-primary size-auto flex-1 pr-4 pl-3 opacity-100 shadow-md",
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
          ))}
          <button
            type="button"
            onClick={handleMoreToggle}
            className={cn(
              "relative flex size-12 items-center justify-center rounded-full border border-primary/20 bg-white",
              "transition-all duration-500 ease-out",
              isOverflowActive && "gradient-primary shadow-md",
            )}
          >
            <Ellipsis
              className={cn(
                "size-5 text-primary transition-colors duration-500 ease-out",
                isOverflowActive && "text-white",
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
