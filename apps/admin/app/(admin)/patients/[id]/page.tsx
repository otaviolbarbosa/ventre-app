import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { notFound } from "next/navigation";
import { PatientEditForm } from "./_components/patient-edit-form";

type Params = Promise<{ id: string }>;

export default async function PatientDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createServerSupabaseAdmin();

  const { data: patient } = await supabase
    .from("patients")
    .select("id, name, email, phone, date_of_birth, created_at, created_by")
    .eq("id", id)
    .single();

  if (!patient) notFound();

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-foreground">Editar Paciente</h1>
        <p className="mt-1 text-muted-foreground text-sm">{patient.name}</p>
      </div>
      <PatientEditForm patient={patient} />
    </div>
  );
}
