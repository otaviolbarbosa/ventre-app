"use client";

import type { Tables } from "@ventre/supabase";
import { Tabs, TabsList, TabsTrigger } from "@ventre/ui/tabs";
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

type BmiCategory = "low" | "normal" | "overweight" | "obese";

function classifyBmi(bmi: number): BmiCategory {
  if (bmi < 18.5) return "low";
  if (bmi < 25.0) return "normal";
  if (bmi < 30.0) return "overweight";
  return "obese";
}

type BandPoint = { week: number; low: number; high: number };

// Fonte: CONMAI/UFRJ, adotada pelo MS em ago/2022 — Caderneta da Gestante 6ª ed.
// (prompts/009-gestational-weigth-gain.md, seção 4). Ganho cumulativo por trimestre.
// Ponto week:0 é assumido (0,0) — não há ganho antes da concepção.
const CONMAI_BANDS: Record<BmiCategory, BandPoint[]> = {
  low: [
    { week: 0, low: 0, high: 0 },
    { week: 13, low: 0.2, high: 1.2 },
    { week: 27, low: 5.6, high: 7.2 },
    { week: 40, low: 9.7, high: 12.2 },
  ],
  normal: [
    { week: 0, low: 0, high: 0 },
    { week: 13, low: -1.8, high: 0.7 },
    { week: 27, low: 3.1, high: 6.3 },
    { week: 40, low: 8.0, high: 12.0 },
  ],
  overweight: [
    { week: 0, low: 0, high: 0 },
    { week: 13, low: -1.6, high: -0.05 },
    { week: 27, low: 2.3, high: 3.7 },
    { week: 40, low: 7.0, high: 9.0 },
  ],
  obese: [
    { week: 0, low: 0, high: 0 },
    { week: 13, low: -1.6, high: 0.05 },
    { week: 27, low: 1.1, high: 2.7 },
    { week: 40, low: 5.0, high: 7.2 },
  ],
};

// Fonte: IOM 2009 (prompts/009-gestational-weigth-gain.md, seção 3) — apenas
// ganho total recomendado (gestação única), sem pontos por trimestre.
// Interpolação linear de (0,0) até (40, total) — decisão documentada no
// PRD (Technical Risks) como mitigação à ausência de pontos intermediários oficiais.
const IOM_TOTALS: Record<BmiCategory, { low: number; high: number }> = {
  low: { low: 12.5, high: 18.0 },
  normal: { low: 11.5, high: 16.0 },
  overweight: { low: 7.0, high: 11.5 },
  obese: { low: 5.0, high: 9.0 },
};

const IOM_BANDS: Record<BmiCategory, BandPoint[]> = Object.fromEntries(
  (Object.keys(IOM_TOTALS) as BmiCategory[]).map((category) => [
    category,
    [
      { week: 0, low: 0, high: 0 },
      { week: 40, low: IOM_TOTALS[category].low, high: IOM_TOTALS[category].high },
    ],
  ]),
) as Record<BmiCategory, BandPoint[]>;

const Y_MIN = -3;
const Y_MAX = 19;

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

type Evolution = Pick<
  Tables<"pregnancy_evolutions">,
  "weight_kg" | "gestational_weeks" | "gestational_days"
>;

type Standard = "conmai" | "iom";

export function GestationalWeightGainChart({
  evolutions,
  initialWeightKg,
  initialBmi,
}: {
  evolutions: Evolution[];
  initialWeightKg: number | null;
  initialBmi: number | null;
}) {
  const [primaryColor, setPrimaryColor] = useState<string | null>(null);
  const [standard, setStandard] = useState<Standard>("conmai");

  useEffect(() => {
    setPrimaryColor(`hsl(${getCssVar("--primary")})`);
  }, []);

  if (initialBmi == null) {
    return (
      <div className="rounded-lg border p-4">
        <p className="mb-3 font-semibold text-sm">Ganho de Peso Gestacional</p>
        <div className="flex h-64 items-center justify-center text-center">
          <p className="max-w-[220px] text-muted-foreground text-xs">
            IMC pré-gestacional não informado. Preencha o peso e altura iniciais para ver este
            gráfico.
          </p>
        </div>
      </div>
    );
  }

  if (primaryColor === null) {
    return (
      <div className="rounded-lg border p-4">
        <p className="mb-3 font-semibold text-sm">Ganho de Peso Gestacional</p>
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  const category = classifyBmi(initialBmi);
  const band = (standard === "conmai" ? CONMAI_BANDS : IOM_BANDS)[category];

  const realPoints =
    initialWeightKg == null
      ? []
      : evolutions
          .filter(
            (ev): ev is Evolution & { weight_kg: number; gestational_weeks: number } =>
              ev.weight_kg != null && ev.gestational_weeks != null,
          )
          .map((ev) => ({
            x: ev.gestational_weeks + (ev.gestational_days ?? 0) / 7,
            y: ev.weight_kg - initialWeightKg,
          }))
          .sort((a, b) => a.x - b.x);

  // Ordem dos datasets é obrigatória: fill: '-1' referencia o dataset anterior
  // por índice, não por nome. [limite superior, limite inferior (fill), pontos reais].
  const data = {
    datasets: [
      {
        label: "Limite superior",
        data: band.map((p) => ({ x: p.week, y: p.high })),
        borderColor: "rgba(34, 197, 94, 0.6)",
        borderWidth: 1,
        fill: false,
        tension: 0.2,
        pointRadius: 0,
      },
      {
        label: "Limite inferior",
        data: band.map((p) => ({ x: p.week, y: p.low })),
        borderColor: "rgba(34, 197, 94, 0.6)",
        backgroundColor: "rgba(34, 197, 94, 0.12)",
        borderWidth: 1,
        fill: "-1" as const,
        tension: 0.2,
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
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold text-sm">Ganho de Peso Gestacional</p>
        <Tabs value={standard} onValueChange={(v) => setStandard(v as Standard)}>
          <TabsList className="h-7">
            <TabsTrigger value="conmai" className="px-2 py-0.5 text-xs">
              CONMAI
            </TabsTrigger>
            <TabsTrigger value="iom" className="px-2 py-0.5 text-xs">
              IOM
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
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
                max: 40,
                title: { display: true, text: "Semanas" },
              },
              y: {
                min: Y_MIN,
                max: Y_MAX,
                title: { display: true, text: "Ganho (kg)" },
              },
            },
            plugins: {
              legend: { display: false },
              tooltip: { filter: (item) => item.dataset.label != null },
            },
          }}
        />
      </div>
    </div>
  );
}
