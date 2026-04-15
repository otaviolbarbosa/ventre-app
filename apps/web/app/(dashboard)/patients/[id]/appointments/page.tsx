"use client";
import { cancelDayAppointmentsAction } from "@/actions/cancel-day-appointments-action";
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
import { CalendarPlus } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
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

  useEffect(() => {
    fetchAppointments({ patientId });
    fetchPatients();
  }, [fetchAppointments, fetchPatients, patientId]);

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
