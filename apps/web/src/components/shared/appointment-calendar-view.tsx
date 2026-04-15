"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { dayjs } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { AppointmentDataModal } from "@/modals/appointment-data-modal";
import { CancelDayAppointmentsModal } from "@/modals/cancel-day-appointments-modal";
import type { AppointmentWithPatient } from "@/services/appointment";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import {
  Calendar,
  CalendarPlus,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";

const typeLabels: Record<string, string> = {
  consulta: "Consulta",
  encontro: "Encontro",
};

const weekdayLabels = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

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

type AppointmentCalendarViewProps = {
  appointments: AppointmentWithPatient[];
  showProfessional?: boolean;
  actions?: React.ReactElement;
  onCancelDay?: (date: string, appointmentIds?: string[]) => Promise<void>;
  onAddAppointment?: VoidFunction;
  onUpdateAppointments?: VoidFunction;
};

export function AppointmentCalendarView({
  appointments,
  showProfessional = false,
  actions,
  onCancelDay,
  onAddAppointment,
  onUpdateAppointments,
}: AppointmentCalendarViewProps) {
  const today = dayjs().format("YYYY-MM-DD");
  const [selectedDate, setSelectedDate] = useState(today);
  const [now, setNow] = useState(dayjs());
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithPatient | null>(
    null,
  );

  const confirmedAppointments = useMemo(() => {
    return appointments.filter((appointment) => appointment.status !== "cancelada");
  }, [appointments]);

  useEffect(() => {
    const interval = setInterval(() => setNow(dayjs()), 60000);
    return () => clearInterval(interval);
  }, []);

  const appointmentsByDate = useMemo(
    () => groupAppointmentsByDate(confirmedAppointments),
    [confirmedAppointments],
  );

  const dayAppointments = useMemo(() => {
    const items = appointmentsByDate[selectedDate] || [];
    return [...items].sort((a, b) => a.time.localeCompare(b.time));
  }, [appointmentsByDate, selectedDate]);

  const isToday = selectedDate === today;
  const selectedDayjs = useMemo(() => dayjs(selectedDate), [selectedDate]);
  const weekStartKey = selectedDayjs.startOf("week").format("YYYY-MM-DD");

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = dayjs(weekStartKey).add(index, "day");
        return {
          key: date.format("YYYY-MM-DD"),
          dayNumber: date.format("D"),
          weekdayIndex: date.day(),
        };
      }),
    [weekStartKey],
  );

  const timelineStartHour = 7;
  const timelineEndHour = 20;
  const hourHeight = 72;
  const hours = useMemo(
    () =>
      Array.from({ length: timelineEndHour - timelineStartHour + 1 }, (_, index) => {
        return timelineStartHour + index;
      }),
    [],
  );

  const nowMinutes = now.diff(dayjs().startOf("day"), "minute");
  const timelineStartMinutes = timelineStartHour * 60;
  const timelineEndMinutes = (timelineEndHour + 1) * 60;
  const nowOffset = ((nowMinutes - timelineStartMinutes) / 60) * hourHeight;

  const cancellableAppointments = dayAppointments.filter((a) => a.status === "agendada");

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <div className="flex flex-1 justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-sm">{selectedDayjs.format("YYYY")}</p>
            <h3 className="font-semibold text-lg capitalize">{selectedDayjs.format("MMMM")}</h3>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedDate(selectedDayjs.subtract(7, "day").format("YYYY-MM-DD"))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedDate(selectedDayjs.add(7, "day").format("YYYY-MM-DD"))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {actions}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const isSelected = day.key === selectedDate;
          const hasAppointments = Boolean(appointmentsByDate[day.key]?.length);
          return (
            <button
              key={day.key}
              type="button"
              onClick={() => setSelectedDate(day.key)}
              className={cn(
                "relative flex shrink-0 flex-col items-center gap-1 rounded-full border p-1.5 text-sm transition-colors",
                isSelected ? "gradient-primary border-transparent text-white" : "hover:bg-muted",
              )}
            >
              <span
                className={cn(
                  "font-medium text-[11px] text-primary capitalize",
                  isSelected && "text-white",
                )}
              >
                {weekdayLabels[day.weekdayIndex]}
              </span>
              <span
                className={cn(
                  "flex h-[32px] w-[32px] items-center justify-center rounded-full font-bold",
                  isSelected && "bg-white text-accent-foreground",
                )}
              >
                {day.dayNumber}
              </span>
              {hasAppointments && (
                <span className={cn("absolute bottom-2 h-1.5 w-1.5 rounded-full", "bg-primary")} />
              )}
            </button>
          );
        })}
      </div>

      {/* Date header */}
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          {isToday && <span className="font-medium text-primary text-sm">Hoje</span>}
          <h3 className="font-medium text-muted-foreground text-sm capitalize">
            {selectedDayjs.format("dddd, DD [de] MMMM")}
          </h3>
        </div>
        {onCancelDay && cancellableAppointments.length > 0 && (
          <Button
            variant="destructive-outline"
            size="sm"
            className="shrink-0"
            onClick={() => setIsCancelModalOpen(true)}
          >
            <CalendarX2 className="h-3.5 w-3.5" />
            Cancelar dia
          </Button>
        )}
      </div>

      {dayAppointments.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Sua agenda está livre neste dia"
          description="Adicione seus compromissos no botão abaixo."
        >
          <Button onClick={onAddAppointment}>
            <CalendarPlus />
            <span className="ml-1">Adicionar Agendamento</span>
          </Button>
        </EmptyState>
      ) : (
        <div className="rounded-xl border bg-background">
          <div className="grid grid-cols-[48px_1fr]">
            <div className="border-r">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="flex items-start justify-end pr-2 text-[10px] text-muted-foreground"
                  style={{ height: hourHeight }}
                >
                  <span className="mt-2">{`${String(hour).padStart(2, "0")}:00`}</span>
                </div>
              ))}
            </div>
            <div className="relative">
              {hours.map((hour, index) => (
                <div
                  key={hour}
                  className={cn("border-muted/40 border-t", index === 0 && "border-t-0")}
                  style={{ height: hourHeight }}
                />
              ))}

              {isToday &&
                nowMinutes >= timelineStartMinutes &&
                nowMinutes <= timelineEndMinutes && (
                  <div
                    className="pointer-events-none absolute right-0 left-0"
                    style={{ top: nowOffset }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="-ml-12 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">
                        {now.format("HH:mm")}
                      </span>
                      <span className="h-[2px] flex-1 bg-primary" />
                    </div>
                  </div>
                )}

              {dayAppointments.map((appointment) => {
                const start = dayjs(`${appointment.date} ${appointment.time}`);
                const duration = appointment.duration ?? 60;
                const startMinutes = start.diff(start.startOf("day"), "minute");
                const minutesFromStart = Math.max(startMinutes - timelineStartMinutes, 0);
                const top = (minutesFromStart / 60) * hourHeight;
                const height = Math.max((duration / 60) * hourHeight, 44);
                const endTime = start.add(duration, "minute").format("HH:mm");
                const typeLabel = typeLabels[appointment.type] || appointment.type;
                const locationLabel = appointment.location?.trim();

                return (
                  <div
                    key={appointment.id}
                    className="absolute right-2 left-2"
                    style={{ top: top + 2, height: height - 2 }}
                  >
                    <button
                      type="button"
                      className="block h-full w-full text-left"
                      onClick={() => setSelectedAppointment(appointment)}
                    >
                      <Card className="h-full rounded-lg border-primary/20 bg-primary/5 shadow-none hover:bg-primary/10">
                        <CardContent className="flex h-full flex-col justify-center p-3">
                          <p className="font-medium text-sm">
                            {start.format("HH:mm")} - {endTime} •{" "}
                            {appointment.patient?.name ?? "Paciente sem nome"}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {locationLabel ? `${locationLabel} • ` : ""}
                            {typeLabel}
                          </p>
                          {showProfessional && appointment.professional?.name && (
                            <div className="mt-1 flex items-center gap-1 text-muted-foreground text-xs">
                              <Stethoscope className="h-3 w-3" />
                              <span>{appointment.professional.name}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {onCancelDay && (
        <CancelDayAppointmentsModal
          open={isCancelModalOpen}
          onOpenChange={setIsCancelModalOpen}
          date={selectedDate}
          appointments={cancellableAppointments}
          onCancelDay={onCancelDay}
        />
      )}

      <AppointmentDataModal
        appointment={selectedAppointment}
        open={selectedAppointment !== null}
        onOpenChange={(open) => !open && setSelectedAppointment(null)}
        onCancel={onUpdateAppointments}
        onSuccess={() => {
          setSelectedAppointment(null);
          onUpdateAppointments?.();
        }}
      />
    </div>
  );
}
