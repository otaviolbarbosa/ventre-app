"use server";

import { authActionClient } from "@/lib/safe-action";
import type { Tables } from "@nascere/supabase/types";

export const getPatientsAction = authActionClient.action(async ({ ctx: { supabase, user } }) => {
  const { data, error } = await supabase
    .from("patients")
    .select("*, team_members!inner(professional_id), pregnancies!inner(has_finished)")
    .eq("team_members.professional_id", user.id)
    .eq("pregnancies.has_finished", false)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return { patients: (data ?? []) as Tables<"patients">[] };
});
