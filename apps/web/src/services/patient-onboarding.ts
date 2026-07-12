import type { CreatePatientInput } from "@/lib/validations/patient";
import { createBilling } from "@/services/billing";
import { createPatient } from "@/services/patient";
import type { createServerSupabaseAdmin, createServerSupabaseClient } from "@ventre/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type SupabaseAdminClient = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

export async function createPatientWithTeamAndBilling(
  supabase: SupabaseClient,
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  input: CreatePatientInput,
  enterpriseId: string | null,
) {
  const patient = await createPatient(supabaseAdmin, userId, {
    ...input,
    enterprise_id: enterpriseId,
  });

  if (input.billing) {
    await createBilling(
      supabase,
      supabaseAdmin,
      userId,
      {
        ...input.billing,
        patient_id: patient.id,
      },
      enterpriseId,
    );
  }

  return { patient };
}
