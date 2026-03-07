import type { createServerSupabaseClient } from "@nascere/supabase/server";
import type { Tables } from "@nascere/supabase/types";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type ProfessionalType = NonNullable<Tables<"users">["professional_type"]>;
type UserType = NonNullable<Tables<"users">["user_type"]>;

export async function setProfessionalType(
  supabase: SupabaseClient,
  userId: string,
  type: ProfessionalType,
) {
  const { error } = await supabase
    .from("users")
    .update({ professional_type: type })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function setUserType(supabase: SupabaseClient, userId: string, type: UserType) {
  const { error } = await supabase.from("users").update({ user_type: type }).eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }
}
