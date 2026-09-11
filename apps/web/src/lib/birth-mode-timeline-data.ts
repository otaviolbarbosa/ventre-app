import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import { computeContractionsPer10Min } from "@/lib/birth-mode-chart-utils";
import type { createServerSupabaseClient } from "@ventre/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type BirthModeTimelineData = {
  events: BirthModeTimelineEvent[];
  patientId: string | null;
  patientName: string | null;
  hasFinished: boolean;
  birthModeActive: boolean;
  wasActivated: boolean;
  partographUnlockedAt: string | null;
};

export async function fetchBirthModeTimelineData(
  supabase: SupabaseClient,
  pregnancyId: string,
): Promise<BirthModeTimelineData> {
  const [
    { data: pregnancy },
    { data: contractions },
    { data: uterineActivityRecords },
    { data: cervicalDilations },
    { data: fetalStations },
    { data: fetalHeartRates },
    { data: amnioticFluidRecords },
    { data: medicationAdministrations },
    { data: membraneRuptures },
    { data: maternalVitals },
    { data: urineTests },
    { data: apgarScores },
  ] = await Promise.all([
    supabase
      .from("pregnancies")
      .select(
        "patient_id, birth_mode_activated_at, birth_mode_activated_by, has_finished, birth_mode_active, partograph_unlocked_at, activated_by:users!pregnancies_birth_mode_activated_by_fkey(name), patient:patients(name)",
      )
      .eq("id", pregnancyId)
      .single(),
    supabase
      .from("birth_contractions")
      .select("*, professional:users(name)")
      .eq("pregnancy_id", pregnancyId)
      .order("measured_at", { ascending: true }),
    supabase
      .from("birth_uterine_activity")
      .select("*, professional:users(name)")
      .eq("pregnancy_id", pregnancyId)
      .order("measured_at", { ascending: true }),
    supabase
      .from("birth_cervical_dilations")
      .select("*, professional:users(name)")
      .eq("pregnancy_id", pregnancyId)
      .order("measured_at", { ascending: true }),
    supabase
      .from("birth_fetal_stations")
      .select("*, professional:users(name)")
      .eq("pregnancy_id", pregnancyId)
      .order("measured_at", { ascending: true }),
    supabase
      .from("birth_fetal_heart_rates")
      .select("*, professional:users(name)")
      .eq("pregnancy_id", pregnancyId)
      .order("measured_at", { ascending: true }),
    supabase
      .from("birth_amniotic_fluid_records")
      .select("*, professional:users(name)")
      .eq("pregnancy_id", pregnancyId)
      .order("measured_at", { ascending: true }),
    supabase
      .from("birth_medication_administrations")
      .select("*, professional:users(name)")
      .eq("pregnancy_id", pregnancyId)
      .order("administered_at", { ascending: true }),
    supabase
      .from("birth_membrane_ruptures")
      .select("*, professional:users(name)")
      .eq("pregnancy_id", pregnancyId)
      .order("occurred_at", { ascending: true }),
    supabase
      .from("birth_maternal_vitals")
      .select("*, professional:users(name)")
      .eq("pregnancy_id", pregnancyId)
      .order("measured_at", { ascending: true }),
    supabase
      .from("birth_urine_tests")
      .select("*, professional:users(name)")
      .eq("pregnancy_id", pregnancyId)
      .order("measured_at", { ascending: true }),
    supabase
      .from("birth_apgar_scores")
      .select("*, professional:users(name)")
      .eq("pregnancy_id", pregnancyId)
      .order("minute", { ascending: true }),
  ]);

  const events: BirthModeTimelineEvent[] = [];

  // Frequência de contrações por 10 min é derivada do intervalo entre os `measured_at`
  // das contrações já registradas, não um campo capturado manualmente.
  const contractionRows = contractions ?? [];
  const contractionsPer10MinById = computeContractionsPer10Min(
    contractionRows.map((row) => ({ id: row.id, occurredAt: row.measured_at })),
  );

  if (pregnancy?.birth_mode_activated_at) {
    const activatedBy = pregnancy.activated_by as { name: string } | null;
    events.push({
      type: "start_monitoring",
      id: `start-monitoring-${pregnancyId}`,
      occurredAt: pregnancy.birth_mode_activated_at,
      professionalId: pregnancy.birth_mode_activated_by,
      professionalName: activatedBy?.name ?? "Profissional",
      payload: {},
    });
  }

  for (const row of contractionRows) {
    events.push({
      type: "contraction",
      id: row.id,
      occurredAt: row.measured_at,
      professionalId: row.professional_id,
      professionalName: (row.professional as { name: string } | null)?.name ?? "Profissional",
      payload: {
        duration_seconds: row.duration_seconds,
        effectiveness: row.effectiveness,
        pain_intensity: row.pain_intensity,
        contractions_per_10min: contractionsPer10MinById.get(row.id) ?? null,
      },
    });
  }

  for (const row of uterineActivityRecords ?? []) {
    events.push({
      type: "uterine_activity",
      id: row.id,
      occurredAt: row.measured_at,
      professionalId: row.professional_id,
      professionalName: (row.professional as { name: string } | null)?.name ?? "Profissional",
      payload: {
        interval_minutes: row.interval_minutes,
        contraction_count: row.contraction_count,
        durations_seconds: row.durations_seconds,
        du_notations: row.du_notations,
      },
    });
  }

  for (const row of cervicalDilations ?? []) {
    events.push({
      type: "cervical_dilation",
      id: row.id,
      occurredAt: row.measured_at,
      professionalId: row.professional_id,
      professionalName: (row.professional as { name: string } | null)?.name ?? "Profissional",
      payload: { dilation_cm: row.dilation_cm },
    });
  }

  for (const row of fetalStations ?? []) {
    events.push({
      type: "fetal_station",
      id: row.id,
      occurredAt: row.measured_at,
      professionalId: row.professional_id,
      professionalName: (row.professional as { name: string } | null)?.name ?? "Profissional",
      payload: { station_lee: row.station_lee },
    });
  }

  for (const row of fetalHeartRates ?? []) {
    events.push({
      type: "fetal_heart_rate",
      id: row.id,
      occurredAt: row.measured_at,
      professionalId: row.professional_id,
      professionalName: (row.professional as { name: string } | null)?.name ?? "Profissional",
      payload: { bpm: row.bpm },
    });
  }

  for (const row of amnioticFluidRecords ?? []) {
    events.push({
      type: "amniotic_fluid",
      id: row.id,
      occurredAt: row.measured_at,
      professionalId: row.professional_id,
      professionalName: (row.professional as { name: string } | null)?.name ?? "Profissional",
      payload: { fluid_type: row.fluid_type },
    });
  }

  for (const row of medicationAdministrations ?? []) {
    events.push({
      type: "medication",
      id: row.id,
      occurredAt: row.administered_at,
      professionalId: row.professional_id,
      professionalName: (row.professional as { name: string } | null)?.name ?? "Profissional",
      payload: {
        medication_type: row.medication_type,
        other_birth_medication_type: row.other_birth_medication_type,
        notes: row.notes,
        oxytocin_concentration_u_per_l: row.oxytocin_concentration_u_per_l,
        oxytocin_drip_rate_gtt_per_min: row.oxytocin_drip_rate_gtt_per_min,
      },
    });
  }

  for (const row of membraneRuptures ?? []) {
    events.push({
      type: "membrane_rupture",
      id: row.id,
      occurredAt: row.occurred_at,
      professionalId: row.professional_id,
      professionalName: (row.professional as { name: string } | null)?.name ?? "Profissional",
      payload: {
        rupture_type: row.rupture_type,
        fluid_type_at_rupture: row.fluid_type_at_rupture,
      },
    });
  }

  for (const row of maternalVitals ?? []) {
    events.push({
      type: "maternal_vitals",
      id: row.id,
      occurredAt: row.measured_at,
      professionalId: row.professional_id,
      professionalName: (row.professional as { name: string } | null)?.name ?? "Profissional",
      payload: {
        systolic_bp: row.systolic_bp,
        diastolic_bp: row.diastolic_bp,
        pulse_bpm: row.pulse_bpm,
        temperature_celsius: row.temperature_celsius,
      },
    });
  }

  for (const row of urineTests ?? []) {
    events.push({
      type: "urine_test",
      id: row.id,
      occurredAt: row.measured_at,
      professionalId: row.professional_id,
      professionalName: (row.professional as { name: string } | null)?.name ?? "Profissional",
      payload: {
        protein_level: row.protein_level,
        ketone_level: row.ketone_level,
        volume_ml: row.volume_ml,
      },
    });
  }

  for (const row of apgarScores ?? []) {
    events.push({
      type: "apgar",
      id: row.id,
      occurredAt: row.created_at,
      professionalId: row.professional_id,
      professionalName: (row.professional as { name: string } | null)?.name ?? "Profissional",
      payload: { minute: row.minute, total: row.total },
    });
  }

  events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  return {
    events,
    patientId: pregnancy?.patient_id ?? null,
    patientName: (pregnancy?.patient as { name: string } | null)?.name ?? null,
    hasFinished: pregnancy?.has_finished ?? false,
    birthModeActive: pregnancy?.birth_mode_active ?? false,
    wasActivated: pregnancy?.birth_mode_activated_at != null,
    partographUnlockedAt: pregnancy?.partograph_unlocked_at ?? null,
  };
}
