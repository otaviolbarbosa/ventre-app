import { splitIntoBlocks } from "./birth-mode-uterine-activity-utils";

const INTERMEDIATE_THRESHOLD_SECONDS = 20;
const EFFECTIVE_THRESHOLD_SECONDS = 40;
const MAX_ROWS = 6;
const MIN_COLUMNS = 14;

export type UterineActivityChartCell = {
  symbol: "◢" | "⬛";
};

export type UterineActivityChartColumn = {
  cells: UterineActivityChartCell[];
};

export type UterineActivityChartRow = {
  interval_minutes: 10 | 20 | 30;
  durations_seconds: number[];
};

function classifyDuration(duration: number): UterineActivityChartCell["symbol"] | null {
  if (duration > EFFECTIVE_THRESHOLD_SECONDS) return "⬛";
  if (duration >= INTERMEDIATE_THRESHOLD_SECONDS) return "◢";
  return null;
}

function blockToColumn(blockDurations: number[]): UterineActivityChartColumn {
  const cells = blockDurations
    .map(classifyDuration)
    .filter((symbol): symbol is UterineActivityChartCell["symbol"] => symbol !== null)
    .slice(0, MAX_ROWS)
    .map((symbol) => ({ symbol }));
  return { cells };
}

/** Decompõe registros de dinâmica uterina (em ordem cronológica) em colunas de
 * células prontas para o gráfico matriz, uma coluna por bloco de 10 minutos.
 * Contrações <20s são excluídas; células são retornadas em ordem cronológica
 * (primeiro item = célula de baixo, via `flex-col-reverse` na renderização). */
export function computeUterineActivityChartColumns(
  rows: UterineActivityChartRow[],
): UterineActivityChartColumn[] {
  const columns: UterineActivityChartColumn[] = [];
  for (const row of rows) {
    const blockCount = row.interval_minutes / 10;
    const blocks = splitIntoBlocks(row.durations_seconds, blockCount);
    for (const block of blocks) {
      columns.push(blockToColumn(block));
    }
  }
  // O gráfico deve sempre mostrar pelo menos 14 colunas (mesmo sem dados suficientes
  // para preenchê-las), completando com colunas vazias à direita.
  while (columns.length < MIN_COLUMNS) {
    columns.push({ cells: [] });
  }
  return columns;
}
