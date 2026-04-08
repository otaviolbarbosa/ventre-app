"use client";

import { getPatientAction } from "@/actions/get-patient-action";
import { Header } from "@/components/layouts/header";
import { calculateGestationalAge } from "@/lib/gestational-age";
import { Skeleton } from "@ventre/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@ventre/ui/tabs";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();

  const patientId = (Array.isArray(params.id) ? params.id[0] : params.id) ?? "";
  const currentTab = pathname.includes("/billing")
    ? "billing"
    : pathname.includes("/appointments")
      ? "appointments"
      : pathname.includes("/team")
        ? "team"
        : "profile";

  const { execute, result, isPending } = useAction(getPatientAction);

  // biome-ignore lint/correctness/useExhaustiveDependencies: execute can change identity and cause request loops
  useEffect(() => {
    execute({ patientId });
  }, [patientId]);

  const patient = result.data?.patient;
  const pregnancy = result.data?.pregnancy;
  // Treat pre-fetch state as loading to avoid a "not found" flash before execute runs
  const isLoading = isPending || result.data === undefined;

  return (
    <div>
      {isLoading ? (
        <>
          <Header title="Carregando..." />
          <div className="p-4 md:p-6">
            <div className="mb-6">
              <Skeleton className="mb-2 h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-10 w-80" />
            <div className="mt-6">
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </>
      ) : !patient ? (
        <>
          <Header title="Paciente não encontrado" />
          <div className="p-4 md:p-6">
            <p className="text-muted-foreground">O paciente solicitado não foi encontrado.</p>
          </div>
        </>
      ) : (
        <>
          <Header
            title={
              <div className="flex items-baseline gap-2">
                <span>{patient.name}</span>
                <span className="font-medium font-sans text-sm">
                  {calculateGestationalAge(pregnancy?.dum)?.label}
                </span>
              </div>
            }
            back
          />
          <div className="p-4 pt-0 md:p-6 md:pt-0">
            <Tabs value={currentTab} className="mb-6 w-full">
              <TabsList>
                <Link href={`/patients/${patientId}/profile`} className="flex-1">
                  <TabsTrigger value="profile">Perfil</TabsTrigger>
                </Link>
                <Link href={`/patients/${patientId}/appointments`} className="flex-1">
                  <TabsTrigger value="appointments">Agenda</TabsTrigger>
                </Link>
                <Link href={`/patients/${patientId}/team`} className="flex-1">
                  <TabsTrigger value="team">Equipe</TabsTrigger>
                </Link>
                <Link href={`/patients/${patientId}/billing`} className="flex-1">
                  <TabsTrigger value="billing">Financeiro</TabsTrigger>
                </Link>
              </TabsList>
            </Tabs>
          </div>
        </>
      )}
      {/*
       * Children must always be rendered in the same position across all states.
       * Next.js App Router's Router component uses useMemo to track the segment tree;
       * conditionally omitting children causes a hook count mismatch ("Rendered more
       * hooks than during the previous render"). Hidden when data is loading/absent.
       */}
      <div className={patient && !isLoading ? "px-4 pb-4 md:px-6 md:pb-6" : "hidden"}>
        {children}
      </div>
    </div>
  );
}
