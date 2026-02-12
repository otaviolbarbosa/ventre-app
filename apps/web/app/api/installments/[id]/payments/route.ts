import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServerSupabaseAdmin,
} from "@nascere/supabase/server";
import { recordPaymentSchema } from "@/lib/validations/billing";
import {
  calculateBillingStatus,
  formatCurrency,
} from "@/lib/billing/calculations";
import { cancelInstallmentNotifications } from "@/lib/billing/notifications";
import { sendNotificationToTeam } from "@/lib/notifications/send";
import { getNotificationTemplate } from "@/lib/notifications/templates";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: payments, error } = await supabase
      .from("payments")
      .select("*")
      .eq("installment_id", id)
      .order("paid_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ payments });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: installmentId } = await params;
    const supabase = await createServerSupabaseClient();
    const supabaseAdmin = await createServerSupabaseAdmin();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const validation = recordPaymentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors },
        { status: 400 },
      );
    }

    // Insert payment
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        installment_id: installmentId,
        paid_at: validation.data.paid_at,
        paid_amount: validation.data.paid_amount,
        payment_method: validation.data.payment_method,
        registered_by: user.id,
        notes: validation.data.notes,
      })
      .select()
      .single();

    if (paymentError) {
      return NextResponse.json(
        { error: paymentError.message },
        { status: 500 },
      );
    }

    // Get all payments for this installment to sum up
    const { data: allPayments } = await supabase
      .from("payments")
      .select("paid_amount")
      .eq("installment_id", installmentId);

    const totalPaid =
      allPayments?.reduce((sum, p) => sum + p.paid_amount, 0) ?? 0;

    // Get installment to check amount
    const { data: installment } = await supabaseAdmin
      .from("installments")
      .select("*, billing_id")
      .eq("id", installmentId)
      .single();

    if (!installment) {
      return NextResponse.json(
        { error: "Parcela não encontrada" },
        { status: 404 },
      );
    }

    // Update installment paid_amount and status
    const installmentPaid = totalPaid >= installment.amount;
    await supabaseAdmin
      .from("installments")
      .update({
        paid_amount: totalPaid,
        paid_at: installmentPaid ? validation.data.paid_at : null,
        payment_method: validation.data.payment_method,
        status: installmentPaid ? "pago" : installment.status,
      })
      .eq("id", installmentId);

    // If installment is fully paid, cancel its pending notifications
    if (installmentPaid) {
      cancelInstallmentNotifications(installmentId);
    }

    // Recalculate billing paid_amount and status
    const { data: allInstallments } = await supabaseAdmin
      .from("installments")
      .select("paid_amount, status")
      .eq("billing_id", installment.billing_id);

    if (allInstallments) {
      const billingPaidAmount = allInstallments.reduce(
        (sum, i) => sum + i.paid_amount,
        0,
      );
      const billingStatus = calculateBillingStatus(allInstallments);

      await supabaseAdmin
        .from("billings")
        .update({
          paid_amount: billingPaidAmount,
          status: billingStatus,
        })
        .eq("id", installment.billing_id);
    }

    // Fire-and-forget: send payment confirmation notification
    const { data: billing } = await supabaseAdmin
      .from("billings")
      .select("description, patient_id")
      .eq("id", installment.billing_id)
      .single();

    if (billing) {
      const template = getNotificationTemplate("billing_payment_received", {
        description: billing.description,
        amount: formatCurrency(validation.data.paid_amount),
        installmentNumber: installment.installment_number,
      });
      sendNotificationToTeam(billing.patient_id, user.id, {
        type: "billing_payment_received",
        ...template,
        data: { url: `/patients/${billing.patient_id}/billing` },
      });
    }

    return NextResponse.json({ payment }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
