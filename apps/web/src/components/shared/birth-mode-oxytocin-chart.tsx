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

const CONCENTRATION_MIN = 0;
const CONCENTRATION_MAX = 20;
const DRIP_RATE_MIN = 0;
const DRIP_RATE_MAX = 50;

type BirthModeOxytocinChartProps = {
  events: BirthModeTimelineEvent[];
};

export function BirthModeOxytocinChart({ events }: BirthModeOxytocinChartProps) {
  const [primaryColor, setPrimaryColor] = useState<string | null>(null);
  const isCompact = useIsCompactViewport();

  useEffect(() => {
    setPrimaryColor(`hsl(${getCssVar("--primary")})`);
  }, []);

  const oxytocinEvents = events.filter(
    (event) =>
      event.type === "medication" &&
      (event.payload as { medication_type: string }).medication_type === "ocitocina",
  );

  if (primaryColor === null) {
    return <div className="h-48 animate-pulse rounded-lg bg-muted" />;
  }

  if (oxytocinEvents.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-xs">
        Nenhum registro de ocitocina ainda
      </div>
    );
  }

  const t0 = resolveChartT0(events);

  if (t0 === null) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-xs">
        Nenhum registro de ocitocina ainda
      </div>
    );
  }

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

  const allX = [...concentrationPoints, ...dripRatePoints].map((point) => point.x);
  const maxX = Math.ceil(Math.max(1, ...allX));
  // Chart.js ignora ticks.stepSize e recalcula um passo "nice number" (ex: 1.9, 3.7)
  // quando autoSkip precisa reduzir a quantidade de ticks abaixo do que stepSize
  // produziria. Calculamos o passo inteiro nós mesmos e desligamos o autoSkip para
  // garantir que as linhas de grade caiam sempre em horas inteiras.
  const xTickStepHours = Math.max(1, Math.ceil(maxX / (isCompact ? 6 : 12)));

  const data = {
    datasets: [
      {
        label: "Concentração (U/L)",
        data: concentrationPoints,
        borderColor: primaryColor,
        borderWidth: 1,
        backgroundColor: "rgba(0, 0, 0, 0.0)",
        pointStyle: "circle" as const,
        pointRadius: 4,
        pointHoverRadius: 4,
        yAxisID: "y",
        spanGaps: false,
      },
      {
        label: "Gotejamento (gtt/min)",
        data: dripRatePoints,
        borderColor: "rgba(249, 115, 22, 0.9)",
        borderWidth: 1,
        backgroundColor: "rgba(0, 0, 0, 0.0)",
        pointStyle: "rectRot" as const,
        pointRadius: 4,
        pointHoverRadius: 4,
        yAxisID: "y1",
        spanGaps: false,
      },
    ],
  };

  return (
    <div className="relative h-48 min-w-0">
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
              title: { display: false, text: "Horas desde o início" },
              ticks: {
                stepSize: xTickStepHours,
                autoSkip: false,
                maxRotation: 0,
              },
              grid: { display: true, drawOnChartArea: true },
            },
            y: {
              min: CONCENTRATION_MIN,
              max: CONCENTRATION_MAX,
              title: { display: true, text: "Concentração (U/L)" },
            },
            y1: {
              min: DRIP_RATE_MIN,
              max: DRIP_RATE_MAX,
              position: "right" as const,
              grid: { drawOnChartArea: false },
              title: { display: true, text: "Gotejamento (gtt/min)" },
            },
          },
          plugins: {
            legend: {
              display: false,
              position: "bottom" as const,
              labels: { boxWidth: 10, font: { size: isCompact ? 9 : 10 } },
            },
            tooltip: { filter: (item) => item.dataset.label != null },
          },
        }}
      />
    </div>
  );
}
