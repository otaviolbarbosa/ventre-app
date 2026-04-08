import { createServerSupabaseAdmin, createServerSupabaseClient } from "@ventre/supabase/server";
import { createSafeActionClient } from "next-safe-action";

export const actionClient = createSafeActionClient();

export const adminActionClient = actionClient.use(async ({ next }) => {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Não autorizado");

  const { data: profile } = await supabase
    .from("users")
    .select("user_type")
    .eq("id", user.id)
    .single();

  if (!profile || profile.user_type !== "admin") {
    throw new Error("Acesso restrito a administradores");
  }

  const supabaseAdmin = await createServerSupabaseAdmin();

  return next({ ctx: { supabase, supabaseAdmin, user } });
});
