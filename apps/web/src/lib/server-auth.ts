import { createServerSupabaseClient } from "@ventre/supabase/server";
import type { Tables } from "@ventre/supabase/types";
import { cache } from "react";

export type UserProfile = Tables<"users">;

/**
 * Memoized per request via React.cache().
 * Returns the Supabase client + authenticated user.
 * Calling this multiple times in the same request executes only once.
 */
const _getBaseAuth = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user: user ?? null };
});

/**
 * Returns the current authenticated user and the Supabase client.
 * Does NOT fetch the profile row from the DB.
 * Returns `user: null` when unauthenticated.
 */
export const getServerUser = _getBaseAuth;

/**
 * Returns the current user, their full profile row, and the Supabase client.
 * Memoized per request — safe to call multiple times in the same render.
 * Returns `user: null, profile: null` when unauthenticated.
 */
export const getServerAuth = cache(async () => {
  const { supabase, user } = await _getBaseAuth();

  if (!user) return { supabase, user: null, profile: null as UserProfile | null };

  const { data: profile } = await supabase.from("users").select("*").eq("id", user.id).single();

  return { supabase, user, profile: profile ?? null };
});
