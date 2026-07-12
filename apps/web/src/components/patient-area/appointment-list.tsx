"use client";

import { confirmAppointmentAttendanceAction } from "@/actions/confirm-appointment-attendance-action";
import { professionalTypeLabels } from "@/utils/team";
import { Badge } from "@ventre/ui/badge";
import { Button } from "@ventre/ui/button";
import type { AppointmentWithProfessional } from "@/services/patient-self";
import dayjs from "dayjs";
import { Check, Loader2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  consulta: "Consulta",
  retorno: "Retorno",
  exame: "Exame",
  ultrassom: "Ultrassom",
};

export default function AppointmentList({
  appointments,
}: {
  appointments: AppointmentWithProfessional[];
}) {
  const router = useRouter();
  const { execute, status, input } = useAction(confirmAppointmentAttendanceAction, {
    onSuccess: () => {
      toast.success("Presença confirmada!");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao confirmar presença");
    },
  });

  if (appointments.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center text-muted-foreground text-sm shadow-sm">
        Nenhuma consulta agendada.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {appointments.map((appointment) => {
        const isPast = dayjs(`${appointment.date}T${appointment.time}`).isBefore(dayjs());
        const isConfirmed = !!appointment.confirmed_by_patient_at;
        const isExecutingThis =
          status === "executing" && input?.appointmentId === appointment.id;

        return (
          <div key={appointment.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[#433831]">
                  {dayjs(appointment.date).format("DD/MM/YYYY")} às {appointment.time.slice(0, 5)}
                </p>
                <p className="text-muted-foreground text-sm">
                  {APPOINTMENT_TYPE_LABELS[appointment.type] ?? appointment.type}
                  {appointment.professional?.name && ` · ${appointment.professional.name}`}
                  {appointment.professional?.professional_type &&
                    ` (${
                      professionalTypeLabels[appointment.professional.professional_type] ??
                      appointment.professional.professional_type
                    })`}
                </p>
              </div>
              {isConfirmed && (
                <Badge variant="outline" className="shrink-0 border-primary/40 text-primary">
                  <Check className="mr-1 h-3 w-3" />
                  Confirmada
                </Badge>
              )}
            </div>

            {!isConfirmed && !isPast && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full"
                disabled={isExecutingThis}
                onClick={() => execute({ appointmentId: appointment.id })}
              >
                {isExecutingThis && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar presença
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
