"use client";

import { dayjs } from "@/lib/dayjs";
import type { AppointmentWithPatient } from "@/services/appointment";
import { Button } from "@ventre/ui/button";
import { Checkbox } from "@ventre/ui/checkbox";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { useEffect, useState } from "react";

const typeLabels: Record<string, string> = {
  consulta: "Consulta",
  encontro: "Encontro",
};

type CancelDayAppointmentsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  appointments: AppointmentWithPatient[];
  onCancelDay: (date: string, appointmentIds?: string[]) => Promise<void>;
};

export function CancelDayAppointmentsModal({
  open,
  onOpenChange,
  date,
  appointments,
  onCancelDay,
}: CancelDayAppointmentsModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setSelectedIds(appointments.map((a) => a.id));
    }
  }, [open, appointments]);

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Cancelar agendamentos do dia"
      description={`Selecione quais agendamentos de ${dayjs(date).format("DD [de] MMMM")} deseja cancelar.`}
    >
      <div className="space-y-4">
        {appointments.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Não há agendamentos ativos para este dia.
          </p>
        ) : (
          <div className="space-y-3">
            {appointments.map((appointment) => {
              const isChecked = selectedIds.includes(appointment.id);
              const start = dayjs(`${appointment.date} ${appointment.time}`);
              const duration = appointment.duration ?? 60;
              const endTime = start.add(duration, "minute").format("HH:mm");
              return (
                <div
                  key={appointment.id}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2"
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(value) => {
                      const checked = Boolean(value);
                      setSelectedIds((prev) => {
                        if (checked) {
                          return prev.includes(appointment.id) ? prev : [...prev, appointment.id];
                        }
                        return prev.filter((id) => id !== appointment.id);
                      });
                    }}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {start.format("HH:mm")} - {endTime} •{" "}
                      {appointment.patient?.name ?? "Paciente sem nome"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {appointment.location ? `${appointment.location} • ` : ""}
                      {typeLabels[appointment.type] || appointment.type}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            disabled={selectedIds.length === 0}
            onClick={async () => {
              await onCancelDay(date, selectedIds);
              onOpenChange(false);
            }}
          >
            Cancelar selecionados
          </Button>
        </div>
      </div>
    </ContentModal>
  );
}
