import { createServerSupabaseAdmin, createServerSupabaseClient } from "@ventre/supabase/server";
import type { Tables } from "@ventre/supabase/types";
import { createSafeActionClient } from "next-safe-action";

export type ProfileWithEnterprise = Tables<"users"> & { enterprise_id: string | null };

export const actionClient = createSafeActionClient();

export const authActionClient = actionClient.use(async ({ next }) => {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Não autorizado");

  const { data: profileData } = await supabase.from("users").select("*").eq("id", user.id).single();

  if (!profileData) throw new Error("Usuário não encontrado");

  const supabaseAdmin = await createServerSupabaseAdmin();

  const { data: ueRow } = await supabaseAdmin
    .from("user_enterprises")
    .select("enterprise_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const profile: ProfileWithEnterprise = {
    ...profileData,
    enterprise_id: ueRow?.enterprise_id ?? null,
  };

  return next({ ctx: { supabase, supabaseAdmin, user, profile } });
});
