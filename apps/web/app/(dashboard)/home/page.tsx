import { HomeScreen } from "@/screens";
import HomeEnterpriseScreen from "@/screens/home-enterprise-screen";
import { getHomeData, getProfile } from "@/services";
import { getHomeEnterpriseData } from "@/services/home-enterprise";
import type { Tables } from "@nascere/supabase";
import { redirect } from "next/navigation";

type Profile = Tables<"users">;

export const revalidate = 300;

export default async function Home() {
  const { profile } = await getProfile();

  const isOnboardingComplete =
    (profile?.user_type === "professional" && profile?.professional_type !== null) ||
    ((profile?.user_type === "manager" || profile?.user_type === "secretary") &&
      profile?.enterprise_id !== null);

  if (!isOnboardingComplete) {
    redirect("/onboarding");
  }

  const isEnterprise =
    profile?.user_type === "manager" || profile?.user_type === "secretary";

  if (isEnterprise) {
    const homeData = await getHomeEnterpriseData();
    return <HomeEnterpriseScreen profile={profile as Profile} homeData={homeData} />;
  }

  const homeData = await getHomeData();
  return <HomeScreen profile={profile as Profile} homeData={homeData} />;
}
