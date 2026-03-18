import { isStaff } from "@/lib/access-control";
import { getServerAuth } from "@/lib/server-auth";
import OnboardingScreen from "@/screens/onboarding-screen";
import { redirect } from "next/navigation";

export default async function Onboarding() {
  const { profile } = await getServerAuth();

  const isComplete =
    (profile?.user_type === "professional" && profile?.professional_type !== null) ||
    (isStaff(profile) && profile?.enterprise_id !== null);

  if (isComplete) {
    redirect("/home");
  }

  return <OnboardingScreen />;
}
