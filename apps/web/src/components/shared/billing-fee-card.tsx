import { formatCurrency } from "@/lib/billing/calculations";
import type { Tables } from "@ventre/supabase/types";
import { Badge } from "@ventre/ui/badge";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import { Pencil, Power } from "lucide-react";

const FEE_TYPE_LABELS: Record<string, string> = {
  fixed: "Fixo",
  percentage: "Percentual",
};

type BillingFeeCardProps = {
  fee: Tables<"enterprise_billing_fees">;
  onEdit: () => void;
  onToggleActive: () => void;
};

export function BillingFeeCard({ fee, onEdit, onToggleActive }: BillingFeeCardProps) {
  const formattedValue = fee.fee_type === "fixed" ? formatCurrency(fee.value) : `${fee.value}%`;

  return (
    <Card className={fee.is_active ? "" : "opacity-60"}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{fee.name}</p>
            <p className="font-semibold text-lg">{formattedValue}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant="outline">{FEE_TYPE_LABELS[fee.fee_type] ?? fee.fee_type}</Badge>
            <Badge variant={fee.is_active ? "outline" : "secondary"}>
              {fee.is_active ? "Ativa" : "Inativa"}
            </Badge>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="size-4" />
            Editar
          </Button>
          <Button
            variant={fee.is_active ? "destructive" : "outline"}
            size="sm"
            onClick={onToggleActive}
          >
            <Power className="size-4" />
            {fee.is_active ? "Desativar" : "Ativar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
