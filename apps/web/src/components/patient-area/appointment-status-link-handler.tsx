"use client";

import { confirmAppointmentAttendanceAction } from "@/actions/confirm-appointment-attendance-action";
import type { AppointmentWithProfessional } from "@/services/patient-self";
import { useAction } from "next-safe-action/hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Handles the WhatsApp deep link (/agenda?status=confirmada|cancelada&aid=<appointmentId>):
// confirms immediately, or hands the appointment off to the cancel modal so the patient can
// still fill in a reason. `appointments` is the server-scoped list from getMyPatientAppointments
// (already filtered to the logged-in patient), so membership in it doubles as the ownership check
// for the link — the server actions re-verify ownership independently regardless.
export function AppointmentStatusLinkHandler({
  appointments,
  onRequestCancel,
}: {
  appointments: AppointmentWithProfessional[];
  onRequestCancel: (appointment: AppointmentWithProfessional) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledRef = useRef(false);

  const { execute: executeConfirm } = useAction(confirmAppointmentAttendanceAction, {
    onSuccess: () => toast.success("Presença confirmada!"),
    onError: ({ error }) => toast.error(error.serverError ?? "Erro ao confirmar presença"),
    onSettled: () => router.replace("/agenda"),
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per mount (guarded by handledRef); re-running on router/onRequestCancel identity changes would risk double-firing the link action
  useEffect(() => {
    if (handledRef.current) return;

    const status = searchParams.get("status");
    const appointmentId = searchParams.get("aid");

    if (!status && !appointmentId) return;
    handledRef.current = true;

    if (!status || !appointmentId || !UUID_REGEX.test(appointmentId)) {
      toast.error("Link inválido.");
      router.replace("/agenda");
      return;
    }

    if (status !== "confirmada" && status !== "cancelada") {
      toast.error("Link inválido.");
      router.replace("/agenda");
      return;
    }

    const appointment = appointments.find((a) => a.id === appointmentId);
    if (!appointment) {
      toast.error("Agendamento não encontrado.");
      router.replace("/agenda");
      return;
    }

    if (status === "confirmada") {
      executeConfirm({ appointmentId });
      return;
    }

    onRequestCancel(appointment);
    router.replace("/agenda");
  }, [appointments]);

  return null;
}
