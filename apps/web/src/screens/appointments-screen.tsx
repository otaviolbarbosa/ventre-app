"use client";

import { cancelDayAppointmentsAction } from "@/actions/cancel-day-appointments-action";
import { getAppointmentsAction } from "@/actions/get-appointments-action";
import { getEnterpriseProfessionalsAction } from "@/actions/get-enterprise-professionals-action";
import { getPatientsAction } from "@/actions/get-patients-action";
import { Header } from "@/components/layouts/header";
import { AppointmentCalendarView } from "@/components/shared/appointment-calendar-view";
import { AppointmentListView } from "@/components/shared/appointment-list-view";
import { CalendarSwitcher } from "@/components/shared/calendar-switcher";
import { ProfessionalsSelector } from "@/components/shared/professionals-selector";
import NewAppointmentModal from "@/modals/new-appointment-modal";
import type { AppointmentWithPatient } from "@/services/appointment";
import type { EnterpriseProfessional } from "@/services/professional";
import type { Tables } from "@ventre/supabase";
import { Button } from "@ventre/ui/button";
import { CalendarPlus, Plus } from "lucide-react";
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

  const isCalendarView = useMemo(() => agendaView === "calendar", [agendaView]);

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

  async function handleCancelDay(date: string, appointmentIds?: string[]) {
    await cancelDay({ date, appointmentIds });
    fetchAppointments({ professionalId: professionalFilter ?? undefined });
  }

  function handleOpenNewModal() {
    setShowNewModal(true);
  }

  const appointmentActions = (
    <div className="flex items-center justify-end gap-2">
      <CalendarSwitcher value={agendaView} onChange={handleSetAgendaView} />

      <Button className="gradient-primary hidden md:flex" onClick={handleOpenNewModal}>
        <CalendarPlus />
        <span className="ml-1">Adicionar Agendamento</span>
      </Button>
      <Button size="icon" className="gradient-primary flex md:hidden" onClick={handleOpenNewModal}>
        <Plus />
      </Button>
    </div>
  );

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

        {isCalendarView ? (
          <AppointmentCalendarView
            appointments={appointments}
            showProfessional={isStaff}
            actions={appointmentActions}
            onCancelDay={handleCancelDay}
            onAddAppointment={() => setShowNewModal(true)}
          />
        ) : (
          <AppointmentListView
            appointments={appointments}
            showProfessional={isStaff}
            actions={appointmentActions}
            onCancelDay={handleCancelDay}
            onAddAppointment={() => setShowNewModal(true)}
          />
        )}
      </div>
      <NewAppointmentModal
        showModal={showNewModal}
        setShowModal={setShowNewModal}
        patients={patients}
        professionals={professionals}
        appointments={appointments}
        isStaff={isStaff}
        onSuccess={() => fetchAppointments({ professionalId: professionalFilter ?? undefined })}
      />
    </div>
  );
}
