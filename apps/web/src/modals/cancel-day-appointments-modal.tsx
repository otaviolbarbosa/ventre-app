"use client";

import { dayjs } from "@/lib/dayjs";
import type { AppointmentWithPatient } from "@/services/appointment";
import { Button } from "@ventre/ui/button";
import { Checkbox } from "@ventre/ui/checkbox";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { useEffect, useMemo, useState } from "react";

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
  isStaff?: boolean;
};

export function CancelDayAppointmentsModal({
  open,
  onOpenChange,
  date,
  appointments,
  onCancelDay,
  isStaff = false,
}: CancelDayAppointmentsModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedProfessionalIds, setSelectedProfessionalIds] = useState<string[]>([]);

  const professionals = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ id: string; name: string | null }> = [];
    for (const a of appointments) {
      if (a.professional?.id && !seen.has(a.professional.id)) {
        seen.add(a.professional.id);
        result.push({ id: a.professional.id, name: a.professional.name ?? null });
      }
    }
    return result;
  }, [appointments]);

  const showProfessionalSelector = isStaff && professionals.length > 0;

  useEffect(() => {
    if (open) {
      const allProfIds = professionals.map((p) => p.id);
      setSelectedProfessionalIds(allProfIds);
      setSelectedIds(appointments.map((a) => a.id));
    }
  }, [open, appointments, professionals]);

  const visibleAppointments = useMemo(() => {
    if (!showProfessionalSelector) return appointments;
    return appointments.filter(
      (a) => a.professional?.id && selectedProfessionalIds.includes(a.professional.id),
    );
  }, [appointments, showProfessionalSelector, selectedProfessionalIds]);

  function toggleProfessional(profId: string) {
    const profAppointmentIds = appointments
      .filter((a) => a.professional?.id === profId)
      .map((a) => a.id);

    if (selectedProfessionalIds.includes(profId)) {
      setSelectedProfessionalIds((prev) => prev.filter((id) => id !== profId));
      setSelectedIds((prev) => prev.filter((id) => !profAppointmentIds.includes(id)));
    } else {
      setSelectedProfessionalIds((prev) => [...prev, profId]);
      setSelectedIds((prev) => [...prev, ...profAppointmentIds.filter((id) => !prev.includes(id))]);
    }
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Cancelar agendamentos do dia"
      description={`Selecione quais agendamentos de ${dayjs(date).format("DD [de] MMMM")} deseja cancelar.`}
    >
      <div className="space-y-4">
        {showProfessionalSelector && (
          <div className="space-y-2">
            <p className="font-medium text-sm">Profissionais</p>
            <div className="space-y-2">
              {professionals.map((prof) => (
                <div key={prof.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                  <Checkbox
                    checked={selectedProfessionalIds.includes(prof.id)}
                    onCheckedChange={() => toggleProfessional(prof.id)}
                  />
                  <p className="text-sm">{prof.name ?? "Profissional sem nome"}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {appointments.length === 0 ? (
          <p className="text-muted-foreground text-sm">Não há agendamentos ativos para este dia.</p>
        ) : (
          <div className="space-y-2">
            {showProfessionalSelector && visibleAppointments.length > 0 && (
              <p className="font-medium text-sm">Agendamentos</p>
            )}
            {visibleAppointments.length === 0 && showProfessionalSelector ? (
              <p className="text-muted-foreground text-sm">
                Selecione ao menos um profissional para ver os agendamentos.
              </p>
            ) : (
              <div className="space-y-3">
                {visibleAppointments.map((appointment) => {
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
                              return prev.includes(appointment.id)
                                ? prev
                                : [...prev, appointment.id];
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
                          {showProfessionalSelector && appointment.professional?.name
                            ? `${appointment.professional.name} • `
                            : ""}
                          {appointment.location ? `${appointment.location} • ` : ""}
                          {typeLabels[appointment.type] || appointment.type}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
