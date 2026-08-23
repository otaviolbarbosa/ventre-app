import type { createServerSupabaseClient } from "@ventre/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

const CONTRACTION_INTERVAL_THRESHOLD_MS = 3 * 60 * 1000;
const DILATION_THRESHOLD_CM = 5;

/** Libera o partograma permanentemente (high-water mark) quando a gestação atinge
 * contração a cada 3 minutos E dilatação ≥ 5cm. Idempotente: o `.is(..., null)` garante
 * que só a primeira chamada bem-sucedida efetivamente seta a coluna. */
export async function maybeUnlockPartograph(
  supabase: SupabaseClient,
  pregnancyId: string,
): Promise<void> {
  const [{ data: recentContractions }, { data: latestDilation }] = await Promise.all([
    supabase
      .from("birth_contractions")
      .select("measured_at")
      .eq("pregnancy_id", pregnancyId)
      .order("measured_at", { ascending: false })
      .limit(2),
    supabase
      .from("birth_cervical_dilations")
      .select("dilation_cm")
      .eq("pregnancy_id", pregnancyId)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!recentContractions || recentContractions.length < 2) return;
  if (!latestDilation || latestDilation.dilation_cm < DILATION_THRESHOLD_CM) return;

  const [latest, previous] = recentContractions;
  if (!latest || !previous) return;

  const intervalMs =
    new Date(latest.measured_at).getTime() - new Date(previous.measured_at).getTime();

  if (intervalMs > CONTRACTION_INTERVAL_THRESHOLD_MS) return;

  await supabase
    .from("pregnancies")
    .update({ partograph_unlocked_at: new Date().toISOString() })
    .eq("id", pregnancyId)
    .is("partograph_unlocked_at", null);
}
