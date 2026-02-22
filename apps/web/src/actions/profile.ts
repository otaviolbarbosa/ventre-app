"use server";

import { createServerSupabaseClient } from "@nascere/supabase/server";
import type { Tables } from "@nascere/supabase/types";
import { redirect } from "next/navigation";

type ProfessionalType = NonNullable<Tables<"users">["professional_type"]>;

export async function setProfessionalType(type: ProfessionalType) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuário não autenticado");
  }

  const { error } = await supabase
    .from("users")
    .update({ professional_type: type })
    .eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/home");
}
