import { createServerSupabaseAdmin, createServerSupabaseClient } from "@nascere/supabase/server";
import { createSafeActionClient } from "next-safe-action";

export const actionClient = createSafeActionClient();

export const authActionClient = actionClient.use(async ({ next }) => {
  const supabase = await createServerSupabaseClient();
  const supabaseAdmin = await createServerSupabaseAdmin();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Não autorizado");

  const { data: profile } = await supabase.from("users").select("*").eq("id", user.id).single();

  if (!profile) throw new Error("Usuário não encontrado");

  return next({ ctx: { supabase, supabaseAdmin, user, profile } });
});
