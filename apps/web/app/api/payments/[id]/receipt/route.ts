import { createServerSupabaseAdmin, createServerSupabaseClient } from "@ventre/supabase/server";
import { NextResponse } from "next/server";

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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paymentId } = await params;
    const supabase = await createServerSupabaseClient();
    const supabaseAdmin = await createServerSupabaseAdmin();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("id, receipt_path")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });
    }

    if (payment.receipt_path) {
      return NextResponse.json(
        { error: "Este pagamento já possui um comprovante" },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const receipt = formData.get("receipt") as File | null;

    if (!receipt || receipt.size === 0) {
      return NextResponse.json({ error: "Envie um arquivo de comprovante" }, { status: 400 });
    }

    if (!ALLOWED_RECEIPT_TYPES.includes(receipt.type)) {
      return NextResponse.json(
        { error: "Tipo de arquivo não permitido. Envie imagens ou PDF." },
        { status: 400 },
      );
    }

    if (receipt.size > MAX_RECEIPT_SIZE) {
      return NextResponse.json(
        { error: "Arquivo muito grande. O tamanho máximo é 10MB." },
        { status: 400 },
      );
    }

    const timestamp = Date.now();
    const receiptPath = `${user.id}/${timestamp}_${receipt.name}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("payments")
      .upload(receiptPath, receipt, {
        contentType: receipt.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: updatedPayment, error: updateError } = await supabase
      .from("payments")
      .update({ receipt_path: receiptPath })
      .eq("id", paymentId)
      .select()
      .single();

    if (updateError) {
      await supabaseAdmin.storage.from("payments").remove([receiptPath]);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ payment: updatedPayment });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
