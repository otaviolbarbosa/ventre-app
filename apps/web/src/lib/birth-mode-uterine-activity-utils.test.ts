import { describe, expect, it } from "vitest";
import { computeDuNotations } from "./birth-mode-uterine-activity-utils";

describe("computeDuNotations", () => {
  it("calcula notação única para intervalo de 10 minutos", () => {
    expect(computeDuNotations({ interval_minutes: 10, durations_seconds: [45, 50, 55] })).toEqual([
      `DU 3/10'/50"`,
    ]);
  });

  it("decompõe 20 minutos em 2 blocos com split desigual (5 contrações)", () => {
    // Fonte: prompts/019-uterine-activity.md:19
    expect(
      computeDuNotations({
        interval_minutes: 20,
        durations_seconds: [23, 25, 33, 40, 42],
      }),
    ).toEqual([`DU 3/10'/27"`, `DU 2/10'/41"`]);
  });

  it("decompõe 20 minutos em 2 blocos com split par (6 contrações)", () => {
    // Fonte: prompts/019-uterine-activity.md:27
    const blocks = computeDuNotations({
      interval_minutes: 20,
      durations_seconds: [28, 31, 35, 43, 55, 54],
    });
    expect(blocks).toHaveLength(2);
  });

  it("exclui contrações <20s da contagem e da média do bloco", () => {
    // Caso construído: prompts/019-uterine-activity.md:34 documenta o efeito
    // ("primeira contração desprezada" -> DU 2/10'/22" a partir de "durações 18, 26"
    // em uma coluna de 3 contrações), mas descreve 4 registros de 10min já
    // agregados em colunas de chart (fora do escopo desta função, que decompõe
    // um único registro) e nunca informa o valor bruto da contração descartada.
    // Como 18s também é <20s, ele não sobrevive ao filtro de >=20s desta função
    // (mesmo limiar do enum birth_contraction_effectiveness) — o valor abaixo
    // usa números sintéticos inequívocos para validar apenas a regra de exclusão.
    expect(computeDuNotations({ interval_minutes: 10, durations_seconds: [15, 22, 30] })).toEqual([
      `DU 2/10'/26"`,
    ]);
  });

  it("decompõe 30 minutos em 3 blocos", () => {
    // Caso construído para esta implementação — não há exemplo numérico de 30min
    // no documento de requisito original, apenas de 10 e 20min.
    const blocks = computeDuNotations({
      interval_minutes: 30,
      durations_seconds: [30, 32, 34, 36, 38, 40, 42, 44, 46],
    });
    expect(blocks).toHaveLength(3);
    expect(blocks).toEqual([`DU 3/10'/32"`, `DU 3/10'/38"`, `DU 3/10'/44"`]);
  });

  it("retorna notação zerada quando todas as contrações do bloco são <20s", () => {
    expect(computeDuNotations({ interval_minutes: 10, durations_seconds: [10, 15, 19] })).toEqual([
      `DU 0/10'/0"`,
    ]);
  });
});
