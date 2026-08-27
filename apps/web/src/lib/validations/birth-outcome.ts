import { z } from "zod";

const apgarSubScoreSchema = z.coerce.number().int().min(0).max(2);

const apgarTimepointSchema = z.object({
  appearance: apgarSubScoreSchema.optional(),
  pulse: apgarSubScoreSchema.optional(),
  grimace: apgarSubScoreSchema.optional(),
  activity: apgarSubScoreSchema.optional(),
  respiration: apgarSubScoreSchema.optional(),
});

export const birthOutcomeBaseSchema = z.object({
  addBornAt: z.boolean().default(false),
  bornAt: z.string().optional(),
  bornAtTime: z.string().optional(),
  deliveryMethod: z.enum(["vaginal", "vaginal_assisted", "cesarean"]).optional(),
  babySex: z.enum(["masculino", "feminino"]).optional(),
  birthWeightGrams: z.coerce.number().int().positive().optional(),
  addApgar: z.boolean().default(false),
  apgar1: apgarTimepointSchema,
  apgar5: apgarTimepointSchema,
  description: z.string().max(5000).optional(),
});

type ApgarRefinementInput = z.infer<typeof birthOutcomeBaseSchema>;

function apgarRefinement(v: ApgarRefinementInput, ctx: z.RefinementCtx) {
  if (!v.addApgar) return;
  for (const timepoint of ["apgar1", "apgar5"] as const) {
    for (const key of ["appearance", "pulse", "grimace", "activity", "respiration"] as const) {
      if (v[timepoint][key] === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Campo obrigatório ao registrar o APGAR",
          path: [timepoint, key],
        });
      }
    }
  }
}

export const birthOutcomeSchema = birthOutcomeBaseSchema.superRefine(apgarRefinement);
export type BirthOutcomeInput = z.infer<typeof birthOutcomeSchema>;

export const finishCareActionSchema = birthOutcomeBaseSchema
  .extend({
    patientId: z.string().uuid("ID do paciente inválido"),
    pregnancyId: z.string().uuid("ID da gestação inválido").optional(),
  })
  .superRefine(apgarRefinement);
export type FinishCareActionInput = z.infer<typeof finishCareActionSchema>;
