import {
  calculateInstallmentAmount,
  calculateInstallmentDates,
} from "@/lib/billing/calculations";
import { scheduleBillingNotifications } from "@/lib/billing/notifications";
import { getServerUser } from "@/lib/server-auth";
import type { CreateBillingInput } from "@/lib/validations/billing";
import {
  type createServerSupabaseAdmin,
  createServerSupabaseAdmin as createAdmin,
  createServerSupabaseClient,
} from "@ventre/supabase/server";
import type { Tables } from "@ventre/supabase/types";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type SupabaseAdminClient = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

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
  upcoming_due: number;
};

export type EnterpriseBillingProfessional = {
  id: string;
  name: string | null;
  professional_type: string | null;
  billing_count: number;
};

export async function getEnterpriseBillings(
  enterpriseId: string,
  startDate?: string,
  endDate?: string,
  professionalId?: string,
): Promise<{
  billings: BillingWithInstallments[];
  metrics: DashboardMetrics | null;
  professionals: EnterpriseBillingProfessional[];
}> {
  const supabase = await createServerSupabaseClient();
  const supabaseAdmin = await createAdmin();

  const { data: professionalsData } = await supabase
    .from("users")
    .select("id, name, professional_type")
    .eq("enterprise_id", enterpriseId)
    .eq("user_type", "professional");

  const professionals = professionalsData ?? [];
  const allIds = professionals.map((p) => p.id);
  const targetIds = professionalId ? [professionalId] : allIds;

  if (targetIds.length === 0) {
    return { billings: [], metrics: null, professionals: [] };
  }

  let query = supabaseAdmin
    .from("billings")
    .select(`
      *,
      installments(*),
      patient:patients!billings_patient_id_fkey(id, name)
    `)
    .or(targetIds.map((id) => `splitted_billing->>${id}.not.is.null`).join(","))
    .order("created_at", { ascending: false })
    .order("installment_number", { ascending: true, referencedTable: "installments" });

  if (startDate) query = query.gte("installments.due_date", startDate);
  if (endDate) query = query.lte("installments.due_date", endDate);

  const { data, error } = await query;
  if (error) return { billings: [], metrics: null, professionals: [] };

  const billings = (data as BillingWithInstallments[]) ?? [];

  const metrics: DashboardMetrics = {
    total_amount: 0,
    paid_amount: 0,
    pending_amount: 0,
    overdue_amount: 0,
    total_billings: billings.length,
    by_status: {},
    by_payment_method: {},
    upcoming_due: 0,
  };

  for (const billing of billings) {
    const splitted = billing.splitted_billing as Record<string, number> | null;
    const professionalTotal = targetIds.reduce((sum, id) => sum + (splitted?.[id] ?? 0), 0);

    metrics.total_amount += professionalTotal;
    metrics.paid_amount += billing.paid_amount;
    metrics.by_status[billing.status] = (metrics.by_status[billing.status] || 0) + 1;
    metrics.by_payment_method[billing.payment_method] =
      (metrics.by_payment_method[billing.payment_method] || 0) + 1;

    for (const inst of billing.installments) {
      if (inst.status === "atrasado") {
        metrics.overdue_amount += inst.amount - inst.paid_amount;
      }
      if (inst.status === "pendente") {
        metrics.upcoming_due += inst.amount - inst.paid_amount;
      }
    }
  }

  metrics.pending_amount = metrics.total_amount - metrics.paid_amount;

  const billingCountByProfessional: Record<string, number> = {};
  for (const billing of billings) {
    for (const professionalId of Object.keys(billing.splitted_billing ?? {})) {
      billingCountByProfessional[professionalId] =
        (billingCountByProfessional[professionalId] ?? 0) + 1;
    }
  }

  const professionalsWithCount: EnterpriseBillingProfessional[] = professionals.map((p) => ({
    id: p.id,
    name: p.name,
    professional_type: p.professional_type,
    billing_count: billingCountByProfessional[p.id] ?? 0,
  }));

  return { billings, metrics, professionals: professionalsWithCount };
}

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
  const { supabase, user } = await getServerUser();

  if (!user) return { billings: [], error: "Não autorizado" };

  const { data, error } = await supabase
    .from("billings")
    .select(`
      *,
      installments(*),
      patient:patients!billings_patient_id_fkey(id, name)
    `)
    .not(`splitted_billing->>${user.id}`, "is", null)
    .order("created_at", { ascending: false });

  if (error) return { billings: [], error: error.message };
  return { billings: (data as BillingWithInstallments[]) || [] };
}

export async function getBillings(startDate?: string, endDate?: string) {
  const { supabase, user } = await getServerUser();

  if (!user) return { billings: [], error: "Não autorizado" };

  let query = supabase
    .from("billings")
    .select(`
      *,
      installments(*),
      patient:patients!billings_patient_id_fkey(id, name)
    `)
    .not(`splitted_billing->>${user.id}`, "is", null)
    .order("created_at", { ascending: false })
    .order("installment_number", { ascending: true, referencedTable: "installments" });

  if (startDate) query = query.gte("installments.due_date", startDate);
  if (endDate) query = query.lte("installments.due_date", endDate);

  const { data, error } = await query;
  if (error) return { billings: [], error: error.message };
  return { billings: (data as BillingWithInstallments[]) || [] };
}

export async function getDashboardMetrics(startDate?: string, endDate?: string) {
  const { supabase, user } = await getServerUser();

  if (!user) return { metrics: null, error: "Não autorizado" };

  let query = supabase
    .from("billings")
    .select(`
      *,
      installments(*)
    `)
    .not(`splitted_billing->>${user.id}`, "is", null);

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
    upcoming_due: 0,
  };

  // const today = new Date().toISOString().split("T")[0] as string;
  // const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  //   .toISOString()
  //   .split("T")[0] as string;

  for (const billing of typedBillings) {
    metrics.total_amount += billing.total_amount;
    metrics.paid_amount += billing.paid_amount;

    metrics.by_status[billing.status] = (metrics.by_status[billing.status] || 0) + 1;
    metrics.by_payment_method[billing.payment_method] =
      (metrics.by_payment_method[billing.payment_method] || 0) + 1;

    for (const inst of billing.installments) {
      if (inst.status === "atrasado") {
        metrics.overdue_amount += inst.amount - inst.paid_amount;
      }
      if (inst.status === "pendente") {
        metrics.upcoming_due += inst.amount - inst.paid_amount;
      }
    }
  }

  metrics.pending_amount = metrics.total_amount - metrics.paid_amount;

  return { metrics };
}

export async function createBilling(
  supabase: SupabaseClient,
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  data: CreateBillingInput,
) {
  const {
    patient_id,
    description,
    payment_method,
    installment_count,
    installment_interval,
    first_due_date,
    installments_dates,
    payment_links,
    notes,
  } = data;

  const splittedBilling: Record<string, number> = data.splitted_billing
    ? data.splitted_billing
    : { [userId]: data.total_amount as number };

  const total_amount = Object.values(splittedBilling).reduce((a, b) => a + b, 0);

  const dates: string[] =
    installment_interval == null
      ? (installments_dates ?? [])
      : calculateInstallmentDates(first_due_date ?? "", installment_count, installment_interval);

  const { data: billing, error: billingError } = await supabase
    .from("billings")
    .insert({
      patient_id,
      splitted_billing: splittedBilling,
      description,
      total_amount,
      payment_method,
      installment_count,
      installment_interval: installment_interval ?? null,
      installments_dates: dates.length > 0 ? dates : null,
      notes,
    })
    .select()
    .single();

  if (billingError) {
    throw new Error(billingError.message);
  }

  const amounts = calculateInstallmentAmount(total_amount, installment_count);

  const installmentRows = amounts.map((amount, i) => {
    const splitted_installment = Object.fromEntries(
      Object.entries(splittedBilling).map(([profId, profAmount]) => [
        profId,
        Math.round((profAmount / total_amount) * amount),
      ]),
    );
    return {
      billing_id: billing.id,
      installment_number: i + 1,
      amount,
      due_date: dates[i] as string,
      payment_link: payment_links?.[i] || null,
      splitted_installment,
    };
  });

  const { error: installmentError } = await supabaseAdmin
    .from("installments")
    .insert(installmentRows);

  if (installmentError) {
    throw new Error(installmentError.message);
  }

  scheduleBillingNotifications(billing.id);

  return billing;
}
