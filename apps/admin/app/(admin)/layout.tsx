import { SidebarNav } from "@/components/sidebar-nav";
import { ConfirmationModalProvider } from "@ventre/ui/contexts/confirmation-modal-provider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmationModalProvider>
      <div className="flex min-h-screen">
        <SidebarNav />
        <main className="ml-60 flex-1 p-8">{children}</main>
      </div>
    </ConfirmationModalProvider>
  );
}
