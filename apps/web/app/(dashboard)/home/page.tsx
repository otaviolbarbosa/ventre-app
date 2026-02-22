import { HomeScreen } from "@/screens";
import { getHomeData, getProfile } from "@/services";
import type { Tables } from "@nascere/supabase";
import { redirect } from "next/navigation";

type Profile = Tables<"users">;

export default async function Home() {
  const [{ profile }, homeData] = await Promise.all([getProfile(), getHomeData()]);

  console.log(profile?.professional_type);
  if (!profile?.professional_type) {
    redirect("/select-type");
  }

  return <HomeScreen profile={profile as Profile} homeData={homeData} />;
}
