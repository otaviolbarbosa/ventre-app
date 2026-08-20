"use server";

import { scheduleBirthModeActivationNotifications } from "@/lib/notifications/birth-mode";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { activateBirthModeSchema } from "@/lib/validations/birth-mode";
import { revalidatePath } from "next/cache";

export const activateBirthModeAction = authActionClient
  .inputSchema(activateBirthModeSchema)
  .action(async ({ parsedInput: { pregnancyId }, ctx: { supabase, user } }) => {
    const { data: pregnancy, error } = await supabase
      .from("pregnancies")
      .update({
        birth_mode_active: true,
        birth_mode_activated_at: new Date().toISOString(),
        birth_mode_activated_by: user.id,
      })
      .eq("id", pregnancyId)
      .select("id, patient_id")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath(`/patients/${pregnancy.patient_id}/profile`);

    scheduleBirthModeActivationNotifications(pregnancyId).catch((err) => {
      console.error("[activate-birth-mode] Failed to schedule WhatsApp notifications", err);
    });

    await captureServerEvent(user.id, "activate_birth_mode", {
      pregnancy_id: pregnancyId,
    });

    return { success: true };
  });
