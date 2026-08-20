import type { createServerSupabaseClient } from "@ventre/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type DuplicateWarning = {
  minutesAgo: number;
  professionalName: string;
} | null;

export const DUPLICATE_WINDOW_MINUTES = 30;

export function duplicateWindowStart(): string {
  return new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60 * 1000).toISOString();
}

export function toDuplicateWarning(
  currentUserId: string,
  row: { professional_id: string; professional: { name: string } | null } | null,
  occurredAtIso: string | undefined,
): DuplicateWarning {
  if (!row || row.professional_id === currentUserId || !occurredAtIso) return null;

  const minutesAgo = Math.max(1, Math.round((Date.now() - new Date(occurredAtIso).getTime()) / 60000));

  return {
    minutesAgo,
    professionalName: row.professional?.name ?? "outro profissional",
  };
}

/** Resolves patient_id for a pregnancy — `birth_*` inserts require it per generated TS types,
 * even though the `set_patient_id_from_pregnancy` trigger overwrites it server-side regardless. */
export async function resolvePregnancyPatientId(
  supabase: SupabaseClient,
  pregnancyId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("pregnancies")
    .select("patient_id")
    .eq("id", pregnancyId)
    .single();

  if (error) throw new Error(error.message);

  return data.patient_id;
}
