"use server";

import { createServerSupabaseClient } from "@ventre/supabase/server";
import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Digite um e-mail válido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export const loginAction = createSafeActionClient()
  .schema(loginSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsedInput.email,
      password: parsedInput.password,
    });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("Erro ao autenticar. Tente novamente.");

    const { data: profile } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", data.user.id)
      .single();

    if (!profile || profile.user_type !== "admin") {
      await supabase.auth.signOut();
      throw new Error("Acesso restrito a administradores.");
    }

    return { success: true };
  });
