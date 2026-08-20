import { z } from "zod";

export const activateBirthModeSchema = z.object({
  pregnancyId: z.string().uuid("ID da gestação inválido"),
});

export type ActivateBirthModeInput = z.infer<typeof activateBirthModeSchema>;
