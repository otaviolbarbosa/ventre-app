"use client";

import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import { type ChartPoint, hoursSince, resolveChartT0 } from "@/lib/birth-mode-chart-utils";
import { dayjs } from "@/lib/dayjs";
import {
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";

ChartJS.register(LineElement, PointElement, LinearScale, Tooltip, Legend, Filler);

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const BP_MIN = 40;
const BP_MAX = 200;
const PULSE_MIN = 40;
const PULSE_MAX = 160;

type BirthModeMaternalVitalsChartProps = {
  events: BirthModeTimelineEvent[];
};

export function BirthModeMaternalVitalsChart({ events }: BirthModeMaternalVitalsChartProps) {
  const [primaryColor, setPrimaryColor] = useState<string | null>(null);

  useEffect(() => {
    setPrimaryColor(`hsl(${getCssVar("--primary")})`);
  }, []);

  const vitalsEvents = events.filter((event) => event.type === "maternal_vitals");

  if (primaryColor === null) {
    return <div className="h-64 animate-pulse rounded-lg bg-muted" />;
  }

  if (vitalsEvents.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-xs">
        Nenhum registro de vitais maternos ainda
      </div>
    );
  }

  const t0 = resolveChartT0(events);

  if (t0 === null) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-xs">
        Nenhum registro de vitais maternos ainda
      </div>
    );
  }

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

  const temperatureEvents = vitalsEvents
    .filter((event) => (event.payload as { temperature_celsius: number | null }).temperature_celsius != null)
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  const allX = [...systolicPoints, ...diastolicPoints, ...pulsePoints].map((point) => point.x);
  const maxX = Math.max(1, ...allX) + 1;

  const data = {
    datasets: [
      {
        label: "PA sistólica",
        data: systolicPoints,
        borderColor: primaryColor,
        backgroundColor: primaryColor,
        pointStyle: "circle" as const,
        pointRadius: 4,
        yAxisID: "y",
        spanGaps: false,
      },
      {
        label: "PA diastólica",
        data: diastolicPoints,
        borderColor: "rgba(59, 130, 246, 0.8)",
        backgroundColor: "rgba(59, 130, 246, 0.8)",
        pointStyle: "triangle" as const,
        pointRadius: 4,
        yAxisID: "y",
        spanGaps: false,
      },
      {
        label: "Pulso (bpm)",
        data: pulsePoints,
        borderColor: "rgba(249, 115, 22, 0.9)",
        backgroundColor: "rgba(249, 115, 22, 0.9)",
        pointStyle: "rectRot" as const,
        pointRadius: 4,
        yAxisID: "y1",
        spanGaps: false,
      },
    ],
  };

  return (
    <div className="space-y-2">
      <div className="h-64">
        <Line
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                type: "linear",
                min: 0,
                max: maxX,
                title: { display: true, text: "Horas desde o início" },
              },
              y: {
                min: BP_MIN,
                max: BP_MAX,
                title: { display: true, text: "PA (mmHg)" },
              },
              y1: {
                min: PULSE_MIN,
                max: PULSE_MAX,
                position: "right" as const,
                grid: { drawOnChartArea: false },
                title: { display: true, text: "Pulso (bpm)" },
              },
            },
            plugins: {
              legend: {
                display: true,
                position: "bottom" as const,
                labels: { boxWidth: 10, font: { size: 10 } },
              },
              tooltip: { filter: (item) => item.dataset.label != null },
            },
          }}
        />
      </div>
      {temperatureEvents.length > 0 && (
        <div className="divide-y divide-border">
          {temperatureEvents.map((event) => {
            const { temperature_celsius } = event.payload as { temperature_celsius: number };
            return (
              <div key={event.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>Temperatura: {temperature_celsius}°C</span>
                <span className="whitespace-nowrap text-muted-foreground text-xs">
                  {dayjs(event.occurredAt).format("HH:mm")}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
