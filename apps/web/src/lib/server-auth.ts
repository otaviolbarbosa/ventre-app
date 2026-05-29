import { createServerSupabaseAdmin, createServerSupabaseClient } from "@ventre/supabase/server";
import type { Tables } from "@ventre/supabase/types";
import { cache } from "react";

export type UserEnterprise = { id: string; name: string };

export type UserProfile = Tables<"users"> & { enterprise_id: string | null };

const _getBaseAuth = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user: user ?? null };
});

export const getServerUser = _getBaseAuth;

export async function getServerUserEnterprises(): Promise<UserEnterprise[]> {
  const { user } = await _getBaseAuth();
  if (!user) return [];

  const supabaseAdmin = await createServerSupabaseAdmin();
  const { data } = await supabaseAdmin
    .from("user_enterprises")
    .select("enterprises!inner(id, name)")
    .eq("user_id", user.id);

  return (data ?? [])
    .map((ue) => {
      const ent = Array.isArray(ue.enterprises) ? ue.enterprises[0] : ue.enterprises;
      return { id: ent?.id ?? "", name: ent?.name ?? "" };
    })
    .filter((e) => e.id);
}

export const getServerAuth = cache(async () => {
  const { supabase, user } = await _getBaseAuth();

  if (!user) return { supabase, user: null, profile: null as UserProfile | null };

  const { data: profileData } = await supabase.from("users").select("*").eq("id", user.id).single();

  const supabaseAdmin = await createServerSupabaseAdmin();
  const { data: ueRow } = await supabaseAdmin
    .from("user_enterprises")
    .select("enterprise_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const profile: UserProfile = {
    ...(profileData ?? ({} as Tables<"users">)),
    enterprise_id: ueRow?.enterprise_id ?? null,
  };

  return { supabase, user, profile: profileData ? profile : null };
});
