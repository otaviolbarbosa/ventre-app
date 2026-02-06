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
  const currentTab = pathname.includes("/appointments")
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
        {/* <PageHeader
          // title={patient.name}
          breadcrumbs={[{ label: "Gestantes", href: "/patients" }, { label: patient.name }]}
        /> */}
        {/* <div className="mb-6 block flex flex-col gap-2 lg:flex-row">
          <Card className="flex-1">
            <CardHeader className="p-4 pb-0">
              <CardTitle>Idade Gestacional</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-6 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary-50 p-4 shadow shadow-primary/20">
                  <Baby className="text-primary-700" />
                </div>
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1">
                    <span className="font-poppins font-semibold text-3xl">
                      {calculateGestationalAge(patient.dum)?.weeks}
                    </span>
                    <span className="text-gray-500 text-sm">semanas</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-poppins font-semibold text-lg">
                      {calculateGestationalAge(patient.dum)?.days}
                    </span>{" "}
                    <span className="text-gray-500 text-sm">dias</span>
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <GestationalProgressBar dum={patient.dum} />
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1">
            <CardHeader className="p-4 pb-0">
              <CardTitle>DPP</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary-50 p-4 shadow shadow-primary/20">
                  <Calendar className="text-primary-700" />
                </div>
                <div className="font-poppins">
                  <div className="text-center font-semibold text-2xl">
                    {dayjs(patient.due_date).format("DD")}
                  </div>
                  <div className="text-center text-sm">
                    {dayjs(patient.due_date).format("MMM").toUpperCase()}
                  </div>
                </div>
              </div>
              <div className="flex flex-1 items-center justify-end gap-3 text-gray-500">
                Faltam{" "}
                <span className="font-poppins font-semibold text-3xl text-black">
                  {calculateRemainingDays(patient.due_date)}
                </span>{" "}
                dias
              </div>
            </CardContent>
          </Card>
        </div> */}

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
          </TabsList>
        </Tabs>

        {children}
      </div>
    </div>
  );
}
