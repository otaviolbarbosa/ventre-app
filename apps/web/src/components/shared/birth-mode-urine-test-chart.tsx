"use client";

import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import { useIsCompactViewport } from "@/hooks/use-media-query";
import { type ChartPoint, hoursSince, resolveChartT0 } from "@/lib/birth-mode-chart-utils";
import { BIRTH_URINE_DIPSTICK_LABELS } from "@/lib/birth-mode-constants";
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

type BirthModeUrineTestChartProps = {
  events: BirthModeTimelineEvent[];
};

export function BirthModeUrineTestChart({ events }: BirthModeUrineTestChartProps) {
  const [primaryColor, setPrimaryColor] = useState<string | null>(null);
  const isCompact = useIsCompactViewport();

  useEffect(() => {
    setPrimaryColor(`hsl(${getCssVar("--primary")})`);
  }, []);

  const urineEvents = events.filter((event) => event.type === "urine_test");

  if (primaryColor === null) {
    return <div className="h-48 animate-pulse rounded-lg bg-muted" />;
  }

  if (urineEvents.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-xs">
        Nenhum registro de urina encontrado
      </div>
    );
  }

  const t0 = resolveChartT0(events);

  if (t0 === null) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-xs">
        Nenhum registro de urina encontrado
      </div>
    );
  }

  const volumePoints: ChartPoint[] = urineEvents
    .map((event) => {
      const { volume_ml } = event.payload as { volume_ml: number | null };
      return volume_ml == null ? null : { x: hoursSince(t0, event.occurredAt), y: volume_ml };
    })
    .filter((point): point is ChartPoint => point != null)
    .sort((a, b) => a.x - b.x);

  const dipstickEvents = urineEvents
    .filter((event) => {
      const { protein_level, ketone_level } = event.payload as {
        protein_level: string | null;
        ketone_level: string | null;
      };
      return protein_level != null || ketone_level != null;
    })
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  const maxX = Math.ceil(Math.max(1, ...volumePoints.map((point) => point.x))) + 1;
  // Chart.js ignora ticks.stepSize e recalcula um passo "nice number" (ex: 1.9, 3.7)
  // quando autoSkip precisa reduzir a quantidade de ticks abaixo do que stepSize
  // produziria. Calculamos o passo inteiro nós mesmos e desligamos o autoSkip para
  // garantir que as linhas de grade caiam sempre em horas inteiras.
  const xTickStepHours = Math.max(1, Math.ceil(maxX / (isCompact ? 6 : 12)));
  const maxVolume = Math.max(50, ...volumePoints.map((point) => point.y)) + 20;

  const data = {
    datasets: [
      {
        label: "Volume (mL)",
        data: volumePoints,
        borderColor: primaryColor,
        backgroundColor: primaryColor,
        pointStyle: "circle" as const,
        pointRadius: 4,
        spanGaps: false,
      },
    ],
  };

  return (
    <div className="space-y-2">
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
                title: { display: true, text: "Horas desde o início" },
                ticks: {
                  stepSize: xTickStepHours,
                  autoSkip: false,
                  maxRotation: 0,
                },
                grid: { display: true, drawOnChartArea: true },
              },
              y: {
                min: 0,
                max: maxVolume,
                title: { display: true, text: "Volume (mL)" },
              },
            },
            plugins: {
              legend: { display: false },
              tooltip: { filter: (item) => item.dataset.label != null },
            },
          }}
        />
      </div>
      {dipstickEvents.length > 0 && (
        <div className="divide-y divide-border">
          {dipstickEvents.map((event) => {
            const { protein_level, ketone_level } = event.payload as {
              protein_level: string | null;
              ketone_level: string | null;
            };
            const parts = [
              protein_level ? `Proteína ${BIRTH_URINE_DIPSTICK_LABELS[protein_level]}` : null,
              ketone_level ? `Cetonúria ${BIRTH_URINE_DIPSTICK_LABELS[ketone_level]}` : null,
            ].filter(Boolean);
            return (
              <div key={event.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>{parts.join(" · ")}</span>
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
