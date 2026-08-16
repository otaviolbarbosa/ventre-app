import { Header } from "@/components/layouts/header";
import BillingSummary from "@/components/patient-area/billing-summary";
import { getMyBillingSummary } from "@/services/patient-self";

export default async function PatientFinanceiroPage() {
  const { billings } = await getMyBillingSummary();

  return (
    <div>
      <Header title="Financeiro" />
      <div className="space-y-4 px-4">
        <BillingSummary billings={billings} />
      </div>
    </div>
  );
}
