"use client";
import { Header } from "@/components/layouts/header";
import { EmptyState } from "@/components/shared/empty-state";
import { PatientCard } from "@/components/shared/patient-card";
import { PATIENTS_PER_PAGE } from "@/lib/constants";
import { calculateGestationalAge } from "@/lib/gestational-age";
import type { PatientWithPregnancyFields } from "@/services/patient";
import type { TeamMember } from "@/types";
import { Button } from "@ventre/ui/button";
import { Input } from "@ventre/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@ventre/ui/pagination";
import { Skeleton } from "@ventre/ui/skeleton";
import { ArrowLeft, Baby, Search } from "lucide-react";
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

type PatientsHistoryScreenProps = {
  patients: PatientWithPregnancyFields[];
  totalCount: number;
  currentPage: number;
  initialSearch: string;
  teamMembersMap: Record<string, TeamMember[]>;
};

export default function PatientsHistoryScreen({
  patients,
  totalCount,
  currentPage,
  initialSearch,
  teamMembersMap,
}: PatientsHistoryScreenProps) {
  const router = useRouter();
  const [isPending] = useTransition();
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const buildUrl = useCallback((search: string, page = 1) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `/patients/history?${qs}` : "/patients/history";
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      router.push(buildUrl(value));
    }, 400);
  };

  const totalPages = Math.ceil(totalCount / PATIENTS_PER_PAGE);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const patientsWithGestAge = useMemo(
    () =>
      patients.map((patient) => {
        const weekInfo = calculateGestationalAge(patient?.dum);
        return {
          ...patient,
          due_date: patient.due_date ?? null,
          dum: patient.dum ?? null,
          has_finished: true as const,
          born_at: patient.born_at ?? null,
          delivery_method: patient.delivery_method ?? null,
          observations: patient.observations ?? null,
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
      <Header title="Histórico de Atendimentos" />
      <div className="p-4 pt-0 md:p-6 md:pt-0">
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" className="gap-2" asChild>
              <Link href="/patients">
                <ArrowLeft className="size-4" />
                <span>Voltar</span>
              </Link>
            </Button>
          </div>

          <div className="relative flex-1">
            <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-4 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              className="h-11 rounded-full bg-white pl-10"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
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
          <EmptyState
            icon={Baby}
            title="Nenhuma gestante no histórico"
            description="Nenhuma gestante com acompanhamento finalizado foi encontrada."
          />
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {patientsWithGestAge.map((patient) => (
                <Link
                  key={patient.id}
                  href={`/patients/${patient.id}`}
                  className="rounded-xl border bg-white"
                >
                  <PatientCard patient={patient} teamMembers={teamMembersMap[patient.id] ?? []} />
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <Pagination className="mt-6">
                <PaginationContent>
                  {currentPage > 1 && (
                    <PaginationItem>
                      <PaginationPrevious href={buildUrl(searchQuery, currentPage - 1)} />
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
                            href={buildUrl(searchQuery, page)}
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
                      <PaginationNext href={buildUrl(searchQuery, currentPage + 1)} />
                    </PaginationItem>
                  )}
                </PaginationContent>
              </Pagination>
            )}
          </>
        )}
      </div>
    </div>
  );
}
