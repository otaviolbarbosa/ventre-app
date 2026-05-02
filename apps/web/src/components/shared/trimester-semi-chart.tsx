"use client";

import type { TrimesterCounts } from "@/services/home-enterprise";
import { Card, CardContent, CardHeader, CardTitle } from "@ventre/ui/card";
import { ArcElement, Chart as ChartJS, DoughnutController, Tooltip } from "chart.js";
import { useEffect, useState } from "react";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, DoughnutController, Tooltip);

type Props = {
  trimesterCounts: TrimesterCounts;
  total: number;
};

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function TrimesterSemiChart({ trimesterCounts, total }: Props) {
  const [colors, setColors] = useState<string[]>([]);

  useEffect(() => {
    setColors([
      `hsl(${getCssVar("--chart-1")})`,
      `hsl(${getCssVar("--chart-2")})`,
      `hsl(${getCssVar("--chart-3")})`,
    ]);
  }, []);

  const segments = [
    { label: "1º Trimestre", count: trimesterCounts.first },
    { label: "2º Trimestre", count: trimesterCounts.second },
    { label: "3º Trimestre", count: trimesterCounts.third },
  ];

  const isEmpty = segments.every((s) => s.count === 0);

  if (colors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gestantes por Trimestre</CardTitle>
        </CardHeader>
        <CardContent className="h-full">
          <div className="h-full animate-pulse rounded-lg bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const data = {
    labels: segments.map((s) => s.label),
    datasets: [
      {
        data: isEmpty ? [1, 1, 1] : segments.map((s) => s.count),
        backgroundColor: isEmpty
          ? ["hsl(var(--muted))", "hsl(var(--muted))", "hsl(var(--muted))"]
          : colors,
        borderRadius: 6,
        hoverOffset: isEmpty ? 0 : 6,
      },
    ],
  };

  return (
    <Card className="flex h-full flex-col p-1">
      <CardHeader className="p-4">
        <CardTitle>Gestantes por Trimestre</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 items-center justify-center bg-background">
        <div>
          {/* Semi-donut chart — rotation -180 draws the top arch (9 o'clock → 12 → 3 o'clock) */}
          <div className="relative" style={{ height: 160 }}>
            <Doughnut
              data={data}
              options={{
                circumference: 180,
                rotation: -90,
                cutout: "75%",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    enabled: !isEmpty,
                    callbacks: {
                      label: (ctx) => {
                        const v = ctx.parsed;
                        return ` ${v} gestante${v === 1 ? "" : "s"}`;
                      },
                    },
                  },
                },
              }}
            />
            {/* Center label positioned at the circle's center (bottom of the arch opening) */}
            <div className="-translate-x-1/2 absolute bottom-4 left-1/2 text-center">
              <p className="font-bold text-4xl tabular-nums leading-none">{total}</p>
              <p className="mt-1 text-muted-foreground text-xs">gestantes</p>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-2 flex flex-wrap justify-center gap-5">
            {segments.map((s, i) => (
              <div key={s.label} className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colors[i] }}
                />
                <div>
                  <p className="text-muted-foreground text-xs">{s.label}</p>
                  <p className="font-semibold text-sm">
                    {s.count} gestante{s.count === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
