import { createServerSupabaseClient } from "@nascere/supabase/server";
import type { Tables } from "@nascere/supabase/types";
import type { User } from "@supabase/supabase-js";

type Profile = Tables<"users">;

type GetProfileResult = {
  profile: Profile | null;
  error?: string;
};

type GetCurrentUserResult = {
  user: User | null;
  error?: string;
};

type GetAuthDataResult = {
  user: User | null;
  profile: Profile | null;
  error?: string;
};

export async function getCurrentUser(): Promise<GetCurrentUserResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return { user: null, error: error.message };
  }

  return { user };
}

export async function getProfile(): Promise<GetProfileResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { profile: null, error: "Usuário não autenticado" };
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    return { profile: null, error: error.message };
  }

  return { profile };
}

export async function getAuthData(): Promise<GetAuthDataResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null, error: "Usuário não autenticado" };
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    return { user, profile: null, error: error.message };
  }

  return { user, profile };
}
