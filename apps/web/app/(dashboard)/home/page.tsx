import { HomeScreen } from "@/screens";
import { getHomeData, getProfile } from "@/services";
import type { Tables } from "@nascere/supabase";
import { redirect } from "next/navigation";

type Profile = Tables<"users">;

export const revalidate = 300;

export default async function Home() {
  const [{ profile }, homeData] = await Promise.all([getProfile(), getHomeData()]);

  const isOnboardingComplete =
    (profile?.user_type === "professional" && profile?.professional_type !== null) ||
    ((profile?.user_type === "manager" || profile?.user_type === "secretary") &&
      profile?.enterprise_id !== null);

  if (!isOnboardingComplete) {
    redirect("/onboarding");
  }

  return <HomeScreen profile={profile as Profile} homeData={homeData} />;
}
