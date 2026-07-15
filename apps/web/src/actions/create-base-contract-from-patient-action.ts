"use server";

import { authActionClient } from "@/lib/safe-action";
import { createBaseContractFromPatientSchema } from "@/lib/validations/contract";
import { revalidatePath } from "next/cache";

export const createBaseContractFromPatientAction = authActionClient
  .inputSchema(createBaseContractFromPatientSchema)
  .action(
    async ({
      parsedInput: { patientId, name, title, clauses_html, city, state },
      ctx: { supabase, user },
    }) => {
      const { error } = await supabase.from("contracts").insert({
        is_base_contract: true,
        name,
        title,
        clauses_html,
        city: city ?? null,
        state: state ?? null,
        user_id: user.id,
        enterprise_id: null,
      });

      if (error) throw new Error(error.message);

      revalidatePath(`/patients/${patientId}/profile`);
      return { success: true };
    },
  );
