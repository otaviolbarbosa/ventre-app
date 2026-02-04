"use client";

import Avatar from "@/components/shared/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bell, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface HeaderProps {
  title?: string;
  back?: string | boolean;
}

export function Header({ title, back }: HeaderProps) {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const scrollContainer = document.querySelector("main");

    const handleScroll = () => {
      const scrollTop = scrollContainer?.scrollTop ?? window.scrollY;
      setIsScrolled(scrollTop > 10);
    };

    handleScroll();

    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
      return () => scrollContainer.removeEventListener("scroll", handleScroll);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleGoBack = () => {
    if (typeof back === "string") {
      router.replace(back);
    }
    router.back();
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-16 items-center gap-2 bg-background px-4 transition-shadow duration-300 md:px-6",
        isScrolled && "shadow-gray-200 shadow-lg",
      )}
    >
      {/* Back button */}
      {back && (
        <Button variant="ghost" size="icon" className="mx-0 md:hidden" onClick={handleGoBack}>
          <ChevronLeft />
        </Button>
      )}
      {/* Title */}
      {title && (
        <div className="flex-1">
          {title && <h1 className="font-poppins font-semibold text-2xl tracking-tight">{title}</h1>}
        </div>
      )}
      {/* Mobile menu */}
      <div className="flex justify-center gap-2">
        <Button variant="ghost" size="icon" className="bg-white md:hidden">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notificações</span>
        </Button>
        <Link href="/profile" className="md:hidden">
          <Avatar />
          <span className="sr-only">Perfil</span>
        </Link>
      </div>
    </header>
  );
}
