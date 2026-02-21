"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dayjs } from "@/lib/dayjs";
import type { AppointmentWithPatient } from "@/services/appointment";
import { Calendar, Clock, MapPin } from "lucide-react";
import Link from "next/link";

const statusLabels: Record<string, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

const statusColors: Record<string, string> = {
  agendada: "bg-muted text-muted-foreground",
  realizada: "bg-green-100 text-green-800",
  cancelada: "bg-red-100 text-red-800",
};

const typeLabels: Record<string, string> = {
  consulta: "Consulta",
  encontro: "Encontro",
};

function groupAppointmentsByDate(appointments: AppointmentWithPatient[]) {
  return appointments.reduce(
    (acc, appointment) => {
      const dateKey = dayjs(appointment.date).format("YYYY-MM-DD");
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(appointment);
      return acc;
    },
    {} as Record<string, AppointmentWithPatient[]>,
  );
}

type AppointmentGroupProps = {
  appointments: AppointmentWithPatient[];
  isPastList?: boolean;
  emptyTitle: string;
  emptyDescription: string;
};

function AppointmentGroup({
  appointments,
  isPastList = false,
  emptyTitle,
  emptyDescription,
}: AppointmentGroupProps) {
  const groupedAppointments = groupAppointmentsByDate(appointments);
  const sortedDates = Object.keys(groupedAppointments).sort((a, b) =>
    isPastList ? b.localeCompare(a) : a.localeCompare(b),
  );

  if (appointments.length === 0) {
    return <EmptyState icon={Calendar} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-6">
      {sortedDates.map((dateKey) => {
        const dateAppointments = groupedAppointments[dateKey] || [];
        const isToday = dayjs(dateKey).isSame(dayjs(), "day");

        return (
          <div key={dateKey}>
            <div className="mb-3 flex items-center gap-2">
              <h3 className="font-medium text-muted-foreground text-sm">
                {isToday ? "Hoje" : dayjs(dateKey).format("dddd, DD [de] MMMM")}
              </h3>
              {isToday && (
                <Badge variant="secondary" className="text-xs">
                  Hoje
                </Badge>
              )}
            </div>
            <div className="space-y-3">
              {dateAppointments.map((appointment) => (
                <Link
                  key={appointment.id}
                  href={`/patients/${appointment.patient_id}/appointments`}
                  className="block"
                >
                  <Card
                    className={`transition-colors hover:bg-muted/50 ${isPastList ? "opacity-60" : ""}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{appointment.patient.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {typeLabels[appointment.type] || appointment.type}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-3 text-muted-foreground text-sm">
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{appointment.time.slice(0, 5)}</span>
                              {appointment.duration && (
                                <span className="text-xs">({appointment.duration} min)</span>
                              )}
                            </div>
                            {appointment.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                <span>{appointment.location}</span>
                              </div>
                            )}
                          </div>
                          {appointment.notes && (
                            <p className="line-clamp-2 text-muted-foreground text-sm">
                              {appointment.notes}
                            </p>
                          )}
                        </div>
                        <Badge className={statusColors[appointment.status]}>
                          {statusLabels[appointment.status] || appointment.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type AppointmentListViewProps = {
  appointments: AppointmentWithPatient[];
};

export function AppointmentListView({ appointments }: AppointmentListViewProps) {
  const now = dayjs();

  const upcomingAppointments = appointments.filter((appointment) => {
    const appointmentDateTime = dayjs(`${appointment.date} ${appointment.time}`);
    return appointmentDateTime.isAfter(now) || appointmentDateTime.isSame(now, "minute");
  });

  const pastAppointments = appointments.filter((appointment) => {
    const appointmentDateTime = dayjs(`${appointment.date} ${appointment.time}`);
    return appointmentDateTime.isBefore(now);
  });

  return (
    <Tabs defaultValue="upcoming" className="w-full">
      <TabsList>
        <TabsTrigger value="upcoming">
          Próximos
          {upcomingAppointments.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {upcomingAppointments.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="past">
          Anteriores
          {pastAppointments.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {pastAppointments.length}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upcoming" className="mt-4">
        <AppointmentGroup
          appointments={upcomingAppointments}
          emptyTitle="Nenhum agendamento próximo"
          emptyDescription="Você não possui agendamentos futuros. Adicione um agendamento a partir do perfil de uma gestante."
        />
      </TabsContent>

      <TabsContent value="past" className="mt-4">
        <AppointmentGroup
          appointments={pastAppointments}
          isPastList
          emptyTitle="Nenhum agendamento anterior"
          emptyDescription="Você ainda não possui agendamentos realizados."
        />
      </TabsContent>
    </Tabs>
  );
}
