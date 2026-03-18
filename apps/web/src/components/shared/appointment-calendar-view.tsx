"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { dayjs } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import type { AppointmentWithPatient } from "@/services/appointment";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Stethoscope, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

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

// const typeLabels: Record<string, string> = {
//   consulta: "Consulta",
//   encontro: "Encontro",
// };

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
  startDate: string;
  endDate: string;
  appointments: AppointmentWithPatient[];
  showProfessional?: boolean;
  onCancelDay?: (date: string) => Promise<void>;
};

export function AppointmentCalendarView({
  startDate,
  endDate,
  appointments,
  showProfessional = false,
  onCancelDay,
}: AppointmentCalendarViewProps) {
  const today = dayjs().format("YYYY-MM-DD");
  const [selectedDate, setSelectedDate] = useState(today);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => {
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    const result = [];
    let current = start;
    while (current.isBefore(end) || current.isSame(end, "day")) {
      result.push({
        key: current.format("YYYY-MM-DD"),
        dayOfWeek: current.format("ddd"),
        dayNumber: current.format("D"),
        month: current.format("MMM").toUpperCase(),
      });
      current = current.add(1, "day");
    }
    return result;
  }, [startDate, endDate]);

  const appointmentsByDate = useMemo(() => groupAppointmentsByDate(appointments), [appointments]);

  const dayAppointments = useMemo(() => {
    const items = appointmentsByDate[selectedDate] || [];
    return items.sort((a, b) => a.time.localeCompare(b.time));
  }, [appointmentsByDate, selectedDate]);

  const isToday = selectedDate === today;
  const selectedDayjs = dayjs(selectedDate);

  async function handleCancelDay() {
    if (!onCancelDay) return;
    setIsCancelling(true);
    await onCancelDay(selectedDate);
    setIsCancelling(false);
    setShowCancelConfirm(false);
  }

  function scrollStrip(direction: "left" | "right") {
    if (!stripRef.current) return;
    const scrollAmount = direction === "left" ? -200 : 200;
    stripRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
  }

  return (
    <div className="space-y-4">
      {/* Date strip */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="hidden shrink-0 sm:flex"
          onClick={() => scrollStrip("left")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div ref={stripRef} className="no-scrollbar scrollbar-hide flex gap-2 overflow-x-auto">
          {days.map((day) => {
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
                  {day.month}
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
                  <span
                    className={cn("absolute bottom-2 h-1.5 w-1.5 rounded-full", "bg-primary")}
                  />
                )}
              </button>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="hidden shrink-0 sm:flex"
          onClick={() => scrollStrip("right")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Date header */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          {isToday && <span className="font-medium text-primary text-sm">Hoje</span>}
          <h3 className="font-medium text-muted-foreground text-sm capitalize">
            {selectedDayjs.format("dddd, DD [de] MMMM [de] YYYY")}
          </h3>
        </div>
        {onCancelDay && dayAppointments.some((a) => a.status === "agendada") && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-destructive hover:text-destructive"
            onClick={() => setShowCancelConfirm(true)}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Cancelar dia
          </Button>
        )}
      </div>

      {/* Timeline */}
      {dayAppointments.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Nenhum agendamento"
          description="Não há agendamentos para este dia."
        />
      ) : (
        <div className="relative space-y-2">
          {/* <span className="absolute left-[5px] mt-[43px] h-[calc(100%-86px)] border-primary border-l-2" /> */}
          {dayAppointments.map((appointment) => (
            <div key={appointment.id} className="relative">
              {/* <span className="-left-6 absolute top-[37px] size-3 rounded-full border-2 border-primary bg-primary" /> */}

              <Link href={`/patients/${appointment.patient_id}/appointments`} className="block">
                <Card className="shadow transition-colors hover:bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{appointment.patient.name}</span>
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
              </Link>
            </div>
          ))}
        </div>
      )}
      <ConfirmModal
        open={showCancelConfirm}
        onOpenChange={setShowCancelConfirm}
        title="Cancelar todos os agendamentos do dia"
        description={`Tem certeza que deseja cancelar todos os agendamentos de ${selectedDayjs.format("DD [de] MMMM")}? Esta ação não pode ser desfeita.`}
        confirmLabel="Cancelar agendamentos"
        variant="destructive"
        loading={isCancelling}
        onConfirm={handleCancelDay}
      />
    </div>
  );
}
