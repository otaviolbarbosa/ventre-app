"use client";
import { getAppointmentsAction } from "@/actions/get-appointments-action";
import { getPatientsAction } from "@/actions/get-patients-action";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingPatientAppointment } from "@/components/shared/loading-state";
import { dayjs } from "@/lib/dayjs";
import NewAppointmentModal from "@/modals/new-appointment-modal";
import { professionalTypeLabels } from "@/utils/team";
import type { Tables } from "@ventre/supabase/types";
import { Badge } from "@ventre/ui/badge";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import { Calendar, CalendarPlus, Clock, MapPin, Plus } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Appointment = Tables<"appointments"> & {
  professional: { name: string; professional_type: string } | null;
};

type Patient = Tables<"patients">;

const statusLabels: Record<string, { label: string; variant: "info" | "success" | "destructive" }> =
  {
    agendada: { label: "Agendada", variant: "info" },
    realizada: { label: "Realizada", variant: "success" },
    cancelada: { label: "Cancelada", variant: "destructive" },
  };

const typeLabels: Record<string, string> = {
  consulta: "Consulta",
  encontro: "Encontro",
};

export default function PatientAppointmentsPage() {
  const params = useParams();
  const [showNewModal, setShowNewModal] = useState(false);

  const patientId = params.id as string;

  const {
    execute: fetchAppointments,
    result: appointmentsResult,
    isPending,
  } = useAction(getAppointmentsAction);
  const { execute: fetchPatients, result: patientsResult } = useAction(getPatientsAction);

  useEffect(() => {
    fetchAppointments({ patientId });
    fetchPatients();
  }, [fetchAppointments, fetchPatients, patientId]);

  const appointments = (appointmentsResult.data?.appointments ?? []) as Appointment[];
  const patients = (patientsResult.data?.patients ?? []) as Patient[];

  if (isPending && appointments.length === 0) {
    return <LoadingPatientAppointment />;
  }

  if (appointments.length === 0) {
    return (
      <>
        <EmptyState
          icon={Calendar}
          title="Nenhum agendamento"
          description="Ainda não há agendamentos para esta paciente."
        >
          <Button className="gradient-primary" onClick={() => setShowNewModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Agendamento
          </Button>
        </EmptyState>

        <NewAppointmentModal
          showModal={showNewModal}
          setShowModal={setShowNewModal}
          patientId={patientId}
          patients={patients}
          onSuccess={() => fetchAppointments({ patientId })}
        />
      </>
    );
  }

  return (
    <>
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Agenda</h2>
          <Button
            size="icon"
            className="gradient-primary flex md:hidden"
            onClick={() => setShowNewModal(true)}
          >
            <CalendarPlus className="h-4 w-4" />
          </Button>
          <Button className="gradient-primary hidden md:flex" onClick={() => setShowNewModal(true)}>
            <CalendarPlus className="h-4 w-4" />
            <span className="ml-2 hidden sm:block">Novo Agendamento</span>
          </Button>
        </div>

        <div className="space-y-3">
          {appointments.map((appointment) => {
            const status = statusLabels[appointment.status] ?? {
              label: appointment.status,
              variant: "info" as const,
            };
            return (
              <Card key={appointment.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex flex-col items-center justify-center rounded-lg bg-muted px-3 py-2 font-poppins text-muted-foreground shadow shadow-primary/20">
                    <span className="font-semibold text-2xl">
                      {dayjs(appointment.date).format("DD")}
                    </span>
                    <span className="text-sm uppercase">
                      {dayjs(appointment.date).format("MMM")}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-medium font-poppins">
                        {typeLabels[appointment.type] ?? appointment.type}
                      </h3>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-muted-foreground text-sm">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {appointment.time.slice(0, 5)}
                        {appointment.duration && ` (${appointment.duration}min)`}
                      </span>
                      {appointment.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {appointment.location}
                        </span>
                      )}
                    </div>
                    {appointment.professional && (
                      <p className="mt-1 text-muted-foreground text-sm">
                        <span className="font-semibold">{appointment.professional.name}</span> -{" "}
                        {professionalTypeLabels[appointment.professional.professional_type]}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <NewAppointmentModal
        showModal={showNewModal}
        setShowModal={setShowNewModal}
        patientId={patientId}
        patients={patients}
        onSuccess={() => fetchAppointments({ patientId })}
      />
    </>
  );
}
