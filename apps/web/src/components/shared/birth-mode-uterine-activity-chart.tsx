"use client";

import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import {
  type UterineActivityChartRow,
  computeUterineActivityChartColumns,
} from "@/lib/birth-mode-uterine-activity-chart-utils";

const MAX_ROWS = 6;

type BirthModeUterineActivityChartProps = {
  events: BirthModeTimelineEvent[];
};

export function BirthModeUterineActivityChart({ events }: BirthModeUterineActivityChartProps) {
  const rows: UterineActivityChartRow[] = events
    .filter((event) => event.type === "uterine_activity")
    .map((event) => {
      const { interval_minutes, durations_seconds } = event.payload as {
        interval_minutes: 10 | 20 | 30;
        durations_seconds: number[];
      };
      return { interval_minutes, durations_seconds };
    });

  if (rows.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-xs">
        Nenhum registro de dinâmica uterina ainda
      </div>
    );
  }

  const columns = computeUterineActivityChartColumns(rows);

  return (
    <div className="flex gap-0.5 overflow-x-auto">
      {columns.map((column, colIndex) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: colunas não têm identidade estável própria
        <div key={colIndex} className="flex flex-col-reverse gap-0.5">
          {Array.from({ length: MAX_ROWS }, (_, rowIndex) => {
            const cell = column.cells[rowIndex];
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: linhas são posições fixas 1-6
                key={rowIndex}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border text-sm"
              >
                {cell?.symbol ?? ""}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
