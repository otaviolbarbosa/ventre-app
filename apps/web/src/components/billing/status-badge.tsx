import { getStatusConfig } from "@/lib/billing/calculations";
import type { Database } from "@ventre/supabase/types";
import { Badge } from "@ventre/ui/badge";

type BillingStatus = Database["public"]["Enums"]["billing_status"];
type InstallmentStatus = Database["public"]["Enums"]["installment_status"];

export function StatusBadge({ status }: { status: BillingStatus | InstallmentStatus }) {
  const config = getStatusConfig(status);
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
