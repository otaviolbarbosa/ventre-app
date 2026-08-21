import { z } from "zod";

export const activateBirthModeSchema = z.object({
  pregnancyId: z.string().uuid("ID da gestação inválido"),
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
    ...birthEventDateTimeSchema,
  })
  .refine((v) => v.medication_type !== "outros" || !!v.other_birth_medication_type, {
    message: "Especifique o medicamento",
    path: ["other_birth_medication_type"],
  });
export type BirthMedicationAdministrationInput = z.infer<
  typeof birthMedicationAdministrationSchema
>;

// ── Bolsa rota ───────────────────────────────────────────────────────────────
export const birthMembraneRuptureSchema = z.object({
  ...birthEventDateTimeSchema,
});
export type BirthMembraneRuptureInput = z.infer<typeof birthMembraneRuptureSchema>;
