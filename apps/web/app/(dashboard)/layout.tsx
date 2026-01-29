import BottomNav from "@/components/layouts/bottom-nav";
import { Sidebar } from "@/components/layouts/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar - hidden on mobile */}
        <div className="hidden md:flex">
          <Sidebar />
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-primary-50 pb-20 sm:pb-0">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
