"use server";

import { authActionClient } from "@/lib/safe-action";

export const getActiveBirthModePregnancyAction = authActionClient.action(
  async ({ ctx: { supabase } }) => {
    const { data, error } = await supabase
      .from("pregnancies")
      .select(
        "id, patient_id, birth_mode_activated_at, birth_mode_activated_by, patient:patients(name)",
      )
      .eq("birth_mode_active", true);

    if (error) throw new Error(error.message);

    return { pregnancies: data ?? [] };
  },
);
