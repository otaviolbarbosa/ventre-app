"use client";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/shared/notification-bell";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
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
        <div className="min-w-0 flex-1">
          {title && <h1 className="truncate font-poppins font-semibold text-2xl tracking-tight">{title}</h1>}
        </div>
      )}
      <div className="flex justify-center gap-2">
        <NotificationBell />
      </div>
    </header>
  );
}
