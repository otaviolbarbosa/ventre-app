"use client";

import { useBirthModeStatus } from "@/hooks/use-birth-mode-status";
import { createContext, useContext } from "react";

type BirthModeRealtimeContextType = ReturnType<typeof useBirthModeStatus>;

const BirthModeRealtimeContext = createContext<BirthModeRealtimeContextType | null>(null);

export function BirthModeRealtimeProvider({ children }: { children: React.ReactNode }) {
  const value = useBirthModeStatus();
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
