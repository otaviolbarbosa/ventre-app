import { getServerAuth } from "@/lib/server-auth";
import { PersonalContractSettingsScreen } from "@/screens";
import { getPersonalBaseContract, getPersonalContractHeaderData } from "@/services/base-contract";
import { redirect } from "next/navigation";

export default async function PersonalContractPage() {
  const { user } = await getServerAuth();

  if (!user) {
    redirect("/login");
  }

  const [initialContract, headerData] = await Promise.all([
    getPersonalBaseContract(),
    getPersonalContractHeaderData(),
  ]);

  return <PersonalContractSettingsScreen initialContract={initialContract} headerData={headerData} />;
}
