"use client";

import { Badge } from "@ventre/ui/badge";
import { Button } from "@ventre/ui/button";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { UserAvatar } from "@ventre/ui/shared/user-avatar";
import { Clock, MapPin, Pencil, Stethoscope, UserPlus } from "lucide-react";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { cancelDayAppointmentsAction } from "@/actions/cancel-day-appointments-action";
import { useAuth } from "@/hooks/use-auth";
import { dayjs } from "@/lib/dayjs";
import { calculateGestationalAge } from "@/lib/gestational-age";
import type { Appointment, PatientWithGestationalInfo, User } from "@/types";
import { professionalTypeLabels } from "@/utils/team";
import { EditAppointmentModal } from "./edit-appointment-modal";

const typeLabels: Record<string, string> = {
  consulta: "Consulta",
  encontro: "Encontro",
};

export type ExternalPatientValues = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type AppointmentDataModalProps = {
  appointment: Appointment | null;
  patient: PatientWithGestationalInfo | null;
  professional: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel?: VoidFunction;
  onSuccess?: VoidFunction;
  onRegisterExternalPatient?: (data: ExternalPatientValues) => void;
};

export function AppointmentDataModal({
  appointment,
  patient,
  professional,
  open,
  onOpenChange,
  onCancel,
  onSuccess,
  onRegisterExternalPatient,
}: AppointmentDataModalProps) {
  const { isStaff } = useAuth();
  const [showEditModal, setShowEditModal] = useState(false);

  const patientName = patient?.name ?? appointment?.external_patient_name ?? "Paciente externa";

  const { execute: cancelAppointment, isPending } = useAction(cancelDayAppointmentsAction, {
    onSuccess: () => {
      toast.success("Agendamento cancelado com sucesso");
      onOpenChange(false);
      onCancel?.();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao cancelar agendamento");
    },
  });

  if (!appointment) return null;

  const start = dayjs(`${appointment.date} ${appointment.time}`);
  const duration = appointment.duration ?? 60;
  const endTime = start.add(duration, "minute").format("HH:mm");
  const isCancellable = appointment.status === "agendada";

  return (
    <>
      <ContentModal
        open={open}
        onOpenChange={onOpenChange}
        title={typeLabels[appointment.type] ?? appointment.type}
      >
        <div className="space-y-4">
          <div className="flex justify-between gap-2">
            {patient && (
              <Link
                href={`/patients/${patient.id}`}
                className="relative flex flex-1 shrink-0 items-center gap-2 rounded-full p-2 hover:bg-accent"
              >
                <UserAvatar
                  user={{
                    name: patientName,
                    avatar_url: null,
                  }}
                  size={12}
                />
                <div className="">
                  <h4 className="font-medium">{patientName}</h4>
                  <div>
                    <Badge variant="outline" className="bg-background">
                      {calculateGestationalAge(patient?.dum as string)?.label}
                    </Badge>
                  </div>
                </div>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>
                {start.format("dddd, DD [de] MMMM")} • {start.format("HH:mm")} – {endTime}
                {appointment.duration && (
                  <span className="ml-1 text-muted-foreground">({appointment.duration} min)</span>
                )}
              </span>
            </div>

            {appointment.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{appointment.location}</span>
              </div>
            )}

            {isStaff && professional?.name && (
              <div className="flex items-center gap-2 text-sm">
                <Stethoscope className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  {professional.name}
                  {professional.professional_type && (
                    <span className="ml-1 text-muted-foreground">
                      ·{" "}
                      {professionalTypeLabels[professional.professional_type] ??
                        professional.professional_type}
                    </span>
                  )}
                </span>
              </div>
            )}

            {appointment.notes && (
              <p className="rounded-lg bg-muted/50 p-3 text-muted-foreground text-sm">
                {appointment.notes}
              </p>
            )}
          </div>

          {appointment.external_patient_name && onRegisterExternalPatient && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                onRegisterExternalPatient({
                  name: appointment.external_patient_name,
                  email: appointment.external_patient_email,
                  phone: appointment.external_patient_phone,
                });
              }}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Cadastrar como Gestante
            </Button>
          )}

          {isCancellable && (
            <Button
              variant="destructive"
              className="w-full"
              disabled={isPending}
              onClick={() =>
                cancelAppointment({
                  date: appointment.date,
                  appointmentIds: [appointment.id],
                })
              }
            >
              Cancelar Evento
            </Button>
          )}
        </div>
      </ContentModal>
      <EditAppointmentModal
        appointment={appointment}
        patient={patient}
        professional={professional}
        open={showEditModal}
        onOpenChange={setShowEditModal}
        onSuccess={() => {
          onOpenChange(false);
          onSuccess?.();
        }}
      />
    </>
  );
}
