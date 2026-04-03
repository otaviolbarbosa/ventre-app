"use server";

import { adminActionClient } from "@/lib/safe-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const updatePatientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres").optional(),
  email: z.string().email("E-mail inválido").nullable().optional(),
  phone: z.string().optional(),
  date_of_birth: z.string().nullable().optional(),
});

const deletePatientSchema = z.object({
  id: z.string().uuid(),
});

export const updatePatientAction = adminActionClient
  .schema(updatePatientSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...data } = parsedInput;

    const { error } = await ctx.supabaseAdmin.from("patients").update(data).eq("id", id);

    if (error) throw new Error(error.message);

    revalidatePath("/patients");
    revalidatePath(`/patients/${id}`);
    return { success: true };
  });

export const deletePatientAction = adminActionClient
  .schema(deletePatientSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { error } = await ctx.supabaseAdmin.from("patients").delete().eq("id", parsedInput.id);

    if (error) throw new Error(error.message);

    revalidatePath("/patients");
    return { success: true };
  });
