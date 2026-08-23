import { calculateGestationalAge } from "@/lib/gestational-age";
import type { createServerSupabaseClient } from "@ventre/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type PartographHeaderInfo = {
  patientName: string;
  dum: string | null;
  dueDate: string | null;
  gestationalAgeLabel: string | null;
};

export async function fetchPartographHeaderInfo(
  supabase: SupabaseClient,
  pregnancyId: string,
): Promise<PartographHeaderInfo> {
  const { data: pregnancy, error } = await supabase
    .from("pregnancies")
    .select("dum, due_date, patient:patients(name)")
    .eq("id", pregnancyId)
    .single();

  if (error || !pregnancy) throw new Error(error?.message ?? "Gestação não encontrada");

  const gestationalAge = calculateGestationalAge(pregnancy.dum);

  return {
    patientName: (pregnancy.patient as { name: string } | null)?.name ?? "Paciente",
    dum: pregnancy.dum,
    dueDate: pregnancy.due_date,
    gestationalAgeLabel: gestationalAge?.fullLabel ?? null,
  };
}
