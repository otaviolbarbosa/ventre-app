"use client";

import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import { useIsCompactViewport } from "@/hooks/use-media-query";
import {
  type ChartPoint,
  computeAlertActionLines,
  hoursSince as hoursSinceT0,
  resolveChartT0,
} from "@/lib/birth-mode-chart-utils";
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

const DILATION_MIN = 0;
const DILATION_MAX = 10;
const STATION_MIN = -3;
const STATION_MAX = 3;

type BirthModeDilationStationChartProps = {
  events: BirthModeTimelineEvent[];
};

export function BirthModeDilationStationChart({ events }: BirthModeDilationStationChartProps) {
  const [primaryColor, setPrimaryColor] = useState<string | null>(null);
  const isCompact = useIsCompactViewport();

  useEffect(() => {
    setPrimaryColor(`hsl(${getCssVar("--primary")})`);
  }, []);

  const dilationEvents = events.filter((event) => event.type === "cervical_dilation");
  const stationEvents = events.filter((event) => event.type === "fetal_station");

  if (primaryColor === null) {
    return <div className="h-64 animate-pulse rounded-lg bg-muted" />;
  }

  const t0 = resolveChartT0(events);

  if (t0 === null) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-xs">
        Nenhum registro de dilatação ou estação ainda
      </div>
    );
  }

  const hoursSince = (iso: string) => hoursSinceT0(t0, iso);

  const dilationPoints: ChartPoint[] = dilationEvents
    .map((event) => ({
      x: hoursSince(event.occurredAt),
      y: (event.payload as { dilation_cm: number }).dilation_cm,
    }))
    .sort((a, b) => a.x - b.x);

  const stationPoints: ChartPoint[] = stationEvents
    .map((event) => ({
      x: hoursSince(event.occurredAt),
      y: (event.payload as { station_lee: number }).station_lee,
    }))
    .sort((a, b) => a.x - b.x);

  // Modelo clássico (Ministério da Saúde): fase ativa começa ao atingir 4cm de
  // dilatação; a Linha de Alerta sobe 1cm/h a partir desse ponto até 10cm; a
  // Linha de Ação é a mesma linha deslocada 4h à direita (PRD Fase 3).
  const { alertLine, actionLine } = computeAlertActionLines(dilationPoints, DILATION_MAX);

  const allX = [...dilationPoints, ...stationPoints, ...alertLine, ...actionLine].map(
    (point) => point.x,
  );
  const maxX = Math.max(4, ...allX) + 1;

  const data = {
    datasets: [
      {
        label: "Dilatação (cm)",
        data: dilationPoints,
        borderColor: primaryColor,
        backgroundColor: primaryColor,
        pointStyle: "circle" as const,
        pointRadius: 4,
        yAxisID: "y",
        spanGaps: false,
      },
      {
        label: "Estação (De Lee)",
        data: stationPoints,
        borderColor: "rgba(249, 115, 22, 0.9)",
        backgroundColor: "rgba(249, 115, 22, 0.9)",
        pointStyle: "rectRot" as const,
        pointRadius: 4,
        yAxisID: "y1",
        spanGaps: false,
      },
      {
        label: "Linha de Alerta",
        data: alertLine,
        borderColor: "rgba(234, 179, 8, 0.8)",
        borderDash: [6, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        yAxisID: "y",
      },
      {
        label: "Linha de Ação",
        data: actionLine,
        borderColor: "rgba(239, 68, 68, 0.8)",
        borderDash: [2, 3],
        borderWidth: 1.5,
        pointRadius: 0,
        yAxisID: "y",
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
              min: DILATION_MIN,
              max: DILATION_MAX,
              title: { display: true, text: "Dilatação (cm)" },
            },
            y1: {
              min: STATION_MIN,
              max: STATION_MAX,
              position: "right" as const,
              grid: { drawOnChartArea: false },
              title: { display: true, text: "Estação (De Lee)" },
            },
          },
          plugins: {
            legend: {
              display: true,
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
