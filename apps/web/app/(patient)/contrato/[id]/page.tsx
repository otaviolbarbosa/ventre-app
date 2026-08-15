import ContractDetail from "@/components/patient-area/contract-detail";
import { getMyContractById } from "@/services/patient-self";
import { notFound } from "next/navigation";

export default async function PatientContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { contract, changeRequests } = await getMyContractById(id);

  if (!contract) notFound();

  return (
    <div className="space-y-4 px-4 py-6">
      <h1 className="font-bold text-2xl text-[#433831]">{contract.title}</h1>
      <ContractDetail contract={contract} changeRequests={changeRequests} />
    </div>
  );
}
