import { HomeScreen } from "@/screens";
import { getHomeData, getProfile } from "@/services";
import type { Tables } from "@nascere/supabase";

type Profile = Tables<"users">;

export default async function Home() {
  const [{ profile }, homeData] = await Promise.all([getProfile(), getHomeData()]);

  return <HomeScreen profile={profile as Profile} homeData={homeData} />;
}
