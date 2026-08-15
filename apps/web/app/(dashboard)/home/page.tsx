import { isStaff } from "@/lib/access-control";
import { getServerAuth, getServerUserEnterprises } from "@/lib/server-auth";
import { HomeScreen, PatientHomeScreen } from "@/screens";
import HomeEnterpriseScreen from "@/screens/home-enterprise-screen";
import {
  getMyContractChangeRequests,
  getMyContracts,
  getMyPregnancy,
} from "@/services/patient-self";
import type { Tables } from "@ventre/supabase";
import { redirect } from "next/navigation";

type Profile = Tables<"users">;

export default async function Home() {
  const { profile } = await getServerAuth();

  if (profile?.user_type === "patient") {
    const [{ patient, pregnancy, error }, { contracts }, { changeRequests }] = await Promise.all([
      getMyPregnancy(),
      getMyContracts(),
      getMyContractChangeRequests(),
    ]);
    return (
      <PatientHomeScreen
        name={profile?.name ?? patient?.name}
        pregnancy={pregnancy}
        contracts={contracts}
        changeRequests={changeRequests}
        error={error}
      />
    );
  }

  const isOnboardingComplete =
    (profile?.user_type === "professional" && profile?.professional_type !== null) ||
    (isStaff(profile) && profile?.enterprise_id !== null);

  if (!isOnboardingComplete) {
    redirect("/onboarding");
  }

  if (isStaff(profile)) {
    return <HomeEnterpriseScreen profile={profile as Profile} />;
  }

  const enterprises = await getServerUserEnterprises();
  return <HomeScreen profile={profile as Profile} enterprises={enterprises} />;
}
