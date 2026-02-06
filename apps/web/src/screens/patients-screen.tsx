"use client";
import { Header } from "@/components/layouts/header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { dayjs } from "@/lib/dayjs";
import { calculateGestationalAge } from "@/lib/gestational-age";
import type { Tables } from "@nascere/supabase";
import { Baby, Plus } from "lucide-react";
import Link from "next/link";

type PatientsScreenProps = {
  patients: Tables<"patients">[];
};
export default function PatientsScreen({ patients }: PatientsScreenProps) {
  return (
    <div>
      <Header title="Minhas Gestantes" />
      <div className="p-4 pt-0 md:p-6">
        <PageHeader
          // title="Pacientes"
          description="Gerencie suas gestantes"
        >
          <Link href="/patients/new">
            <Button className="gradient-primary">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:block">Adicionar</span>
            </Button>
          </Link>
        </PageHeader>

        {patients.length === 0 ? (
          <EmptyState
            icon={Baby}
            title="Nenhuma paciente cadastrada"
            description="Comece cadastrando sua primeira paciente para acompanhar a gestação."
          >
            <Link href="/patients/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar Paciente
              </Button>
            </Link>
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {patients.map((patient) => {
              const weekInfo = calculateGestationalAge(patient?.dum);
              return (
                <Link key={patient.id} href={`/patients/${patient.id}`} className="block">
                  <Card className="transition-colors hover:bg-muted/50">
                    <CardContent className="flex items-center gap-4 p-2">
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100 text-primary-700">
                        <Baby className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{patient.name}</h3>
                        {/* <p className="text-sm text-muted-foreground">{patient.email}</p> */}
                        <span>DPP: {dayjs(patient.due_date).format("DD/MM/YYYY")}</span>
                      </div>
                      {weekInfo && (
                        <div className="text-sm text-muted-foreground text-center justify-end">
                          <div className="flex gap-1 items-baseline justify-end">
                            <div className="text-2xl font-semibold">{weekInfo.weeks}</div>
                            <div className="font-poppins text-xs">Semanas</div>
                          </div>
                          <div className="flex gap-1 items-baseline justify-end">
                            <div className="font-semibold text-sm">{weekInfo.days}</div>
                            <div className="font-poppins text-xs">Dias</div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
