import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServerSupabaseAdmin } from "@nascere/supabase/server";
import { createBillingSchema } from "@/lib/validations/billing";
import {
  calculateInstallmentAmount,
  calculateInstallmentDates,
  formatCurrency,
} from "@/lib/billing/calculations";
import { scheduleBillingNotifications } from "@/lib/billing/notifications";
import { sendNotificationToTeam } from "@/lib/notifications/send";
import { getNotificationTemplate } from "@/lib/notifications/templates";

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patient_id");
    const status = searchParams.get("status");
    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "20");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    let query = supabase
      .from("billings")
      .select(
        `
        *,
        installments(id, status),
        patient:patients!billings_patient_id_fkey(id, name)
      `,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (patientId) {
      query = query.eq("patient_id", patientId);
    }

    if (status) {
      query = query.eq(
        "status",
        status as "pendente" | "pago" | "atrasado" | "cancelado",
      );
    }

    const { data: billings, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ billings, total: count });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const supabaseAdmin = await createServerSupabaseAdmin();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createBillingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors },
        { status: 400 },
      );
    }

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
    } = validation.data;

    // Create billing
    const { data: billing, error: billingError } = await supabase
      .from("billings")
      .insert({
        patient_id,
        professional_id: user.id,
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
      return NextResponse.json(
        { error: billingError.message },
        { status: 500 },
      );
    }

    // Calculate and create installments (using admin to bypass RLS)
    const amounts = calculateInstallmentAmount(total_amount, installment_count);
    const dates = calculateInstallmentDates(
      first_due_date,
      installment_count,
      installment_interval,
    );

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
      return NextResponse.json(
        { error: installmentError.message },
        { status: 500 },
      );
    }

    // Fire-and-forget: schedule notifications
    scheduleBillingNotifications(billing.id);

    // Fire-and-forget: notify team
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
      sendNotificationToTeam(patient_id, user.id, {
        type: "billing_created",
        ...template,
        data: { url: `/patients/${patient_id}/billing` },
      });
    }

    return NextResponse.json({ billing }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
