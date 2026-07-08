"use server";

import { authActionClient } from "@/lib/safe-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export const deactivatePatientContractAction = authActionClient
  .inputSchema(z.object({ contractId: z.string().uuid(), patientId: z.string().uuid() }))
  .action(async ({ parsedInput: { contractId, patientId }, ctx: { supabase } }) => {
    const { error } = await supabase
      .from("contracts")
      .update({ is_active: false })
      .eq("id", contractId)
      .eq("is_base_contract", false);

    if (error) throw new Error(error.message);

    revalidatePath(`/patients/${patientId}/profile`);
    return { success: true };
  });
