"use client";

import { ConfirmationModalProvider } from "@ventre/ui/contexts/confirmation-modal-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ConfirmationModalProvider>{children}</ConfirmationModalProvider>;
}
