import ContractDetail from "@/components/patient-area/contract-detail";
import { getMyContractById } from "@/services/patient-self";
import { redirect } from "next/navigation";

export default async function PatientContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { contract, changeRequests } = await getMyContractById(id);

  // Not found or revoked (getMyContractById already filters is_active) — same
  // treatment either way, since a revoked contract is no longer a valid document.
  if (!contract) redirect("/home?contractError=1");

  return (
    <div className="flex h-full flex-col gap-4 px-4 py-6">
      <h1 className="shrink-0 font-bold text-2xl text-[#433831]">{contract.title}</h1>
      <ContractDetail contract={contract} changeRequests={changeRequests} />
    </div>
  );
}
