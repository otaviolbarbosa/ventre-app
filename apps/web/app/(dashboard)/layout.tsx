import BottomNav from "@/components/layouts/bottom-nav";
import { MainContent } from "@/components/layouts/main-content";
import { Sidebar } from "@/components/layouts/sidebar";
import { FlashMessage } from "@/components/shared/flash-message";
import { NotificationPermissionPrompt } from "@/components/shared/notification-permission-prompt";
import { Suspense } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1">
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <MainContent>{children}</MainContent>
      </div>
      <BottomNav />
      <NotificationPermissionPrompt />
      <Suspense>
        <FlashMessage />
      </Suspense>
    </div>
  );
}
