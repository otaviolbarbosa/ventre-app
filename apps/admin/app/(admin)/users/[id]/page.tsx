import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { notFound } from "next/navigation";
import { UserEditForm } from "./_components/user-edit-form";

type Params = Promise<{ id: string }>;

export default async function UserDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createServerSupabaseAdmin();

  const [{ data: user }, { data: enterprises }] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, email, user_type, professional_type, created_at")
      .eq("id", id)
      .single(),
    supabase.from("enterprises").select("id, name").order("name"),
  ]);

  if (!user) notFound();

  const { data: ueRow } = await supabase
    .from("user_enterprises")
    .select("enterprise_id")
    .eq("user_id", id)
    .limit(1)
    .maybeSingle();

  const userWithEnterprise = { ...user, enterprise_id: ueRow?.enterprise_id ?? null };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-foreground">Editar Usuário</h1>
        <p className="mt-1 text-muted-foreground text-sm">{user.email}</p>
      </div>
      <UserEditForm user={userWithEnterprise} enterprises={enterprises ?? []} />
    </div>
  );
}
