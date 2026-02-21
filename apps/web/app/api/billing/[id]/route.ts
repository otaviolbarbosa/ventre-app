import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServerSupabaseAdmin,
} from "@nascere/supabase/server";
import { updateBillingSchema } from "@/lib/validations/billing";

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

    const { data: billing, error } = await supabase
      .from("billings")
      .select(`
        *,
        installments(*, payments(*)),
        patient:patients!billings_patient_id_fkey(id, name)
      `)
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!billing) {
      return NextResponse.json(
        { error: "Cobrança não encontrada" },
        { status: 404 },
      );
    }

    // Generate signed URLs for payments with receipts
    const allPayments = billing.installments.flatMap((i) => i.payments);
    const paymentsWithReceipts = allPayments.filter((p) => p.receipt_path);

    const receiptUrls: Record<string, string> = {};
    if (paymentsWithReceipts.length > 0) {
      const supabaseAdmin = await createServerSupabaseAdmin();
      const paths = paymentsWithReceipts.map(
        (p) => p.receipt_path as string,
      );
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

    // Inject receipt_url into each payment
    const billingWithUrls = {
      ...billing,
      installments: billing.installments.map((installment) => ({
        ...installment,
        payments: installment.payments.map((payment) => ({
          ...payment,
          receipt_url: receiptUrls[payment.id] ?? null,
        })),
      })),
    };

    return NextResponse.json({ billing: billingWithUrls });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
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

    const body = await request.json();
    const validation = updateBillingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors },
        { status: 400 },
      );
    }

    const { data: billing, error } = await supabase
      .from("billings")
      .update(validation.data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ billing });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

export async function DELETE(
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

    const { error } = await supabase.from("billings").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
