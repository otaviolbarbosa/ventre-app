import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServerSupabaseAdmin } from "@nascere/supabase/server";

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

    const { data: installments, error } = await supabase
      .from("installments")
      .select("*, payments(*)")
      .eq("billing_id", id)
      .order("installment_number", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ installments });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const supabaseAdmin = await createServerSupabaseAdmin();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { installment_id, payment_link } = await request.json();

    if (!installment_id) {
      return NextResponse.json(
        { error: "ID da parcela é obrigatório" },
        { status: 400 },
      );
    }

    // Verify installment belongs to this billing
    const { data: installment } = await supabaseAdmin
      .from("installments")
      .select("id")
      .eq("id", installment_id)
      .eq("billing_id", id)
      .single();

    if (!installment) {
      return NextResponse.json(
        { error: "Parcela não encontrada" },
        { status: 404 },
      );
    }

    const { error } = await supabaseAdmin
      .from("installments")
      .update({ payment_link: payment_link || null })
      .eq("id", installment_id);

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
