"use client";

import { useEffect, useState } from "react";

export type BillingViewMode = "simplified" | "expanded";

const STORAGE_KEY = "billing-view-mode";

export function useBillingViewMode() {
  const [viewMode, setViewModeState] = useState<BillingViewMode>("simplified");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "simplified" || stored === "expanded") {
      setViewModeState(stored);
    }
  }, []);

  const setViewMode = (mode: BillingViewMode) => {
    setViewModeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  };

  return { viewMode, setViewMode };
}
