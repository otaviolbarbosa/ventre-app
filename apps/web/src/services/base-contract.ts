import { getServerAuth } from "@/lib/server-auth";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import type { Tables } from "@ventre/supabase/types";

export async function getPersonalBaseContract(): Promise<Tables<"contracts"> | null> {
  const { user } = await getServerAuth();
  if (!user) return null;

  const supabaseAdmin = await createServerSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("contracts")
    .select("*")
    .eq("is_base_contract", true)
    .eq("user_id", user.id)
    .is("enterprise_id", null)
    .maybeSingle();

  if (error) {
    console.error("[getPersonalBaseContract]", error.message);
    return null;
  }

  return data;
}

export async function getBaseContract(): Promise<Tables<"contracts"> | null> {
  const { profile, user } = await getServerAuth();
  if (!user) return null;

  const supabaseAdmin = await createServerSupabaseAdmin();

  let query = supabaseAdmin.from("contracts").select("*").eq("is_base_contract", true);

  if (profile?.enterprise_id) {
    query = query.eq("enterprise_id", profile.enterprise_id);
  } else {
    query = query.eq("user_id", user.id).is("enterprise_id", null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("[getBaseContract]", error.message);
    return null;
  }

  return data;
}

type TeamMember = {
  id: string;
  name: string | null;
  professional_type: string | null;
  email: string | null;
  phone: string | null;
};

export type ContractHeaderData =
  | {
      type: "enterprise";
      enterprise: Pick<
        Tables<"enterprises">,
        | "name"
        | "legal_name"
        | "cnpj"
        | "email"
        | "phone"
        | "street"
        | "number"
        | "complement"
        | "neighborhood"
        | "city"
        | "state"
        | "zipcode"
      > | null;
      teamMembers: TeamMember[];
    }
  | {
      type: "autonomous";
      user: { name: string | null; email: string | null; phone: string | null; professional_type: string | null };
    };

export async function getPersonalContractHeaderData(): Promise<
  Extract<ContractHeaderData, { type: "autonomous" }>
> {
  const { profile } = await getServerAuth();
  return {
    type: "autonomous",
    user: {
      name: profile?.name ?? null,
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      professional_type: profile?.professional_type ?? null,
    },
  };
}

export async function getContractHeaderData(): Promise<ContractHeaderData> {
  const { profile, user } = await getServerAuth();

  if (!user || !profile) {
    return { type: "autonomous", user: { name: null, email: null, phone: null, professional_type: null } };
  }

  const supabaseAdmin = await createServerSupabaseAdmin();

  if (profile.enterprise_id) {
    const { data: enterprise } = await supabaseAdmin
      .from("enterprises")
      .select("name, legal_name, cnpj, email, phone, street, number, complement, neighborhood, city, state, zipcode")
      .eq("id", profile.enterprise_id)
      .maybeSingle();

    const { data: teamRows } = await supabaseAdmin
      .from("user_enterprises")
      .select("users!inner(id, name, professional_type, email, phone)")
      .eq("enterprise_id", profile.enterprise_id);

    const teamMembers: TeamMember[] = (teamRows ?? []).map((r) => {
      const u = r.users as unknown as TeamMember;
      return {
        id: u.id,
        name: u.name,
        professional_type: u.professional_type,
        email: u.email,
        phone: u.phone,
      };
    });

    return { type: "enterprise", enterprise: enterprise ?? null, teamMembers };
  }

  return {
    type: "autonomous",
    user: {
      name: profile.name,
      email: profile.email,
      phone: profile.phone ?? null,
      professional_type: profile.professional_type ?? null,
    },
  };
}
