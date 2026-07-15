"use server";

import { authActionClient } from "@/lib/safe-action";
import { saveBaseContractSchema } from "@/lib/validations/contract";
import { revalidatePath } from "next/cache";

export const saveBaseContractAction = authActionClient
  .inputSchema(saveBaseContractSchema)
  .action(
    async ({
      parsedInput: { contractId, name, title, clauses_html, city, state },
      ctx: { supabase, profile, user },
    }) => {
      if (profile.user_type !== "manager") {
        throw new Error("Apenas gestores podem configurar o contrato base.");
      }

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
          .eq("is_base_contract", true);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("contracts").insert({
          is_base_contract: true,
          title,
          clauses_html,
          city: city ?? null,
          state: state ?? null,
          name: name ?? title,
          enterprise_id: profile.enterprise_id ?? null,
          user_id: profile.enterprise_id ? null : user.id,
        });

        if (error) throw new Error(error.message);
      }

      revalidatePath("/settings/contract");
      return { success: true };
    },
  );
