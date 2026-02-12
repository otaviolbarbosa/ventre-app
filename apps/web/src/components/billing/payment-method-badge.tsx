import { Badge } from "@/components/ui/badge";
import { getPaymentMethodLabel } from "@/lib/billing/calculations";
import type { Database } from "@nascere/supabase/types";

type PaymentMethod = Database["public"]["Enums"]["payment_method"];

export function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  return <Badge variant="outline">{getPaymentMethodLabel(method)}</Badge>;
}
