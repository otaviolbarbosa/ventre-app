"use server";

import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { emotionalPrenatalSchema } from "@/lib/validations/prenatal";
import { z } from "zod";

const schema = z.object({
  pregnancyId: z.string().uuid(),
  data: emotionalPrenatalSchema,
});

export const upsertEmotionalPrenatalAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, user, profile } }) => {
    const { pregnancyId, data } = parsedInput;

    if (profile.professional_type !== "doula") {
      throw new Error("Apenas doulas podem preencher o pré-natal emocional");
    }

    const { error } = await supabase.from("prenatal_emotional_records").upsert(
      {
        pregnancy_id: pregnancyId,
        professional_id: user.id,
        ...data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "professional_id,pregnancy_id" },
    );

    if (error) throw new Error(error.message);

    await captureServerEvent(user.id, "upsert_emotional_prenatal", { pregnancy_id: pregnancyId });

    return { success: true };
  });
