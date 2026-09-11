import { describe, expect, it } from "vitest";
import { computeUterineActivityChartColumns } from "./birth-mode-uterine-activity-chart-utils";

describe("computeUterineActivityChartColumns", () => {
  it("decompõe 20min em 2 colunas de 3 células cada (exemplo do requisito), preenchendo até 14 colunas", () => {
    // Fonte: prompts/019-uterine-activity.md:27
    const columns = computeUterineActivityChartColumns([
      { interval_minutes: 20, durations_seconds: [28, 31, 35, 43, 55, 54] },
    ]);
    expect(columns).toHaveLength(14);
    expect(columns[0]?.cells).toEqual([{ symbol: "◢" }, { symbol: "◢" }, { symbol: "◢" }]);
    expect(columns[1]?.cells).toEqual([{ symbol: "⬛" }, { symbol: "⬛" }, { symbol: "⬛" }]);
    expect(columns.slice(2)).toEqual(Array.from({ length: 12 }, () => ({ cells: [] })));
  });

  it("exclui contrações <20s da coluna", () => {
    const columns = computeUterineActivityChartColumns([
      { interval_minutes: 10, durations_seconds: [15, 25, 45] },
    ]);
    expect(columns).toHaveLength(14);
    expect(columns[0]?.cells).toEqual([{ symbol: "◢" }, { symbol: "⬛" }]);
  });

  it("concatena colunas de múltiplos registros em ordem cronológica", () => {
    const columns = computeUterineActivityChartColumns([
      { interval_minutes: 10, durations_seconds: [45, 50] },
      { interval_minutes: 10, durations_seconds: [25] },
    ]);
    expect(columns).toHaveLength(14);
    expect(columns[0]?.cells).toHaveLength(2);
    expect(columns[1]?.cells).toHaveLength(1);
  });

  it("retorna coluna com array de células vazio quando todas as contrações do bloco são <20s", () => {
    const columns = computeUterineActivityChartColumns([
      { interval_minutes: 10, durations_seconds: [10, 15] },
    ]);
    expect(columns).toEqual(Array.from({ length: 14 }, () => ({ cells: [] })));
  });

  it("preenche até 14 colunas quando não há registros", () => {
    const columns = computeUterineActivityChartColumns([]);
    expect(columns).toEqual(Array.from({ length: 14 }, () => ({ cells: [] })));
  });

  it("não corta colunas quando há mais de 14 blocos", () => {
    const columns = computeUterineActivityChartColumns([
      { interval_minutes: 30, durations_seconds: Array(18).fill(45) },
      { interval_minutes: 30, durations_seconds: Array(18).fill(45) },
      { interval_minutes: 30, durations_seconds: Array(18).fill(45) },
      { interval_minutes: 30, durations_seconds: Array(18).fill(45) },
      { interval_minutes: 30, durations_seconds: Array(18).fill(45) },
    ]);
    expect(columns).toHaveLength(15);
  });
});
