"use client";
import { Header } from "@/components/layouts/header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PatientCard } from "@/components/shared/patient-card";
import { ProfessionalsSelector } from "@/components/shared/professionals-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { calculateGestationalAge } from "@/lib/gestational-age";
import { cn } from "@/lib/utils";
import NewPatientModal from "@/modals/new-patient-modal";
import type { PatientWithPregnancyFields } from "@/services/patient";
import type { EnterpriseProfessional } from "@/services/professional";
import type { PatientFilter, TeamMember } from "@/types";
import { Baby, Check, ListFilter, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const FILTER_OPTIONS: { key: PatientFilter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "recent", label: "Adicionadas Recentemente" },
  { key: "trim1", label: "1º Trimestre" },
  { key: "trim2", label: "2º Trimestre" },
  { key: "trim3", label: "3º Trimestre" },
  { key: "final", label: "Bebê a Termo" },
];

const PATIENTS_PER_PAGE = 10;

type PatientsEnterpriseScreenProps = {
  patients: PatientWithPregnancyFields[];
  totalCount: number;
  currentPage: number;
  initialFilter: PatientFilter;
  initialSearch: string;
  professionals: EnterpriseProfessional[];
  initialProfessionalId: string | null;
  teamMembersMap: Record<string, TeamMember[]>;
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
}: PatientsEnterpriseScreenProps) {
  const router = useRouter();
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<PatientFilter>(initialFilter);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [professionalId, setProfessionalId] = useState<string | null>(initialProfessionalId);
  const [showFilters, setShowFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(!!initialSearch);
  const filterRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilters(false);
      }
    }
    if (showFilters) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilters]);

  const handleFilterToggle = useCallback(() => {
    setShowFilters((prev) => !prev);
  }, []);

  const buildUrl = useCallback(
    (filter: PatientFilter, search: string, profId: string | null, page = 1) => {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("filter", filter);
      if (search) params.set("search", search);
      if (profId) params.set("professional", profId);
      if (page > 1) params.set("page", String(page));
      const qs = params.toString();
      return qs ? `/patients?${qs}` : "/patients";
    },
    [],
  );

  const handleSearchToggle = useCallback(() => {
    setShowSearch((prev) => {
      if (prev) {
        setSearchQuery("");
        router.push(buildUrl(activeFilter, "", professionalId));
      } else {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      return !prev;
    });
  }, [activeFilter, buildUrl, professionalId, router]);

  const handleFilterClick = (filter: PatientFilter) => {
    setActiveFilter(filter);
    setShowFilters(false);
    router.push(buildUrl(filter, searchQuery, professionalId));
  };

  const handleProfessionalSelect = (id: string) => {
    const newId = professionalId === id ? null : id;
    setProfessionalId(newId);
    router.push(buildUrl(activeFilter, searchQuery, newId));
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      router.push(buildUrl(activeFilter, value, professionalId));
    }, 400);
  };

  const totalPages = Math.ceil(totalCount / PATIENTS_PER_PAGE);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const activeLabel = FILTER_OPTIONS.find((o) => o.key === activeFilter)?.label;

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

        <PageHeader description="">
          <div className="flex flex-col-reverse items-end gap-4">
            {activeFilter !== "all" && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1 px-3 py-1.5 text-sm">
                  {activeLabel}
                  <button type="button" onClick={() => handleFilterClick("all")}>
                    <X className="size-3" />
                  </button>
                </Badge>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant={showSearch ? "secondary" : "outline"}
                onClick={handleSearchToggle}
              >
                {showSearch ? <X className="size-4" /> : <Search className="size-4" />}
              </Button>
              <div ref={filterRef} className="relative">
                <Button
                  size="icon"
                  variant={activeFilter !== "all" ? "secondary" : "outline"}
                  className="flex"
                  onClick={handleFilterToggle}
                >
                  <ListFilter className="size-4" />
                </Button>
                <div
                  className={cn(
                    "absolute top-full right-0 z-10 mt-2 flex flex-col gap-1.5 rounded-xl border bg-background p-2 shadow-md transition-opacity duration-200",
                    showFilters ? "opacity-100" : "pointer-events-none opacity-0",
                  )}
                >
                  {FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => handleFilterClick(option.key)}
                      className={cn(
                        "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                        activeFilter === option.key && "font-medium text-primary",
                      )}
                    >
                      <Check
                        className={cn(
                          "size-4 shrink-0",
                          activeFilter === option.key ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

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
        </PageHeader>

        {showSearch && (
          <div className="relative mb-4">
            <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-4 size-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Buscar por nome..."
              className="h-11 rounded-full bg-white pl-10"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
        )}

        {patients.length === 0 ? (
          activeFilter !== "all" ? (
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
              {patients.map((patient) => {
                const weekInfo = calculateGestationalAge(patient?.dum);
                return (
                  <Link
                    key={patient.id}
                    href={`/patients/${patient.id}`}
                    className="rounded-xl border bg-white"
                  >
                    <PatientCard
                      patient={{
                        ...patient,
                        due_date: patient.due_date ?? null,
                        dum: patient.dum ?? null,
                        has_finished: false,
                        born_at: null,
                        observations: null,
                        weeks: weekInfo?.weeks ?? 0,
                        days: weekInfo?.days ?? 0,
                        remainingDays: 280 - (weekInfo?.totalDays ?? 0),
                        progress: ((weekInfo?.totalDays ?? 0) * 100) / 280,
                      }}
                      teamMembers={teamMembersMap[patient.id] ?? []}
                    />
                  </Link>
                );
              })}
            </div>

            {totalPages > 1 && (
              <Pagination className="mt-6">
                <PaginationContent>
                  {currentPage > 1 && (
                    <PaginationItem>
                      <PaginationPrevious
                        href={buildUrl(activeFilter, searchQuery, professionalId, currentPage - 1)}
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
                            href={buildUrl(activeFilter, searchQuery, professionalId, page)}
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
                        href={buildUrl(activeFilter, searchQuery, professionalId, currentPage + 1)}
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
