"use client";

import type { BirthEventType } from "@/lib/birth-mode-constants";
import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import type { RealtimeChannel, RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { supabase } from "@ventre/supabase";
import { useEffect } from "react";

const RECONNECT_STATUSES = new Set(["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"]);

const TABLE_TO_EVENT_TYPE: Record<string, BirthEventType> = {
  birth_contractions: "contraction",
  birth_cervical_dilations: "cervical_dilation",
  birth_fetal_stations: "fetal_station",
  birth_fetal_heart_rates: "fetal_heart_rate",
  birth_amniotic_fluid_records: "amniotic_fluid",
  birth_medication_administrations: "medication",
  birth_membrane_ruptures: "membrane_rupture",
  birth_maternal_vitals: "maternal_vitals",
  birth_urine_tests: "urine_test",
  birth_apgar_scores: "apgar",
};

const TIME_COLUMN_BY_TABLE: Record<string, string> = {
  birth_contractions: "measured_at",
  birth_cervical_dilations: "measured_at",
  birth_fetal_stations: "measured_at",
  birth_fetal_heart_rates: "measured_at",
  birth_amniotic_fluid_records: "measured_at",
  birth_medication_administrations: "administered_at",
  birth_membrane_ruptures: "occurred_at",
  birth_maternal_vitals: "measured_at",
  birth_urine_tests: "measured_at",
  birth_apgar_scores: "created_at",
};

const PAYLOAD_KEYS_BY_TABLE: Record<string, string[]> = {
  // Nota: contractions_per_10min é derivado no fetch completo (getBirthModeTimelineAction) a
  // partir do histórico de contrações; eventos chegados via realtime não recalculam esse valor.
  birth_contractions: ["duration_seconds", "effectiveness"],
  birth_cervical_dilations: ["dilation_cm"],
  birth_fetal_stations: ["station_lee"],
  birth_fetal_heart_rates: ["bpm"],
  birth_amniotic_fluid_records: ["fluid_type"],
  birth_medication_administrations: [
    "medication_type",
    "other_birth_medication_type",
    "notes",
    "oxytocin_concentration_u_per_l",
    "oxytocin_drip_rate_gtt_per_min",
  ],
  birth_membrane_ruptures: ["rupture_type", "fluid_type_at_rupture"],
  birth_maternal_vitals: ["systolic_bp", "diastolic_bp", "pulse_bpm", "temperature_celsius"],
  birth_urine_tests: ["protein_level", "ketone_level", "volume_ml"],
  birth_apgar_scores: ["minute", "total"],
};

/**
 * Subscribes to INSERT events across the `birth_*` tables for a single pregnancy,
 * normalizing each incoming row into the same shape used by getBirthModeTimelineAction.
 * Professional names aren't included in Realtime payloads, so the caller must resolve
 * them (e.g. via a professionalId -> name map built from the initial fetch).
 */
export function useBirthModeTimelineRealtime(
  pregnancyId: string | undefined,
  resolveProfessionalName: (professionalId: string) => string,
  onNewEvent: (event: BirthModeTimelineEvent) => void,
) {
  useEffect(() => {
    if (!pregnancyId) return;

    let cancelled = false;

    function handleInsert(table: string) {
      return (payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => {
        if (cancelled) return;

        const row = payload.new;
        const timeColumn = TIME_COLUMN_BY_TABLE[table];
        const professionalId = row.professional_id as string;
        const payloadKeys = PAYLOAD_KEYS_BY_TABLE[table] ?? [];

        onNewEvent({
          type: TABLE_TO_EVENT_TYPE[table] as BirthEventType,
          id: row.id as string,
          occurredAt: row[timeColumn ?? "created_at"] as string,
          professionalId,
          professionalName: resolveProfessionalName(professionalId),
          payload: Object.fromEntries(payloadKeys.map((key) => [key, row[key]])),
        });
      };
    }

    const channel: RealtimeChannel = supabase.channel(`birth-mode-timeline-${pregnancyId}`);

    for (const table of Object.keys(TABLE_TO_EVENT_TYPE)) {
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table,
          filter: `pregnancy_id=eq.${pregnancyId}`,
        },
        handleInsert(table),
      );
    }

    channel.subscribe((subscribeStatus) => {
      if (cancelled) return;

      if (RECONNECT_STATUSES.has(subscribeStatus)) {
        channel.subscribe();
      }
    });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [pregnancyId, resolveProfessionalName, onNewEvent]);
}
