import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { notFound } from "next/navigation";
import { EnterpriseEditForm } from "./_components/enterprise-edit-form";

type Params = Promise<{ id: string }>;

export default async function EnterpriseDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createServerSupabaseAdmin();

  const { data: enterprise } = await supabase
    .from("enterprises")
    .select("id, name, legal_name, cnpj, email, phone, is_active, professionals_amount, slug")
    .eq("id", id)
    .single();

  if (!enterprise) notFound();

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-foreground">Editar Empresa</h1>
        <p className="mt-1 text-muted-foreground text-sm">{enterprise.name}</p>
      </div>
      <EnterpriseEditForm enterprise={enterprise} />
    </div>
  );
}
