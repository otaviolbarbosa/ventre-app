import { HomeScreen } from "@/screens";
import { getProfile } from "@/services";
import type { Tables } from "@nascere/supabase";

type Profile = Tables<"users">;

export default async function Home() {
  const { profile } = await getProfile();

  return <HomeScreen profile={profile as Profile} />;
}
