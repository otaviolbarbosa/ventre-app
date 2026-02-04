"use client";
import { Header } from "@/components/layouts/header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { dayjs } from "@/lib/dayjs";
import { calculateGestationalAge } from "@/lib/gestational-age";
import type { HomeData } from "@/services/home";
import { getFirstName } from "@/utils";
import type { Tables } from "@nascere/supabase";
import { Baby, Calendar, Clock, User } from "lucide-react";
import Link from "next/link";

type HomeScreenProps = {
  profile: Tables<"users">;
  homeData: HomeData;
};

export default function HomeScreen({ profile, homeData }: HomeScreenProps) {
  const { trimesterCounts, upcomingDueDates, upcomingAppointments } = homeData;

  return (
    <div className="flex h-full flex-col">
      <Header title={`Olá, ${getFirstName(profile.name) ?? ""}!`} />

      <div className="flex flex-1 flex-col space-y-6 px-4 pb-20 sm:pb-4">
        {/* Minhas Gestantes */}
        <section>
          <h2 className="mb-3 font-medium font-poppins text-xl">Minhas Gestantes</h2>
          <Card>
            <CardContent className="flex gap-2 divide-x p-0">
              <div className="flex-1 items-center justify-center gap-2 space-y-2 py-2 text-center">
                <div className="font-medium text-muted-foreground text-sm">1º Trim.</div>
                <div className="font-semibold text-3xl">{trimesterCounts.first}</div>
              </div>
              <div className="flex-1 items-center justify-center gap-2 space-y-2 py-2 text-center">
                <div className="font-medium text-muted-foreground text-sm">2º Trim.</div>
                <div className="font-semibold text-3xl">{trimesterCounts.second}</div>
              </div>
              <div className="flex-1 items-center justify-center gap-2 space-y-2 py-2 text-center">
                <div className="font-medium text-muted-foreground text-sm">3º Trim.</div>
                <div className="font-semibold text-3xl">{trimesterCounts.third}</div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* DPP Próximas */}
        <section>
          <h2 className="mb-3 font-medium font-poppins text-xl">DPP Próximas</h2>
          <Card>
            <CardContent className="divide-y p-0">
              {upcomingDueDates.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Nenhuma DPP próxima
                </div>
              ) : (
                upcomingDueDates.map((patient) => (
                  <Link
                    key={patient.id}
                    href={`/patients/${patient.id}`}
                    className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                        <Baby className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-medium">{patient.name}</div>
                        <div className="text-muted-foreground text-sm">{patient.weeks} semanas</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {dayjs(patient.due_date).format("DD/MM/YYYY")}
                      </div>
                      <Badge
                        variant="secondary"
                        className="mt-1 bg-secondary-50 text-secondary-600"
                      >
                        <Clock className="mr-1 h-3 w-3" />
                        {patient.remainingDays} dias
                      </Badge>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </section>

        {/* Próximas Consultas */}
        <section>
          <h2 className="mb-3 font-medium font-poppins text-xl">Próximas Consultas</h2>
          <Card>
            <CardContent className="divide-y p-0">
              {upcomingAppointments.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Nenhuma consulta agendada
                </div>
              ) : (
                upcomingAppointments.map((appointment) => {
                  const gestationalAge = calculateGestationalAge(appointment.patient.dum);
                  const typeLabel = appointment.type === "consulta" ? "Pré-natal" : "Encontro";

                  return (
                    <Link
                      key={appointment.id}
                      href={`/patients/${appointment.patient_id}/appointments`}
                      className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-medium">{appointment.patient.name}</div>
                          <div className="text-muted-foreground text-sm">
                            {typeLabel}
                            {gestationalAge && ` - ${gestationalAge.weeks} semanas`}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {dayjs(appointment.date).format("DD/MM")}
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground text-sm">
                          <Clock className="h-4 w-4" />
                          {appointment.time.slice(0, 5)}
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
