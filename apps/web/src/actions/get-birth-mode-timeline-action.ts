"use server";

import type { BirthEventType } from "@/lib/birth-mode-constants";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  pregnancyId: z.string().uuid(),
});

export type BirthModeTimelineEvent = {
  type: BirthEventType;
  id: string;
  occurredAt: string;
  professionalId: string | null;
  professionalName: string;
  payload: Record<string, unknown>;
};

export const getBirthModeTimelineAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    const { pregnancyId } = parsedInput;

    const [
      { data: pregnancy },
      { data: contractions },
      { data: cervicalDilations },
      { data: fetalStations },
      { data: fetalHeartRates },
      { data: amnioticFluidRecords },
      { data: medicationAdministrations },
      { data: membraneRuptures },
    ] = await Promise.all([
      supabase
        .from("pregnancies")
        .select(
          "birth_mode_activated_at, birth_mode_activated_by, activated_by:users!pregnancies_birth_mode_activated_by_fkey(name)",
        )
        .eq("id", pregnancyId)
        .single(),
      supabase
        .from("birth_contractions")
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
    ]);

    const events: BirthModeTimelineEvent[] = [];

    if (pregnancy?.birth_mode_activated_at) {
      const activatedBy = pregnancy.activated_by as { name: string } | null;
      events.push({
        type: "active_labor_entry",
        id: `active-labor-entry-${pregnancyId}`,
        occurredAt: pregnancy.birth_mode_activated_at,
        professionalId: pregnancy.birth_mode_activated_by,
        professionalName: activatedBy?.name ?? "Profissional",
        payload: {},
      });
    }

    for (const row of contractions ?? []) {
      events.push({
        type: "contraction",
        id: row.id,
        occurredAt: row.measured_at,
        professionalId: row.professional_id,
        professionalName: (row.professional as { name: string } | null)?.name ?? "Profissional",
        payload: { duration_seconds: row.duration_seconds, effectiveness: row.effectiveness },
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
        payload: {},
      });
    }

    events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

    return { events };
  });
