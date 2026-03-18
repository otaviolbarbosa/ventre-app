"use client";
import { Header } from "@/components/layouts/header";
import { DppMonthCarousel } from "@/components/shared/dpp-month-carousel";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterDropdown } from "@/components/shared/filter-dropdown";
import { PATIENTS_PER_PAGE } from "@/lib/constants";
import { PatientCard } from "@/components/shared/patient-card";
import { ProfessionalsSelector } from "@/components/shared/professionals-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { calculateGestationalAge } from "@/lib/gestational-age";
import NewPatientModal from "@/modals/new-patient-modal";
import type { DppByMonth } from "@/services/home";
import { MONTH_LABELS_FULL } from "@/services/home";
import type { PatientWithPregnancyFields } from "@/services/patient";
import type { EnterpriseProfessional } from "@/services/professional";
import type { PatientFilter, TeamMember } from "@/types";
import { Baby, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

function PatientCardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-white p-4">
      <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="mt-2 h-3 w-full rounded-full" />
      </div>
    </div>
  );
}

const FILTER_OPTIONS: { key: PatientFilter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "recent", label: "Adicionadas Recentemente" },
  { key: "trim1", label: "1º Trimestre" },
  { key: "trim2", label: "2º Trimestre" },
  { key: "trim3", label: "3º Trimestre" },
  { key: "final", label: "Bebê a Termo" },
];

type PatientsEnterpriseScreenProps = {
  patients: PatientWithPregnancyFields[];
  totalCount: number;
  currentPage: number;
  initialFilter: PatientFilter;
  initialSearch: string;
  professionals: EnterpriseProfessional[];
  initialProfessionalId: string | null;
  teamMembersMap: Record<string, TeamMember[]>;
  dppByMonth: DppByMonth[];
  initialDppMonth: number | null;
  initialDppYear: number | null;
};

export default function PatientsEnterpriseScreen({
  patients,
  totalCount,
  currentPage,
  initialFilter,
  initialSearch,
  professionals,
  initialProfessionalId,
  teamMembersMap,
  dppByMonth,
  initialDppMonth,
  initialDppYear,
}: PatientsEnterpriseScreenProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<PatientFilter>(initialFilter);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [professionalId, setProfessionalId] = useState<string | null>(initialProfessionalId);
  const [dppFilter, setDppFilter] = useState<{ month: number; year: number } | null>(
    initialDppMonth !== null && initialDppYear !== null
      ? { month: initialDppMonth, year: initialDppYear }
      : null,
  );
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const buildUrl = useCallback(
    (
      filter: PatientFilter,
      search: string,
      profId: string | null,
      page = 1,
      dpp?: { month: number; year: number } | null,
    ) => {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("filter", filter);
      if (search) params.set("search", search);
      if (profId) params.set("professional", profId);
      if (page > 1) params.set("page", String(page));
      if (dpp) {
        params.set("dppMonth", String(dpp.month));
        params.set("dppYear", String(dpp.year));
      }
      const qs = params.toString();
      return qs ? `/patients?${qs}` : "/patients";
    },
    [],
  );

  const handleFilterClick = (filter: PatientFilter) => {
    setActiveFilter(filter);
    setDppFilter(null);
    startTransition(() => router.push(buildUrl(filter, searchQuery, professionalId)));
  };

  const handleProfessionalSelect = (id: string) => {
    const newId = professionalId === id ? null : id;
    setProfessionalId(newId);
    startTransition(() => router.push(buildUrl(activeFilter, searchQuery, newId, 1, dppFilter)));
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      router.push(buildUrl(activeFilter, value, professionalId, 1, dppFilter));
    }, 400);
  };

  const handleDppFilterChange = (month: number, year: number) => {
    const isSame = dppFilter?.month === month && dppFilter?.year === year;
    if (isSame) {
      setDppFilter(null);
      startTransition(() => router.push(buildUrl(activeFilter, searchQuery, professionalId)));
    } else {
      setDppFilter({ month, year });
      startTransition(() =>
        router.push(buildUrl(activeFilter, searchQuery, professionalId, 1, { month, year })),
      );
    }
  };

  const handleClearDppFilter = () => {
    setDppFilter(null);
    startTransition(() => router.push(buildUrl(activeFilter, searchQuery, professionalId)));
  };

  const totalPages = Math.ceil(totalCount / PATIENTS_PER_PAGE);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const activeLabel = FILTER_OPTIONS.find((o) => o.key === activeFilter)?.label;

  const patientsWithGestAge = useMemo(
    () =>
      patients.map((patient) => {
        const weekInfo = calculateGestationalAge(patient?.dum);
        return {
          ...patient,
          due_date: patient.due_date ?? null,
          dum: patient.dum ?? null,
          has_finished: false as const,
          born_at: null,
          observations: null,
          weeks: weekInfo?.weeks ?? 0,
          days: weekInfo?.days ?? 0,
          remainingDays: 280 - (weekInfo?.totalDays ?? 0),
          progress: ((weekInfo?.totalDays ?? 0) * 100) / 280,
        };
      }),
    [patients],
  );

  return (
    <div>
      <Header title="Gestantes" />
      <div className="p-4 pt-0 md:p-6 md:pt-0">
        {professionals.length > 0 && (
          <div className="mb-4">
            <ProfessionalsSelector
              professionals={professionals}
              selectedId={professionalId}
              onSelect={handleProfessionalSelect}
              getCountLabel={(prof) =>
                prof.patient_count === 1 ? "1 gestante" : `${prof.patient_count} gestantes`
              }
            />
          </div>
        )}

        {dppByMonth.length > 0 && (
          <div className="mb-4">
            <DppMonthCarousel
              items={dppByMonth}
              selectedMonth={dppFilter?.month ?? null}
              selectedYear={dppFilter?.year ?? null}
              onSelect={handleDppFilterChange}
            />
          </div>
        )}

        <div className="mb-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {dppFilter && (
                <Badge variant="secondary" className="gap-1 px-3 py-1.5 text-sm">
                  {MONTH_LABELS_FULL[dppFilter.month]}
                  <button type="button" onClick={handleClearDppFilter}>
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
              {!dppFilter && activeFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 px-3 py-1.5 text-sm">
                  {activeLabel}
                  <button type="button" onClick={() => handleFilterClick("all")}>
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="icon"
                className="gradient-primary flex sm:hidden"
                onClick={() => setShowNewPatientModal(true)}
              >
                <Plus className="size-4" />
              </Button>
              <Button
                className="gradient-primary hidden sm:flex"
                onClick={() => setShowNewPatientModal(true)}
              >
                <Plus className="size-4" />
                <span className="hidden sm:block">Adicionar</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-4 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                className="h-11 rounded-full bg-white pl-10"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <FilterDropdown
              options={FILTER_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
              value={activeFilter}
              onChange={(v) => handleFilterClick(v as PatientFilter)}
            />
          </div>
        </div>

        {isPending ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <PatientCardSkeleton key={i} />
            ))}
          </div>
        ) : patients.length === 0 ? (
          dppFilter ? (
            <EmptyState
              icon={Baby}
              title="Nenhuma gestante encontrada"
              description={`Nenhuma gestante com DPP em ${MONTH_LABELS_FULL[dppFilter.month]}.`}
            />
          ) : activeFilter !== "all" ? (
            <EmptyState
              icon={Baby}
              title="Nenhuma gestante encontrada"
              description={`Nenhuma gestante no filtro "${activeLabel}".`}
            />
          ) : (
            <EmptyState
              icon={Baby}
              title="Nenhuma paciente cadastrada"
              description="Nenhuma gestante encontrada para os filtros selecionados."
            >
              <Button onClick={() => setShowNewPatientModal(true)}>
                <Plus className="mr-2 size-4" />
                Cadastrar Paciente
              </Button>
            </EmptyState>
          )
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {patientsWithGestAge.map((patient) => (
                <Link
                  key={patient.id}
                  href={`/patients/${patient.id}`}
                  className="rounded-xl border bg-white"
                >
                  <PatientCard
                    patient={patient}
                    teamMembers={teamMembersMap[patient.id] ?? []}
                  />
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <Pagination className="mt-6">
                <PaginationContent>
                  {currentPage > 1 && (
                    <PaginationItem>
                      <PaginationPrevious
                        href={buildUrl(activeFilter, searchQuery, professionalId, currentPage - 1, dppFilter)}
                      />
                    </PaginationItem>
                  )}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      if (totalPages <= 5) return true;
                      if (page === 1 || page === totalPages) return true;
                      return Math.abs(page - currentPage) <= 1;
                    })
                    .map((page, idx, arr) => {
                      const items = [];
                      if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                        items.push(
                          <PaginationItem key={`ellipsis-${page}`}>
                            <span className="flex size-9 items-center justify-center text-muted-foreground">
                              ...
                            </span>
                          </PaginationItem>,
                        );
                      }
                      items.push(
                        <PaginationItem key={page}>
                          <PaginationLink
                            href={buildUrl(activeFilter, searchQuery, professionalId, page, dppFilter)}
                            isActive={page === currentPage}
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>,
                      );
                      return items;
                    })}
                  {currentPage < totalPages && (
                    <PaginationItem>
                      <PaginationNext
                        href={buildUrl(activeFilter, searchQuery, professionalId, currentPage + 1, dppFilter)}
                      />
                    </PaginationItem>
                  )}
                </PaginationContent>
              </Pagination>
            )}
          </>
        )}
      </div>

      <NewPatientModal
        showModal={showNewPatientModal}
        setShowModal={setShowNewPatientModal}
        professionals={professionals}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
