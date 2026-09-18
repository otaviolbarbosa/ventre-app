"use client";

import AppointmentList from "@/components/patient-area/appointment-list";
import { AppointmentStatusLinkHandler } from "@/components/patient-area/appointment-status-link-handler";
import { CancelAppointmentModal } from "@/modals/cancel-appointment-modal";
import { ConfirmAppointmentModal } from "@/modals/confirm-appointment-modal";
import type { AppointmentWithProfessional } from "@/services/patient-self";
import { Suspense, useState } from "react";

export function PatientAgendaClient({
  appointments,
}: {
  appointments: AppointmentWithProfessional[];
}) {
  const [confirmingAppointment, setConfirmingAppointment] =
    useState<AppointmentWithProfessional | null>(null);
  const [cancelingAppointment, setCancelingAppointment] =
    useState<AppointmentWithProfessional | null>(null);

  return (
    <>
      {/* useSearchParams inside requires a Suspense boundary; it renders nothing visual */}
      <Suspense fallback={null}>
        <AppointmentStatusLinkHandler
          appointments={appointments}
          onRequestCancel={setCancelingAppointment}
        />
      </Suspense>
      <AppointmentList
        appointments={appointments}
        onRequestConfirm={setConfirmingAppointment}
        onRequestCancel={setCancelingAppointment}
      />
      <ConfirmAppointmentModal
        appointment={confirmingAppointment}
        open={!!confirmingAppointment}
        onOpenChange={(open) => !open && setConfirmingAppointment(null)}
      />
      <CancelAppointmentModal
        appointment={cancelingAppointment}
        open={!!cancelingAppointment}
        onOpenChange={(open) => !open && setCancelingAppointment(null)}
      />
    </>
  );
}
