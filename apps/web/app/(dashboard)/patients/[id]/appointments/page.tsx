"use client";
import { cancelDayAppointmentsAction } from "@/actions/cancel-day-appointments-action";
import { getGoogleCalendarStatusAction } from "@/actions/disconnect-google-calendar-action";
import { getAppointmentsAction } from "@/actions/get-appointments-action";
import { getPatientsAction } from "@/actions/get-patients-action";
import { AppointmentCalendarView } from "@/components/shared/appointment-calendar-view";
import { AppointmentListView } from "@/components/shared/appointment-list-view";
import { CalendarSwitcher } from "@/components/shared/calendar-switcher";
import { LoadingPatientAppointment } from "@/components/shared/loading-state";
import NewAppointmentModal from "@/modals/new-appointment-modal";
import type { AppointmentWithPatient } from "@/services/appointment";
import type { Tables } from "@ventre/supabase/types";
import { Button } from "@ventre/ui/button";
import { CalendarPlus, CalendarSync } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type AgendaView = "list" | "calendar";
type Patient = Tables<"patients">;

export default function PatientAppointmentsPage() {
  const params = useParams();
  const patientId = params.id as string;

  const [showNewModal, setShowNewModal] = useState(false);
  const [agendaView, setAgendaView] = useState<AgendaView>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("agenda-view");
      if (stored === "list" || stored === "calendar") return stored;
    }
    return "calendar";
  });

  const {
    execute: fetchAppointments,
    result: appointmentsResult,
    isPending,
  } = useAction(getAppointmentsAction);
  const { execute: fetchPatients, result: patientsResult } = useAction(getPatientsAction);
  const { executeAsync: cancelDay } = useAction(cancelDayAppointmentsAction);
  const { execute: checkCalendarStatus, result: calendarStatusResult } = useAction(
    getGoogleCalendarStatusAction,
  );

  useEffect(() => {
    fetchAppointments({ patientId });
    fetchPatients();
    checkCalendarStatus();
  }, [fetchAppointments, fetchPatients, checkCalendarStatus, patientId]);

  const isGoogleCalendarConnected = calendarStatusResult.data?.connected ?? true;

  const appointments = (appointmentsResult.data?.appointments ?? []) as AppointmentWithPatient[];
  const patients = (patientsResult.data?.patients ?? []) as Patient[];

  function handleSetAgendaView(view: AgendaView) {
    setAgendaView(view);
    localStorage.setItem("agenda-view", view);
  }

  async function handleCancelDay(date: string, appointmentIds?: string[]) {
    await cancelDay({ date, appointmentIds });
    fetchAppointments({ patientId });
  }

  if (isPending && appointments.length === 0) {
    return <LoadingPatientAppointment />;
  }

  const actions = (
    <div className="flex items-center gap-2">
      <CalendarSwitcher value={agendaView} onChange={handleSetAgendaView} />
      <Button
        size="icon"
        className="gradient-primary flex md:hidden"
        onClick={() => setShowNewModal(true)}
      >
        <CalendarPlus className="h-4 w-4" />
      </Button>
      <Button className="gradient-primary hidden md:flex" onClick={() => setShowNewModal(true)}>
        <CalendarPlus className="h-4 w-4" />
        <span className="ml-2">Novo Agendamento</span>
      </Button>
    </div>
  );

  return (
    <>
      {!isGoogleCalendarConnected && (
        <div className="mb-4 flex flex-col justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800 text-sm md:flex-row dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
          <div className="flex items-center gap-2">
            <CalendarSync className="h-4 w-4 shrink-0" />
            <span>Sincronize seus agendamentos com a sua agenda do Google. </span>
          </div>
          <Link
            href="/profile/settings"
            className="font-medium underline underline-offset-2 hover:no-underline"
          >
            Clique aqui para sincronizar
          </Link>
        </div>
      )}
      {agendaView === "calendar" ? (
        <AppointmentCalendarView
          appointments={appointments}
          showProfessional
          actions={actions}
          onCancelDay={handleCancelDay}
          onAddAppointment={() => setShowNewModal(true)}
          onUpdateAppointments={() => fetchAppointments({ patientId })}
        />
      ) : (
        <AppointmentListView
          appointments={appointments}
          showProfessional
          actions={actions}
          onCancelDay={handleCancelDay}
          onAddAppointment={() => setShowNewModal(true)}
          onUpdateAppointments={() => fetchAppointments({ patientId })}
        />
      )}

      <NewAppointmentModal
        showModal={showNewModal}
        setShowModal={setShowNewModal}
        patientId={patientId}
        patients={patients}
        appointments={appointments}
        onSuccess={() => fetchAppointments({ patientId })}
      />
    </>
  );
}
