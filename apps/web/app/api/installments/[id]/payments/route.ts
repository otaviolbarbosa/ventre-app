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

const ALLOWED_RECEIPT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

const MAX_RECEIPT_SIZE = 10 * 1024 * 1024; // 10MB

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

    // Generate signed URLs for payments with receipts
    const paymentsWithReceipts = (payments ?? []).filter(
      (p) => p.receipt_path,
    );

    const receiptUrls: Record<string, string> = {};
    if (paymentsWithReceipts.length > 0) {
      const supabaseAdmin = await createServerSupabaseAdmin();
      const paths = paymentsWithReceipts.map((p) => p.receipt_path as string);
      const { data: signedUrls } = await supabaseAdmin.storage
        .from("payments")
        .createSignedUrls(paths, 3600);

      if (signedUrls) {
        for (const entry of signedUrls) {
          if (entry.signedUrl) {
            const payment = paymentsWithReceipts.find(
              (p) => p.receipt_path === entry.path,
            );
            if (payment) receiptUrls[payment.id] = entry.signedUrl;
          }
        }
      }
    }

    const paymentsWithUrls = (payments ?? []).map((p) => ({
      ...p,
      receipt_url: receiptUrls[p.id] ?? null,
    }));

    return NextResponse.json({ payments: paymentsWithUrls });
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

    const formData = await request.formData();

    const body = {
      paid_at: formData.get("paid_at") as string,
      paid_amount: Number(formData.get("paid_amount")),
      payment_method: formData.get("payment_method") as string,
      notes: (formData.get("notes") as string) || undefined,
    };
    const receipt = formData.get("receipt") as File | null;

    const validation = recordPaymentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors },
        { status: 400 },
      );
    }

    // Validate receipt file if provided
    if (receipt && receipt.size > 0) {
      if (!ALLOWED_RECEIPT_TYPES.includes(receipt.type)) {
        return NextResponse.json(
          {
            error:
              "Tipo de arquivo não permitido. Envie imagens ou PDF.",
          },
          { status: 400 },
        );
      }
      if (receipt.size > MAX_RECEIPT_SIZE) {
        return NextResponse.json(
          { error: "Arquivo muito grande. O tamanho máximo é 10MB." },
          { status: 400 },
        );
      }
    }

    // Upload receipt if provided
    let receiptPath: string | null = null;
    if (receipt && receipt.size > 0) {
      const timestamp = Date.now();
      receiptPath = `${user.id}/${timestamp}_${receipt.name}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("payments")
        .upload(receiptPath, receipt, {
          contentType: receipt.type,
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: uploadError.message },
          { status: 500 },
        );
      }
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
        receipt_path: receiptPath,
      })
      .select()
      .single();

    if (paymentError) {
      // Rollback: delete uploaded file if insert failed
      if (receiptPath) {
        await supabaseAdmin.storage.from("payments").remove([receiptPath]);
      }
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
