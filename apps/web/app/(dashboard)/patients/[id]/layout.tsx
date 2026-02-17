"use client";

import { Header } from "@/components/layouts/header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Tables } from "@nascere/supabase/types";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Patient = Tables<"patients">;

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  const patientId = params.id as string;
  const currentTab = pathname.includes("/billing")
    ? "billing"
    : pathname.includes("/appointments")
      ? "appointments"
      : pathname.includes("/team")
        ? "team"
        : "profile";

  useEffect(() => {
    async function fetchPatient() {
      const response = await fetch(`/api/patients/${patientId}`);
      const data = await response.json();
      setPatient(data.patient);
      setLoading(false);
    }
    fetchPatient();
  }, [patientId]);

  if (loading) {
    return (
      <div>
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
      </div>
    );
  }

  if (!patient) {
    return (
      <div>
        <Header title="Paciente não encontrado" />
        <div className="p-4 md:p-6">
          <p className="text-muted-foreground">O paciente solicitado não foi encontrado.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title={patient.name} back />
      <div className="p-4 pt-0 md:p-6">
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

        {children}
      </div>
    </div>
  );
}
