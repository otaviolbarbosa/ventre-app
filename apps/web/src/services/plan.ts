import { createServerSupabaseClient } from "@nascere/supabase/server";

export async function getPlanById(planId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: plan, error } = await supabase.from("plans").select().eq("id", planId).single();

  if (error) {
    throw new Error(error.message);
  }

  return plan;
}
