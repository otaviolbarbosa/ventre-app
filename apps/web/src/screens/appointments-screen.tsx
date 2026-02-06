"use client";
import { Header } from "@/components/layouts/header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dayjs } from "@/lib/dayjs";
import NewAppointmentModal from "@/modals/new-appointment-modal";
import type { AppointmentWithPatient } from "@/services/appointment";
import type { Tables } from "@nascere/supabase";
import { Calendar, Clock, MapPin, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type AppointmentsScreenProps = {
  appointments: AppointmentWithPatient[];
};

const statusLabels: Record<string, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

const statusColors: Record<string, string> = {
  agendada: "bg-blue-100 text-blue-800",
  realizada: "bg-green-100 text-green-800",
  cancelada: "bg-red-100 text-red-800",
};

const typeLabels: Record<string, string> = {
  consulta: "Consulta",
  encontro: "Encontro",
};

type Patient = Tables<"patients">;

function groupAppointmentsByDate(appointments: AppointmentWithPatient[]) {
  const grouped = appointments.reduce(
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

  return grouped;
}

type AppointmentListProps = {
  appointments: AppointmentWithPatient[];
  isPastList?: boolean;
  emptyTitle: string;
  emptyDescription: string;
};

function AppointmentList({
  appointments,
  isPastList = false,
  emptyTitle,
  emptyDescription,
}: AppointmentListProps) {
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

export default function AppointmentsScreen({
  appointments: initialAppointments,
}: AppointmentsScreenProps) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [_loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<AppointmentWithPatient[]>(initialAppointments);
  const now = dayjs();

  const fetchPatients = useCallback(async () => {
    const response = await fetch("/api/patients");
    const data = await response.json();
    setPatients(data.patients || []);
  }, []);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/appointments");
    const data = await response.json();
    setAppointments(data.appointments || []);
    setLoading(false);
  }, []);

  function handleOpenNewModal() {
    setShowNewModal(true);
  }

  const upcomingAppointments = appointments.filter((appointment) => {
    const appointmentDateTime = dayjs(`${appointment.date} ${appointment.time}`);
    return appointmentDateTime.isAfter(now) || appointmentDateTime.isSame(now, "minute");
  });

  const pastAppointments = appointments.filter((appointment) => {
    const appointmentDateTime = dayjs(`${appointment.date} ${appointment.time}`);
    return appointmentDateTime.isBefore(now);
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchAppointments changes on every render
  useEffect(() => {
    fetchPatients();
  }, []);

  return (
    <div>
      <Header title="Agenda" />
      <div className="p-4 pt-0 md:p-6">
        <div className="flex justify-between">
          <PageHeader description="Seus agendamentos" />
          <Button className="gradient-primary" onClick={handleOpenNewModal}>
            <Plus className="h-4 w-4" />
            <span className="ml-2 hidden sm:block">Adicionar Agendamento</span>
          </Button>
        </div>

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
            <AppointmentList
              appointments={upcomingAppointments}
              emptyTitle="Nenhum agendamento próximo"
              emptyDescription="Você não possui agendamentos futuros. Adicione um agendamento a partir do perfil de uma gestante."
            />
          </TabsContent>

          <TabsContent value="past" className="mt-4">
            <AppointmentList
              appointments={pastAppointments}
              isPastList
              emptyTitle="Nenhum agendamento anterior"
              emptyDescription="Você ainda não possui agendamentos realizados."
            />
          </TabsContent>
        </Tabs>
      </div>
      <NewAppointmentModal
        showModal={showNewModal}
        setShowModal={setShowNewModal}
        patients={patients}
        callback={fetchAppointments}
      />
    </div>
  );
}
