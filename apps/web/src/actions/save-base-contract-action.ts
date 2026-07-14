"use server";

import { authActionClient } from "@/lib/safe-action";
import { saveBaseContractSchema } from "@/lib/validations/contract";
import { revalidatePath } from "next/cache";

export const saveBaseContractAction = authActionClient
  .inputSchema(saveBaseContractSchema)
  .action(
    async ({
      parsedInput: { title, clauses_html, city, state },
      ctx: { supabase, profile, user },
    }) => {
      if (profile.user_type !== "manager") {
        throw new Error("Apenas gestores podem configurar o contrato base.");
      }

      let existingId: string | null = null;

      if (profile.enterprise_id) {
        const { data: existing } = await supabase
          .from("contracts")
          .select("id")
          .eq("is_base_contract", true)
          .eq("enterprise_id", profile.enterprise_id)
          .maybeSingle();
        existingId = existing?.id ?? null;
      } else {
        const { data: existing } = await supabase
          .from("contracts")
          .select("id")
          .eq("is_base_contract", true)
          .eq("user_id", user.id)
          .is("enterprise_id", null)
          .maybeSingle();
        existingId = existing?.id ?? null;
      }

      if (existingId) {
        const { error } = await supabase
          .from("contracts")
          .update({ title, clauses_html, city: city ?? null, state: state ?? null })
          .eq("id", existingId);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("contracts").insert({
          is_base_contract: true,
          title,
          clauses_html,
          city: city ?? null,
          state: state ?? null,
          enterprise_id: profile.enterprise_id ?? null,
          user_id: profile.enterprise_id ? null : user.id,
        });

        if (error) throw new Error(error.message);
      }

      revalidatePath("/settings/contract");
      return { success: true };
    },
  );
