# Feature: Aplicação Automática de Taxas de Cobrança (Phase 3)

## Summary

Hoje `enterprise_billing_fees` (taxas configuráveis pelo gestor) e a coluna `billings.applied_billing_fees` (snapshot imutável, default `'[]'`) já existem no schema, mas nada no código as conecta: `createBilling` em `apps/web/src/services/billing.ts` nunca lê as taxas ativas nem grava o snapshot. Esta fase implementa o cálculo: ao criar uma cobrança, buscamos as taxas ativas da empresa, calculamos a dedução de cada taxa sobre o valor de cada profissional dentro do `splitted_billing`, e persistimos um snapshot por profissional em `applied_billing_fees`. O valor bruto cobrado do paciente (`total_amount`, `splitted_billing`, parcelas) **não muda** — apenas o snapshot do valor líquido por profissional é adicionado, preparando o terreno para a exibição na Fase 4.

## User Story

As a gestor de empresa
I want to que as taxas que configurei sejam aplicadas automaticamente a toda cobrança nova
So that eu não precise calcular manualmente o valor líquido que cada profissional vai receber

## Problem Statement

`createBilling` constrói `splitted_billing` e parcelas sem qualquer conhecimento das taxas configuradas pelo gestor (Fases 1-2). O valor líquido por profissional não é calculado nem persistido em lugar nenhum — `applied_billing_fees` fica sempre `'[]'`.

## Solution Statement

Adicionar uma função pura de cálculo (`applyBillingFeesToSplit`) que recebe o `splitted_billing` e a lista de taxas ativas da empresa, e retorna um array de snapshots `{ professional_id, fee_id, name, fee_type, value, base_amount_cents, computed_amount_cents }` — um item por (profissional × taxa ativa). Cada taxa é calculada **independentemente sobre o valor bruto original do profissional** (não cascateando sobre o resultado da taxa anterior), arredondada por `Math.round` (round-half-up), e nunca deduz mais do que o valor bruto disponível (clamp em zero). Uma nova função de serviço `getActiveEnterpriseBillingFees(supabaseAdmin, enterpriseId)` busca apenas taxas `is_active = true` de uma empresa via client admin (necessário porque RLS de `enterprise_billing_fees` só permite leitura para `manager`/`secretary`, mas `createBilling` também é chamado por profissionais não-staff). `createBilling` passa a chamar essas duas funções e gravar o resultado em `applied_billing_fees` no insert de `billings`.

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------|
| Type             | ENHANCEMENT                                                           |
| Complexity       | MEDIUM                                                                |
| Systems Affected | `apps/web/src/services/billing.ts`, `apps/web/src/services/enterprise-billing-fees.ts`, `apps/web/src/lib/billing/calculations.ts` |
| Dependencies     | Nenhuma nova lib externa — apenas TypeScript/Supabase já em uso       |
| Estimated Tasks  | 5                                                                     |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐            ║
║   │ new-billing-│ ──────► │ createBilling│ ──────► │  billings   │            ║
║   │   modal     │         │  (billing.ts)│         │ INSERT row  │            ║
║   └─────────────┘         └─────────────┘         └─────────────┘            ║
║                                                            │                  ║
║                                                            ▼                  ║
║                                         applied_billing_fees = '[]' (default) ║
║                                                                                ║
║   USER_FLOW: gestor cadastra cobrança; taxas ativas (Fase 1-2) nunca são     ║
║               lidas ou aplicadas.                                            ║
║   PAIN_POINT: valor líquido por profissional precisa ser calculado fora da   ║
║               plataforma; coluna applied_billing_fees existe mas é morta.    ║
║                                                                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║   ┌─────────────┐    ┌──────────────┐    ┌────────────────────┐             ║
║   │ new-billing-│───►│ createBilling │───►│ getActiveEnterprise│             ║
║   │   modal     │    │  (billing.ts) │    │ BillingFees(admin, │             ║
║   └─────────────┘    └──────────────┘    │ enterpriseId)      │             ║
║                              │            └────────────────────┘             ║
║                              ▼                       │                       ║
║                    applyBillingFeesToSplit            │                      ║
║                    (splittedBilling, fees) ◄──────────┘                      ║
║                              │                                               ║
║                              ▼                                               ║
║                  ┌─────────────────────┐                                     ║
║                  │  billings INSERT    │                                     ║
║                  │  applied_billing_   │                                     ║
║                  │  fees = [snapshot]  │                                     ║
║                  └─────────────────────┘                                     ║
║                                                                                ║
║   USER_FLOW: cobrança criada após config de taxa já nasce com o snapshot     ║
║               do valor líquido por profissional.                             ║
║   VALUE_ADD: valor bruto cobrado do paciente é preservado; snapshot          ║
║               imutável habilita a Fase 4 (exibição do valor líquido).        ║
║   DATA_FLOW: enterpriseId → taxas ativas → cálculo independente por taxa →   ║
║              snapshot persistido junto com a cobrança, atomicamente no       ║
║              mesmo INSERT que já existia.                                    ║
║                                                                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes
| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| `services/billing.ts` `createBilling` | `applied_billing_fees` sempre `'[]'` | Snapshot populado com taxas ativas aplicadas por profissional | Nenhuma mudança visível ainda (Fase 4 exibe) — fundação de dados correta |
| Cobranças criadas sem taxas ativas configuradas | `applied_billing_fees = '[]'` | Continua `[]` (nenhuma taxa ativa = nenhuma dedução) | Comportamento inalterado para empresas sem taxas |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/services/billing.ts` | 294-379 | `createBilling` — função a ser modificada, entender split/total/installments antes de tocar |
| P0 | `apps/web/src/lib/billing/calculations.ts` | 1-37 | Padrão de arredondamento `Math.floor` + resto-no-primeiro-item a ser respeitado/contrastado |
| P0 | `packages/supabase/supabase/migrations/20260620000001_enterprise_billing_fees.sql` | 1-102 | Schema exato de `enterprise_billing_fees` e shape documentado de `applied_billing_fees` |
| P1 | `apps/web/src/services/enterprise-billing-fees.ts` | 1-22 | Função existente a ser complementada (não substituída) com versão que recebe `enterpriseId` explícito |
| P1 | `apps/web/src/lib/validations/enterprise-billing-fees.ts` | all | Confirma `fixed` em centavos inteiros, `percentage` em 0-100 |
| P1 | `apps/web/src/actions/add-billing-action.ts` | 1-50 | Um dos dois call sites de `createBilling` |
| P1 | `apps/web/src/actions/add-patient-action.ts` | 40-56 | Segundo call site de `createBilling` |
| P2 | `apps/web/src/actions/create-billing-fee-action.ts` | 1-44 | Referência de estilo (não aplicável a esta fase — sem novo audit log aqui) |

**External References:**
| Source | Section | Why Needed |
|--------|---------|------------|
| [Rounding rules for Stripe fees](https://support.stripe.com/questions/rounding-rules-for-stripe-fees) | Rounding to nearest cent | Justifica round-half-up por taxa, calculado independentemente |
| [Stripe Connect — custom pricing strategy](https://docs.stripe.com/connect/platform-pricing-tools/pricing-schemes) | Sequential modifiers example | Mostra que cascata é uma escolha explícita — reforça decisão de NÃO cascatear aqui |
| [Shopify Eng — Bound to Round](https://shopify.engineering/eight-tips-for-hanging-pennies) | Documenting rounding rules | Reforça documentar a regra explicitamente em vez de comportamento implícito |

---

## Patterns to Mirror

**ROUNDING_PATTERN (existing — installment totals, NOT to be copied verbatim but understood as contrast):**
```typescript
// SOURCE: apps/web/src/lib/billing/calculations.ts:8-12
export function calculateInstallmentAmount(totalAmount: number, count: number): number[] {
  const base = Math.floor(totalAmount / count);
  const remainder = totalAmount - base * count;
  return Array.from({ length: count }, (_, i) => (i === 0 ? base + remainder : base));
}
```
Esse padrão garante soma exata quando dividindo um total entre N partes (parcelas). **Não se aplica aqui**: cada taxa é uma dedução independente sobre o valor de UM profissional, não uma divisão de um total entre N partes — não há necessidade de "remainder ao primeiro item". Use `Math.round` simples por taxa.

**SERVICE_FUNCTION_PATTERN (existing fee fetcher, to extend not duplicate):**
```typescript
// SOURCE: apps/web/src/services/enterprise-billing-fees.ts:5-22
export async function getEnterpriseBillingFees(): Promise<Tables<"enterprise_billing_fees">[]> {
  const { profile } = await getServerAuth();
  if (!profile?.enterprise_id) return [];

  const supabaseAdmin = await createServerSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("enterprise_billing_fees")
    .select("*")
    .eq("enterprise_id", profile.enterprise_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getEnterpriseBillingFees]", error.message);
    return [];
  }

  return data;
}
```
GOTCHA: esta função usa `getServerAuth()` e não filtra `is_active` — não dá para reusá-la dentro de `createBilling`, que recebe `enterpriseId` como parâmetro explícito (pode ser de uma gestação do paciente, não do profile do chamador) e roda fora de contexto de request de settings. Criar uma função irmã, não modificar a existente (ela é usada pela tela de settings, que precisa ver taxas inativas também para permitir reativação).

**CREATE_BILLING_INSERT_PATTERN (existing, to extend with one new field):**
```typescript
// SOURCE: apps/web/src/services/billing.ts:325-340
const { data: billing, error: billingError } = await supabase
  .from("billings")
  .insert({
    patient_id,
    splitted_billing: splittedBilling,
    description,
    total_amount,
    payment_method,
    installment_count,
    installment_interval: installment_interval ?? null,
    installments_dates: dates.length > 0 ? dates : null,
    notes,
    ...(enterpriseId ? { enterprise_id: enterpriseId } : {}),
  })
  .select()
  .single();
```

---

## Files to Change

| File                                                     | Action | Justification                                                          |
| --------------------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| `apps/web/src/lib/billing/calculations.ts`                | UPDATE | Adicionar tipos `AppliedBillingFee`/`SplittedBilling` e a função pura `applyBillingFeesToSplit` |
| `apps/web/src/services/enterprise-billing-fees.ts`        | UPDATE | Adicionar `getActiveEnterpriseBillingFees(supabaseAdmin, enterpriseId)` |
| `apps/web/src/services/billing.ts`                        | UPDATE | `createBilling` busca taxas ativas, calcula snapshot, grava em `applied_billing_fees` |

Nenhum arquivo novo é necessário — não há nova migration (coluna já existe), nem nova action (lógica fica inteiramente dentro de `createBilling`, compartilhada pelos dois call sites existentes).

---

## NOT Building (Scope Limits)

- **Exibição do valor líquido na UI** — fica para a Fase 4 (`billing-card`, `installment-card`). Esta fase só persiste o snapshot.
- **Aplicação de taxas por parcela individual** — o snapshot é calculado UMA VEZ sobre o `splitted_billing` total da cobrança (valor bruto por profissional na cobrança inteira), não recalculado por parcela. Confirmado pelo PRD: "calculados sobre o valor de cada profissional dentro do `splitted_billing`", que é a estrutura no nível da cobrança, não da parcela.
- **Transação/rollback atômico entre `billings` e `installments`** — já não existe hoje (cada insert é sequencial, sem `.rpc()`); fora de escopo desta fase corrigir isso.
- **Correção do arredondamento `Math.round` sem resto em `splitted_installment` por parcela** (`billing.ts:351-357`) — bug pré-existente não relacionado a taxas; não tocar.
- **Audit log de "taxas aplicadas nesta cobrança"** — o PRD exige log apenas para criação/edição/desativação de taxa (já feito na Fase 2). A aplicação automática em uma cobrança não é uma mutação de configuração e não precisa de log próprio.

---

## Step-by-Step Tasks

Execute em ordem. Cada task é atômica e verificável independentemente.

### Task 1: UPDATE `apps/web/src/lib/billing/calculations.ts` — tipos e função de cálculo

- **ACTION**: Adicionar tipos e a função pura de aplicação de taxas
- **IMPLEMENT**:
  ```typescript
  import type { Tables } from "@ventre/supabase/types";

  export type SplittedBilling = Record<string, number>;

  export interface AppliedBillingFee {
    professional_id: string;
    fee_id: string;
    name: string;
    fee_type: "fixed" | "percentage";
    value: number;
    base_amount_cents: number;
    computed_amount_cents: number;
  }

  export function applyBillingFeesToSplit(
    splittedBilling: SplittedBilling,
    fees: Tables<"enterprise_billing_fees">[],
  ): AppliedBillingFee[] {
    const activeFees = fees.filter((fee) => fee.is_active);
    const appliedFees: AppliedBillingFee[] = [];

    for (const [professionalId, baseAmountCents] of Object.entries(splittedBilling)) {
      for (const fee of activeFees) {
        const rawAmount =
          fee.fee_type === "fixed" ? fee.value : Math.round(baseAmountCents * (fee.value / 100));
        const computedAmountCents = Math.min(Math.round(rawAmount), baseAmountCents);

        appliedFees.push({
          professional_id: professionalId,
          fee_id: fee.id,
          name: fee.name,
          fee_type: fee.fee_type,
          value: fee.value,
          base_amount_cents: baseAmountCents,
          computed_amount_cents: computedAmountCents,
        });
      }
    }

    return appliedFees;
  }
  ```
- **MIRROR**: Estilo de função pura sem side effects, como `calculateInstallmentAmount` (`calculations.ts:8-12`)
- **DECISION (regra de ordem/arredondamento — resolve open question do PRD)**: Cada taxa é calculada **independentemente sobre `base_amount_cents` original** do profissional (não cascateia sobre o resultado de taxas anteriores), arredondada com `Math.round` (round-half-up), e nunca deduz mais que o valor bruto disponível (`Math.min(..., baseAmountCents)` evita líquido negativo se uma taxa fixa for maior que o valor do profissional). Justificativa: Stripe trata cada fee/line item como cálculo independente arredondado para o centavo mais próximo antes de somar (ver Mandatory Reading); cascata é uma escolha explícita de design que não se aplica aqui pois as taxas representam deduções conceitualmente paralelas (taxa de NF, taxa de gateway, taxa de plataforma), não uma cadeia de markups sequenciais.
- **GOTCHA**: `fee.value` para `fixed` já está em centavos inteiros (vem do schema Zod com `Number.isInteger` check) — não multiplicar por 100. Para `percentage`, `fee.value` é 0-100 (não 0-1) — dividir por 100 antes de multiplicar.
- **VALIDATE**: `pnpm check-types`

### Task 2: UPDATE `apps/web/src/services/enterprise-billing-fees.ts` — buscar taxas ativas por enterpriseId explícito

- **ACTION**: Adicionar nova função exportada (não modificar `getEnterpriseBillingFees` existente — ela é usada pela tela de settings e precisa continuar retornando taxas inativas também)
- **IMPLEMENT**:
  ```typescript
  export async function getActiveEnterpriseBillingFees(
    supabaseAdmin: SupabaseAdminClient,
    enterpriseId: string,
  ): Promise<Tables<"enterprise_billing_fees">[]> {
    const { data, error } = await supabaseAdmin
      .from("enterprise_billing_fees")
      .select("*")
      .eq("enterprise_id", enterpriseId)
      .eq("is_active", true);

    if (error) {
      console.error("[getActiveEnterpriseBillingFees]", error.message);
      return [];
    }

    return data;
  }
  ```
- **MIRROR**: `apps/web/src/services/enterprise-billing-fees.ts:5-22` — mesmo padrão de erro tratado (log + retorna `[]`, nunca lança), mas com `enterpriseId` e `supabaseAdmin` como parâmetros explícitos em vez de derivar de `getServerAuth()`.
- **IMPORTS**: `import type { SupabaseClient } from "@supabase/supabase-js"` ou o alias de tipo `SupabaseAdminClient` já usado em `billing.ts` — verificar import exato usado em `billing.ts:296` e replicar.
- **GOTCHA**: Usar `supabaseAdmin` (service-role) é obrigatório aqui, não `supabase` anônimo — a RLS de `enterprise_billing_fees` só permite `SELECT` para `user_type IN ('manager', 'secretary')` (migration linhas 43-52), mas `createBilling` também é chamado quando um profissional (não-staff) cria sua própria cobrança via `add-billing-action.ts` (fallback de `enterpriseId` pela gestação ativa do paciente) — com client anônimo, a query retornaria silenciosamente vazio para esses casos, quebrando a aplicação de taxas exatamente no cenário mais comum.
- **VALIDATE**: `pnpm check-types`

### Task 3: UPDATE `apps/web/src/services/billing.ts` — integrar cálculo de taxas em `createBilling`

- **ACTION**: Buscar taxas ativas, calcular snapshot, adicionar ao insert de `billings`
- **IMPLEMENT**: Logo após a linha que computa `total_amount` (`billing.ts:318`) e antes do insert (`billing.ts:325`), adicionar:
  ```typescript
  const activeFees = enterpriseId
    ? await getActiveEnterpriseBillingFees(supabaseAdmin, enterpriseId)
    : [];
  const appliedBillingFees = applyBillingFeesToSplit(splittedBilling, activeFees);
  ```
  E no objeto do insert (`billing.ts:327-338`), adicionar o campo:
  ```typescript
  .insert({
    patient_id,
    splitted_billing: splittedBilling,
    description,
    total_amount,
    payment_method,
    installment_count,
    installment_interval: installment_interval ?? null,
    installments_dates: dates.length > 0 ? dates : null,
    notes,
    applied_billing_fees: appliedBillingFees,
    ...(enterpriseId ? { enterprise_id: enterpriseId } : {}),
  })
  ```
- **MIRROR**: Estrutura sequencial existente da função — sem mudar o fluxo de erro/return já estabelecido (`billing.ts:294-379`)
- **IMPORTS**: `import { applyBillingFeesToSplit } from "@/lib/billing/calculations";` (ajustar ao import já existente de `calculations.ts` no topo do arquivo, provavelmente já importa `calculateInstallmentAmount`/`calculateInstallmentDates` de lá) e `import { getActiveEnterpriseBillingFees } from "@/services/enterprise-billing-fees";`
- **GOTCHA**: `getActiveEnterpriseBillingFees` é assíncrona e nunca lança (retorna `[]` em erro) — não envolver em try/catch extra, apenas `await` direto, consistente com o padrão fire-safe já usado no arquivo.
- **GOTCHA**: `total_amount` cobrado do paciente (linha 318, soma de `splittedBilling`) **não muda** — `applied_billing_fees` é apenas um snapshot informativo de quanto cada profissional recebe líquido; não subtrair `computed_amount_cents` de `total_amount` nem de `splittedBilling` nesta fase.
- **VALIDATE**: `pnpm check-types`

### Task 4: UPDATE `pnpm db:types` — confirmar tipos gerados já refletem a coluna

- **ACTION**: Rodar `pnpm db:types` para garantir que `database.types.ts` está sincronizado (a coluna já existe desde a Fase 1, mas validar que nenhuma regeneração pendente quebra o build)
- **VALIDATE**: `git diff packages/supabase/src/types/database.types.ts` — não deve haver diff inesperado (coluna já presente conforme achado da exploração)

### Task 5: Validação manual ponta-a-ponta

- **ACTION**: Criar uma taxa fixa e uma percentual ativa para uma empresa de teste (via UI da Fase 2), criar uma cobrança nova (com e sem parcelamento, com `splitted_billing` multi-profissional), e inspecionar `applied_billing_fees` da linha criada em `billings` via Supabase Studio/MCP.
- **VALIDATE**: Confirmar que `applied_billing_fees` contém um item por (profissional × taxa ativa), `computed_amount_cents` correto para cada tipo, `total_amount`/`splitted_billing` inalterados, e que uma cobrança criada para empresa sem taxas ativas mantém `applied_billing_fees = []`.

---

## Testing Strategy

Não existem testes automatizados no monorepo (`apps/web` não tem `*.test.ts`/`*.spec.ts` hoje — confirmado na exploração). Esta fase não introduz framework de testes novo (fora de escopo). Validação é manual (Task 5) + `pnpm check-types`.

### Edge Cases Checklist

- [ ] Empresa sem nenhuma taxa configurada → `applied_billing_fees = []` (comportamento atual preservado)
- [ ] Empresa com taxas, mas todas `is_active = false` → `applied_billing_fees = []`
- [ ] Taxa fixa (cents) maior que o valor bruto do profissional → `computed_amount_cents` clampado em `base_amount_cents` (líquido nunca negativo)
- [ ] Múltiplas taxas (fixa + percentual) para o mesmo profissional → ambas aparecem como itens independentes no snapshot, cada uma calculada sobre o `base_amount_cents` original (não cascateado)
- [ ] `splitted_billing` com múltiplos profissionais → snapshot contém entradas para cada profissional × cada taxa ativa
- [ ] `enterpriseId` é `null`/`undefined` (cobrança sem empresa associada) → `applied_billing_fees = []`, sem chamada a `getActiveEnterpriseBillingFees`
- [ ] Cobrança criada via `add-patient-action.ts` (segundo call site) também recebe o snapshot, idêntico ao fluxo de `add-billing-action.ts`

---

## Validation Commands

### Level 1: STATIC_ANALYSIS
```bash
pnpm check-types
```
**EXPECT**: Exit 0, sem erros de tipo

### Level 2: LINT
```bash
npx biome lint --write --unsafe apps/web/src/lib/billing/calculations.ts apps/web/src/services/enterprise-billing-fees.ts apps/web/src/services/billing.ts
```
**EXPECT**: Sem warnings de class sorting/imports pendentes

### Level 3: DATABASE_VALIDATION
Usar Supabase MCP (`list_tables`, `execute_sql`) para:
- [ ] Confirmar que `billings.applied_billing_fees` aceita o shape gravado (jsonb array)
- [ ] Inspecionar uma linha criada após o teste manual (Task 5) e validar o conteúdo do snapshot

### Level 4: MANUAL_VALIDATION
Ver Task 5 acima — fluxo completo via UI: criar taxas (Fase 2 já implementada) → criar cobrança → inspecionar snapshot.

---

## Acceptance Criteria

- [ ] `createBilling` busca taxas ativas da empresa e grava `applied_billing_fees` corretamente para os dois call sites (`add-billing-action.ts`, `add-patient-action.ts`)
- [ ] Taxas fixas e percentuais calculadas de forma independente (não cascateada) sobre `base_amount_cents` original
- [ ] `total_amount` e `splitted_billing` (valor bruto cobrado do paciente) permanecem inalterados
- [ ] Cobranças de empresas sem taxas ativas continuam gravando `applied_billing_fees = []`
- [ ] `pnpm check-types` passa sem erros
- [ ] Nenhuma regressão nos fluxos existentes de criação de cobrança (parcelamento, datas, notificações)

---

## Completion Checklist

- [ ] Task 1-3 implementadas em ordem de dependência
- [ ] Level 1 (check-types) passa
- [ ] Level 2 (lint) passa
- [ ] Level 3 (database validation) confirma shape correto
- [ ] Level 4 (manual end-to-end) confirma comportamento esperado em todos os edge cases da checklist
- [ ] Todos os acceptance criteria atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| RLS bloquear leitura de `enterprise_billing_fees` quando profissional (não-staff) cria a própria cobrança | M | H | Usar `supabaseAdmin` (service-role) em `getActiveEnterpriseBillingFees`, nunca o client anônimo (ver Task 2 GOTCHA) |
| Taxa fixa maior que o valor bruto do profissional gerar líquido negativo | M | M | `Math.min(computedAmountCents, baseAmountCents)` clampa em zero — implementado na Task 1 |
| Regra de ordem de aplicação ambígua (open question do PRD) gerar inconsistência entre desenvolvedores | M | M | Decisão explícita documentada na Task 1 (não-cascateado, round-half-up, baseado em precedente Stripe) — resolve a open question do PRD nesta fase |
| Esquecer de aplicar a mudança nos dois call sites de `createBilling` | B | M | Lógica centralizada inteiramente dentro de `createBilling` (não duplicada nas actions) — ambos call sites herdam automaticamente |

---

## Notes

- A "Open Question" do PRD sobre ordem de aplicação fixa-vs-percentual é resolvida nesta fase como: **não-cascateado, cada taxa independente sobre o valor bruto original**. Isso é mais simples, determinístico independente da ordem de criação das taxas no banco, e alinhado ao precedente de mercado (Stripe trata fees como itens de linha independentes, não como modificadores sequenciais, a menos que explicitamente desenhado assim).
- O snapshot é por **profissional × taxa**, não apenas por taxa (mais granular que o shape inicialmente sugerido no comentário da migration `[{ fee_id, name, fee_type, value, base_amount_cents, computed_amount_cents }]`) — necessário porque o PRD confirma que taxas se aplicam "sobre o valor de cada profissional dentro do `splitted_billing`", então o mesmo `fee_id` pode gerar `computed_amount_cents` diferentes por profissional (taxas percentuais) ou repetir o mesmo valor fixo por profissional (taxas fixas). `professional_id` foi adicionado ao shape documentado para refletir isso fielmente.
- Fase 4 (próxima) consumirá `applied_billing_fees` para exibir valor líquido = `base_amount_cents - sum(computed_amount_cents para aquele professional_id)`, agrupando por `professional_id` no snapshot.
