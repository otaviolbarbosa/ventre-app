"use server";

import { isStaff } from "@/lib/access-control";
import { authActionClient } from "@/lib/safe-action";

export const getEnterprisePatientsForBillingAction = authActionClient.action(
  async ({ ctx: { supabase, profile, user } }) => {
    let query = supabase
      .from("patients")
      .select(
        "id, name, team_members!inner(professional_id, users!team_members_professional_id_fkey!inner(enterprise_id, user_type))",
      )
      .order("name", { ascending: true });

    if (isStaff(profile) && profile.enterprise_id) {
      query = query
        .eq("team_members.users.enterprise_id", profile.enterprise_id)
        .eq("team_members.users.user_type", "professional");
    } else {
      query = query.eq("team_members.professional_id", user.id);
    }

    const { data, error } = await query;
    if (error) return { patients: [] };

    return { patients: (data ?? []).map((p) => ({ id: p.id, name: p.name })) };
  },
);
