const INTERMEDIATE_THRESHOLD_SECONDS = 20;

export type UterineActivityInput = {
  interval_minutes: 10 | 20 | 30;
  durations_seconds: number[];
};

function splitIntoBlocks<T>(items: T[], blockCount: number): T[][] {
  const base = Math.floor(items.length / blockCount);
  const remainder = items.length % blockCount;
  const blocks: T[][] = [];
  let cursor = 0;
  for (let i = 0; i < blockCount; i++) {
    const size = base + (i < remainder ? 1 : 0);
    blocks.push(items.slice(cursor, cursor + size));
    cursor += size;
  }
  return blocks;
}

function formatBlockNotation(blockDurations: number[]): string {
  const registrable = blockDurations.filter((d) => d >= INTERMEDIATE_THRESHOLD_SECONDS);
  if (registrable.length === 0) return `DU 0/10'/0"`;
  const average = Math.round(registrable.reduce((sum, d) => sum + d, 0) / registrable.length);
  return `DU ${registrable.length}/10'/${average}"`;
}

/** Decompõe um registro de dinâmica uterina em notações DU por bloco de 10 minutos.
 * Contrações <20s (não efetivas) são excluídas da contagem e da média de cada bloco,
 * mas permanecem no array bruto persistido em `durations_seconds`. */
export function computeDuNotations(input: UterineActivityInput): string[] {
  const blockCount = input.interval_minutes / 10;
  const blocks = splitIntoBlocks(input.durations_seconds, blockCount);
  return blocks.map(formatBlockNotation);
}
