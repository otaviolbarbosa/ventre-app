import { createServerSupabaseClient } from "@nascere/supabase/server";

export async function getUserById(userId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: user, error } = await supabase.from("users").select().eq("id", userId).single();

  if (error) {
    throw new Error(error.message);
  }

  return user;
}
