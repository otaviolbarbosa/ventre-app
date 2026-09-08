import { getStatusConfig } from "@/lib/billing/calculations";
import type { Database } from "@ventre/supabase/types";
import { Badge } from "@ventre/ui/badge";

type BillingStatus = Database["public"]["Enums"]["billing_status"];
type InstallmentStatus = Database["public"]["Enums"]["installment_status"];

export function StatusBadge({
  status,
  amount,
  isPatient,
}: { status: BillingStatus | InstallmentStatus; amount?: number; isPatient?: boolean }) {
  const config = getStatusConfig(status, isPatient);
  return (
    <Badge variant={config.variant}>
      {config.label}
      {amount ? ` (${amount})` : ""}
    </Badge>
  );
}
