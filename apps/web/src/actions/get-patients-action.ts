"use server";

import { authActionClient } from "@/lib/safe-action";

export const getPatientsAction = authActionClient.action(async ({ ctx: { supabase, user } }) => {
  const { data: teamMembers, error: teamError } = await supabase
    .from("team_members")
    .select("patient_id")
    .eq("professional_id", user.id);

  if (teamError) throw new Error(teamError.message);

  const patientIds = teamMembers?.map((tm) => tm.patient_id) ?? [];

  if (patientIds.length === 0) {
    return { patients: [] };
  }

  const { data: patients, error } = await supabase
    .from("patients")
    .select("*")
    .in("id", patientIds)
    .order("due_date", { ascending: true });

  if (error) throw new Error(error.message);

  return { patients: patients ?? [] };
});
