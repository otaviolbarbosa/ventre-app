"use client";

import { Header } from "@/components/layouts/header";
import { AppointmentCalendarView } from "@/components/shared/appointment-calendar-view";
import { AppointmentListView } from "@/components/shared/appointment-list-view";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { dayjs } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import NewAppointmentModal from "@/modals/new-appointment-modal";
import type { AppointmentWithPatient } from "@/services/appointment";
import type { Tables } from "@nascere/supabase";
import { Calendar, ListIcon, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type AppointmentsScreenProps = {
  appointments: AppointmentWithPatient[];
};

type AgendaView = "list" | "calendar";

type Patient = Tables<"patients">;

export default function AppointmentsScreen({
  appointments: initialAppointments,
}: AppointmentsScreenProps) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [_loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [agendaView, setAgendaView] = useState<AgendaView>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("agenda-view");
      if (stored === "list" || stored === "calendar") return stored;
    }
    return "calendar";
  });

  function handleSetAgendaView(view: AgendaView) {
    setAgendaView(view);
    localStorage.setItem("agenda-view", view);
  }
  const [appointments, setAppointments] = useState<AppointmentWithPatient[]>(initialAppointments);

  const isListView = useMemo(() => agendaView === "list", [agendaView]);
  const isCalendarView = useMemo(() => agendaView === "calendar", [agendaView]);

  const calendarStartDate = dayjs().format("YYYY-MM-DD");
  const calendarEndDate = dayjs().add(14, "day").format("YYYY-MM-DD");

  const fetchPatients = useCallback(async () => {
    const response = await fetch("/api/patients");
    const data = await response.json();
    setPatients(data.patients || []);
  }, []);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/appointments");
    const data = await response.json();
    setAppointments(data.appointments || []);
    setLoading(false);
  }, []);

  function handleOpenNewModal() {
    setShowNewModal(true);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchAppointments changes on every render
  useEffect(() => {
    fetchPatients();
  }, []);

  return (
    <div>
      <Header title="Agenda" />
      <div className="p-4 pt-0 md:p-6">
        <div className="flex justify-between">
          <PageHeader description="Seus agendamentos" />
          <Button className="gradient-primary" onClick={handleOpenNewModal}>
            <Plus className="h-4 w-4" />
            <span className="ml-2 hidden sm:block">Adicionar Agendamento</span>
          </Button>
        </div>

        <div className="flex justify-end">
          <div className="mb-2 inline-flex gap-1 rounded-full border p-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "bg-transparent hover:bg-transparent",
                isCalendarView &&
                  "bg-secondary text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground",
              )}
              onClick={(e) => {
                e.preventDefault();
                handleSetAgendaView("calendar");
              }}
            >
              <Calendar />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "bg-transparent hover:bg-transparent",
                isListView &&
                  "bg-secondary text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground",
              )}
              onClick={(e) => {
                e.preventDefault();
                handleSetAgendaView("list");
              }}
            >
              <ListIcon />
            </Button>
          </div>
        </div>

        {isCalendarView ? (
          <AppointmentCalendarView
            startDate={calendarStartDate}
            endDate={calendarEndDate}
            appointments={appointments}
          />
        ) : (
          <AppointmentListView appointments={appointments} />
        )}
      </div>
      <NewAppointmentModal
        showModal={showNewModal}
        setShowModal={setShowNewModal}
        patients={patients}
        callback={fetchAppointments}
      />
    </div>
  );
}
