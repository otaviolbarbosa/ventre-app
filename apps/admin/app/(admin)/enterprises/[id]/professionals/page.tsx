import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { notFound } from "next/navigation";
import { ProfessionalsTable } from "./_components/professionals-table";

type Params = Promise<{ id: string }>;

export default async function EnterpriseProfessionalsPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createServerSupabaseAdmin();

  const { data: enterprise } = await supabase
    .from("enterprises")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!enterprise) notFound();

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-foreground">Profissionais</h1>
        <p className="mt-1 text-muted-foreground text-sm">{enterprise.name}</p>
      </div>
      <ProfessionalsTable enterpriseId={id} />
    </div>
  );
}
