"use server";

import { authActionClient } from "@/lib/safe-action";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import type { Tables } from "@ventre/supabase";
import { redirect } from "next/navigation";
import { z } from "zod";

type UserType = NonNullable<Tables<"users">["user_type"]>;

const userTypes = [
  "manager",
  "patient",
  "professional",
  "secretary",
  "admin",
] as const satisfies readonly UserType[];

const schema = z.object({
  token: z.string().length(5, "O token deve ter 5 dígitos"),
  userType: z.enum(userTypes),
});

export const joinEnterpriseAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    const { token, userType } = parsedInput;

    const { data: enterprise, error: enterpriseError } = await supabase
      .from("enterprises")
      .select("id")
      .eq("token", token.toUpperCase())
      .single();

    if (enterpriseError || !enterprise) {
      throw new Error("Token inválido. Verifique o código e tente novamente.");
    }

    // Atualiza o user_type do usuário
    const { error: typeError } = await supabase
      .from("users")
      .update({ user_type: userType })
      .eq("id", user.id);

    if (typeError) throw new Error(typeError.message);

    if (userType === "professional") {
      // Profissionais entram via junction table (suporta múltiplas empresas)
      const supabaseAdmin = await createServerSupabaseAdmin();
      const { error: joinError } = await supabaseAdmin
        .from("user_enterprises")
        .insert({ user_id: user.id, enterprise_id: enterprise.id });
      if (joinError && joinError.code !== "23505") {
        throw new Error(joinError.message);
      }
    } else {
      // Managers e secretaries mantêm users.enterprise_id
      const { error } = await supabase
        .from("users")
        .update({ enterprise_id: enterprise.id })
        .eq("id", user.id);
      if (error) throw new Error(error.message);
    }

    redirect("/home");
  });
