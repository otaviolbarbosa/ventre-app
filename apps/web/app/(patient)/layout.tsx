import BottomNav from "@/components/layouts/bottom-nav";
import { MainContent } from "@/components/layouts/main-content";
import { Sidebar } from "@/components/layouts/sidebar";
import { getServerAuth } from "@/lib/server-auth";
import { redirect } from "next/navigation";

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getServerAuth();

  if (!user) {
    redirect("/login");
  }

  if (profile?.user_type !== "patient") {
    redirect("/home");
  }

  return (
    <div className="flex-1">
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <MainContent>{children}</MainContent>
      </div>
      <BottomNav />
    </div>
  );
}
