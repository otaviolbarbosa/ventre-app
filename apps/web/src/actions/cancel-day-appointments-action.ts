"use server";

import { isStaff } from "@/lib/access-control";
import { insertActivityLog } from "@/lib/activity-log";
import { sendWhatsAppToUser } from "@/lib/notifications/whatsapp-send";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { syncDeleteToGoogleCalendar } from "@/services/google-calendar";
import { z } from "zod";

export const cancelDayAppointmentsAction = authActionClient
  .inputSchema(
    z.object({
      date: z.string(),
      appointmentIds: z.array(z.string().uuid()).optional(),
    }),
  )
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    // Fetch appointments with google_event_id before cancelling so we can delete GCal events
    let fetchQuery = supabase
      .from("appointments")
      .select("id, google_event_id, patient_id, patient:patients(id, name)")
      .eq("status", "agendada")
      .eq("date", parsedInput.date);

    if (!isStaff(profile)) {
      fetchQuery = fetchQuery.eq("professional_id", user.id);
    }

    if (parsedInput.appointmentIds && parsedInput.appointmentIds.length > 0) {
      fetchQuery = fetchQuery.in("id", parsedInput.appointmentIds);
    }

    const { data: appointmentsToCancel } = await fetchQuery;

    let query = supabase
      .from("appointments")
      .update({ status: "cancelada" })
      .eq("status", "agendada")
      .eq("date", parsedInput.date);

    if (!isStaff(profile)) {
      query = query.eq("professional_id", user.id);
    }

    if (parsedInput.appointmentIds && parsedInput.appointmentIds.length > 0) {
      query = query.in("id", parsedInput.appointmentIds);
    }

    const { error } = await query;

    if (error) throw new Error(error.message);

    // Fire-and-forget GCal deletes for appointments that had calendar events
    for (const appt of appointmentsToCancel ?? []) {
      if (appt.google_event_id) {
        syncDeleteToGoogleCalendar(appt.google_event_id, user.id).catch((err) => {
          console.error("[google-calendar] delete sync failed", err);
        });
      }
    }

    // Dedupe by patient: several cancelled appointments for the same patient on the
    // same day would otherwise trigger byte-identical WhatsApp messages. Keeps the first
    // appointment id encountered per patient as the notification_log reference — with
    // several appointments cancelled for the same patient/day there's no single "correct"
    // appointment to attribute the message to, so this is a best-effort choice.
    const patientsToNotify = new Map<string, { patientName: string; appointmentId: string }>();
    for (const appt of appointmentsToCancel ?? []) {
      const patient = appt.patient as { id: string; name: string } | null;
      if (patient && !patientsToNotify.has(patient.id)) {
        patientsToNotify.set(patient.id, { patientName: patient.name, appointmentId: appt.id });
      }
    }

    for (const [patientId, { patientName, appointmentId }] of patientsToNotify) {
      sendWhatsAppToUser(
        { recipientType: "patient", recipientId: patientId },
        "appointment_cancelled",
        { patientName, date: parsedInput.date },
        { referenceType: "appointment", referenceId: appointmentId },
      ).catch((err) => {
        console.error("[whatsapp] cancel-day-appointments send failed", err);
      });
    }

    if (profile.enterprise_id) {
      insertActivityLog({
        supabaseAdmin,
        actionName: "Agendamentos do dia cancelados",
        description: `Agendamentos do dia ${parsedInput.date} cancelados`,
        actionType: "appointment",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        metadata: { date: parsedInput.date },
      });
    }

    await captureServerEvent(user.id, "cancel_day_appointments", { date: parsedInput.date });
  });
