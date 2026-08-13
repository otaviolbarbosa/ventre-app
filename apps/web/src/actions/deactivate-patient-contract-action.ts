"use server";

import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export const deactivatePatientContractAction = authActionClient
  .inputSchema(z.object({ contractId: z.string().uuid(), patientId: z.string().uuid() }))
  .action(async ({ parsedInput: { contractId, patientId }, ctx: { supabase, user } }) => {
    const { error } = await supabase
      .from("contracts")
      .update({ is_active: false })
      .eq("id", contractId)
      .eq("is_base_contract", false);

    if (error) throw new Error(error.message);

    revalidatePath(`/patients/${patientId}/profile`);

    await captureServerEvent(user.id, "deactivate_patient_contract", {
      contract_id: contractId,
      patient_id: patientId,
    });

    return { success: true };
  });
