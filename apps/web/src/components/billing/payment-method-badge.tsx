import { Badge } from "@ventre/ui/badge";
import { getPaymentMethodLabel } from "@/lib/billing/calculations";
import type { Database } from "@ventre/supabase/types";

type PaymentMethod = Database["public"]["Enums"]["payment_method"];

export function PaymentMethodBadge({ method }: { method?: PaymentMethod | null }) {
  return method ? <Badge variant="outline">{getPaymentMethodLabel(method)}</Badge> : null;
}
