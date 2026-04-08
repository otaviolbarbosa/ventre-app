import BottomNav from "@/components/layouts/bottom-nav";
import { Sidebar } from "@/components/layouts/sidebar";
import { FlashMessage } from "@/components/shared/flash-message";
import { NotificationPermissionPrompt } from "@/components/shared/notification-permission-prompt";
import { Suspense } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar - hidden on mobile */}
        <div className="hidden md:flex">
          <Sidebar />
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-24 sm:pb-0">{children}</main>
      </div>
      <BottomNav />
      <NotificationPermissionPrompt />
      <Suspense>
        <FlashMessage />
      </Suspense>
    </div>
  );
}
