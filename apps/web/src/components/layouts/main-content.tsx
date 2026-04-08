"use client";

import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

export function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className={cn("flex-1 overflow-y-auto", pathname !== "/onboarding" && "pb-24 sm:pb-0")}>
      {children}
    </main>
  );
}
