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
import type { ExternalPatientValues } from "@/modals/appointment-data-modal";
import NewAppointmentModal from "@/modals/new-appointment-modal";
import NewPatientModal from "@/modals/new-patient-modal";
import type { AppointmentWithPatient } from "@/services/appointment";
import type { EnterpriseProfessional } from "@/services/professional";
import type { Tables } from "@ventre/supabase";
import { Button } from "@ventre/ui/button";
import { CalendarPlus, CalendarSync, Plus } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AppointmentsScreenProps = {
  appointments: AppointmentWithPatient[];
  isStaff?: boolean;
  isGoogleCalendarConnected?: boolean;
};

type AgendaView = "list" | "calendar";

type Patient = Tables<"patients">;

export default function AppointmentsScreen({
  appointments: initialAppointments,
  isStaff = false,
  isGoogleCalendarConnected = true,
}: AppointmentsScreenProps) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [externalPatientInitialValues, setExternalPatientInitialValues] =
    useState<ExternalPatientValues | null>(null);

  function handleRegisterExternalPatient(data: ExternalPatientValues) {
    setExternalPatientInitialValues(data);
    setShowNewPatientModal(true);
  }
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
    if (isStaff) fetchProfessionals({});
  }, [fetchPatients, fetchProfessionals, isStaff]);

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
      {!isGoogleCalendarConnected && (
        <div className="mx-4 mb-2 flex flex-col justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800 text-sm md:mx-6 md:flex-row dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
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
            onUpdateAppointments={() =>
              fetchAppointments({ professionalId: professionalFilter ?? undefined })
            }
            onRegisterExternalPatient={handleRegisterExternalPatient}
          />
        ) : (
          <AppointmentListView
            appointments={appointments}
            showProfessional={isStaff}
            actions={appointmentActions}
            onCancelDay={handleCancelDay}
            onAddAppointment={() => setShowNewModal(true)}
            onUpdateAppointments={() =>
              fetchAppointments({ professionalId: professionalFilter ?? undefined })
            }
            onRegisterExternalPatient={handleRegisterExternalPatient}
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
      <NewPatientModal
        showModal={showNewPatientModal}
        setShowModal={(open) => {
          setShowNewPatientModal(open);
          if (!open) setExternalPatientInitialValues(null);
        }}
        professionals={professionals}
        initialValues={{
          name: externalPatientInitialValues?.name ?? undefined,
          email: externalPatientInitialValues?.email ?? undefined,
          phone: externalPatientInitialValues?.phone ?? undefined,
        }}
        onSuccess={() => fetchAppointments({ professionalId: professionalFilter ?? undefined })}
      />
    </div>
  );
}
