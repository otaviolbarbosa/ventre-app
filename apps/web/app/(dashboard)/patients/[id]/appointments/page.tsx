"use client";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingTable } from "@/components/shared/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { dayjs } from "@/lib/dayjs";
import NewAppointmentModal from "@/modals/new-appointment-modal";
import { professionalTypeLabels } from "@/utils/team";
import type { Tables } from "@nascere/supabase/types";
import { Calendar, Clock, MapPin, Plus } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);

  const patientId = params.id as string;

  const fetchAppointments = async () => {
    const response = await fetch(`/api/appointments?patient_id=${patientId}`);
    const data = await response.json();
    setAppointments(data.appointments || []);
    setLoading(false);
  };

  const fetchPatients = useCallback(async () => {
    const response = await fetch("/api/patients");
    const data = await response.json();
    setPatients(data.patients || []);
    setLoading(false);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchAppointments changes on every render
  useEffect(() => {
    fetchAppointments();
    fetchPatients();
  }, [patientId]);

  function handleOpenNewModal() {
    setShowNewModal(true);
  }

  if (loading) {
    return <LoadingTable />;
  }

  if (appointments.length === 0) {
    return (
      <>
        <EmptyState
          icon={Calendar}
          title="Nenhum agendamento"
          description="Ainda não há agendamentos para esta paciente."
        >
          <Button onClick={handleOpenNewModal}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Agendamento
          </Button>
        </EmptyState>

        <NewAppointmentModal
          showModal={showNewModal}
          setShowModal={setShowNewModal}
          patientId={patientId}
          patients={patients}
          callback={fetchAppointments}
        />
      </>
    );
  }

  return (
    <>
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Agenda</h2>
          <Button className="gradient-primary" onClick={handleOpenNewModal}>
            <Plus className="h-4 w-4" />
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
        callback={fetchAppointments}
      />
    </>
  );
}
