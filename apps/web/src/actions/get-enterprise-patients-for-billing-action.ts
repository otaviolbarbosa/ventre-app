"use server";

import { isStaff } from "@/lib/access-control";
import { authActionClient } from "@/lib/safe-action";

export const getEnterprisePatientsForBillingAction = authActionClient.action(
  async ({ ctx: { supabase, profile } }) => {
    if (isStaff(profile) && profile.enterprise_id) {
      const { data, error } = await supabase
        .from("patients")
        .select("id, name, pregnancies!inner(enterprise_id)")
        .eq("pregnancies.enterprise_id", profile.enterprise_id)
        .order("name", { ascending: true });

      if (error) return { patients: [] };

      const seen = new Set<string>();
      const patients = (data ?? [])
        .filter((p) => !seen.has(p.id) && seen.add(p.id))
        .map((p) => ({ id: p.id, name: p.name }));

      return { patients };
    }

    return { patients: [] };
  },
);
