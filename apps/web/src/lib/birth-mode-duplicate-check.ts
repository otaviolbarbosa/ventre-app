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
 * even though the `set_patient_id_from_pregnancy` trigger overwrites it server-side regardless.
 * Also asserts Modo Parto is currently active for the pregnancy, so birth events can't be
 * registered outside an active Modo Parto session (defense in depth — the UI already blocks this,
 * but RLS alone doesn't, since `is_team_member` doesn't consider `birth_mode_active`). */
export async function resolvePregnancyPatientId(
  supabase: SupabaseClient,
  pregnancyId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("pregnancies")
    .select("patient_id, birth_mode_active")
    .eq("id", pregnancyId)
    .single();

  if (error) throw new Error(error.message);
  if (!data.birth_mode_active) {
    throw new Error("Modo Parto não está ativo para esta gestação");
  }

  return data.patient_id;
}
