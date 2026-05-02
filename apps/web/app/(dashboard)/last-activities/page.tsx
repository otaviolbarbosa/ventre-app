import { Header } from "@/components/layouts/header";
import { isStaff } from "@/lib/access-control";
import { getServerAuth } from "@/lib/server-auth";
import { LastActivitiesScreen } from "@/screens/last-activities-screen";
import { getEnterpriseActivityLogs } from "@/services/activity-logs";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { redirect } from "next/navigation";

const PAGE_SIZE = 20;

export default async function LastActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);

  const { profile } = await getServerAuth();

  if (!isStaff(profile) || !profile?.enterprise_id) {
    redirect("/home");
  }

  const supabaseAdmin = await createServerSupabaseAdmin();
  const offset = (currentPage - 1) * PAGE_SIZE;
  const { logs, total } = await getEnterpriseActivityLogs(supabaseAdmin, profile.enterprise_id, {
    limit: PAGE_SIZE,
    offset,
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex h-full flex-col">
      <Header title="Últimas Atualizações" />
      <LastActivitiesScreen
        logs={logs}
        currentPage={currentPage}
        totalPages={totalPages}
        total={total}
      />
    </div>
  );
}
