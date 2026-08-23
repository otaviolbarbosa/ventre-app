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
import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";

ChartJS.register(LineElement, PointElement, LinearScale, Tooltip, Legend, Filler);

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Chart.js centra qualquer pointStyle (built-in ou canvas/imagem) no ponto de dados.
// Para a ponta do triângulo (e não o centro) ficar exatamente sobre o valor, desenhamos
// o triângulo num canvas próprio com o vértice superior no centro do canvas — assim o
// centro que o Chart.js usa para posicionar coincide com a ponta, não com o centroide.
function createApexTrianglePointStyle(color: string, size = 16): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const apexX = size / 2;
    const apexY = size / 2;
    const halfBase = size / 2.4;
    const baseY = apexY + halfBase * 1.4;
    ctx.beginPath();
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(apexX - halfBase, baseY);
    ctx.lineTo(apexX + halfBase, baseY);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  return canvas;
}

const DILATION_MIN = 0;
const DILATION_MAX = 10;
const STATION_MIN = -4;
const STATION_MAX = 4;

type BirthModeDilationStationChartProps = {
  events: BirthModeTimelineEvent[];
};

export function BirthModeDilationStationChart({ events }: BirthModeDilationStationChartProps) {
  const [primaryColor, setPrimaryColor] = useState<string | null>(null);
  const isCompact = useIsCompactViewport();

  useEffect(() => {
    setPrimaryColor(`hsl(${getCssVar("--primary")})`);
  }, []);

  const dilationPointStyle = useMemo(
    () => createApexTrianglePointStyle(primaryColor ?? "#000000", 16),
    [primaryColor],
  );

  const dilationEvents = events.filter((event) => event.type === "cervical_dilation");
  const stationEvents = events.filter((event) => event.type === "fetal_station");

  if (primaryColor === null) {
    return <div className="h-48 animate-pulse rounded-lg bg-muted" />;
  }

  const t0 = resolveChartT0(events);

  if (t0 === null) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-xs">
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
  const maxX = Math.ceil(Math.max(4, ...allX)) + 1;
  // Chart.js ignora ticks.stepSize e recalcula um passo "nice number" (ex: 1.9, 3.7)
  // quando autoSkip precisa reduzir a quantidade de ticks abaixo do que stepSize
  // produziria. Calculamos o passo inteiro nós mesmos e desligamos o autoSkip para
  // garantir que as linhas de grade caiam sempre em horas inteiras.
  const xTickStepHours = Math.max(1, Math.ceil(maxX / (isCompact ? 6 : 12)));

  const data = {
    datasets: [
      {
        label: "Dilatação (cm)",
        data: dilationPoints,
        borderColor: primaryColor,
        backgroundColor: primaryColor,
        pointStyle: dilationPointStyle,
        pointRadius: 6,
        yAxisID: "y",
        spanGaps: false,
        showLine: false,
      },
      {
        label: "Estação (De Lee)",
        data: stationPoints,
        borderColor: "rgba(249, 115, 22, 0.9)",
        backgroundColor: "rgba(249, 115, 22, 0.9)",
        pointStyle: "circle" as const,
        pointRadius: 8,
        yAxisID: "y1",
        spanGaps: false,
        showLine: false,
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
              min: DILATION_MIN,
              max: DILATION_MAX,
              title: { display: true, text: "Dilatação (cm) ▲" },
            },
            y1: {
              min: STATION_MIN,
              max: STATION_MAX,
              reverse: true,
              position: "right" as const,
              grid: { drawOnChartArea: false },
              title: { display: true, text: "Estação (De Lee) ●" },
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
