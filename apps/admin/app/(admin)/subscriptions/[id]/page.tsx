import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { notFound } from "next/navigation";
import { SubscriptionEditForm } from "./_components/subscription-edit-form";

type Params = Promise<{ id: string }>;

export default async function SubscriptionDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createServerSupabaseAdmin();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select(`
      id,
      status,
      frequence,
      expires_at,
      paid_at,
      cancelation_reason,
      created_at,
      user_id,
      enterprise_id,
      plan_id,
      plans(id, name),
      users(id, name, email)
    `)
    .eq("id", id)
    .single();

  if (!subscription) notFound();

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-foreground">Editar Assinatura</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          {(subscription.users as { name: string } | null)?.name ?? subscription.id}
        </p>
      </div>
      <SubscriptionEditForm subscription={subscription} />
    </div>
  );
}
