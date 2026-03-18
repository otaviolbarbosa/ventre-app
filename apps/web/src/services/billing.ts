import {
  calculateInstallmentAmount,
  calculateInstallmentDates,
  formatCurrency,
} from "@/lib/billing/calculations";
import { scheduleBillingNotifications } from "@/lib/billing/notifications";
import { sendNotificationToTeam } from "@/lib/notifications/send";
import { getNotificationTemplate } from "@/lib/notifications/templates";
import { getServerUser } from "@/lib/server-auth";
import type { CreateBillingInput } from "@/lib/validations/billing";
import {
  createServerSupabaseAdmin,
  createServerSupabaseClient,
} from "@nascere/supabase/server";
import type { Tables } from "@nascere/supabase/types";

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

  let query = supabase
    .from("billings")
    .select(`
      *,
      installments(*),
      patient:patients!billings_patient_id_fkey(id, name)
    `)
    .in("professional_id", targetIds)
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

  const billingCountByProfessional: Record<string, number> = {};
  for (const billing of billings) {
    billingCountByProfessional[billing.professional_id] =
      (billingCountByProfessional[billing.professional_id] ?? 0) + 1;
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
    .eq("professional_id", user.id)
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
    .eq("professional_id", user.id)
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
    total_amount,
    payment_method,
    installment_count,
    installment_interval,
    first_due_date,
    payment_links,
    notes,
  } = data;

  const { data: billing, error: billingError } = await supabase
    .from("billings")
    .insert({
      patient_id,
      professional_id: userId,
      description,
      total_amount,
      payment_method,
      installment_count,
      installment_interval,
      notes,
    })
    .select()
    .single();

  if (billingError) {
    throw new Error(billingError.message);
  }

  const amounts = calculateInstallmentAmount(total_amount, installment_count);
  const dates = calculateInstallmentDates(first_due_date, installment_count, installment_interval);

  const installmentRows = amounts.map((amount, i) => ({
    billing_id: billing.id,
    installment_number: i + 1,
    amount,
    due_date: dates[i] as string,
    payment_link: payment_links?.[i] || null,
  }));

  const { error: installmentError } = await supabaseAdmin
    .from("installments")
    .insert(installmentRows);

  if (installmentError) {
    throw new Error(installmentError.message);
  }

  scheduleBillingNotifications(billing.id);

  const { data: patient } = await supabase
    .from("patients")
    .select("name")
    .eq("id", patient_id)
    .single();

  if (patient) {
    const template = getNotificationTemplate("billing_created", {
      description,
      amount: formatCurrency(total_amount),
    });
    sendNotificationToTeam(patient_id, userId, {
      type: "billing_created",
      ...template,
      data: { url: `/patients/${patient_id}/billing` },
    });
  }

  return billing;
}
