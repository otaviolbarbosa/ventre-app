"use client";

import { cancelDayAppointmentsAction } from "@/actions/cancel-day-appointments-action";
import { useAuth } from "@/hooks/use-auth";
import { dayjs } from "@/lib/dayjs";
import type { AppointmentWithPatient } from "@/services/appointment";
import { professionalTypeLabels } from "@/utils/team";
import { Button } from "@ventre/ui/button";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Clock, MapPin, Pencil, Stethoscope } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { EditAppointmentModal } from "./edit-appointment-modal";

const typeLabels: Record<string, string> = {
  consulta: "Consulta",
  encontro: "Encontro",
};

type AppointmentDataModalProps = {
  appointment: AppointmentWithPatient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel?: VoidFunction;
  onSuccess?: VoidFunction;
};

export function AppointmentDataModal({
  appointment,
  open,
  onOpenChange,
  onCancel,
  onSuccess,
}: AppointmentDataModalProps) {
  const { isStaff } = useAuth();
  const [showEditModal, setShowEditModal] = useState(false);

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
        title={appointment.patient?.name ?? "Paciente"}
        description={typeLabels[appointment.type] ?? appointment.type}
      >
        <div className="space-y-4">
          <div className="absolute top-10 right-4">
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

            {isStaff && appointment.professional?.name && (
              <div className="flex items-center gap-2 text-sm">
                <Stethoscope className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  {appointment.professional.name}
                  {appointment.professional.professional_type && (
                    <span className="ml-1 text-muted-foreground">
                      ·{" "}
                      {professionalTypeLabels[appointment.professional.professional_type] ??
                        appointment.professional.professional_type}
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
