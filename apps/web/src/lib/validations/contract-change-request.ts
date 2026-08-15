import { z } from "zod";

function isRichTextEmpty(html: string) {
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}

export const createContractChangeRequestSchema = z.object({
  patientId: z.string().uuid(),
  messageHtml: z
    .string()
    .refine((html) => !isRichTextEmpty(html), "A mensagem não pode estar vazia"),
});
export type CreateContractChangeRequestInput = z.infer<typeof createContractChangeRequestSchema>;

export const resolveContractChangeRequestSchema = z.object({
  requestId: z.string().uuid(),
  patientId: z.string().uuid(),
});
export type ResolveContractChangeRequestInput = z.infer<typeof resolveContractChangeRequestSchema>;
