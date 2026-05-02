"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { updateAppointmentSchema } from "@/lib/validations/appointment";
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

    if (profile.enterprise_id) {
      const { data: appointment } = await supabase
        .from("appointments")
        .select("patient_id, patient:patients(name)")
        .eq("id", id)
        .single();
      const patient = appointment?.patient as { name: string } | null;

      insertActivityLog({
        supabaseAdmin,
        actionName: "Consulta atualizada",
        description: patient ? `Consulta de ${patient.name} atualizada` : "Consulta atualizada",
        actionType: "appointment",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: appointment?.patient_id ?? null,
        metadata: { appointment_id: id },
      });
    }
  });
