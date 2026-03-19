"use server";

import { dayjs } from "@/lib/dayjs";
import { getDppDateRange } from "@/lib/dpp-filter";
import { calculateGestationalAge } from "@/lib/gestational-age";
import { authActionClient } from "@/lib/safe-action";
import type { PatientFilter, PatientWithGestationalInfo } from "@/types";
import type { Tables } from "@nascere/supabase";
import { z } from "zod";

const schema = z.object({
  filter: z.enum(["all", "recent", "trim1", "trim2", "trim3", "final"]).default("all"),
  showFinished: z.boolean().optional().default(false),
  search: z.string().default(""),
  dppMonth: z.number().optional(), // 0-indexed (0 = January)
  dppYear: z.number().optional(),
});

export const getHomePatientsAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    const { filter, search, dppMonth, dppYear } = parsedInput;

    const { data: teamMembers } = await supabase
      .from("team_members")
      .select("patient_id")
      .eq("professional_id", user.id);

    const patientIds = teamMembers?.map((tm) => tm.patient_id) ?? [];

    if (patientIds.length === 0) {
      return { patients: [] as PatientWithGestationalInfo[] };
    }

    const today = dayjs();

    type RawPatient = Tables<"patients"> & {
      due_date?: string | null;
      dum?: string | null;
      has_finished?: boolean;
      born_at?: string | null;
      observations?: string | null;
    };

    let rawPatients: RawPatient[] = [];

    if (dppMonth !== undefined && dppYear !== undefined) {
      const { startDate, endDate } = getDppDateRange(dppMonth, dppYear);

      // Filter via pregnancies: get pregnancy ids in date range, then fetch patients
      let pregnancyQuery = supabase
        .from("pregnancies")
        .select("patient_id, due_date, dum, has_finished, born_at, observations")
        .in("patient_id", patientIds)
        .gte("due_date", startDate)
        .lte("due_date", endDate)
        .order("due_date", { ascending: true });

      if (!parsedInput.showFinished) {
        pregnancyQuery = pregnancyQuery.eq("has_finished", false);
      }

      const { data: pregnancies, error: pregError } = await pregnancyQuery;
      if (pregError) throw new Error(pregError.message);

      const pregnancyByPatient = new Map((pregnancies ?? []).map((p) => [p.patient_id, p]));
      const filteredPatientIds = (pregnancies ?? []).map((p) => p.patient_id);

      if (filteredPatientIds.length === 0) {
        rawPatients = [];
      } else {
        let patientsQuery = supabase.from("patients").select("*").in("id", filteredPatientIds);

        if (search) {
          patientsQuery = patientsQuery.ilike("name", `%${search}%`);
        }

        const { data, error } = await patientsQuery;
        if (error) throw new Error(error.message);

        rawPatients = (data ?? []).map((p) => ({
          ...p,
          due_date: pregnancyByPatient.get(p.id)?.due_date ?? null,
          dum: pregnancyByPatient.get(p.id)?.dum ?? null,
          has_finished: pregnancyByPatient.get(p.id)?.has_finished ?? false,
          born_at: pregnancyByPatient.get(p.id)?.born_at ?? null,
          observations: pregnancyByPatient.get(p.id)?.observations ?? null,
        }));
      }
    } else {
      const { data, error } = await supabase.rpc("get_filtered_patients", {
        patient_ids: patientIds,
        filter_type: filter as PatientFilter,
        search_query: search,
      });
      if (error) throw new Error(error.message);
      rawPatients = (data ?? []) as unknown as RawPatient[];
    }

    const patientsWithInfo: PatientWithGestationalInfo[] = rawPatients
      .map((patient) => {
        const gestationalAge = calculateGestationalAge(patient.dum ?? null);
        const dueDate = dayjs(patient.due_date);
        const remainingDays = dueDate.diff(today, "day");

        return {
          ...patient,
          due_date: patient.due_date ?? null,
          dum: patient.dum ?? null,
          has_finished: patient.has_finished ?? false,
          born_at: patient.born_at ?? null,
          observations: patient.observations ?? null,
          weeks: gestationalAge?.weeks ?? 0,
          days: gestationalAge?.days ?? 0,
          remainingDays: Math.max(remainingDays, 0),
          progress: gestationalAge
            ? Math.min(Math.round((gestationalAge.weeks / 40) * 100), 100)
            : 0,
        };
      })
      .slice(0, 20);

    return { patients: patientsWithInfo };
  });
