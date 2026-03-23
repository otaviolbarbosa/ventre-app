import { z } from "zod";

// ── Patient prenatal fields ──────────────────────────────────────────────────
export const updatePatientPrenatalSchema = z.object({
  blood_type: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .optional()
    .nullable(),
  height_cm: z.coerce.number().positive().optional().nullable(),
  allergies: z.string().optional(), // comma-separated in form, parsed to array
  personal_notes: z.string().optional(),
  family_history_diabetes: z.boolean().optional().nullable(),
  family_history_hypertension: z.boolean().optional().nullable(),
  family_history_twin: z.boolean().optional().nullable(),
  family_history_others: z.string().optional(),
  // Pregnancy obstetric counts
  gestations_count: z.coerce.number().int().min(0).optional().nullable(),
  deliveries_count: z.coerce.number().int().min(0).optional().nullable(),
  cesareans_count: z.coerce.number().int().min(0).optional().nullable(),
  abortions_count: z.coerce.number().int().min(0).optional().nullable(),
  initial_weight_kg: z.coerce.number().positive().optional().nullable(),
});
export type UpdatePatientPrenatalInput = z.infer<typeof updatePatientPrenatalSchema>;

// ── Obstetric History ────────────────────────────────────────────────────────
export const obstetricHistorySchema = z.object({
  diabetes: z.boolean().optional().nullable(),
  urinary_infection: z.boolean().optional().nullable(),
  infertility: z.boolean().optional().nullable(),
  breastfeeding_difficulty: z.boolean().optional().nullable(),
  cardiopathy: z.boolean().optional().nullable(),
  thromboembolism: z.boolean().optional().nullable(),
  hypertension: z.boolean().optional().nullable(),
  other_clinical: z.boolean().optional().nullable(),
  other_clinical_notes: z.string().optional(),
  pelvic_uterine_surgery: z.boolean().optional().nullable(),
  prior_surgery: z.boolean().optional().nullable(),
  other_surgery_notes: z.string().optional(),
});
export type ObstetricHistoryInput = z.infer<typeof obstetricHistorySchema>;

// ── Risk Factors ─────────────────────────────────────────────────────────────
export const riskFactorsSchema = z.object({
  smoking: z.boolean().optional().nullable(),
  cigarettes_per_day: z.coerce.number().int().min(0).optional().nullable(),
  alcohol: z.boolean().optional().nullable(),
  other_drugs: z.boolean().optional().nullable(),
  domestic_violence: z.boolean().optional().nullable(),
  hiv_aids: z.boolean().optional().nullable(),
  syphilis: z.boolean().optional().nullable(),
  toxoplasmosis: z.boolean().optional().nullable(),
  urinary_infection: z.boolean().optional().nullable(),
  fever: z.boolean().optional().nullable(),
  anemia: z.boolean().optional().nullable(),
  isthmocervical_incompetence: z.boolean().optional().nullable(),
  preterm_labor_threat: z.boolean().optional().nullable(),
  rh_isoimmunization: z.boolean().optional().nullable(),
  oligo_polyhydramnios: z.boolean().optional().nullable(),
  premature_membrane_rupture: z.boolean().optional().nullable(),
  iugr: z.boolean().optional().nullable(),
  post_term: z.boolean().optional().nullable(),
  hypertension: z.boolean().optional().nullable(),
  preeclampsia_eclampsia: z.boolean().optional().nullable(),
  cardiopathy: z.boolean().optional().nullable(),
  gestational_diabetes: z.boolean().optional().nullable(),
  insulin_use: z.boolean().optional().nullable(),
  hemorrhage_1st_trimester: z.boolean().optional().nullable(),
  hemorrhage_2nd_trimester: z.boolean().optional().nullable(),
  hemorrhage_3rd_trimester: z.boolean().optional().nullable(),
  exantema: z.boolean().optional().nullable(),
  other_notes: z.string().optional(),
});
export type RiskFactorsInput = z.infer<typeof riskFactorsSchema>;

// ── Pregnancy Evolution ──────────────────────────────────────────────────────
export const pregnancyEvolutionSchema = z.object({
  consultation_date: z.string().min(1, "Data da consulta obrigatória"),
  gestational_weeks: z.coerce.number().int().min(0).max(45).optional().nullable(),
  gestational_days: z.coerce.number().int().min(0).max(6).optional().nullable(),
  ig_source: z.enum(["dum", "usg"]).optional().nullable(),
  complaint: z.string().optional(),
  weight_kg: z.coerce.number().positive().optional().nullable(),
  edema: z.boolean().optional().nullable(),
  systolic_bp: z.coerce.number().int().min(0).optional().nullable(),
  diastolic_bp: z.coerce.number().int().min(0).optional().nullable(),
  uterine_height_cm: z.coerce.number().positive().optional().nullable(),
  fetal_presentation: z.enum(["cephalic", "pelvic", "transverse"]).optional().nullable(),
  fetal_heart_rate: z.coerce.number().int().min(0).optional().nullable(),
  fetal_movement: z.boolean().optional().nullable(),
  cervical_exam: z.string().optional(),
  exantema: z.boolean().optional().nullable(),
  exantema_notes: z.string().optional(),
  observations: z.string().optional(),
  responsible: z.string().optional(),
});
export type PregnancyEvolutionInput = z.infer<typeof pregnancyEvolutionSchema>;

// ── Ultrasound ───────────────────────────────────────────────────────────────
export const ultrasoundSchema = z.object({
  exam_date: z.string().min(1, "Data do exame obrigatória"),
  gestational_weeks: z.coerce.number().int().min(0).max(45).optional().nullable(),
  gestational_days: z.coerce.number().int().min(0).max(6).optional().nullable(),
  ccn_mm: z.coerce.number().positive().optional().nullable(),
  fetal_heart_rate_bpm: z.coerce.number().int().min(0).optional().nullable(),
  nuchal_translucency_mm: z.coerce.number().positive().optional().nullable(),
  cervical_length_cm: z.coerce.number().positive().optional().nullable(),
  estimated_weight_g: z.coerce.number().int().min(0).optional().nullable(),
  amniotic_fluid_index: z.enum(["severe_oligohydramnios", "oligohydramnios", "normal", "polyhydramnios"]).optional().nullable(),
  nasal_bone_present: z.boolean().optional().nullable(),
  placenta_position: z.string().optional(),
  iugr: z.boolean().optional().nullable(),
  doppler_result: z.enum(["normal", "abnormal", "not_performed"]).optional().nullable(),
  notes: z.string().optional(),
});
export type UltrasoundInput = z.infer<typeof ultrasoundSchema>;

// ── Lab Exam ─────────────────────────────────────────────────────────────────
export const labExamSchema = z.object({
  exam_date: z.string().min(1, "Data do exame obrigatória"),
  exam_name: z.string().min(1, "Nome do exame obrigatório"),
  result_text: z.string().optional(),
  result_numeric: z.coerce.number().optional().nullable(),
  unit: z.string().optional(),
  hemoglobin_electrophoresis: z
    .enum(["AA", "AS", "AC", "SS", "SC", "other_heterozygous", "other_homozygous"])
    .optional()
    .nullable(),
});
export type LabExamInput = z.infer<typeof labExamSchema>;

// ── Vaccine Record ───────────────────────────────────────────────────────────
export const vaccineRecordSchema = z.object({
  vaccine_name: z.enum(["covid", "influenza", "hepatitis_b", "dtpa", "abrysvo", "rhogam"]),
  dose_number: z.coerce.number().int().min(1).max(3).optional().nullable(),
  applied_date: z.string().optional(),
  status: z.enum(["applied", "immunized", "not_applicable"]).optional().nullable(),
  notes: z.string().optional(),
});
export type VaccineRecordInput = z.infer<typeof vaccineRecordSchema>;

// ── Other Exam ───────────────────────────────────────────────────────────────
export const otherExamSchema = z.object({
  exam_date: z.string().min(1, "Data do exame obrigatória"),
  description: z.string().min(1, "Descrição obrigatória"),
});
export type OtherExamInput = z.infer<typeof otherExamSchema>;
