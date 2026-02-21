"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/billing/calculations";
import { dayjs } from "@/lib/dayjs";
import type { Tables } from "@nascere/supabase/types";
import { Check, ExternalLink, FileText, Image, LinkIcon, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "./status-badge";

type Payment = Tables<"payments"> & { receipt_url?: string | null };
type Installment = Tables<"installments"> & { payments: Payment[] };

type InstallmentListProps = {
  billingId: string;
  installments: Installment[];
  onRecordPayment: (installment: Installment) => void;
  onUpdate: () => void;
};

export function InstallmentList({
  billingId,
  installments,
  onRecordPayment,
  onUpdate,
}: InstallmentListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [linkValue, setLinkValue] = useState("");
  const [saving, setSaving] = useState(false);

  const handleEditLink = (installment: Installment) => {
    setEditingId(installment.id);
    setLinkValue(installment.payment_link || "");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setLinkValue("");
  };

  const handleSaveLink = async (installmentId: string) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/billing/${billingId}/installments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installment_id: installmentId,
          payment_link: linkValue.trim(),
        }),
      });

      if (!response.ok) throw new Error();

      toast.success("Link de pagamento salvo!");
      setEditingId(null);
      setLinkValue("");
      onUpdate();
    } catch {
      toast.error("Erro ao salvar link de pagamento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {installments
        .sort((a, b) => a.installment_number - b.installment_number)
        .map((installment) => (
          <div key={installment.id} className="flex flex-col gap-3 rounded-lg border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-medium text-sm">
                  {installment.installment_number}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatCurrency(installment.amount)}</span>
                    <StatusBadge status={installment.status} />
                  </div>
                  <div className="text-muted-foreground text-sm">
                    Vencimento: {dayjs(installment.due_date).format("DD/MM/YYYY")}
                    {installment.paid_amount > 0 && (
                      <span className="ml-2">
                        (Pago: {formatCurrency(installment.paid_amount)})
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {installment.status === "pago" &&
                  installment.payments
                    .filter((p) => p.receipt_url)
                    .map((p) => (
                      <Button key={p.id} variant="ghost" size="sm" asChild>
                        <a href={p.receipt_url as string} target="_blank" rel="noopener noreferrer">
                          {p.receipt_path?.endsWith(".pdf") ? (
                            <FileText className="mr-1 h-4 w-4 text-red-500" />
                          ) : (
                            <Image className="mr-1 h-4 w-4 text-blue-500" />
                          )}
                          Comprovante
                        </a>
                      </Button>
                    ))}
                {installment.status !== "pago" && installment.status !== "cancelado" && (
                  <>
                    {installment.payment_link && editingId !== installment.id && (
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={installment.payment_link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-1 h-4 w-4" />
                          Link
                        </a>
                      </Button>
                    )}
                    {!installment.payment_link ? (
                      <Button size="sm" variant="ghost" onClick={() => handleEditLink(installment)}>
                        <LinkIcon className="mr-1 h-4 w-4" />
                        Adicionar link
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRecordPayment(installment)}
                    >
                      Registrar Pagamento
                    </Button>
                  </>
                )}
              </div>
            </div>
            {editingId === installment.id && (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="https://..."
                  value={linkValue}
                  onChange={(e) => setLinkValue(e.target.value)}
                  className="flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveLink(installment.id);
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => handleSaveLink(installment.id)}
                >
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button size="icon" variant="ghost" disabled={saving} onClick={handleCancelEdit}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
