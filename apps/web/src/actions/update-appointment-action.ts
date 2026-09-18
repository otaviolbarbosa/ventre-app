"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { enqueueNotification } from "@/lib/notifications/queue";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { updateAppointmentSchema } from "@/lib/validations/appointment";
import { syncUpdateToGoogleCalendar } from "@/services/google-calendar";
import type { Patient } from "@/types";
import { z } from "zod";

export const updateAppointmentAction = authActionClient
  .inputSchema(
    updateAppointmentSchema.extend({
      id: z.string().uuid(),
    }),
  )
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { id, ...fields } = parsedInput;

    // Só dispara appointment_rescheduling quando data/hora de fato mudam — updates de outros
    // campos (status, notas, tipo etc.) não devem gerar aviso de reagendamento ao paciente.
    const { data: previousAppointment } = await supabase
      .from("appointments")
      .select("date, time, patient_id")
      .eq("id", id)
      .single();

    const { error } = await supabase.from("appointments").update(fields).eq("id", id);

    if (error) throw new Error(error.message);

    // Fetch updated row for GCal sync and activity log (single query for both)
    const { data: updatedAppointment } = await supabase
      .from("appointments")
      .select("*, patient:patients(name)")
      .eq("id", id)
      .single();

    if (
      previousAppointment?.patient_id &&
      updatedAppointment &&
      (fields.date !== undefined || fields.time !== undefined) &&
      (updatedAppointment.date !== previousAppointment.date ||
        updatedAppointment.time !== previousAppointment.time)
    ) {
      try {
        await enqueueNotification({
          queueName: "whatsapp_notifications",
          notificationType: "appointment_updated",
          referenceType: "appointment",
          referenceId: id,
          recipientType: "patient",
          recipientId: previousAppointment.patient_id,
        });
      } catch (err) {
        console.error("[appointment-rescheduling] Failed to enqueue whatsapp notification", err);
      }
    }

    if (updatedAppointment) {
      // Fire-and-forget — GCal failure must not break update
      syncUpdateToGoogleCalendar(
        updatedAppointment,
        { name: updatedAppointment.patient?.name } as Patient,
        user.id,
      ).catch((err) => {
        console.error("[google-calendar] update sync failed", err);
      });
    }

    if (profile.enterprise_id && updatedAppointment) {
      const patient = updatedAppointment.patient as { name: string } | null;

      insertActivityLog({
        supabaseAdmin,
        actionName: "Consulta atualizada",
        description: patient ? `Consulta de ${patient.name} atualizada` : "Consulta atualizada",
        actionType: "appointment",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: updatedAppointment.patient_id ?? null,
        metadata: { appointment_id: id },
      });
    }

    await captureServerEvent(user.id, "update_appointment", { appointment_id: id });
  });
