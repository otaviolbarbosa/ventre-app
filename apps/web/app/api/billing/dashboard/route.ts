import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@nascere/supabase/server";
import type { Tables } from "@nascere/supabase/types";

type Installment = Tables<"installments">;
type Billing = Tables<"billings"> & { installments: Installment[] };

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Default to current month
    const now = new Date();
    const startDate =
      searchParams.get("start_date") ||
      new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endDate =
      searchParams.get("end_date") || now.toISOString();

    const { data: billings, error } = await supabase
      .from("billings")
      .select("*, installments(*)")
      .eq("professional_id", user.id)
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const typedBillings = (billings as Billing[]) || [];

    let totalAmount = 0;
    let paidAmount = 0;
    let overdueAmount = 0;
    const byStatus: Record<string, number> = {};
    const byPaymentMethod: Record<string, number> = {};
    const upcomingDue: Installment[] = [];

    const today = new Date().toISOString().split("T")[0] as string;
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0] as string;

    for (const billing of typedBillings) {
      totalAmount += billing.total_amount;
      paidAmount += billing.paid_amount;

      byStatus[billing.status] = (byStatus[billing.status] || 0) + 1;
      byPaymentMethod[billing.payment_method] =
        (byPaymentMethod[billing.payment_method] || 0) + 1;

      for (const inst of billing.installments) {
        if (inst.status === "atrasado") {
          overdueAmount += inst.amount - inst.paid_amount;
        }
        if (
          inst.status === "pendente" &&
          inst.due_date >= today &&
          inst.due_date <= nextWeek
        ) {
          upcomingDue.push(inst);
        }
      }
    }

    return NextResponse.json({
      metrics: {
        total_amount: totalAmount,
        paid_amount: paidAmount,
        pending_amount: totalAmount - paidAmount,
        overdue_amount: overdueAmount,
        total_billings: typedBillings.length,
        by_status: byStatus,
        by_payment_method: byPaymentMethod,
        upcoming_due: upcomingDue,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
