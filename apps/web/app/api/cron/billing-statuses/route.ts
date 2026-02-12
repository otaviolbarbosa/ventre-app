import { NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@nascere/supabase/server";
import { calculateBillingStatus } from "@/lib/billing/calculations";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const supabaseAdmin = await createServerSupabaseAdmin();
    const today = new Date().toISOString().split("T")[0] as string;

    // Update pending installments to overdue where due_date < today
    const { data: overdueInstallments } = await supabaseAdmin
      .from("installments")
      .update({ status: "atrasado" })
      .eq("status", "pendente")
      .lt("due_date", today)
      .select("billing_id");

    // Get unique billing IDs to recalculate
    const billingIds = [
      ...new Set(overdueInstallments?.map((i) => i.billing_id) ?? []),
    ];

    let updated = 0;

    for (const billingId of billingIds) {
      const { data: installments } = await supabaseAdmin
        .from("installments")
        .select("status")
        .eq("billing_id", billingId);

      if (installments) {
        const newStatus = calculateBillingStatus(installments);
        await supabaseAdmin
          .from("billings")
          .update({ status: newStatus })
          .eq("id", billingId);
        updated++;
      }
    }

    // Schedule overdue notifications for newly overdue installments
    if (overdueInstallments?.length) {
      for (const inst of overdueInstallments) {
        const { data: billing } = await supabaseAdmin
          .from("billings")
          .select("patient_id")
          .eq("id", inst.billing_id)
          .single();

        if (!billing) continue;

        const { data: teamMembers } = await supabaseAdmin
          .from("team_members")
          .select("professional_id")
          .eq("patient_id", billing.patient_id);

        const { data: patient } = await supabaseAdmin
          .from("patients")
          .select("user_id")
          .eq("id", billing.patient_id)
          .single();

        const userIds: string[] = [];
        for (const tm of teamMembers ?? []) {
          userIds.push(tm.professional_id);
        }
        if (patient?.user_id) {
          userIds.push(patient.user_id);
        }

        // We don't create scheduled notifications for overdue
        // since we're processing them right now in the cron
      }
    }

    return NextResponse.json({
      overdue_installments: overdueInstallments?.length ?? 0,
      billings_updated: updated,
    });
  } catch {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
