import { isStaff } from "@/lib/access-control";
import { getServerAuth } from "@/lib/server-auth";
import { HomeScreen } from "@/screens";
import HomeEnterpriseScreen from "@/screens/home-enterprise-screen";
import type { Tables } from "@nascere/supabase";
import { redirect } from "next/navigation";

type Profile = Tables<"users">;

export default async function Home() {
  const { profile } = await getServerAuth();

  const isOnboardingComplete =
    (profile?.user_type === "professional" && profile?.professional_type !== null) ||
    (isStaff(profile) && profile?.enterprise_id !== null);

  if (!isOnboardingComplete) {
    redirect("/onboarding");
  }

  if (isStaff(profile)) {
    return <HomeEnterpriseScreen profile={profile as Profile} />;
  }

  return <HomeScreen profile={profile as Profile} />;
}
