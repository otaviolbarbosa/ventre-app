import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import {
  type ChartPoint,
  computeAlertActionLines,
  hoursSince,
  resolveChartT0,
} from "@/lib/birth-mode-chart-utils";
import {
  AMNIOTIC_FLUID_TYPE_LABELS,
  BIRTH_MEDICATION_TYPE_LABELS,
  BIRTH_MEMBRANE_RUPTURE_TYPE_LABELS,
} from "@/lib/birth-mode-constants";
import { PDF_FONT_FAMILY } from "@/lib/contract-pdf-fonts";
import { dayjs } from "@/lib/dayjs";
import {
  Circle,
  Document,
  Line as SvgLine,
  Page,
  Polyline,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import { Fragment } from "react";

export type PartographPdfData = {
  patientName: string;
  events: BirthModeTimelineEvent[];
};

// Cores fixas em vez de `hsl(var(--primary))` — o documento é renderizado
// server-side, sem acesso a CSS custom properties do tema (ao contrário dos
// mini-gráficos em tela, que resolvem a cor via getComputedStyle no cliente).
const PRIMARY = "#1d4ed8";
const SECONDARY = "#f97316";
const TERTIARY = "#3b82f6";
const ALERT = "#eab308";
const ACTION = "#ef4444";
const NORMAL_BAND = "#22c55e";
const EVENT_MEDICATION = "#eab308";
const EVENT_RUPTURE = "#3b82f6";
const AXIS_COLOR = "#9ca3af";

const PLOT_WIDTH = 650;
const LINE_BAND_HEIGHT = 64;
const EVENT_BAND_HEIGHT = 46;
const BAND_LABEL_WIDTH = 96;

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 8,
    padding: 24,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 2,
  },
  bandRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
    paddingBottom: 4,
    borderBottom: "1 solid #e5e7eb",
  },
  bandLabel: {
    width: BAND_LABEL_WIDTH,
    paddingTop: 4,
    paddingRight: 4,
  },
  bandTitle: {
    fontSize: 8,
    fontWeight: "bold",
  },
  axisCaption: {
    fontSize: 6,
    color: AXIS_COLOR,
    marginTop: 2,
  },
  emptyMessage: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 24,
  },
});

function scaleX(hours: number, maxHours: number): number {
  if (maxHours <= 0) return 0;
  return (Math.max(0, Math.min(hours, maxHours)) / maxHours) * PLOT_WIDTH;
}

function scaleY(value: number, min: number, max: number, height: number): number {
  if (max <= min) return height;
  const clamped = Math.max(min, Math.min(value, max));
  return height - ((clamped - min) / (max - min)) * height;
}

function toPolylinePoints(
  points: ChartPoint[],
  maxHours: number,
  min: number,
  max: number,
  height: number,
): string {
  return points
    .map((point) => `${scaleX(point.x, maxHours)},${scaleY(point.y, min, max, height)}`)
    .join(" ");
}

type LineSeries = {
  label: string;
  points: ChartPoint[];
  color: string;
  dashed?: boolean;
};

type LineTrackBandProps = {
  title: string;
  maxHours: number;
  primaryMin: number;
  primaryMax: number;
  primaryUnit: string;
  primarySeries: LineSeries[];
  secondaryMin?: number;
  secondaryMax?: number;
  secondaryUnit?: string;
  secondarySeries?: LineSeries[];
  shadedBand?: { min: number; max: number; color: string };
};

function LineTrackBand({
  title,
  maxHours,
  primaryMin,
  primaryMax,
  primaryUnit,
  primarySeries,
  secondaryMin,
  secondaryMax,
  secondaryUnit,
  secondarySeries,
  shadedBand,
}: LineTrackBandProps) {
  const height = LINE_BAND_HEIGHT;

  return (
    <View style={styles.bandRow} wrap={false}>
      <View style={styles.bandLabel}>
        <Text style={styles.bandTitle}>{title}</Text>
        <Text style={styles.axisCaption}>
          {primaryMin}–{primaryMax} {primaryUnit}
        </Text>
        {secondarySeries && secondaryMin != null && secondaryMax != null && (
          <Text style={styles.axisCaption}>
            {secondaryMin}–{secondaryMax} {secondaryUnit}
          </Text>
        )}
      </View>
      <Svg width={PLOT_WIDTH} height={height}>
        <Rect x={0} y={0} width={PLOT_WIDTH} height={height} fill="#ffffff" stroke="#e5e7eb" />
        {shadedBand && (
          <Rect
            x={0}
            y={scaleY(shadedBand.max, primaryMin, primaryMax, height)}
            width={PLOT_WIDTH}
            height={
              scaleY(shadedBand.min, primaryMin, primaryMax, height) -
              scaleY(shadedBand.max, primaryMin, primaryMax, height)
            }
            fill={shadedBand.color}
            opacity={0.15}
          />
        )}
        {primarySeries.map((series, index) => (
          <Polyline
            // biome-ignore lint/suspicious/noArrayIndexKey: bandas são desenhadas uma única vez em um documento PDF estático, sem reconciliação/reordenação
            key={`primary-${index}`}
            points={toPolylinePoints(series.points, maxHours, primaryMin, primaryMax, height)}
            stroke={series.color}
            strokeWidth={series.dashed ? 0.75 : 1}
            strokeDasharray={series.dashed ? "3 2" : undefined}
            fill="none"
          />
        ))}
        {primarySeries.flatMap((series, si) =>
          series.dashed
            ? []
            : series.points.map((point, pi) => (
                <Circle
                  // biome-ignore lint/suspicious/noArrayIndexKey: idem — sem reconciliação
                  key={`primary-${si}-${pi}`}
                  cx={scaleX(point.x, maxHours)}
                  cy={scaleY(point.y, primaryMin, primaryMax, height)}
                  r={1.3}
                  fill={series.color}
                />
              )),
        )}
        {secondaryMin != null &&
          secondaryMax != null &&
          secondarySeries?.map((series, index) => (
            <Polyline
              // biome-ignore lint/suspicious/noArrayIndexKey: idem — sem reconciliação
              key={`secondary-${index}`}
              points={toPolylinePoints(series.points, maxHours, secondaryMin, secondaryMax, height)}
              stroke={series.color}
              strokeWidth={1}
              fill="none"
            />
          ))}
        {secondaryMin != null &&
          secondaryMax != null &&
          secondarySeries?.flatMap((series, si) =>
            series.points.map((point, pi) => (
              <Circle
                // biome-ignore lint/suspicious/noArrayIndexKey: idem — sem reconciliação
                key={`secondary-${si}-${pi}`}
                cx={scaleX(point.x, maxHours)}
                cy={scaleY(point.y, secondaryMin, secondaryMax, height)}
                r={1.3}
                fill={series.color}
              />
            )),
          )}
      </Svg>
    </View>
  );
}

type EventMarker = {
  id: string;
  hours: number;
  label: string;
  color: string;
};

function EventTrackBand({
  title,
  maxHours,
  markers,
}: {
  title: string;
  maxHours: number;
  markers: EventMarker[];
}) {
  const height = EVENT_BAND_HEIGHT;
  const baselineY = height - 8;

  return (
    <View style={styles.bandRow} wrap={false}>
      <View style={styles.bandLabel}>
        <Text style={styles.bandTitle}>{title}</Text>
      </View>
      <Svg width={PLOT_WIDTH} height={height}>
        <Rect x={0} y={0} width={PLOT_WIDTH} height={height} fill="#ffffff" stroke="#e5e7eb" />
        <SvgLine x1={0} y1={baselineY} x2={PLOT_WIDTH} y2={baselineY} stroke={AXIS_COLOR} strokeWidth={0.5} />
        {markers.map((marker, index) => {
          const x = scaleX(marker.hours, maxHours);
          const labelY = index % 2 === 0 ? baselineY - 22 : baselineY - 10;
          return (
            <Fragment key={marker.id}>
              <SvgLine x1={x} y1={labelY + 6} x2={x} y2={baselineY} stroke={marker.color} strokeWidth={0.75} />
              <Circle cx={x} cy={baselineY} r={1.5} fill={marker.color} />
              <Text x={x} y={labelY} textAnchor="middle" style={{ fontSize: 5.5 }}>
                {marker.label}
              </Text>
            </Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

export function PartographPdfDocument({ data }: { data: PartographPdfData }) {
  const { patientName, events } = data;
  const t0 = resolveChartT0(events);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Partograma — {patientName}</Text>
          <Text style={styles.subtitle}>
            Modelo clássico (Ministério da Saúde) — gerado em {dayjs().format("DD/MM/YYYY HH:mm")}
          </Text>
        </View>
        {t0 === null ? (
          <Text style={styles.emptyMessage}>Sem dados suficientes para gerar o partograma.</Text>
        ) : (
          <PartographBands events={events} t0={t0} />
        )}
      </Page>
    </Document>
  );
}

function PartographBands({ events, t0 }: { events: BirthModeTimelineEvent[]; t0: number }) {
  const allHours = events.map((event) => hoursSince(t0, event.occurredAt));
  const maxHours = Math.max(1, Math.ceil(Math.max(0, ...allHours)) + 1);

  const dilationEvents = events.filter((event) => event.type === "cervical_dilation");
  const stationEvents = events.filter((event) => event.type === "fetal_station");
  const fhrEvents = events.filter((event) => event.type === "fetal_heart_rate");
  const contractionEvents = events.filter((event) => event.type === "contraction");
  const oxytocinEvents = events.filter(
    (event) =>
      event.type === "medication" &&
      (event.payload as { medication_type: string }).medication_type === "ocitocina",
  );
  const otherMedicationEvents = events.filter(
    (event) =>
      event.type === "medication" &&
      (event.payload as { medication_type: string }).medication_type !== "ocitocina",
  );
  const membraneRuptureEvents = events.filter((event) => event.type === "membrane_rupture");
  const vitalsEvents = events.filter((event) => event.type === "maternal_vitals");
  const urineEvents = events.filter((event) => event.type === "urine_test");

  const dilationPoints: ChartPoint[] = dilationEvents
    .map((event) => ({
      x: hoursSince(t0, event.occurredAt),
      y: (event.payload as { dilation_cm: number }).dilation_cm,
    }))
    .sort((a, b) => a.x - b.x);

  const stationPoints: ChartPoint[] = stationEvents
    .map((event) => ({
      x: hoursSince(t0, event.occurredAt),
      y: (event.payload as { station_lee: number }).station_lee,
    }))
    .sort((a, b) => a.x - b.x);

  const { alertLine, actionLine } = computeAlertActionLines(dilationPoints, 10);

  const bpmPoints: ChartPoint[] = fhrEvents
    .map((event) => ({
      x: hoursSince(t0, event.occurredAt),
      y: (event.payload as { bpm: number }).bpm,
    }))
    .sort((a, b) => a.x - b.x);

  const frequencyPoints: ChartPoint[] = contractionEvents
    .map((event) => {
      const { contractions_per_10min } = event.payload as { contractions_per_10min: number | null };
      return contractions_per_10min == null
        ? null
        : { x: hoursSince(t0, event.occurredAt), y: contractions_per_10min };
    })
    .filter((point): point is ChartPoint => point != null)
    .sort((a, b) => a.x - b.x);

  const durationPoints: ChartPoint[] = contractionEvents
    .map((event) => ({
      x: hoursSince(t0, event.occurredAt),
      y: (event.payload as { duration_seconds: number }).duration_seconds,
    }))
    .sort((a, b) => a.x - b.x);

  const concentrationPoints: ChartPoint[] = oxytocinEvents
    .map((event) => {
      const { oxytocin_concentration_u_per_l } = event.payload as {
        oxytocin_concentration_u_per_l: number | null;
      };
      return oxytocin_concentration_u_per_l == null
        ? null
        : { x: hoursSince(t0, event.occurredAt), y: oxytocin_concentration_u_per_l };
    })
    .filter((point): point is ChartPoint => point != null)
    .sort((a, b) => a.x - b.x);

  const dripRatePoints: ChartPoint[] = oxytocinEvents
    .map((event) => {
      const { oxytocin_drip_rate_gtt_per_min } = event.payload as {
        oxytocin_drip_rate_gtt_per_min: number | null;
      };
      return oxytocin_drip_rate_gtt_per_min == null
        ? null
        : { x: hoursSince(t0, event.occurredAt), y: oxytocin_drip_rate_gtt_per_min };
    })
    .filter((point): point is ChartPoint => point != null)
    .sort((a, b) => a.x - b.x);

  const systolicPoints: ChartPoint[] = vitalsEvents
    .map((event) => {
      const { systolic_bp } = event.payload as { systolic_bp: number | null };
      return systolic_bp == null ? null : { x: hoursSince(t0, event.occurredAt), y: systolic_bp };
    })
    .filter((point): point is ChartPoint => point != null)
    .sort((a, b) => a.x - b.x);

  const diastolicPoints: ChartPoint[] = vitalsEvents
    .map((event) => {
      const { diastolic_bp } = event.payload as { diastolic_bp: number | null };
      return diastolic_bp == null ? null : { x: hoursSince(t0, event.occurredAt), y: diastolic_bp };
    })
    .filter((point): point is ChartPoint => point != null)
    .sort((a, b) => a.x - b.x);

  const pulsePoints: ChartPoint[] = vitalsEvents
    .map((event) => {
      const { pulse_bpm } = event.payload as { pulse_bpm: number | null };
      return pulse_bpm == null ? null : { x: hoursSince(t0, event.occurredAt), y: pulse_bpm };
    })
    .filter((point): point is ChartPoint => point != null)
    .sort((a, b) => a.x - b.x);

  const volumePoints: ChartPoint[] = urineEvents
    .map((event) => {
      const { volume_ml } = event.payload as { volume_ml: number | null };
      return volume_ml == null ? null : { x: hoursSince(t0, event.occurredAt), y: volume_ml };
    })
    .filter((point): point is ChartPoint => point != null)
    .sort((a, b) => a.x - b.x);
  const maxVolume = Math.max(50, ...volumePoints.map((point) => point.y)) + 20;

  const medicationMarkers: EventMarker[] = otherMedicationEvents.map((event) => {
    const { medication_type, other_birth_medication_type } = event.payload as {
      medication_type: string;
      other_birth_medication_type: string | null;
    };
    const label =
      medication_type === "outros" && other_birth_medication_type
        ? other_birth_medication_type
        : (BIRTH_MEDICATION_TYPE_LABELS[medication_type] ?? medication_type);
    return { id: event.id, hours: hoursSince(t0, event.occurredAt), label, color: EVENT_MEDICATION };
  });

  const ruptureMarkers: EventMarker[] = membraneRuptureEvents.map((event) => {
    const { rupture_type, fluid_type_at_rupture } = event.payload as {
      rupture_type: string;
      fluid_type_at_rupture: string | null;
    };
    const ruptureLabel = BIRTH_MEMBRANE_RUPTURE_TYPE_LABELS[rupture_type] ?? rupture_type;
    const fluidLabel = fluid_type_at_rupture
      ? (AMNIOTIC_FLUID_TYPE_LABELS[fluid_type_at_rupture] ?? fluid_type_at_rupture)
      : null;
    return {
      id: event.id,
      hours: hoursSince(t0, event.occurredAt),
      label: fluidLabel ? `Bolsa: ${ruptureLabel} (${fluidLabel})` : `Bolsa: ${ruptureLabel}`,
      color: EVENT_RUPTURE,
    };
  });

  const eventMarkers = [...medicationMarkers, ...ruptureMarkers].sort((a, b) => a.hours - b.hours);

  return (
    <View>
      <LineTrackBand
        title="Dilatação / Estação"
        maxHours={maxHours}
        primaryMin={0}
        primaryMax={10}
        primaryUnit="cm"
        primarySeries={[
          { label: "Dilatação", points: dilationPoints, color: PRIMARY },
          { label: "Linha de Alerta", points: alertLine, color: ALERT, dashed: true },
          { label: "Linha de Ação", points: actionLine, color: ACTION, dashed: true },
        ]}
        secondaryMin={-3}
        secondaryMax={3}
        secondaryUnit="De Lee"
        secondarySeries={[{ label: "Estação", points: stationPoints, color: SECONDARY }]}
      />
      <LineTrackBand
        title="BCF"
        maxHours={maxHours}
        primaryMin={80}
        primaryMax={200}
        primaryUnit="bpm"
        primarySeries={[{ label: "BCF", points: bpmPoints, color: PRIMARY }]}
        shadedBand={{ min: 110, max: 160, color: NORMAL_BAND }}
      />
      <LineTrackBand
        title="Contrações"
        maxHours={maxHours}
        primaryMin={0}
        primaryMax={6}
        primaryUnit="/10min"
        primarySeries={[{ label: "Frequência", points: frequencyPoints, color: PRIMARY }]}
        secondaryMin={0}
        secondaryMax={120}
        secondaryUnit="s"
        secondarySeries={[{ label: "Duração", points: durationPoints, color: SECONDARY }]}
      />
      <LineTrackBand
        title="Ocitocina"
        maxHours={maxHours}
        primaryMin={0}
        primaryMax={20}
        primaryUnit="U/L"
        primarySeries={[{ label: "Concentração", points: concentrationPoints, color: PRIMARY }]}
        secondaryMin={0}
        secondaryMax={60}
        secondaryUnit="gtt/min"
        secondarySeries={[{ label: "Gotejamento", points: dripRatePoints, color: SECONDARY }]}
      />
      <EventTrackBand title="Medicações / Bolsa Rota" maxHours={maxHours} markers={eventMarkers} />
      <LineTrackBand
        title="Vitais Maternos"
        maxHours={maxHours}
        primaryMin={40}
        primaryMax={200}
        primaryUnit="mmHg"
        primarySeries={[
          { label: "PA sistólica", points: systolicPoints, color: PRIMARY },
          { label: "PA diastólica", points: diastolicPoints, color: TERTIARY },
        ]}
        secondaryMin={40}
        secondaryMax={160}
        secondaryUnit="bpm"
        secondarySeries={[{ label: "Pulso", points: pulsePoints, color: SECONDARY }]}
      />
      <LineTrackBand
        title="Urina"
        maxHours={maxHours}
        primaryMin={0}
        primaryMax={maxVolume}
        primaryUnit="mL"
        primarySeries={[{ label: "Volume", points: volumePoints, color: PRIMARY }]}
      />
    </View>
  );
}
