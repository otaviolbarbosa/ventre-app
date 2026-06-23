import { dayjs } from "@/lib/dayjs";
import type { Database, Tables } from "@ventre/supabase/types";

type BillingStatus = Database["public"]["Enums"]["billing_status"];
type InstallmentStatus = Database["public"]["Enums"]["installment_status"];
type PaymentMethod = Database["public"]["Enums"]["payment_method"];

export type SplittedBilling = Record<string, number>;

export interface AppliedBillingFee {
  professional_id: string;
  fee_id: string;
  name: string;
  fee_type: "fixed" | "percentage";
  value: number;
  base_amount_cents: number;
  computed_amount_cents: number;
}

export function applyBillingFeesToSplit(
  splittedBilling: SplittedBilling,
  fees: Tables<"enterprise_billing_fees">[],
): AppliedBillingFee[] {
  const activeFees = fees.filter((fee) => fee.is_active);
  const appliedFees: AppliedBillingFee[] = [];

  for (const [professionalId, baseAmountCents] of Object.entries(splittedBilling)) {
    for (const fee of activeFees) {
      const rawAmount =
        fee.fee_type === "fixed" ? fee.value : Math.round(baseAmountCents * (fee.value / 100));
      const computedAmountCents = Math.min(Math.round(rawAmount), baseAmountCents);

      appliedFees.push({
        professional_id: professionalId,
        fee_id: fee.id,
        name: fee.name,
        fee_type: fee.fee_type,
        value: fee.value,
        base_amount_cents: baseAmountCents,
        computed_amount_cents: computedAmountCents,
      });
    }
  }

  return appliedFees;
}

export interface AppliedFeeLineItem {
  fee_id: string;
  name: string;
  fee_type: "fixed" | "percentage";
  value: number;
  amountCents: number;
}

export interface NetAmountResult {
  netAmountCents: number;
  totalFeesCents: number;
  feeLineItems: AppliedFeeLineItem[];
}

export function computeNetAmountCents(
  grossAmountCents: number,
  appliedFees: AppliedBillingFee[],
  professionalId: string,
): NetAmountResult {
  const professionalFees = appliedFees.filter((fee) => fee.professional_id === professionalId);

  if (professionalFees.length === 0) {
    return { netAmountCents: grossAmountCents, totalFeesCents: 0, feeLineItems: [] };
  }

  const baseAmountCents = professionalFees[0]?.base_amount_cents ?? grossAmountCents;
  const ratio = baseAmountCents === 0 ? 0 : grossAmountCents / baseAmountCents;
  const isBillingLevel = baseAmountCents === grossAmountCents;

  const feeLineItems: AppliedFeeLineItem[] = professionalFees.map((fee) => ({
    fee_id: fee.fee_id,
    name: fee.name,
    fee_type: fee.fee_type,
    value: fee.value,
    amountCents: isBillingLevel
      ? fee.computed_amount_cents
      : Math.round(fee.computed_amount_cents * ratio),
  }));

  const totalFeesCents = feeLineItems.reduce((sum, item) => sum + item.amountCents, 0);

  return {
    netAmountCents: grossAmountCents - totalFeesCents,
    totalFeesCents,
    feeLineItems,
  };
}

export function calculateInstallmentAmount(totalAmount: number, count: number): number[] {
  const base = Math.floor(totalAmount / count);
  const remainder = totalAmount - base * count;
  return Array.from({ length: count }, (_, i) => (i === 0 ? base + remainder : base));
}

export function recalculateInstallmentAmounts(
  totalAmount: number,
  count: number,
  locked: Record<number, number>,
): number[] {
  const lockedTotal = Object.values(locked).reduce((a, b) => a + b, 0);
  const remaining = totalAmount - lockedTotal;
  const unlockedIndices = Array.from({ length: count }, (_, i) => i).filter((i) => !(i in locked));
  const unlockedCount = unlockedIndices.length;

  const result = Array.from({ length: count }, (_, i) => locked[i] ?? 0);

  if (unlockedCount === 0) return result;

  const base = Math.floor(remaining / unlockedCount);
  const remainder = remaining - base * unlockedCount;

  for (let j = 0; j < unlockedIndices.length; j++) {
    const idx = unlockedIndices[j] as number;
    result[idx] = base + (j === 0 ? remainder : 0);
  }

  return result;
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
