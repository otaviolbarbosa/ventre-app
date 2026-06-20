"use client";

import type { Tables } from "@ventre/supabase";
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

// Fonte: INTERGROWTH-21st (Papageorghiou AT et al., BMJ 2016;355:i5662),
// referenciada pela Caderneta da Gestante do MS 2024. Constante clínica fixa.
const AU_REFERENCE: {
  week: number;
  p5: number;
  p10: number;
  p50: number;
  p90: number;
  p95: number;
}[] = [
  { week: 16, p5: 13.5, p10: 14.0, p50: 15.8, p90: 17.6, p95: 18.1 },
  { week: 17, p5: 14.4, p10: 14.9, p50: 16.8, p90: 18.6, p95: 19.1 },
  { week: 18, p5: 15.4, p10: 15.9, p50: 17.8, p90: 19.6, p95: 20.2 },
  { week: 19, p5: 16.3, p10: 16.9, p50: 18.8, p90: 20.7, p95: 21.2 },
  { week: 20, p5: 17.3, p10: 17.8, p50: 19.8, p90: 21.7, p95: 22.2 },
  { week: 21, p5: 18.2, p10: 18.8, p50: 20.8, p90: 22.7, p95: 23.3 },
  { week: 22, p5: 19.2, p10: 19.8, p50: 21.8, p90: 23.8, p95: 24.3 },
  { week: 23, p5: 20.1, p10: 20.7, p50: 22.8, p90: 24.8, p95: 25.4 },
  { week: 24, p5: 21.1, p10: 21.7, p50: 23.8, p90: 25.8, p95: 26.4 },
  { week: 25, p5: 22.1, p10: 22.7, p50: 24.7, p90: 26.8, p95: 27.4 },
  { week: 26, p5: 23.0, p10: 23.6, p50: 25.7, p90: 27.9, p95: 28.5 },
  { week: 27, p5: 23.9, p10: 24.6, p50: 26.7, p90: 28.9, p95: 29.5 },
  { week: 28, p5: 24.9, p10: 25.5, p50: 27.7, p90: 29.9, p95: 30.5 },
  { week: 29, p5: 25.8, p10: 26.4, p50: 28.6, p90: 30.9, p95: 31.5 },
  { week: 30, p5: 26.7, p10: 27.3, p50: 29.6, p90: 31.8, p95: 32.5 },
  { week: 31, p5: 27.6, p10: 28.2, p50: 30.5, p90: 32.8, p95: 33.5 },
  { week: 32, p5: 28.4, p10: 29.1, p50: 31.4, p90: 33.8, p95: 34.4 },
  { week: 33, p5: 29.3, p10: 30.0, p50: 32.3, p90: 34.7, p95: 35.4 },
  { week: 34, p5: 30.1, p10: 30.8, p50: 33.2, p90: 35.6, p95: 36.3 },
  { week: 35, p5: 30.9, p10: 31.6, p50: 34.0, p90: 36.5, p95: 37.2 },
  { week: 36, p5: 31.7, p10: 32.4, p50: 34.9, p90: 37.3, p95: 38.0 },
  { week: 37, p5: 32.5, p10: 33.2, p50: 35.7, p90: 38.2, p95: 38.9 },
  { week: 38, p5: 33.2, p10: 33.9, p50: 36.5, p90: 39.0, p95: 39.7 },
  { week: 39, p5: 33.9, p10: 34.7, p50: 37.2, p90: 39.8, p95: 40.5 },
  { week: 40, p5: 34.6, p10: 35.4, p50: 38.0, p90: 40.5, p95: 41.3 },
  // { week: 41, p5: 35.3, p10: 36.0, p50: 38.7, p90: 41.3, p95: 42.0 },
];

const Y_MIN = 10;
const Y_MAX = 45;

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

type Evolution = Pick<
  Tables<"pregnancy_evolutions">,
  "uterine_height_cm" | "gestational_weeks" | "gestational_days"
>;

export function UterineHeightChart({ evolutions }: { evolutions: Evolution[] }) {
  const [primaryColor, setPrimaryColor] = useState<string | null>(null);

  useEffect(() => {
    setPrimaryColor(`hsl(${getCssVar("--primary")})`);
  }, []);

  if (primaryColor === null) {
    return (
      <div className="rounded-lg border p-4">
        <p className="mb-3 font-semibold text-sm">Altura Uterina (AU)</p>
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  const realPoints = evolutions
    .filter(
      (ev): ev is Evolution & { uterine_height_cm: number; gestational_weeks: number } =>
        ev.uterine_height_cm != null && ev.gestational_weeks != null,
    )
    .map((ev) => ({
      x: ev.gestational_weeks + (ev.gestational_days ?? 0) / 7,
      y: ev.uterine_height_cm,
    }))
    .sort((a, b) => a.x - b.x);

  // Ordem dos datasets é obrigatória: fill: '-1' referencia o dataset anterior
  // por índice no array, não por nome. [topo, p90, p50, p10, base, p95, p5, real].
  const data = {
    datasets: [
      {
        label: undefined,
        data: AU_REFERENCE.map((r) => ({ x: r.week, y: Y_MAX })),
        borderWidth: 0,
        pointRadius: 0,
      },
      {
        label: "P90",
        data: AU_REFERENCE.map((r) => ({ x: r.week, y: r.p90 })),
        borderColor: "rgba(239, 68, 68, 0.8)",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        borderWidth: 1,
        fill: "-1" as const,
        tension: 0.4,
        pointRadius: 0,
      },
      {
        label: "Mediana (P50)",
        data: AU_REFERENCE.map((r) => ({ x: r.week, y: r.p50 })),
        borderColor: "rgba(59, 130, 246, 0.8)",
        borderWidth: 1,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
      },
      {
        label: "P10",
        data: AU_REFERENCE.map((r) => ({ x: r.week, y: r.p10 })),
        borderColor: "rgba(239, 68, 68, 0.8)",
        borderWidth: 1,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
      },
      {
        label: undefined,
        data: AU_REFERENCE.map((r) => ({ x: r.week, y: Y_MIN })),
        borderWidth: 0,
        pointRadius: 0,
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        fill: "-1" as const,
      },
      {
        label: "P95",
        data: AU_REFERENCE.map((r) => ({ x: r.week, y: r.p95 })),
        borderColor: "rgba(239, 68, 68, 0.4)",
        borderWidth: 1,
        borderDash: [5, 5],
        fill: false,
        tension: 0.4,
        pointRadius: 0,
      },
      {
        label: "P5",
        data: AU_REFERENCE.map((r) => ({ x: r.week, y: r.p5 })),
        borderColor: "rgba(239, 68, 68, 0.4)",
        borderWidth: 1,
        borderDash: [5, 5],
        fill: false,
        tension: 0.4,
        pointRadius: 0,
      },
      {
        label: "Gestante",
        data: realPoints,
        borderColor: primaryColor,
        backgroundColor: primaryColor,
        pointStyle: "circle" as const,
        pointRadius: 4,
        spanGaps: false,
      },
    ],
  };

  return (
    <div className="rounded-lg border p-4">
      <p className="mb-3 font-semibold text-sm">Altura Uterina (AU)</p>
      <div className="h-64">
        <Line
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                type: "linear",
                min: 16,
                max: 40,
                title: { display: true, text: "Semanas" },
              },
              y: {
                min: Y_MIN,
                max: Y_MAX,
                title: { display: true, text: "AU (cm)" },
              },
            },
            plugins: {
              legend: {
                display: false,
                labels: {
                  filter: (item) => Boolean(item.text),
                },
              },
              tooltip: {
                filter: (item) => item.dataset.label != null,
              },
            },
          }}
        />
      </div>
    </div>
  );
}
