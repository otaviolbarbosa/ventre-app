import { isManager } from "@/lib/access-control";
import { getServerAuth } from "@/lib/server-auth";
import { ContractSettingsScreen } from "@/screens";
import { getBaseContract, getContractHeaderData } from "@/services/base-contract";
import { redirect } from "next/navigation";

export default async function ContractPage() {
  const { profile } = await getServerAuth();

  if (!isManager(profile)) {
    redirect("/home?error=acesso-negado");
  }

  const [initialContract, headerData] = await Promise.all([getBaseContract(), getContractHeaderData()]);

  return <ContractSettingsScreen initialContract={initialContract} headerData={headerData} />;
}
