import { isStaff } from "@/lib/access-control";
import { type BillingPeriod, getPeriodRange } from "@/lib/billing/period-range";
import { getServerAuth } from "@/lib/server-auth";
import BillingDashboardEnterpriseScreen from "@/screens/billing-dashboard-enterprise-screen";
import BillingDashboardScreen from "@/screens/billing-dashboard-screen";
import { getEnterpriseBillings, getBillings, getDashboardMetrics } from "@/services/billing";

export default async function BillingDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;

  const activePeriod = period as BillingPeriod | undefined;
  const dateRange = activePeriod ? getPeriodRange(activePeriod) : undefined;

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
        activePeriod={activePeriod ?? null}
      />
    );
  }

  const [{ billings }, { metrics }] = await Promise.all([
    getBillings(dateRange?.startDate, dateRange?.endDate),
    getDashboardMetrics(dateRange?.startDate, dateRange?.endDate),
  ]);

  return (
    <BillingDashboardScreen
      billings={billings}
      metrics={metrics}
      activePeriod={activePeriod ?? null}
    />
  );
}
