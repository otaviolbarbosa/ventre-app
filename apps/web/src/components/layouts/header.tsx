"use client";
import { NotificationBell } from "@/components/shared/notification-bell";
import { cn } from "@/lib/utils";
import { Button } from "@ventre/ui/button";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface HeaderProps {
  title?: React.ReactNode;
  back?: string | boolean;
  subtitle?: React.ReactNode;
}

export function Header({ title, back, subtitle }: HeaderProps) {
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
      return router.replace(back);
    }
    router.back();
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex min-h-16 items-center bg-background px-4 py-3 transition-shadow duration-300 md:px-6",
        isScrolled && "shadow-gray-200 shadow-lg",
      )}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {/* Back button */}
          {back && (
            <Button
              variant="ghost"
              size="icon"
              className="mx-0 w-6 hover:bg-transparent active:bg-transparent md:hidden"
              onClick={handleGoBack}
            >
              <ChevronLeft />
            </Button>
          )}
          {/* Title */}
          {title && (
            <div className="min-w-0 flex-1">
              {title && (
                <h1 className="truncate font-poppins font-semibold text-xl tracking-tight">
                  {title}
                </h1>
              )}
            </div>
          )}
          <div className="flex justify-center gap-2">
            <NotificationBell />
          </div>
        </div>
        {subtitle && <div className="mt-0.5 text-muted-foreground text-sm">{subtitle}</div>}
      </div>
    </header>
  );
}
