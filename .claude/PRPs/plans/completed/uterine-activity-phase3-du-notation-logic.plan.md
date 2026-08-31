# Feature: Dinâmica Uterina — Fase 3: Lógica de Notação DU

## Summary

Implementar uma função pura e testável que calcula a notação DU (`DU n/10'/duração"`) a partir de um registro em lote de dinâmica uterina, decompondo registros de 20/30 minutos em sub-blocos de 10 minutos. Como este é o primeiro código do repositório a exigir testes unitários automatizados, esta fase também introduz a infraestrutura de testes (Vitest) em `apps/web` — inexistente até agora em todo o monorepo.

## User Story

As a médica obstetra ou enfermeira obstétrica
I want to que o sistema calcule automaticamente a notação DU correta a partir das durações que informo
So that eu veja a notação em destaque no modal (Fase 4) sem precisar calcular manualmente médias e agrupamentos de 10 em 10 minutos

## Problem Statement

Não existe hoje nenhuma função no codebase que calcule a notação DU ou que decomponha um registro de 20/30 minutos em sub-blocos de 10 minutos. Sem ela, o modal da Fase 4 não tem como preencher o campo `du_notations` (obrigatório em `birth_uterine_activity`, aceito pelo action da Fase 2 como entrada já calculada pelo cliente).

## Solution Statement

Novo módulo `apps/web/src/lib/birth-mode-uterine-activity-utils.ts` com uma função pura `computeDuNotations(input)`, sem I/O, sem dependência de Supabase/React. O algoritmo é extraído diretamente dos exemplos numéricos do documento de requisito original (`prompts/019-uterine-activity.md`, não apenas do PRD, que os parafraseia): (1) decompor o array de durações em `interval_minutes / 10` blocos, distribuindo o resto para os primeiros blocos; (2) dentro de cada bloco, excluir contrações `< 20s` (não efetivas, "não devem ser registradas" — mesmo limiar do enum `birth_contraction_effectiveness`); (3) formatar `DU {count}/10'/{avg}"` com `avg` arredondado. Testes unitários (Vitest, introduzido nesta fase) cobrem os três exemplos numéricos do requisito, incluindo o caso de "primeira contração desprezada".

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------|
| Type             | NEW_CAPABILITY                                                       |
| Complexity       | MEDIUM                                                                |
| Systems Affected | `apps/web/src/lib`, `apps/web` build tooling (novo test runner), `turbo.json` |
| Dependencies     | `vitest` (NOVO — nenhuma versão pré-existente no repo, escolhida por ser o padrão de-facto para TS/Next.js/Turborepo, zero-config com Vite, rápida) |
| Estimated Tasks  | 4                                                                     |

---

## UX Design

Esta fase não tem UI própria — é lógica pura consumida pela Fase 4 (modal). O "antes/depois" é sobre a disponibilidade da função, não sobre uma tela.

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║  Modal (Fase 4, futuro) ──X──► Nenhuma função de cálculo disponível        ║
║                                                                             ║
║  Profissional preencheria quantidade/intervalo/durações mas não haveria    ║
║  como calcular ou exibir a notação DU em tempo real.                       ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║  computeDuNotations({ interval_minutes, durations_seconds })              ║
║     ──► decompõe em blocos de 10 min (resto nos primeiros blocos)         ║
║     ──► filtra durações < 20s por bloco                                   ║
║     ──► formata "DU {count}/10'/{avg}\"" por bloco                        ║
║     ──► retorna string[] pronta para preencher du_notations               ║
║                                                                             ║
║  VALUE_ADD: Fase 4 pode consumir esta função diretamente para exibir a     ║
║             notação em tempo real conforme o profissional digita.         ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes
| Location | Before | After | Impact |
|----------|--------|-------|--------|
| `apps/web/src/lib/` | Sem lógica de notação DU | `computeDuNotations` disponível e testada | Fase 4 (modal) pode ser implementada sem bloqueio |

---

## Mandatory Reading

**CRITICAL: Ler estes arquivos/trechos antes de iniciar qualquer task.**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `prompts/019-uterine-activity.md` | 15-41 (full) | **Fonte primária dos exemplos numéricos** — o PRD só parafraseia isto. Contém os 3 casos que viram os testes unitários desta fase, incluindo o texto exato do caso "primeira contração desprezada" |
| P0 | `apps/web/src/lib/validations/birth-mode.ts` | 132-152 (`birthUterineActivitySchema`) | Contrato de entrada exato: `interval_minutes: 10\|20\|30`, `contraction_count`, `durations_seconds: number[]`, `du_notations: string[]` |
| P1 | `packages/supabase/supabase/migrations/20260822000005_birth_contractions.sql` | 1, 10-14 | Limiares herdados do enum `birth_contraction_effectiveness`: `>40` efetiva, `>=20` intermediária, `<20` não efetiva |
| P1 | `apps/web/src/lib/partograph-overlay-svg.ts` | 213-262 | Referência conceitual dos mesmos limiares (20/40) já usados em outro contexto do produto — não reutilizável diretamente, mas confirma os valores |
| P2 | `packages/supabase/supabase/migrations/20260831000000_birth_uterine_activity.sql` | full | Constraint `contraction_count <= (interval_minutes/10)*6` — define o teto de contrações por bloco de 10 min, relevante para os casos de teste |

**External Documentation:**
| Source | Section | Why Needed |
|--------|---------|------------|
| [Vitest — Getting Started](https://vitest.dev/guide/) | Config básica + `vitest.config.ts` | Nenhum framework de teste existe no repo; esta é a primeira introdução — usar a config zero-setup recomendada oficialmente, sem plugins extras não necessários (não precisamos de DOM/jsdom, é lógica pura) |

---

## Patterns to Mirror

**Não há padrão de teste pré-existente no repositório** (confirmado: zero arquivos `*.test.ts`, zero config de vitest/jest/bun:test em qualquer `package.json` do monorepo). Esta fase estabelece a convenção pela primeira vez — decisões de naming/estrutura abaixo são novas, não espelhadas de código existente.

**NUMERIC_EXAMPLES (fonte: `prompts/019-uterine-activity.md:15-41`, literal):**
```
// Exemplo 1 — decomposição 20min, split desigual (linha 19):
// 5 contrações em 20 minutos, durações [23,25,33,40,42]
// -> "DU 3/10'/27\"" e "DU 2/10'/41\""
// (23+25+33)/3 = 27; (40+42)/2 = 41

// Exemplo 2 — decomposição 20min, split par (linha 27, contexto de chart, valida o split):
// 6 contrações em 20 minutos, durações [28,31,35,43,55,54]
// -> blocos [28,31,35] e [43,55,54] (3+3)

// Exemplo 3 — "primeira contração desprezada" (linhas 28-41):
// coluna de 10min com 3 contrações registradas, durações cruas [X<20, 18, 26]
// (o comentário do requisito lista só "18, 26" como as durações que contam)
// -> "DU 2/10'/22\"" (a contração <20s é excluída da contagem E da média)
// (18+26)/2 = 22
```

**SPLIT_ALGORITHM (derivado dos exemplos 1 e 2 — resto vai para os primeiros blocos):**
```
nBlocks = interval_minutes / 10
base = floor(count / nBlocks)
remainder = count % nBlocks
// os primeiros `remainder` blocos recebem (base + 1) elementos; os demais recebem `base`
// Exemplo 1: count=5, nBlocks=2 -> base=2, remainder=1 -> tamanhos [3, 2]  ✓
// Exemplo 2: count=6, nBlocks=2 -> base=3, remainder=0 -> tamanhos [3, 3]  ✓
```

---

## Files to Change

| File                                                                    | Action | Justification                                                        |
| -------------------------------------------------------------------------| ------ | ---------------------------------------------------------------------|
| `apps/web/package.json`                                                 | UPDATE | Adicionar `vitest` como devDependency + script `test`                |
| `apps/web/vitest.config.ts`                                             | CREATE | Config mínima do Vitest (resolve `@/*` alias, ambiente `node`)       |
| `turbo.json`                                                            | UPDATE | Adicionar task `test` ao pipeline                                    |
| `apps/web/src/lib/birth-mode-uterine-activity-utils.ts`                 | CREATE | Função pura `computeDuNotations`                                     |
| `apps/web/src/lib/birth-mode-uterine-activity-utils.test.ts`            | CREATE | Testes unitários cobrindo os 3 exemplos do requisito + edge cases    |

---

## NOT Building (Scope Limits)

- **UI/modal** — consumo de `computeDuNotations` no modal é Fase 4, não incluído aqui.
- **Componente de gráfico matriz** — a lógica de bucketing por coluna do gráfico (Fase 7) é related mas separada; esta fase entrega apenas a notação textual `du_notations`, não estruturas de dados para renderização de grid.
- **Setup de testes fora de `apps/web`** — não estender Vitest para `apps/admin`, `apps/storybook` ou `packages/*` nesta fase; escopo mínimo necessário para esta função.
- **Persistência/validação server-side de `du_notations`** — decisão já registrada na Fase 2: o server action aceita a notação computada pelo cliente sem revalidar a lógica de negócio.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|---------------|-----------|
| Runner de teste a introduzir | Vitest | Jest, bun:test | Vitest é o padrão de-facto para projetos TS/Next.js modernos, zero-config, rápido, sem necessidade de Babel/ts-jest; nenhum dos três tinha precedente no repo, então a escolha não quebra convenção alguma — Vitest minimiza fricção de setup |
| Onde filtrar contrações `<20s` | Dentro de cada bloco de 10min, APÓS a decomposição, ANTES do cálculo de média/contagem da notação | Filtrar antes da decomposição (sobre o array bruto) | O Exemplo 3 do requisito mostra a contração excluída sendo removida tanto da contagem quanto da média de um bloco específico de 10min — a ordem (decompor primeiro, filtrar depois) é a única consistente com os limiares por bloco descritos na linha 21-26 do requisito, que descreve o comportamento por "espaço reservado" (célula/bloco), não pelo registro inteiro |
| Comportamento quando um bloco fica com 0 contrações após o filtro | Retornar `"DU 0/10'/0\""` para esse bloco | Omitir o bloco do array retornado; lançar erro | Nenhum exemplo do requisito cobre esse caso — optamos pelo comportamento mais previsível (array sempre com `nBlocks` elementos, 1:1 com os blocos temporais) em vez de silenciosamente reduzir o tamanho do array, o que quebraria a expectativa de "um bloco = uma notação" ao consumir na Fase 4/7. **Marcado como decisão a validar com o time clínico antes do rollout da flag** (ver Risks) |
| Arredondamento da média | `Math.round` (mais próximo, .5 para cima) | `Math.floor`, `Math.trunc` | Todos os exemplos do requisito resultam em médias inteiras exatas (27, 41, 22), não há evidência direta do requisito sobre arredondamento fracionário — `Math.round` é a escolha mais natural/menos surpreendente para exibição a profissionais de saúde |
| Estrutura de teste | Arquivo colocado `*.test.ts` ao lado do módulo (convenção idiomática do Vitest) | Pasta `tests/` separada | Não há convenção pré-existente no repo; colocação lado-a-lado é o padrão mais comum em projetos Vitest/Next.js e mantém a fonte e o teste próximos |

---

## Step-by-Step Tasks

### Task 1: UPDATE `apps/web/package.json` + CREATE `apps/web/vitest.config.ts`

- **ACTION**: Adicionar Vitest como devDependency e script de teste
- **IMPLEMENT**:
  ```bash
  cd apps/web && pnpm add -D vitest
  ```
  Adicionar em `apps/web/package.json` scripts:
  ```json
  "test": "vitest run"
  ```
  Criar `apps/web/vitest.config.ts`:
  ```typescript
  import path from "node:path";
  import { defineConfig } from "vitest/config";

  export default defineConfig({
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    test: {
      environment: "node",
    },
  });
  ```
- **GOTCHA**: Não usar `environment: "jsdom"` — a função é pura, sem DOM, sem necessidade de simular browser; manter o teste rápido
- **GOTCHA**: `pnpm add -D vitest` sem pin de major version explícito — confirmar no `package.json` gerado a versão instalada e registrar no relatório de implementação (a versão exata só será conhecida após a instalação)
- **VALIDATE**: `cd apps/web && npx vitest --version` (confirma instalação bem-sucedida, sem rodar testes ainda)

### Task 2: UPDATE `turbo.json`

- **ACTION**: Adicionar task `test` ao pipeline do Turborepo
- **IMPLEMENT**:
  ```json
  "test": {
    "dependsOn": ["^test"],
    "outputs": []
  }
  ```
  (inserir no objeto `tasks`, ao lado de `build`/`lint`/`check-types`)
- **MIRROR**: `turbo.json` — estrutura idêntica à task `check-types` existente (`{ "dependsOn": ["^check-types"] }`)
- **VALIDATE**: `cat turbo.json` — confirmar JSON válido (sem vírgula sobrando/faltando)

### Task 3: CREATE `apps/web/src/lib/birth-mode-uterine-activity-utils.ts`

- **ACTION**: CREATE função pura de cálculo/decomposição da notação DU
- **IMPLEMENT**:
  ```typescript
  const EFFECTIVE_THRESHOLD_SECONDS = 40;
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
    const average = Math.round(
      registrable.reduce((sum, d) => sum + d, 0) / registrable.length,
    );
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
  ```
- **MIRROR**: Nenhum arquivo existente a espelhar estruturalmente — nova convenção; seguir o estilo de módulo utilitário puro já visto em `apps/web/src/lib/birth-mode-duplicate-check.ts` (funções nomeadas exportadas, sem classe, JSDoc apenas onde o "porquê" não é óbvio)
- **GOTCHA**: `EFFECTIVE_THRESHOLD_SECONDS` (40) está declarado mas não usado diretamente nesta função — ele documenta o limiar irmão (`efetiva`) do enum `birth_contraction_effectiveness` para contexto de leitura, mas a notação DU só precisa do limiar de 20s (contração "registrável" vs. não). Se o linter (`noUnusedVariables`) reclamar, considerar remover a constante não usada e comentar o valor 40 inline, ou usá-la para expor uma função auxiliar `classifyContraction` reutilizável pela Fase 7 — decisão a tomar durante a implementação, documentar como desvio se removida
- **GOTCHA**: `interval_minutes / 10` assume que o Zod já validou `10|20|30` — a função não revalida isso (fora do escopo de uma função pura de cálculo; validação é responsabilidade do schema, já implementado na Fase 2)
- **VALIDATE**: `cd apps/web && npx tsc --noEmit` (ou `pnpm check-types` na raiz — usar `NODE_OPTIONS="--max-old-space-size=8192"` se o processo `tsc` abortar por limitação de memória local, problema de ambiente já documentado na Fase 2, não relacionado ao código desta fase)

### Task 4: CREATE `apps/web/src/lib/birth-mode-uterine-activity-utils.test.ts`

- **ACTION**: CREATE testes unitários cobrindo os exemplos do requisito
- **IMPLEMENT**:
  ```typescript
  import { describe, expect, it } from "vitest";
  import { computeDuNotations } from "./birth-mode-uterine-activity-utils";

  describe("computeDuNotations", () => {
    it("calcula notação única para intervalo de 10 minutos", () => {
      expect(
        computeDuNotations({ interval_minutes: 10, durations_seconds: [45, 50, 55] }),
      ).toEqual([`DU 3/10'/50"`]);
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

    it("exclui contração <20s da contagem e da média (primeira contração desprezada)", () => {
      // Fonte: prompts/019-uterine-activity.md:28-41
      expect(
        computeDuNotations({ interval_minutes: 10, durations_seconds: [15, 18, 26] }),
      ).toEqual([`DU 2/10'/22"`]);
    });

    it("decompõe 30 minutos em 3 blocos", () => {
      const blocks = computeDuNotations({
        interval_minutes: 30,
        durations_seconds: [30, 32, 34, 36, 38, 40, 42, 44, 46],
      });
      expect(blocks).toHaveLength(3);
      expect(blocks).toEqual([`DU 3/10'/32"`, `DU 3/10'/38"`, `DU 3/10'/44"`]);
    });

    it("retorna notação zerada quando todas as contrações do bloco são <20s", () => {
      expect(
        computeDuNotations({ interval_minutes: 10, durations_seconds: [10, 15, 19] }),
      ).toEqual([`DU 0/10'/0"`]);
    });
  });
  ```
- **MIRROR**: Nenhum teste pré-existente — estrutura `describe`/`it`/`expect` é a convenção padrão do Vitest, estabelecida por esta task
- **GOTCHA**: O caso "30 minutos em 3 blocos" é **construído para esta implementação**, não extraído do documento de requisito (que só cobre exemplos de 10 e 20 minutos) — deixar claro no código/PR que este caso valida a generalização do algoritmo de split, não um exemplo clinicamente validado
- **VALIDATE**: `cd apps/web && pnpm test` — todos os 6 casos devem passar

---

## Testing Strategy

### Unit Tests to Write

| Test File                                                        | Test Cases                                                             | Validates                          |
| ------------------------------------------------------------------| ------------------------------------------------------------------------| ------------------------------------|
| `apps/web/src/lib/birth-mode-uterine-activity-utils.test.ts`      | 10min simples, 20min split desigual, 20min split par, desprezada, 30min, todas <20s | `computeDuNotations` — algoritmo completo |

### Edge Cases Checklist

- [x] Intervalo de 10 minutos (1 bloco, trivial)
- [x] Intervalo de 20 minutos com split desigual (5 contrações → 3+2)
- [x] Intervalo de 20 minutos com split par (6 contrações → 3+3)
- [x] Contração <20s excluída da contagem/média ("primeira contração desprezada")
- [x] Intervalo de 30 minutos (3 blocos) — caso construído, não do requisito
- [x] Todas as contrações de um bloco <20s → notação zerada
- [ ] Array vazio de durações (não coberto — `contraction_count >= 0` é permitido pelo schema/DB; comportamento com array vazio herda o caso "todas <20s" trivialmente, mas vale um teste explícito se o revisor considerar necessário)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
cd apps/web && npx tsc --noEmit
npx biome check apps/web/src/lib/birth-mode-uterine-activity-utils.ts apps/web/src/lib/birth-mode-uterine-activity-utils.test.ts apps/web/vitest.config.ts
```

**EXPECT**: Exit 0 em ambos. Se `tsc --noEmit` abortar com `Abort trap: 6` (exit 134), reexecutar com `NODE_OPTIONS="--max-old-space-size=8192"` — problema de ambiente já documentado na Fase 2, não relacionado ao código desta fase.

### Level 2: UNIT_TESTS

```bash
cd apps/web && pnpm test
```

**EXPECT**: 6/6 testes passando (ou mais, se o caso de array vazio for adicionado)

### Level 6: MANUAL_VALIDATION

1. Em um REPL do Node/ts-node, ou temporariamente dentro de um teste, chamar `computeDuNotations` com o payload de exemplo já usado na Fase 2 (`interval_minutes: 10, durations_seconds: [45,50,55]`) e confirmar que o resultado (`["DU 3/10'/50\""]`) é compatível com o `du_notations` esperado pelo action `addBirthUterineActivityAction`.

---

## Acceptance Criteria

- [ ] Vitest instalado e configurado em `apps/web`, task `test` adicionada ao `turbo.json`
- [ ] `computeDuNotations` implementada em `apps/web/src/lib/birth-mode-uterine-activity-utils.ts`
- [ ] Todos os 3 exemplos numéricos do documento de requisito (`prompts/019-uterine-activity.md`) cobertos por teste e passando, incluindo o caso "primeira contração desprezada"
- [ ] `pnpm test` (ou `cd apps/web && pnpm test`) executa e passa sem erros
- [ ] `tsc --noEmit` passa sem erros de tipo
- [ ] Biome lint limpo nos arquivos novos/alterados

---

## Completion Checklist

- [ ] Task 1 completa (Vitest instalado, config criado)
- [ ] Task 2 completa (`turbo.json` atualizado)
- [ ] Task 3 completa e validada (`tsc --noEmit`)
- [ ] Task 4 completa e validada (`pnpm test` — 6/6 passando)
- [ ] Level 1: Static analysis passa
- [ ] Level 2: Unit tests passam
- [ ] Level 6: Validação manual do payload de exemplo confirma compatibilidade com a Fase 2
- [ ] Todos os acceptance criteria atendidos

---

## Risks and Mitigations

| Risk               | Likelihood   | Impact       | Mitigation                              |
| ------------------ | ------------ | ------------ | ---------------------------------------- |
| Comportamento de "bloco com 0 contrações após filtro" (`DU 0/10'/0"`) não foi validado com a equipe clínica — é uma decisão de implementação, não do requisito original | M | M | Documentado explicitamente no Decisions Log; recomendar validação com o time de produto/clínico antes do rollout da flag `show_uterine_activity`, junto ao risco já registrado na Fase 2 sobre `maybeUnlockPartograph` |
| Algoritmo de split par/ímpar (resto nos primeiros blocos) foi inferido de apenas 2 exemplos do requisito (ambos com `interval_minutes=20`) — o caso de 30 minutos (3 blocos) não tem exemplo numérico de referência | M | M | Caso de 30min marcado explicitamente como "construído" nos testes e nesta plan, não como exemplo validado; se a Fase 4 (modal) ou testes manuais revelarem expectativa diferente da equipe obstétrica, revisar `splitIntoBlocks` antes do rollout |
| Introdução do Vitest pode conflitar com configuração futura de testes em outros pacotes do monorepo (ex. `packages/ui`, `apps/admin`) se convenções divergentes forem adotadas depois | L | L | Escopo desta fase é mínimo e isolado a `apps/web`; se outro pacote precisar de testes no futuro, a config aqui criada serve de referência mas não impõe nada aos demais |

---

## Notes

- O arquivo `prompts/019-uterine-activity.md` é a fonte de verdade dos exemplos numéricos — o PRD (`uterine-activity.prd.md`) apenas os referencia de forma resumida. Qualquer dúvida futura sobre a especificação exata da notação DU deve voltar a este arquivo primeiro.
- Esta é a primeira fase do projeto a introduzir testes automatizados no monorepo — a config do Vitest criada aqui é deliberadamente mínima (sem jsdom, sem setup files) porque a função é pura; não deve ser tomada como template completo para testar componentes React (Fase 4 não terá testes automatizados, seguindo a mesma lacuna de convenção já documentada na Fase 2 para os `add-birth-*-action.ts`).
- Depois desta fase, atualizar a tabela de fases do PRD (`uterine-activity.prd.md`): Status da Fase 3 → `complete`, campo PRP Plan apontando para este arquivo.
