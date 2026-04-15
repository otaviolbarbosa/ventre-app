"use client";
import { EmptyState } from "@/components/shared/empty-state";
import { dayjs } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { AppointmentDataModal } from "@/modals/appointment-data-modal";
import { CancelDayAppointmentsModal } from "@/modals/cancel-day-appointments-modal";
import type { AppointmentWithPatient } from "@/services/appointment";
import { Badge } from "@ventre/ui/badge";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import {
  Calendar,
  CalendarPlus,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Stethoscope,
} from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";

const statusLabels: Record<string, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

const statusColors: Record<string, string> = {
  agendada: "bg-muted text-muted-foreground",
  realizada: "bg-green-100 text-green-800",
  cancelada: "bg-red-100 text-red-800",
};

const typeLabels: Record<string, string> = {
  consulta: "Consulta",
  encontro: "Encontro",
};

const weekdayLabels = [
  { key: "sun", label: "D" },
  { key: "mon", label: "S" },
  { key: "tue", label: "T" },
  { key: "wed", label: "Q" },
  { key: "thu", label: "Q" },
  { key: "fri", label: "S" },
  { key: "sat", label: "S" },
];

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

type AppointmentGroupProps = {
  appointments: AppointmentWithPatient[];
  isPastList?: boolean;
  showProfessional?: boolean;
  onCancelDay?: (date: string, appointmentIds?: string[]) => Promise<void>;
  onAddAppointment?: VoidFunction;
  onUpdateAppointments?: VoidFunction;
};

function AppointmentGroup({
  appointments,
  isPastList = false,
  showProfessional = false,
  onCancelDay,
  onAddAppointment,
  onUpdateAppointments,
}: AppointmentGroupProps) {
  const groupedAppointments = groupAppointmentsByDate(appointments);
  const sortedDates = Object.keys(groupedAppointments).sort((a, b) =>
    isPastList ? b.localeCompare(a) : a.localeCompare(b),
  );
  const [cancelDate, setCancelDate] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithPatient | null>(
    null,
  );

  if (appointments.length === 0) {
    return (
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
    );
  }

  const cancellableByDate = (dateKey: string) =>
    (groupedAppointments[dateKey] || []).filter((a) => a.status === "agendada");

  return (
    <div className="space-y-6">
      {sortedDates.map((dateKey) => {
        const dateAppointments = groupedAppointments[dateKey] || [];
        const isToday = dayjs(dateKey).isSame(dayjs(), "day");
        const hasCancellable = onCancelDay && cancellableByDate(dateKey).length > 0;

        return (
          <div key={dateKey} className="space-y-3">
            {/* Date header */}
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                {isToday && <span className="font-medium text-primary text-sm">Hoje</span>}
                <h3 className="font-medium text-muted-foreground text-sm capitalize">
                  {dayjs(dateKey).format("dddd, DD [de] MMMM")}
                </h3>
              </div>

              {hasCancellable && (
                <Button
                  variant="destructive-outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setCancelDate(dateKey)}
                >
                  <CalendarX2 className="mr-1 h-3.5 w-3.5" />
                  Cancelar dia
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {dateAppointments.map((appointment) => (
                <button
                  key={appointment.id}
                  type="button"
                  className="block w-full text-left"
                  onClick={() => setSelectedAppointment(appointment)}
                >
                  <Card
                    className={`transition-colors hover:bg-muted/50 ${isPastList ? "opacity-60" : ""}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-start gap-2">
                            <span className="font-medium">{appointment.patient.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {typeLabels[appointment.type] || appointment.type}
                            </Badge>
                          </div>
                          {showProfessional && appointment.professional?.name && (
                            <div className="flex items-center gap-1 text-muted-foreground text-xs">
                              <Stethoscope className="h-3 w-3" />
                              <span>{appointment.professional.name}</span>
                            </div>
                          )}
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
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {onCancelDay && cancelDate && (
        <CancelDayAppointmentsModal
          open={cancelDate !== null}
          onOpenChange={(open) => !open && setCancelDate(null)}
          date={cancelDate}
          appointments={cancellableByDate(cancelDate)}
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

type MonthDay = {
  key: string;
  dayNumber: string;
  isCurrentMonth: boolean;
  isToday: boolean;
};

function buildMonthDays(month: string) {
  const monthStart = dayjs(month).startOf("month");
  const monthEnd = dayjs(month).endOf("month");
  const gridStart = monthStart.startOf("week");
  const gridEnd = monthEnd.endOf("week");
  const days: MonthDay[] = [];
  let current = gridStart;

  while (current.isBefore(gridEnd) || current.isSame(gridEnd, "day")) {
    days.push({
      key: current.format("YYYY-MM-DD"),
      dayNumber: current.format("D"),
      isCurrentMonth: current.isSame(monthStart, "month"),
      isToday: current.isSame(dayjs(), "day"),
    });
    current = current.add(1, "day");
  }

  return days;
}

type AppointmentListViewProps = {
  appointments: AppointmentWithPatient[];
  showProfessional?: boolean;
  actions?: React.ReactElement;
  onCancelDay?: (date: string, appointmentIds?: string[]) => Promise<void>;
  onAddAppointment: VoidFunction;
  onUpdateAppointments?: VoidFunction;
};

export function AppointmentListView({
  appointments,
  showProfessional = false,
  actions,
  onCancelDay,
  onAddAppointment,
  onUpdateAppointments,
}: AppointmentListViewProps) {
  const now = dayjs();
  const today = now.format("YYYY-MM-DD");
  const [visibleMonth, setVisibleMonth] = useState(now.startOf("month").format("YYYY-MM-DD"));
  const [selectedDate, setSelectedDate] = useState(today);

  const monthDays = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth]);
  const appointmentsByDate = useMemo(() => groupAppointmentsByDate(appointments), [appointments]);
  const selectedDayAppointments = useMemo(() => {
    const items = appointmentsByDate[selectedDate] || [];
    return [...items].sort((a, b) => a.time.localeCompare(b.time));
  }, [appointmentsByDate, selectedDate]);

  function changeMonth(direction: "previous" | "next") {
    const nextMonth =
      direction === "previous"
        ? dayjs(visibleMonth).subtract(1, "month")
        : dayjs(visibleMonth).add(1, "month");
    const nextSelectedDate = nextMonth.isSame(dayjs(), "month")
      ? today
      : nextMonth.startOf("month").format("YYYY-MM-DD");

    setVisibleMonth(nextMonth.startOf("month").format("YYYY-MM-DD"));
    setSelectedDate(nextSelectedDate);
  }

  return (
    <div>
      {" "}
      <div className="flex items-center">
        <div className="flex flex-1 justify-between gap-3">
          <div>
            <p className="font-medium text-muted-foreground text-sm">
              {dayjs(visibleMonth).format("YYYY")}
            </p>
            <h2 className="font-semibold text-xl capitalize">
              {dayjs(visibleMonth).format("MMMM")}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => changeMonth("previous")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => changeMonth("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {actions}
      </div>
      <div className="mt-3 space-y-3 md:grid md:grid-cols-[320px_1fr] md:gap-6">
        {/* Left: month calendar */}
        <div className="space-y-4">
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdayLabels.map((weekday) => (
              <div key={weekday.key} className="py-2 font-semibold text-sm">
                {weekday.label}
              </div>
            ))}
            {monthDays.map((day) => {
              const isSelected = day.key === selectedDate;
              const hasAppointments = Boolean(appointmentsByDate[day.key]?.length);
              return (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => setSelectedDate(day.key)}
                  className={cn(
                    "relative flex min-h-8 items-center justify-center rounded-lg border border-transparent font-medium text-sm transition-colors sm:aspect-square sm:min-h-11",
                    day.isCurrentMonth ? "text-foreground" : "text-muted-foreground/60",
                    isSelected && "border-primary bg-primary/5 text-primary",
                    !isSelected && "hover:bg-muted",
                  )}
                >
                  <span>{day.dayNumber}</span>
                  {hasAppointments && (
                    <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />
                  )}
                  {day.isToday && !isSelected && (
                    <span className="absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-primary/60" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: selected day appointments */}
        <div className="space-y-3">
          <div className="-mx-4 bg-muted/40 px-4 py-4 sm:mx-0 sm:rounded-lg">
            <AppointmentGroup
              appointments={selectedDayAppointments}
              showProfessional={showProfessional}
              onCancelDay={onCancelDay}
              onAddAppointment={onAddAppointment}
              onUpdateAppointments={onUpdateAppointments}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
