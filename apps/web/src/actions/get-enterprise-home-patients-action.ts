"use server";

import { dayjs } from "@/lib/dayjs";
import { calculateGestationalAge } from "@/lib/gestational-age";
import { authActionClient } from "@/lib/safe-action";
import type { PatientFilter, PatientWithGestationalInfo } from "@/types";
import { z } from "zod";

const schema = z.object({
  filter: z.enum(["all", "recent", "trim1", "trim2", "trim3", "final"]).default("all"),
  search: z.string().default(""),
});

export const getEnterpriseHomePatientsAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, profile } }) => {
    if (!profile.enterprise_id) {
      return { patients: [] as PatientWithGestationalInfo[] };
    }

    // Busca todos os profissionais da organização
    const { data: professionals } = await supabase
      .from("users")
      .select("id")
      .eq("enterprise_id", profile.enterprise_id)
      .eq("user_type", "professional");

    const professionalIds = professionals?.map((p) => p.id) ?? [];
    if (professionalIds.length === 0) {
      return { patients: [] as PatientWithGestationalInfo[] };
    }

    // Busca todos os pacientes via team_members
    const { data: teamMembers } = await supabase
      .from("team_members")
      .select("patient_id")
      .in("professional_id", professionalIds);

    const allPatientIds = [...new Set(teamMembers?.map((tm) => tm.patient_id) ?? [])];

    if (allPatientIds.length === 0) {
      return { patients: [] as PatientWithGestationalInfo[] };
    }

    const { data: patients, error } = await supabase.rpc("get_filtered_patients", {
      patient_ids: allPatientIds,
      filter_type: parsedInput.filter as PatientFilter,
      search_query: parsedInput.search,
    });

    if (error) throw new Error(error.message);

    const today = dayjs();

    const patientsWithInfo: PatientWithGestationalInfo[] = (patients ?? [])
      .map((patient) => {
        const gestationalAge = calculateGestationalAge(patient.dum);
        const dueDate = dayjs(patient.due_date);
        const remainingDays = dueDate.diff(today, "day");

        return {
          ...patient,
          born_at: null,
          has_finished: false,
          weeks: gestationalAge?.weeks ?? 0,
          days: gestationalAge?.days ?? 0,
          remainingDays: Math.max(remainingDays, 0),
          progress: gestationalAge
            ? Math.min(Math.round((gestationalAge.weeks / 40) * 100), 100)
            : 0,
        };
      })
      .slice(0, 5);

    return { patients: patientsWithInfo };
  });
