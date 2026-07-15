import { getServerAuth } from "@/lib/server-auth";
import { PersonalContractSettingsScreen } from "@/screens";
import { getPersonalBaseContracts, getPersonalContractHeaderData } from "@/services/base-contract";
import { redirect } from "next/navigation";

export default async function PersonalContractPage() {
  const { user } = await getServerAuth();

  if (!user) {
    redirect("/login");
  }

  const [contracts, headerData] = await Promise.all([
    getPersonalBaseContracts(),
    getPersonalContractHeaderData(),
  ]);

  return <PersonalContractSettingsScreen contracts={contracts} headerData={headerData} />;
}
