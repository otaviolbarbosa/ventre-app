"use client";

import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import { useIsCompactViewport } from "@/hooks/use-media-query";
import { type ChartPoint, hoursSince, resolveChartT0 } from "@/lib/birth-mode-chart-utils";
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

const BPM_MIN = 80;
const BPM_MAX = 200;
const NORMAL_RANGE_MIN = 110;
const NORMAL_RANGE_MAX = 160;

type BirthModeFetalHeartRateChartProps = {
  events: BirthModeTimelineEvent[];
};

export function BirthModeFetalHeartRateChart({ events }: BirthModeFetalHeartRateChartProps) {
  const [primaryColor, setPrimaryColor] = useState<string | null>(null);
  const isCompact = useIsCompactViewport();

  useEffect(() => {
    setPrimaryColor(`hsl(${getCssVar("--primary")})`);
  }, []);

  const bpmEvents = events.filter((event) => event.type === "fetal_heart_rate");

  if (primaryColor === null) {
    return <div className="h-64 animate-pulse rounded-lg bg-muted" />;
  }

  const t0 = resolveChartT0(events);

  if (t0 === null) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-xs">
        Nenhum registro de BCF ainda
      </div>
    );
  }

  const bpmPoints: ChartPoint[] = bpmEvents
    .map((event) => ({
      x: hoursSince(t0, event.occurredAt),
      y: (event.payload as { bpm: number }).bpm,
    }))
    .sort((a, b) => a.x - b.x);

  const maxX = Math.max(1, ...bpmPoints.map((point) => point.x)) + 1;

  // Banda sombreada de referência (110-160bpm): datasets invisíveis ancorando
  // fill: "-1", mesma técnica de UterineHeightChart (P90/P95 bands).
  const data = {
    datasets: [
      {
        label: undefined,
        data: [
          { x: 0, y: NORMAL_RANGE_MAX },
          { x: maxX, y: NORMAL_RANGE_MAX },
        ],
        borderWidth: 0,
        pointRadius: 0,
      },
      {
        label: "Faixa normal (110-160bpm)",
        data: [
          { x: 0, y: NORMAL_RANGE_MIN },
          { x: maxX, y: NORMAL_RANGE_MIN },
        ],
        borderColor: "rgba(34, 197, 94, 0.3)",
        backgroundColor: "rgba(34, 197, 94, 0.12)",
        borderWidth: 1,
        fill: "-1" as const,
        pointRadius: 0,
      },
      {
        label: "BCF (bpm)",
        data: bpmPoints,
        borderColor: primaryColor,
        backgroundColor: primaryColor,
        pointStyle: "circle" as const,
        pointRadius: 4,
        spanGaps: false,
      },
    ],
  };

  return (
    <div className="relative h-64 min-w-0">
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
              ticks: { maxTicksLimit: isCompact ? 4 : 8, maxRotation: 0 },
            },
            y: {
              min: BPM_MIN,
              max: BPM_MAX,
              title: { display: true, text: "BCF (bpm)" },
            },
          },
          plugins: {
            legend: {
              display: true,
              position: "bottom" as const,
              labels: {
                boxWidth: 10,
                font: { size: isCompact ? 9 : 10 },
                filter: (item) => Boolean(item.text),
              },
            },
            tooltip: { filter: (item) => item.dataset.label != null },
          },
        }}
      />
    </div>
  );
}
