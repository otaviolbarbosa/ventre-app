import BottomNav from "@/components/layouts/bottom-nav";
import { MainContent } from "@/components/layouts/main-content";
import { Sidebar } from "@/components/layouts/sidebar";
import { FlashMessage } from "@/components/shared/flash-message";
import { NotificationPermissionPrompt } from "@/components/shared/notification-permission-prompt";
import { ProfessionalDocumentsBanner } from "@/components/shared/professional-documents-banner";
import { needsProfessionalDocuments } from "@/lib/professional-documents";
import { getServerAuth } from "@/lib/server-auth";
import type { ProfessionalType } from "@/types";
import { Suspense } from "react";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getServerAuth();
  const showProfessionalDocumentsBanner = needsProfessionalDocuments(
    (profile?.professional_type as ProfessionalType | null) ?? null,
    profile?.professional_documents ?? null,
  );

  return (
    <div className="flex-1">
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <MainContent>{children}</MainContent>
      </div>
      <BottomNav />
      <NotificationPermissionPrompt />
      {showProfessionalDocumentsBanner && <ProfessionalDocumentsBanner />}
      <Suspense>
        <FlashMessage />
      </Suspense>
    </div>
  );
}
