import { isStaff } from "@/lib/access-control";
import { getServerAuth, getServerUserEnterprises } from "@/lib/server-auth";
import { HomeScreen } from "@/screens";
import HomeEnterpriseScreen from "@/screens/home-enterprise-screen";
import type { Tables } from "@ventre/supabase";

type Profile = Tables<"users">;

export default async function Home() {
  const { profile } = await getServerAuth();

  if (isStaff(profile)) {
    return <HomeEnterpriseScreen profile={profile as Profile} />;
  }

  const enterprises = await getServerUserEnterprises();
  return <HomeScreen profile={profile as Profile} enterprises={enterprises} />;
}
