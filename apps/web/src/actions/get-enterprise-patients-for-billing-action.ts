"use server";

import { isStaff } from "@/lib/access-control";
import { authActionClient } from "@/lib/safe-action";

export const getEnterprisePatientsForBillingAction = authActionClient.action(
  async ({ ctx: { supabase, profile } }) => {
    if (!isStaff(profile) || !profile.enterprise_id) {
      return { patients: [] };
    }

    const { data: professionals } = await supabase
      .from("users")
      .select("id")
      .eq("enterprise_id", profile.enterprise_id)
      .eq("user_type", "professional");

    const professionalIds = professionals?.map((p) => p.id) ?? [];
    if (professionalIds.length === 0) return { patients: [] };

    const { data: teamMembers } = await supabase
      .from("team_members")
      .select("patient_id")
      .in("professional_id", professionalIds);

    const patientIds = [...new Set(teamMembers?.map((tm) => tm.patient_id) ?? [])];
    if (patientIds.length === 0) return { patients: [] };

    const { data } = await supabase
      .from("patients")
      .select("id, name")
      .in("id", patientIds)
      .order("name", { ascending: true });

    return { patients: (data ?? []) as { id: string; name: string | null }[] };
  },
);
