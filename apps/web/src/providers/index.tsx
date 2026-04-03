"use client";

import { ConfirmationModalProvider } from "@ventre/ui/contexts/confirmation-modal-provider";
import { Toaster } from "@ventre/ui/sonner";
import { AuthProvider } from "./auth-provider";
import { NotificationsProvider } from "./notifications-provider";
import { PwaProvider } from "./pwa-provider";
import { ThemeProvider } from "./theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <NotificationsProvider>
          <PwaProvider>
            <ConfirmationModalProvider>{children}</ConfirmationModalProvider>
            <Toaster />
          </PwaProvider>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
