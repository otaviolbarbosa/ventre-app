import { z } from "zod";

export const documentTemplateCategorySchema = z.enum([
  "prescricao",
  "exame",
  "cirurgia",
  "laudo",
  "atestado",
  "declaracao",
  "relatorio",
]);

export type DocumentTemplateCategory = z.infer<typeof documentTemplateCategorySchema>;

export const listDocumentTemplatesSchema = z.object({
  category: documentTemplateCategorySchema,
});

export const createDocumentTemplateSchema = z.object({
  category: documentTemplateCategorySchema,
  title: z.string().min(1, "O nome não pode estar vazio"),
  content: z.record(z.string(), z.unknown()),
});

export const updateDocumentTemplateSchema = z.object({
  templateId: z.string().uuid(),
  title: z.string().min(1, "O nome não pode estar vazio").optional(),
  content: z.record(z.string(), z.unknown()),
});

export const deleteDocumentTemplateSchema = z.object({
  templateId: z.string().uuid(),
});
