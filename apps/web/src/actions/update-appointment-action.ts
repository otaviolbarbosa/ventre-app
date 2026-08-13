"use server";

import { insertActivityLog } from "@/lib/activity-log";
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

    const { error } = await supabase.from("appointments").update(fields).eq("id", id);

    if (error) throw new Error(error.message);

    // Fetch updated row for GCal sync and activity log (single query for both)
    const { data: updatedAppointment } = await supabase
      .from("appointments")
      .select("*, patient:patients(name)")
      .eq("id", id)
      .single();

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
