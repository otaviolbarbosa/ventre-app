import { PatientsScreen } from "@/screens";
import { getMyPatients } from "@/services";
import type { PatientFilter } from "@/types";

const VALID_FILTERS: PatientFilter[] = ["all", "recent", "trim1", "trim2", "trim3", "final"];

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; search?: string; page?: string }>;
}) {
  const { filter, search, page } = await searchParams;
  const validFilter = VALID_FILTERS.includes(filter as PatientFilter)
    ? (filter as PatientFilter)
    : "all";
  const currentPage = Math.max(1, Number(page) || 1);

  const { patients, totalCount } = await getMyPatients(validFilter, search || "", currentPage);

  return (
    <PatientsScreen
      patients={patients}
      totalCount={totalCount}
      currentPage={currentPage}
      initialFilter={validFilter}
      initialSearch={search || ""}
    />
  );
}
