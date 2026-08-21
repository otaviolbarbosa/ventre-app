"use client";

import { ConfirmationModalProvider } from "@ventre/ui/contexts/confirmation-modal-provider";
import { Toaster } from "@ventre/ui/sonner";
import { PwaInstallBanner } from "@/components/shared/pwa-install-banner";
import { AuthProvider } from "./auth-provider";
import { BirthModeRealtimeProvider } from "./birth-mode-realtime-provider";
import { NotificationsProvider } from "./notifications-provider";
import { PosthogProvider } from "./posthog-provider";
import { PwaProvider } from "./pwa-provider";
import { ThemeProvider } from "./theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PosthogProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
        <AuthProvider>
          <BirthModeRealtimeProvider>
            <NotificationsProvider>
              <PwaProvider>
                <ConfirmationModalProvider>{children}</ConfirmationModalProvider>
                <PwaInstallBanner />
                <Toaster />
              </PwaProvider>
            </NotificationsProvider>
          </BirthModeRealtimeProvider>
        </AuthProvider>
      </ThemeProvider>
    </PosthogProvider>
  );
}
