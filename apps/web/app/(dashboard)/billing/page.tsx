import { isStaff } from "@/lib/access-control";
import { getMonthRange } from "@/lib/billing/period-range";
import { dayjs } from "@/lib/dayjs";
import { getServerAuth } from "@/lib/server-auth";
import BillingDashboardEnterpriseScreen from "@/screens/billing-dashboard-enterprise-screen";
import BillingDashboardScreen from "@/screens/billing-dashboard-screen";
import { getBillings, getDashboardMetrics, getEnterpriseBillings } from "@/services/billing";

export default async function BillingDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; month?: string; view?: string }>;
}) {
  const { month } = await searchParams;

  const activeMonth = month ?? dayjs().format("YYYY-MM");

  const dateRange = getMonthRange(activeMonth);

  const { profile } = await getServerAuth();

  if (isStaff(profile) && profile?.enterprise_id) {
    const { billings, metrics, professionals } = await getEnterpriseBillings(
      profile.enterprise_id,
      dateRange?.startDate,
      dateRange?.endDate,
    );

    return (
      <BillingDashboardEnterpriseScreen
        initialBillings={billings}
        initialMetrics={metrics}
        initialProfessionals={professionals}
        activeMonth={activeMonth}
      />
    );
  }

  const [{ billings }, { metrics }] = await Promise.all([
    getBillings(dateRange?.startDate, dateRange?.endDate),
    getDashboardMetrics(dateRange?.startDate, dateRange?.endDate),
  ]);

  return <BillingDashboardScreen billings={billings} metrics={metrics} activeMonth={activeMonth} />;
}
