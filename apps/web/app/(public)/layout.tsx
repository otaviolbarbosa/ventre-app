import { PublicFooter } from "@/components/shared/public-footer";
import { PublicHeader } from "@/components/shared/public-header";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <PublicHeader />
      <div className="flex-1">{children}</div>
      <PublicFooter />
    </div>
  );
}
