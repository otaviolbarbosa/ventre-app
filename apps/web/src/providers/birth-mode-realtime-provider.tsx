"use client";

import { useBirthModeRealtime } from "@/hooks/use-birth-mode-realtime";
import { createContext, useContext } from "react";

type BirthModeRealtimeContextType = ReturnType<typeof useBirthModeRealtime>;

const BirthModeRealtimeContext = createContext<BirthModeRealtimeContextType | null>(null);

export function BirthModeRealtimeProvider({ children }: { children: React.ReactNode }) {
  const value = useBirthModeRealtime();
  return (
    <BirthModeRealtimeContext.Provider value={value}>{children}</BirthModeRealtimeContext.Provider>
  );
}

export function useBirthModeRealtimeContext(): BirthModeRealtimeContextType {
  const ctx = useContext(BirthModeRealtimeContext);
  if (!ctx) {
    throw new Error("useBirthModeRealtimeContext must be used inside BirthModeRealtimeProvider");
  }
  return ctx;
}
