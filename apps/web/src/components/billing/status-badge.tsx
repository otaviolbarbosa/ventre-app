import { Badge } from "@/components/ui/badge";
import { getStatusConfig } from "@/lib/billing/calculations";
import type { Database } from "@nascere/supabase/types";

type BillingStatus = Database["public"]["Enums"]["billing_status"];
type InstallmentStatus = Database["public"]["Enums"]["installment_status"];

export function StatusBadge({ status }: { status: BillingStatus | InstallmentStatus }) {
  const config = getStatusConfig(status);
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
