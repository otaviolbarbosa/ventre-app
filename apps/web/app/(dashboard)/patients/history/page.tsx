import { getEnterprisePatients } from "@/actions/get-enterprise-patients-action";
import { isStaff } from "@/lib/access-control";
import { getServerAuth } from "@/lib/server-auth";
import { PatientsHistoryEnterpriseScreen, PatientsHistoryScreen } from "@/screens";
import { getMyPatients } from "@/services/patient";
import { getEnterpriseProfessionals } from "@/services/professional";

export default async function PatientsHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    page?: string;
    professional?: string;
  }>;
}) {
  const { search, page, professional } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);

  const { profile } = await getServerAuth();

  if (isStaff(profile) && profile?.enterprise_id) {
    const { professionals } = await getEnterpriseProfessionals();

    const validProfessionalId =
      professional && professionals.some((p) => p.id === professional) ? professional : null;

    const { patients, totalCount, teamMembersMap } = await getEnterprisePatients(
      profile.enterprise_id,
      "finished",
      search || "",
      currentPage,
      validProfessionalId ?? undefined,
    );

    return (
      <PatientsHistoryEnterpriseScreen
        patients={patients}
        totalCount={totalCount}
        currentPage={currentPage}
        initialSearch={search || ""}
        professionals={professionals}
        initialProfessionalId={validProfessionalId}
        teamMembersMap={teamMembersMap}
      />
    );
  }

  const { patients, totalCount, teamMembersMap } = await getMyPatients(
    "finished",
    search || "",
    currentPage,
  );

  return (
    <PatientsHistoryScreen
      patients={patients}
      totalCount={totalCount}
      currentPage={currentPage}
      initialSearch={search || ""}
      teamMembersMap={teamMembersMap}
    />
  );
}
