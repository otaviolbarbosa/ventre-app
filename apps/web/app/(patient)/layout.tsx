import { getServerAuth } from "@/lib/server-auth";
import PatientNav from "@/components/patient-area/patient-nav";
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
    <div className="min-h-screen bg-[#FFFAF5] pb-20">
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
      <PatientNav />
    </div>
  );
}
