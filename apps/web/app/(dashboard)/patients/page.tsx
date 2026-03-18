import { getEnterpriseDueDates, getEnterprisePatients } from "@/actions/get-enterprise-patients-action";
import { isStaff } from "@/lib/access-control";
import { dayjs } from "@/lib/dayjs";
import { getServerAuth } from "@/lib/server-auth";
import { PatientsEnterpriseScreen, PatientsScreen } from "@/screens";
import { buildDppByMonth } from "@/services/home";
import { getMyPatients } from "@/services/patient";
import { getDueDatesForUser } from "@/services/patient";
import { getEnterpriseProfessionals } from "@/services/professional";
import type { PatientFilter } from "@/types";

const VALID_FILTERS: PatientFilter[] = ["all", "recent", "trim1", "trim2", "trim3", "final"];

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; search?: string; page?: string; professional?: string; dppMonth?: string; dppYear?: string }>;
}) {
  const { filter, search, page, professional, dppMonth: dppMonthParam, dppYear: dppYearParam } = await searchParams;
  const validFilter = VALID_FILTERS.includes(filter as PatientFilter)
    ? (filter as PatientFilter)
    : "all";
  const currentPage = Math.max(1, Number(page) || 1);

  const dppMonth = dppMonthParam !== undefined ? Number(dppMonthParam) : undefined;
  const dppYear = dppYearParam !== undefined ? Number(dppYearParam) : undefined;

  const initialDppMonth = dppMonth !== undefined ? dppMonth : null;
  const initialDppYear = dppYear !== undefined ? dppYear : null;

  const { profile } = await getServerAuth();

  let patients: Awaited<ReturnType<typeof getMyPatients>>["patients"] = [];
  let totalCount = 0;
  let teamMembersMap: Awaited<ReturnType<typeof getMyPatients>>["teamMembersMap"] = {};

  if (isStaff(profile) && profile?.enterprise_id) {
    const { professionals } = await getEnterpriseProfessionals();

    const validProfessionalId =
      professional && professionals.some((p) => p.id === professional) ? professional : null;

    const [{ patients: p, totalCount: tc, teamMembersMap: tm }, dueDates] = await Promise.all([
      getEnterprisePatients(
        profile.enterprise_id,
        validFilter,
        search || "",
        currentPage,
        validProfessionalId ?? undefined,
        dppMonth,
        dppYear,
      ),
      getEnterpriseDueDates(profile.enterprise_id, validProfessionalId),
    ]);

    patients = p;
    totalCount = tc;
    teamMembersMap = tm;

    const dppByMonth = buildDppByMonth(dueDates, dayjs());

    return (
      <PatientsEnterpriseScreen
        patients={patients}
        totalCount={totalCount}
        currentPage={currentPage}
        initialFilter={validFilter}
        initialSearch={search || ""}
        professionals={professionals}
        initialProfessionalId={validProfessionalId}
        teamMembersMap={teamMembersMap}
        dppByMonth={dppByMonth}
        initialDppMonth={initialDppMonth}
        initialDppYear={initialDppYear}
      />
    );
  }

  const [{ patients: p, totalCount: tc, teamMembersMap: tm }, dueDates] = await Promise.all([
    getMyPatients(validFilter, search || "", currentPage, dppMonth, dppYear),
    profile?.id ? getDueDatesForUser(profile.id) : Promise.resolve([]),
  ]);

  patients = p;
  totalCount = tc;
  teamMembersMap = tm;

  const dppByMonth = buildDppByMonth(dueDates, dayjs());

  return (
    <PatientsScreen
      patients={patients}
      totalCount={totalCount}
      currentPage={currentPage}
      initialFilter={validFilter}
      initialSearch={search || ""}
      teamMembersMap={teamMembersMap}
      dppByMonth={dppByMonth}
      initialDppMonth={initialDppMonth}
      initialDppYear={initialDppYear}
    />
  );
}
