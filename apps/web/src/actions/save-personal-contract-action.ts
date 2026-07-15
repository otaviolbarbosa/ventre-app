"use server";

import { authActionClient } from "@/lib/safe-action";
import { saveBaseContractSchema } from "@/lib/validations/contract";
import { revalidatePath } from "next/cache";

export const savePersonalContractAction = authActionClient
  .inputSchema(saveBaseContractSchema)
  .action(
    async ({
      parsedInput: { contractId, name, title, clauses_html, city, state },
      ctx: { supabase, user },
    }) => {
      if (contractId) {
        const { error } = await supabase
          .from("contracts")
          .update({
            title,
            clauses_html,
            city: city ?? null,
            state: state ?? null,
            ...(name !== undefined ? { name } : {}),
          })
          .eq("id", contractId)
          .eq("is_base_contract", true)
          .eq("user_id", user.id)
          .is("enterprise_id", null);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("contracts").insert({
          is_base_contract: true,
          title,
          clauses_html,
          city: city ?? null,
          state: state ?? null,
          name: name ?? title,
          user_id: user.id,
          enterprise_id: null,
        });

        if (error) throw new Error(error.message);
      }

      revalidatePath("/profile/settings/contract");
      return { success: true };
    },
  );
