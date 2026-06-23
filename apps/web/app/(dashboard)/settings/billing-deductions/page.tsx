import { isManager } from "@/lib/access-control";
import { getServerAuth } from "@/lib/server-auth";
import { BillingDeductionsScreen } from "@/screens";
import { getEnterpriseBillingFees } from "@/services/enterprise-billing-fees";
import { redirect } from "next/navigation";

export default async function BillingDeductionsPage() {
  const { profile } = await getServerAuth();

  if (!isManager(profile)) {
    redirect("/home?error=acesso-negado");
  }

  const fees = await getEnterpriseBillingFees();

  return <BillingDeductionsScreen fees={fees} />;
}
