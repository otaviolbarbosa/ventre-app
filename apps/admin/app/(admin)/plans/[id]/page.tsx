import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { notFound } from "next/navigation";
import { PlanEditForm } from "./_components/plan-edit-form";

type Params = Promise<{ id: string }>;

export default async function PlanDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createServerSupabaseAdmin();

  const { data: plan } = await supabase
    .from("plans")
    .select("id, name, slug, description, type, value, benefits")
    .eq("id", id)
    .single();

  if (!plan) notFound();

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-foreground">Editar Plano</h1>
        <p className="mt-1 text-muted-foreground text-sm">{plan.name}</p>
      </div>
      <PlanEditForm plan={plan} />
    </div>
  );
}
