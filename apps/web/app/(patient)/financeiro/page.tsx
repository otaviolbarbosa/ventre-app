import BillingSummary from "@/components/patient-area/billing-summary";
import { getMyBillingSummary } from "@/services/patient-self";

export default async function PatientFinanceiroPage() {
  const { billings } = await getMyBillingSummary();

  return (
    <div className="space-y-4">
      <h1 className="font-bold text-2xl text-[#433831]">Financeiro</h1>
      <BillingSummary billings={billings} />
    </div>
  );
}
