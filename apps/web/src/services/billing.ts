import { createServerSupabaseClient } from "@nascere/supabase/server";
import type { Tables } from "@nascere/supabase/types";

type Billing = Tables<"billings">;
type Installment = Tables<"installments">;
type Payment = Tables<"payments">;
type Patient = Tables<"patients">;

export type BillingWithInstallments = Billing & {
  installments: Installment[];
  patient: Pick<Patient, "id" | "name">;
};

export type BillingDetail = Billing & {
  installments: (Installment & { payments: Payment[] })[];
  patient: Pick<Patient, "id" | "name">;
};

export type DashboardMetrics = {
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  overdue_amount: number;
  total_billings: number;
  by_status: Record<string, number>;
  by_payment_method: Record<string, number>;
  upcoming_due: Installment[];
};

export async function getPatientBillings(patientId: string) {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("billings")
    .select(`
      *,
      installments(*),
      patient:patients!billings_patient_id_fkey(id, name)
    `)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) return { billings: [], error: error.message };
  return { billings: (data as BillingWithInstallments[]) || [] };
}

export async function getBillingById(billingId: string) {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("billings")
    .select(`
      *,
      installments(*, payments(*)),
      patient:patients!billings_patient_id_fkey(id, name)
    `)
    .eq("id", billingId)
    .single();

  if (error) return { billing: null, error: error.message };
  return { billing: data as BillingDetail };
}

export async function getAllBillings() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { billings: [], error: "Não autorizado" };

  const { data, error } = await supabase
    .from("billings")
    .select(`
      *,
      installments(*),
      patient:patients!billings_patient_id_fkey(id, name)
    `)
    .eq("professional_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { billings: [], error: error.message };
  return { billings: (data as BillingWithInstallments[]) || [] };
}

export async function getDashboardMetrics(startDate?: string, endDate?: string) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { metrics: null, error: "Não autorizado" };

  let query = supabase
    .from("billings")
    .select(`
      *,
      installments(*)
    `)
    .eq("professional_id", user.id);

  if (startDate) {
    query = query.gte("created_at", startDate);
  }
  if (endDate) {
    query = query.lte("created_at", endDate);
  }

  const { data: billings, error } = await query;

  if (error) return { metrics: null, error: error.message };

  type BillingRow = Billing & { installments: Installment[] };
  const typedBillings = (billings as BillingRow[]) || [];

  const metrics: DashboardMetrics = {
    total_amount: 0,
    paid_amount: 0,
    pending_amount: 0,
    overdue_amount: 0,
    total_billings: typedBillings.length,
    by_status: {},
    by_payment_method: {},
    upcoming_due: [],
  };

  const today = new Date().toISOString().split("T")[0] as string;
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0] as string;

  for (const billing of typedBillings) {
    metrics.total_amount += billing.total_amount;
    metrics.paid_amount += billing.paid_amount;

    metrics.by_status[billing.status] =
      (metrics.by_status[billing.status] || 0) + 1;
    metrics.by_payment_method[billing.payment_method] =
      (metrics.by_payment_method[billing.payment_method] || 0) + 1;

    for (const inst of billing.installments) {
      if (inst.status === "atrasado") {
        metrics.overdue_amount += inst.amount - inst.paid_amount;
      }
      if (
        inst.status === "pendente" &&
        inst.due_date >= today &&
        inst.due_date <= nextWeek
      ) {
        metrics.upcoming_due.push(inst);
      }
    }
  }

  metrics.pending_amount = metrics.total_amount - metrics.paid_amount;

  return { metrics };
}
