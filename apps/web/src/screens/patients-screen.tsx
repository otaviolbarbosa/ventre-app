"use client";
import { Header } from "@/components/layouts/header";
import { EmptyState } from "@/components/shared/empty-state";
import { PatientCard } from "@/components/shared/patient-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import NewPatientModal from "@/modals/new-patient-modal";
import type { DppByMonth } from "@/services/home";
import { MONTH_LABELS_FULL } from "@/services/home";
import type { PatientWithPregnancyFields } from "@/services/patient";
import type { PatientFilter, TeamMember } from "@/types";
import { Baby, Check, ListFilter, Plus, Search, TrendingDown, TrendingUp, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

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

const PATIENTS_PER_PAGE = 10;

type PatientsScreenProps = {
  patients: PatientWithPregnancyFields[];
  totalCount: number;
  currentPage: number;
  initialFilter: PatientFilter;
  initialSearch: string;
  teamMembersMap: Record<string, TeamMember[]>;
  dppByMonth: DppByMonth[];
  initialDppMonth: number | null;
  initialDppYear: number | null;
};

export default function PatientsScreen({
  patients,
  totalCount,
  currentPage,
  initialFilter,
  initialSearch,
  teamMembersMap,
  dppByMonth,
  initialDppMonth,
  initialDppYear,
}: PatientsScreenProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<PatientFilter>(initialFilter);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [dppFilter, setDppFilter] = useState<{ month: number; year: number } | null>(
    initialDppMonth !== null && initialDppYear !== null
      ? { month: initialDppMonth, year: initialDppYear }
      : null,
  );
  const [showFilters, setShowFilters] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    (filter: PatientFilter, search: string, page = 1, dpp?: { month: number; year: number } | null) => {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("filter", filter);
      if (search) params.set("search", search);
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
    setShowFilters(false);
    startTransition(() => router.push(buildUrl(filter, searchQuery)));
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      router.push(buildUrl(activeFilter, value, 1, dppFilter));
    }, 400);
  };

  const handleDppFilterChange = (month: number, year: number) => {
    const isSame = dppFilter?.month === month && dppFilter?.year === year;
    if (isSame) {
      setDppFilter(null);
      startTransition(() => router.push(buildUrl(activeFilter, searchQuery)));
    } else {
      setDppFilter({ month, year });
      startTransition(() => router.push(buildUrl(activeFilter, searchQuery, 1, { month, year })));
    }
  };

  const handleClearDppFilter = () => {
    setDppFilter(null);
    startTransition(() => router.push(buildUrl(activeFilter, searchQuery)));
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
      <Header title="Minhas Gestantes" />
      <div className="p-4 pt-0 md:p-6 md:pt-0">
        {dppByMonth.length > 0 && (
          <div className="-mx-4 no-scrollbar mb-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {dppByMonth.map((item) => {
              const isSelected = dppFilter?.month === item.month && dppFilter?.year === item.year;
              return (
                <button
                  key={`${item.year}-${item.month}`}
                  type="button"
                  onClick={() => handleDppFilterChange(item.month, item.year)}
                >
                  <Card
                    className={cn(
                      "shrink-0 transition-colors",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/40 hover:bg-muted/40",
                    )}
                  >
                    <CardContent className="flex items-center justify-between px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex min-w-[120px] items-center justify-between gap-3">
                          <p
                            className={cn(
                              "font-bold font-poppins text-lg",
                              isSelected ? "text-primary" : "text-muted-foreground",
                            )}
                          >
                            {MONTH_LABELS_FULL[item.month]}
                          </p>
                          {item.percentage !== 0 && (
                            <div
                              className={cn(
                                "flex items-start gap-0.5 rounded-full border px-2 py-0.5 font-medium text-[10px]",
                                item.percentage >= 0
                                  ? "border-green-600/20 text-green-600"
                                  : "border-destructive/20 text-destructive",
                              )}
                            >
                              {Math.abs(item.percentage)}%
                              {item.percentage >= 0 ? (
                                <TrendingUp className="size-3.5" />
                              ) : (
                                <TrendingDown className="size-3.5" />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-baseline gap-4">
                          <p className="font-bold font-poppins text-xl">{item.count}</p>
                          <span className="text-muted-foreground text-xs">Gestantes</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
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
            <div ref={filterRef} className="relative">
              <Button
                size="icon"
                variant={activeFilter !== "all" ? "secondary" : "outline"}
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
              description="Comece cadastrando sua primeira paciente para acompanhar a gestação."
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
                        href={buildUrl(activeFilter, searchQuery, currentPage - 1, dppFilter)}
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
                            href={buildUrl(activeFilter, searchQuery, page, dppFilter)}
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
                      <PaginationNext href={buildUrl(activeFilter, searchQuery, currentPage + 1, dppFilter)} />
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
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
