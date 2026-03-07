import OnboardingScreen from "@/screens/onboarding-screen";
import { getProfile } from "@/services";
import { redirect } from "next/navigation";

export default async function Onboarding() {
  const { profile } = await getProfile();

  const isComplete =
    (profile?.user_type === "professional" && profile?.professional_type !== null) ||
    ((profile?.user_type === "manager" || profile?.user_type === "secretary") &&
      profile?.enterprise_id !== null);

  if (isComplete) {
    redirect("/home");
  }

  return <OnboardingScreen />;
}
