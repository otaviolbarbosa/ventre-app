"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { sendWhatsAppToUser } from "@/lib/notifications/whatsapp-send";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { vaccineRecordSchema } from "@/lib/validations/prenatal";
import { z } from "zod";

const schema = z.object({
  pregnancyId: z.string().uuid(),
  recordId: z.string().uuid().optional(),
  data: vaccineRecordSchema,
});

export const upsertVaccineRecordAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { pregnancyId, recordId, data } = parsedInput;

    if (recordId) {
      const { error } = await supabase
        .from("vaccine_records")
        .update({ ...data })
        .eq("id", recordId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("vaccine_records").insert({
        pregnancy_id: pregnancyId,
        ...data,
      });
      if (error) throw new Error(error.message);
    }

    const { data: pregnancy } = await supabase
      .from("pregnancies")
      .select("patient:patients(id, name)")
      .eq("id", pregnancyId)
      .single();
    const patient = pregnancy?.patient as { id: string; name: string } | null;

    if (patient) {
      sendWhatsAppToUser(
        { recipientType: "patient", recipientId: patient.id },
        "vaccine_record_updated",
        { patientName: patient.name },
      ).catch((err) => {
        console.error("[whatsapp] vaccine_record_updated send failed", err);
      });
    }

    if (profile.enterprise_id) {
      insertActivityLog({
        supabaseAdmin,
        actionName: "Registro de vacina atualizado",
        description: patient
          ? `Registro de vacina atualizado para ${patient.name}`
          : "Registro de vacina atualizado",
        actionType: "vaccine",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: patient?.id ?? null,
        metadata: { pregnancy_id: pregnancyId },
      });
    }

    await captureServerEvent(user.id, "upsert_vaccine_record", { pregnancy_id: pregnancyId });

    return { success: true };
  });
