import { dayjs } from "@/lib/dayjs";
import type { Database } from "@nascere/supabase/types";

type BillingStatus = Database["public"]["Enums"]["billing_status"];
type InstallmentStatus = Database["public"]["Enums"]["installment_status"];
type PaymentMethod = Database["public"]["Enums"]["payment_method"];

export function calculateInstallmentAmount(totalAmount: number, count: number): number[] {
  const base = Math.floor(totalAmount / count);
  const remainder = totalAmount - base * count;
  return Array.from({ length: count }, (_, i) => (i === 0 ? base + remainder : base));
}

export function calculateInstallmentDates(
  firstDueDate: string,
  count: number,
  intervalMonths: number,
): string[] {
  return Array.from({ length: count }, (_, i) =>
    dayjs(firstDueDate)
      .add(i * intervalMonths, "month")
      .format("YYYY-MM-DD"),
  );
}

export function calculateBillingStatus(
  installments: { status: InstallmentStatus }[],
): BillingStatus {
  if (installments.length === 0) return "pendente";
  if (installments.every((i) => i.status === "pago")) return "pago";
  if (installments.every((i) => i.status === "cancelado")) return "cancelado";
  if (installments.some((i) => i.status === "atrasado")) return "atrasado";
  return "pendente";
}

export function formatCurrency(amountInCents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amountInCents / 100);
}

export function parseCurrencyToCents(value: string): number {
  const cleaned = value
    .replace(/R\$\s?/, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Math.round(Number.parseFloat(cleaned) * 100);
}

const paymentMethodLabels: Record<PaymentMethod, string> = {
  credito: "Crédito",
  debito: "Débito",
  pix: "PIX",
  boleto: "Boleto",
  dinheiro: "Dinheiro",
  outro: "Outro",
};

export function getPaymentMethodLabel(method: PaymentMethod): string {
  return paymentMethodLabels[method];
}

type StatusConfig = {
  label: string;
  variant: "default" | "success" | "warning" | "destructive" | "secondary";
};

const statusConfigs: Record<BillingStatus, StatusConfig> = {
  pendente: { label: "Pendente", variant: "warning" },
  pago: { label: "Pago", variant: "success" },
  atrasado: { label: "Atrasado", variant: "destructive" },
  cancelado: { label: "Cancelado", variant: "secondary" },
};

export function getStatusConfig(status: BillingStatus | InstallmentStatus): StatusConfig {
  return statusConfigs[status] || statusConfigs.pendente;
}
