"use server";

import { authActionClient } from "@/lib/safe-action";
import type { Tables } from "@nascere/supabase";
import { redirect } from "next/navigation";
import { z } from "zod";

type UserType = NonNullable<Tables<"users">["user_type"]>;

const userTypes = [
  "manager",
  "patient",
  "professional",
  "secretary",
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

    const { error } = await supabase
      .from("users")
      .update({ user_type: userType, enterprise_id: enterprise.id })
      .eq("id", user.id);

    if (error) {
      throw new Error(error.message);
    }

    redirect("/home");
  });
