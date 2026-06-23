import { isManager } from "@/lib/access-control";
import { getServerAuth } from "@/lib/server-auth";
import { EnterpriseSettingsScreen } from "@/screens";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const { profile } = await getServerAuth();

  if (!isManager(profile)) {
    redirect("/home?error=acesso-negado");
  }

  return <EnterpriseSettingsScreen />;
}
