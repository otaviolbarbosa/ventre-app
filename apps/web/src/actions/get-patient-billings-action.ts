"use server";

import { isStaff } from "@/lib/access-control";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid("ID do paciente inválido"),
});

export const getPatientBillingsAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, profile } }) => {
    const selectedProfessionalId = isStaff(profile) ? null : profile.id;

    let billingsQuery = supabase
      .from("billings")
      .select(`
      *,
      installments(id, status, due_date),
      patient:patients!billings_patient_id_fkey(id, name)
    `)
      .eq("patient_id", parsedInput.patientId);

    if (selectedProfessionalId) {
      billingsQuery = billingsQuery.not(
        `splitted_billing->>${selectedProfessionalId}`,
        "is",
        null,
      );
    }

    const { data: billings, error } = await billingsQuery.order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return { billings: billings ?? [] };
  });
