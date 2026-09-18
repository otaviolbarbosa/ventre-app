"use client";

import type { AppointmentWithProfessional } from "@/services/patient-self";
import { professionalTypeLabels } from "@/utils/team";
import { Badge } from "@ventre/ui/badge";
import { Button } from "@ventre/ui/button";
import dayjs from "dayjs";
import { Check } from "lucide-react";

const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  consulta: "Consulta",
  retorno: "Retorno",
  exame: "Exame",
  ultrassom: "Ultrassom",
};

export default function AppointmentList({
  appointments,
  onRequestConfirm,
  onRequestCancel,
}: {
  appointments: AppointmentWithProfessional[];
  onRequestConfirm: (appointment: AppointmentWithProfessional) => void;
  onRequestCancel: (appointment: AppointmentWithProfessional) => void;
}) {
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
        const isCancelled = appointment.status === "cancelada";
        const isConfirmed = !!appointment.confirmed_by_patient_at;

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
              {isCancelled ? (
                <Badge
                  variant="outline"
                  className="shrink-0 border-destructive/40 text-destructive"
                >
                  Cancelada
                </Badge>
              ) : (
                isConfirmed && (
                  <Badge variant="outline" className="shrink-0 border-primary/40 text-primary">
                    <Check className="mr-1 h-3 w-3" />
                    Confirmada
                  </Badge>
                )
              )}
            </div>

            {!isCancelled && !isPast && (
              <div className="mt-3 flex gap-2">
                {!isConfirmed && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => onRequestConfirm(appointment)}
                  >
                    Confirmar presença
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive-outline"
                  className="flex-1"
                  onClick={() => onRequestCancel(appointment)}
                >
                  Cancelar agendamento
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
