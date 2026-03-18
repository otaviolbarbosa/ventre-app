"use client";

import { cancelDayAppointmentsAction } from "@/actions/cancel-day-appointments-action";
import { getAppointmentsAction } from "@/actions/get-appointments-action";
import { getEnterpriseProfessionalsAction } from "@/actions/get-enterprise-professionals-action";
import { getPatientsAction } from "@/actions/get-patients-action";
import { Header } from "@/components/layouts/header";
import { AppointmentCalendarView } from "@/components/shared/appointment-calendar-view";
import { AppointmentListView } from "@/components/shared/appointment-list-view";
import { ProfessionalsSelector } from "@/components/shared/professionals-selector";
import { Button } from "@/components/ui/button";
import { dayjs } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import NewAppointmentModal from "@/modals/new-appointment-modal";
import type { AppointmentWithPatient } from "@/services/appointment";
import type { EnterpriseProfessional } from "@/services/professional";
import type { Tables } from "@nascere/supabase";
import { Calendar, ListIcon, Plus } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useMemo, useState } from "react";

type AppointmentsScreenProps = {
  appointments: AppointmentWithPatient[];
  isStaff?: boolean;
};

type AgendaView = "list" | "calendar";

type Patient = Tables<"patients">;

export default function AppointmentsScreen({
  appointments: initialAppointments,
  isStaff = false,
}: AppointmentsScreenProps) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [professionalFilter, setProfessionalFilter] = useState<string | null>(null);
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

  const isListView = useMemo(() => agendaView === "list", [agendaView]);
  const isCalendarView = useMemo(() => agendaView === "calendar", [agendaView]);

  const calendarStartDate = dayjs().format("YYYY-MM-DD");
  const calendarEndDate = dayjs().add(14, "day").format("YYYY-MM-DD");

  const { execute: fetchPatients, result: patientsResult } = useAction(getPatientsAction);
  const { execute: fetchAppointments, result: appointmentsResult } =
    useAction(getAppointmentsAction);
  const { execute: fetchProfessionals, result: professionalsResult } = useAction(
    getEnterpriseProfessionalsAction,
  );
  const { executeAsync: cancelDay } = useAction(cancelDayAppointmentsAction);

  useEffect(() => {
    fetchPatients();
    fetchAppointments({});
    if (isStaff) fetchProfessionals({});
  }, [fetchPatients, fetchAppointments, fetchProfessionals, isStaff]);

  const patients = (patientsResult.data?.patients ?? []) as Patient[];
  const appointments = (appointmentsResult.data?.appointments ??
    initialAppointments) as AppointmentWithPatient[];
  const professionals = (professionalsResult.data?.professionals ?? []) as EnterpriseProfessional[];

  function handleProfessionalSelect(id: string) {
    const isSame = professionalFilter === id;
    const newFilter = isSame ? null : id;
    setProfessionalFilter(newFilter);
    fetchAppointments({ professionalId: newFilter ?? undefined });
  }

  async function handleCancelDay(date: string) {
    await cancelDay({ date });
    fetchAppointments({ professionalId: professionalFilter ?? undefined });
  }

  function handleOpenNewModal() {
    setShowNewModal(true);
  }

  return (
    <div>
      <Header title="Agenda" />
      <div className="space-y-4 p-4 pt-0 md:p-6 md:pt-0">
        {isStaff && professionals.length > 0 && (
          <ProfessionalsSelector
            professionals={professionals}
            selectedId={professionalFilter}
            onSelect={handleProfessionalSelect}
            getCountLabel={(prof) =>
              prof.patient_count === 1 ? "1 gestante" : `${prof.patient_count} gestantes`
            }
          />
        )}

        <div className="flex items-center justify-end gap-2">
          <div className="flex items-center justify-end">
            <div className="inline-flex gap-1 rounded-full border p-1">
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

          <Button className="gradient-primary hidden md:flex" onClick={handleOpenNewModal}>
            <Plus />
            <span className="ml-2">Adicionar Agendamento</span>
          </Button>
          <Button
            size="icon"
            className="gradient-primary flex md:hidden"
            onClick={handleOpenNewModal}
          >
            <Plus />
          </Button>
        </div>

        {isCalendarView ? (
          <AppointmentCalendarView
            startDate={calendarStartDate}
            endDate={calendarEndDate}
            appointments={appointments}
            showProfessional={isStaff}
            onCancelDay={handleCancelDay}
          />
        ) : (
          <AppointmentListView appointments={appointments} showProfessional={isStaff} />
        )}
      </div>
      <NewAppointmentModal
        showModal={showNewModal}
        setShowModal={setShowNewModal}
        patients={patients}
        professionals={professionals}
        isStaff={isStaff}
        onSuccess={() => fetchAppointments({ professionalId: professionalFilter ?? undefined })}
      />
    </div>
  );
}
