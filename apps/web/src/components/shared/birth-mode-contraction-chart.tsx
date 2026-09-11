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

const DURATION_MIN = 0;
const DURATION_MAX = 120;

type BirthModeContractionChartProps = {
  events: BirthModeTimelineEvent[];
};

export function BirthModeContractionChart({ events }: BirthModeContractionChartProps) {
  const [primaryColor, setPrimaryColor] = useState<string | null>(null);
  const isCompact = useIsCompactViewport();

  useEffect(() => {
    setPrimaryColor(`hsl(${getCssVar("--primary")})`);
  }, []);

  const contractionEvents = events.filter((event) => event.type === "contraction");

  if (primaryColor === null) {
    return <div className="h-48 animate-pulse rounded-lg bg-muted" />;
  }

  const t0 = resolveChartT0(events);

  if (t0 === null) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-xs">
        Nenhum registro de contração ainda
      </div>
    );
  }

  const durationPoints: ChartPoint[] = contractionEvents
    .map((event) => ({
      x: hoursSince(t0, event.occurredAt),
      y: (event.payload as { duration_seconds: number }).duration_seconds,
    }))
    .sort((a, b) => a.x - b.x);

  const allX = durationPoints.map((point) => point.x);
  const maxX = Math.ceil(Math.max(1, ...allX)) + 1;
  // Chart.js ignora ticks.stepSize e recalcula um passo "nice number" (ex: 1.9, 3.7)
  // quando autoSkip precisa reduzir a quantidade de ticks abaixo do que stepSize
  // produziria. Calculamos o passo inteiro nós mesmos e desligamos o autoSkip para
  // garantir que as linhas de grade caiam sempre em horas inteiras.
  const xTickStepHours = Math.max(1, Math.ceil(maxX / (isCompact ? 6 : 12)));

  const data = {
    datasets: [
      {
        label: "Duração (s)",
        data: durationPoints,
        borderColor: primaryColor,
        borderWidth: 1,
        backgroundColor: "rgba(0, 0, 0, 0.0)",
        pointStyle: "circle" as const,
        pointRadius: 4,
        pointHoverRadius: 4,
        yAxisID: "y",
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
              min: DURATION_MIN,
              max: DURATION_MAX,
              title: { display: true, text: "Duração (s)" },
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
