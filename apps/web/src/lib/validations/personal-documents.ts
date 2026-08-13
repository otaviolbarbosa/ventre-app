import { z } from "zod";

export const personalDocumentsSchema = z.object({
  cpf: z.string().optional(),
  rg: z.string().optional(),
  rg_issuing_body: z.string().optional(),
});

export type PersonalDocumentsInput = z.infer<typeof personalDocumentsSchema>;
