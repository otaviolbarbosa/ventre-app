"use server";

import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid(),
  pregnancyId: z.string().uuid(),
});

export const getPrenatalCardAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    const { patientId, pregnancyId } = parsedInput;

    const [
      { data: patient },
      { data: pregnancy },
      { data: obstetricHistory },
      { data: riskFactors },
      { data: evolutions },
      { data: ultrasounds },
      { data: labExams },
      { data: vaccines },
      { data: otherExams },
    ] = await Promise.all([
      supabase
        .from("patients")
        .select(
          "partner_name, blood_type, height_cm, allergies, personal_notes, family_history_diabetes, family_history_hypertension, family_history_twin, family_history_others",
        )
        .eq("id", patientId)
        .single(),
      supabase
        .from("pregnancies")
        .select(
          "gestations_count, deliveries_count, cesareans_count, abortions_count, initial_weight_kg, initial_bmi",
        )
        .eq("id", pregnancyId)
        .single(),
      supabase
        .from("patient_obstetric_history")
        .select("*")
        .eq("patient_id", patientId)
        .maybeSingle(),
      supabase
        .from("pregnancy_risk_factors")
        .select("*")
        .eq("pregnancy_id", pregnancyId)
        .maybeSingle(),
      supabase
        .from("pregnancy_evolutions")
        .select("*")
        .eq("pregnancy_id", pregnancyId)
        .order("consultation_date", { ascending: true }),
      supabase
        .from("ultrasounds")
        .select("*")
        .eq("pregnancy_id", pregnancyId)
        .order("exam_date", { ascending: true }),
      supabase
        .from("lab_exam_results")
        .select("*")
        .eq("pregnancy_id", pregnancyId)
        .order("exam_date", { ascending: true }),
      supabase
        .from("vaccine_records")
        .select("*")
        .eq("pregnancy_id", pregnancyId)
        .order("created_at", { ascending: true }),
      supabase
        .from("other_exams")
        .select("*")
        .eq("pregnancy_id", pregnancyId)
        .order("exam_date", { ascending: true }),
    ]);

    return {
      patient: patient ?? null,
      pregnancy: pregnancy ?? null,
      obstetricHistory: obstetricHistory ?? null,
      riskFactors: riskFactors ?? null,
      evolutions: evolutions ?? [],
      ultrasounds: ultrasounds ?? [],
      labExams: labExams ?? [],
      vaccines: vaccines ?? [],
      otherExams: otherExams ?? [],
    };
  });
