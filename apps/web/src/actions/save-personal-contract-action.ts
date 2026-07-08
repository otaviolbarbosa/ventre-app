"use server";

import { authActionClient } from "@/lib/safe-action";
import { saveBaseContractSchema } from "@/lib/validations/contract";
import { revalidatePath } from "next/cache";

export const savePersonalContractAction = authActionClient
  .inputSchema(saveBaseContractSchema)
  .action(async ({ parsedInput: { title, clauses_html, city, state }, ctx: { supabase, user } }) => {
    const { data: existing } = await supabase
      .from("contracts")
      .select("id")
      .eq("is_base_contract", true)
      .eq("user_id", user.id)
      .is("enterprise_id", null)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("contracts")
        .update({ title, clauses_html, city: city ?? null, state: state ?? null })
        .eq("id", existing.id);

      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("contracts").insert({
        is_base_contract: true,
        title,
        clauses_html,
        city: city ?? null,
        state: state ?? null,
        user_id: user.id,
        enterprise_id: null,
      });

      if (error) throw new Error(error.message);
    }

    revalidatePath("/profile/settings/contract");
    return { success: true };
  });
