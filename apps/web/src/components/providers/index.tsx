"use client";

import { ThemeProvider } from "./theme-provider";
import { AuthProvider } from "./auth-provider";
import { PwaProvider } from "./pwa-provider";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <PwaProvider>
          {children}
          <Toaster />
        </PwaProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
