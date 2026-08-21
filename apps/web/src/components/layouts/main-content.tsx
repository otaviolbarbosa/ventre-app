"use client";

import { cn } from "@/lib/utils";
import { useBirthModeRealtimeContext } from "@/providers/birth-mode-realtime-provider";
import { usePathname } from "next/navigation";

export function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { showBar } = useBirthModeRealtimeContext();

  return (
    <main
      className={cn(
        "min-w-0 flex-1 overflow-y-auto",
        pathname !== "/onboarding" && "pb-24 sm:pb-0",
        showBar && "pt-14",
      )}
    >
      {children}
    </main>
  );
}
