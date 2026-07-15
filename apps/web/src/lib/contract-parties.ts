import { type ContractHeaderBlocks, buildContractHeaderBlocks } from "@/lib/contract-header-text";
import type { ProfileWithEnterprise } from "@/lib/safe-action";
import type {
  createServerSupabaseAdmin,
  createServerSupabaseClient,
} from "@ventre/supabase/server";
import type { Tables } from "@ventre/supabase/types";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type SupabaseAdmin = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

type PatientRow = Pick<
  Tables<"patients">,
  "name" | "email" | "phone" | "date_of_birth" | "rg" | "cpf" | "marital_status" | "occupation"
>;

type TeamMember = {
  id: string;
  name: string | null;
  professional_type: string | null;
  email: string | null;
  phone: string | null;
};

export async function buildPatientContractParties(
  {
    supabase,
    supabaseAdmin,
    profile,
  }: { supabase: SupabaseClient; supabaseAdmin: SupabaseAdmin; profile: ProfileWithEnterprise },
  { patientId, pregnancyId }: { patientId: string; pregnancyId: string | null },
): Promise<{
  patient: PatientRow | null;
  parties_details: ContractHeaderBlocks | null;
  contratadaName: string | null;
}> {
  const [patientResult, pregnancyResult, teamResult] = await Promise.all([
    supabase
      .from("patients")
      .select("name, email, phone, date_of_birth, rg, cpf, marital_status, occupation")
      .eq("id", patientId)
      .maybeSingle(),
    pregnancyId
      ? supabase.from("pregnancies").select("due_date").eq("id", pregnancyId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("team_members")
      .select("users!inner(id, name, professional_type, email, phone)")
      .eq("patient_id", patientId),
  ]);

  const patient = patientResult.data ?? null;
  const pregnancy = pregnancyResult.data ?? null;
  const teamMembers: TeamMember[] = ((teamResult.data ?? []) as unknown[]).map((r) => {
    const u = (r as { users: TeamMember }).users;
    return {
      id: u.id,
      name: u.name,
      professional_type: u.professional_type,
      email: u.email,
      phone: u.phone,
    };
  });

  // Build parties_details server-side — never sourced from client input
  let parties_details: ContractHeaderBlocks | null = null;
  let contratadaName: string | null = null;
  if (patient) {
    if (profile.enterprise_id) {
      const { data: enterprise } = await supabaseAdmin
        .from("enterprises")
        .select(
          "name, legal_name, cnpj, email, phone, street, number, complement, neighborhood, city, state, zipcode",
        )
        .eq("id", profile.enterprise_id)
        .maybeSingle();

      parties_details = buildContractHeaderBlocks(patient, pregnancy, {
        type: "enterprise",
        enterprise: enterprise ?? null,
        teamMembers,
      });
      contratadaName = enterprise?.legal_name ?? enterprise?.name ?? null;
    } else {
      parties_details = buildContractHeaderBlocks(patient, pregnancy, {
        type: "autonomous",
        user: {
          name: profile.name,
          email: profile.email,
          phone: profile.phone ?? null,
          professional_type: profile.professional_type ?? null,
        },
      });
      contratadaName = profile.name ?? null;
    }
  }

  return { patient, parties_details, contratadaName };
}
