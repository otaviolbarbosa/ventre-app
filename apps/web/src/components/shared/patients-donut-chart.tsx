"use client";

import type { EnterpriseProfessional } from "@/services/home-enterprise";
import type { ChartData } from "chart.js";
import { ArcElement, Chart as ChartJS, DoughnutController, Legend, Tooltip } from "chart.js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, DoughnutController, Tooltip, Legend);

type PatientsDonutChartProps = {
  professionals: EnterpriseProfessional[];
};

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function PatientsDonutChart({ professionals }: PatientsDonutChartProps) {
  const router = useRouter();
  const [colors, setColors] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const vars = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];
    setColors(vars.map((v) => `hsl(${getCssVar(v)})`));
  }, []);

  const withPatients = professionals.filter((p) => p.patient_count > 0);

  const isEmpty = professionals.every((p) => p.patient_count === 0);

  if (withPatients.length === 0) {
    return <p className="text-muted-foreground text-sm">Nenhuma gestante distribuída</p>;
  }

  if (colors.length === 0) return null;

  const visible = withPatients.filter((p) => !hiddenIds.has(p.id));

  function toggleLegend(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const data: ChartData<"doughnut"> = {
    labels: visible.map((p) => p.name ?? "Profissional"),
    datasets: [
      {
        data: visible.map((p) => p.patient_count),
        backgroundColor: visible.map((_, i) => colors[i % colors.length]),
        borderRadius: 6,
        hoverOffset: isEmpty ? 0 : 6,
      },
    ],
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative h-[240px] w-full">
        {visible.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground text-sm">Nenhum profissional visível</p>
          </div>
        ) : (
          <Doughnut
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              cutout: "65%",
              onClick: (_, elements) => {
                if (elements.length > 0) {
                  const professional = visible[elements[0]?.index ?? 0];
                  if (professional) {
                    router.push(`/patients?professional=${professional.id}`);
                  }
                }
              },
              plugins: {
                legend: { display: false },
                tooltip: {
                  enabled: true,
                  callbacks: {
                    label: (context) => {
                      const value = context.parsed;
                      return ` ${value} ${value === 1 ? "gestante" : "gestantes"}`;
                    },
                  },
                },
              },
            }}
          />
        )}
      </div>
      <ul className="flex flex-wrap justify-center gap-3">
        {withPatients.map((p, i) => {
          const hidden = hiddenIds.has(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                className="flex cursor-pointer items-center gap-2 text-sm transition-opacity hover:opacity-75"
                style={{ opacity: hidden ? 0.4 : 1 }}
                onClick={() => toggleLegend(p.id)}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: colors[i % colors.length] }}
                />
                <span className={hidden ? "line-through" : ""}>{p.name ?? "Profissional"}</span>
                <span className="text-muted-foreground">
                  ({p.patient_count} {p.patient_count === 1 ? "gestante" : "gestantes"})
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
