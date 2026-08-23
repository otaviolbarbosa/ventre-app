import { z } from "zod";

export const activateBirthModeSchema = z
  .object({
    pregnancyId: z.string().uuid("ID da gestação inválido"),
    birth_mode_labour_type: z.enum(["espontaneo", "induzido"], {
      message: "Selecione o tipo de trabalho de parto",
    }),
    birth_mode_induction_type: z
      .enum(["balao", "misoprostol", "ocitocina"])
      .optional()
      .nullable(),
    labour_start_description: z.string().optional().nullable(),
  })
  .refine((v) => v.birth_mode_labour_type !== "induzido" || !!v.birth_mode_induction_type, {
    message: "Informe o tipo de indução",
    path: ["birth_mode_induction_type"],
  });

export type ActivateBirthModeInput = z.infer<typeof activateBirthModeSchema>;

// ── Data e hora do evento ────────────────────────────────────────────────────
export const birthEventDateTimeSchema = {
  date: z.string().min(1, "Informe a data"),
  time: z.string().min(1, "Informe o horário"),
};

// ── Contração ────────────────────────────────────────────────────────────────
export const birthContractionSchema = z.object({
  duration_seconds: z.coerce.number().int().positive("Duração deve ser maior que zero"),
  ...birthEventDateTimeSchema,
});
export type BirthContractionInput = z.infer<typeof birthContractionSchema>;

// ── Dilatação cervical ───────────────────────────────────────────────────────
export const birthCervicalDilationSchema = z.object({
  dilation_cm: z.coerce.number().min(0).max(10),
  ...birthEventDateTimeSchema,
});
export type BirthCervicalDilationInput = z.infer<typeof birthCervicalDilationSchema>;

// ── Altura de apresentação (plano de Lee) ────────────────────────────────────
export const birthFetalStationSchema = z.object({
  station_lee: z.coerce.number().int().min(-4).max(4),
  ...birthEventDateTimeSchema,
});
export type BirthFetalStationInput = z.infer<typeof birthFetalStationSchema>;

// ── Frequência cardíaca fetal ────────────────────────────────────────────────
export const birthFetalHeartRateSchema = z.object({
  bpm: z.coerce.number().int().positive().max(299),
  ...birthEventDateTimeSchema,
});
export type BirthFetalHeartRateInput = z.infer<typeof birthFetalHeartRateSchema>;

// ── Fluido amniótico ─────────────────────────────────────────────────────────
export const birthAmnioticFluidRecordSchema = z.object({
  fluid_type: z.enum(["intacto", "com_sangue", "claro", "com_meconio"]),
  ...birthEventDateTimeSchema,
});
export type BirthAmnioticFluidRecordInput = z.infer<typeof birthAmnioticFluidRecordSchema>;

// ── Administração de medicamentos ────────────────────────────────────────────
export const birthMedicationAdministrationSchema = z
  .object({
    medication_type: z.enum(["fluidos_intravenosos", "ocitocina", "analgesia", "outros"]),
    other_birth_medication_type: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    oxytocin_concentration_u_per_l: z.coerce.number().positive().optional().nullable(),
    oxytocin_drip_rate_gtt_per_min: z.coerce.number().int().min(0).optional().nullable(),
    ...birthEventDateTimeSchema,
  })
  .refine((v) => v.medication_type !== "outros" || !!v.other_birth_medication_type, {
    message: "Especifique o medicamento",
    path: ["other_birth_medication_type"],
  })
  .refine((v) => v.medication_type !== "ocitocina" || !!v.oxytocin_concentration_u_per_l, {
    message: "Informe a concentração da ocitocina",
    path: ["oxytocin_concentration_u_per_l"],
  })
  .refine(
    (v) =>
      v.medication_type !== "ocitocina" ||
      (v.oxytocin_drip_rate_gtt_per_min !== undefined &&
        v.oxytocin_drip_rate_gtt_per_min !== null),
    {
      message: "Informe o gotejamento da ocitocina",
      path: ["oxytocin_drip_rate_gtt_per_min"],
    },
  );
export type BirthMedicationAdministrationInput = z.infer<
  typeof birthMedicationAdministrationSchema
>;

// ── Bolsa rota ───────────────────────────────────────────────────────────────
export const birthMembraneRuptureSchema = z.object({
  rupture_type: z.enum(["espontanea", "artificial"]),
  fluid_type_at_rupture: z.enum(["claro", "com_meconio", "com_sangue"]),
  ...birthEventDateTimeSchema,
});
export type BirthMembraneRuptureInput = z.infer<typeof birthMembraneRuptureSchema>;

// ── Vitais maternos ──────────────────────────────────────────────────────────
export const birthMaternalVitalsSchema = z.object({
  systolic_bp: z.coerce.number().int().positive().optional().nullable(),
  diastolic_bp: z.coerce.number().int().positive().optional().nullable(),
  pulse_bpm: z.coerce.number().int().positive().optional().nullable(),
  temperature_celsius: z.coerce.number().positive().optional().nullable(),
  ...birthEventDateTimeSchema,
});
export type BirthMaternalVitalsInput = z.infer<typeof birthMaternalVitalsSchema>;

// ── Urina ────────────────────────────────────────────────────────────────────
export const birthUrineTestSchema = z.object({
  protein_level: z
    .enum(["ausente", "tracos", "uma_cruz", "duas_cruzes", "tres_cruzes"])
    .optional()
    .nullable(),
  ketone_level: z
    .enum(["ausente", "tracos", "uma_cruz", "duas_cruzes", "tres_cruzes"])
    .optional()
    .nullable(),
  volume_ml: z.coerce.number().min(0).optional().nullable(),
  ...birthEventDateTimeSchema,
});
export type BirthUrineTestInput = z.infer<typeof birthUrineTestSchema>;
