# Configuração de Impostos, Taxas, Tributos e Descontos em Cobranças

## Problem Statement

Hoje, todo o cálculo de impostos, taxas e descontos aplicados às cobranças (ex: taxa de emissão de nota fiscal, taxa de gateway de pagamento, taxa de manutenção da plataforma) é feito manualmente e de forma descentralizada — cada profissional mantém seu próprio controle fora da plataforma. Isso gera falta de transparência sobre o valor líquido que cada profissional efetivamente recebe, dificulta o fechamento mensal dos gestores, e cresce em risco à medida que a base de profissionais aumenta (inconsistência de dados de pagamento pode gerar retrabalho e até disputas judiciais).

## Evidence

- A demanda partiu dos próprios profissionais, que pediram mais controle sobre os descontos e taxas aplicados aos seus serviços e cobranças.
- Crescimento da base de profissionais tornou o cálculo manual e descentralizado inviável de manter de forma consistente.
- Assumption — validação de que "profissionais confiam nos valores líquidos exibidos" será medida qualitativamente após o lançamento (sem dado quantitativo prévio).

## Proposed Solution

Gestores (managers apenas, não inclui secretaries) passam a configurar, em uma nova página de configurações a nível de empresa, um conjunto de taxas/impostos/descontos (fixos em R$ ou percentuais) que se aplicam automaticamente a todas as cobranças geradas na plataforma — incluindo cobranças parceladas — calculados sobre o valor de cada profissional dentro do `splitted_billing`. Cada taxa aplicada a uma cobrança é registrada (snapshot) no momento da criação, de forma que mudanças futuras na configuração não alterem cobranças já existentes. Toda criação/edição/desativação de taxa gera um log de auditoria.

A exportação de relatórios em PDF, mencionada no documento original, foi explicitamente removida do escopo desta entrega para reduzir risco técnico (zero infraestrutura de PDF existente no monorepo) — fica como iniciativa futura dedicada.

## Key Hypothesis

Acreditamos que permitir configurar taxas centralizadas vai resolver a falta de transparência e o cálculo manual para gestores e profissionais.
Saberemos que estamos certos quando os profissionais validarem os valores gerados automaticamente pelo sistema, atingindo suas expectativas de recebimento em cada mês.

## What We're NOT Building

- **Exportação de relatórios em PDF** — risco técnico alto (sem infraestrutura de PDF no monorepo); fica para uma entrega futura dedicada.
- **Aplicação retroativa de taxas em cobranças já existentes** — taxas só se aplicam a cobranças criadas após a configuração, para preservar a integridade histórica dos valores já cobrados/pagos.
- **Taxas diferentes por tipo de serviço/categoria** — todas as taxas configuradas se aplicam de forma uniforme a todas as cobranças da empresa, independente do tipo de serviço.
- **Integração direta com emissão de nota fiscal** — a plataforma não emite NF nem se integra com sistemas fiscais; o usuário apenas registra a taxa correspondente manualmente.
- **Taxas configuráveis por profissional individual** — fica como nice-to-have para uma iteração futura (ver Should/Could abaixo).

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|---------------|
| Gestores usando planilhas externas para cálculo de descontos | Redução para próximo de zero | Pesquisa qualitativa com gestores 30-60 dias após lançamento |
| Tempo de fechamento mensal de cobranças (gestor) | Redução perceptível (meta a refinar) | Pesquisa qualitativa / feedback direto |
| Profissionais que validam os valores líquidos exibidos como corretos | TBD — precisa de baseline | Feedback direto dos profissionais nos primeiros meses |

## Open Questions

- [ ] Ordem de aplicação quando há múltiplas taxas configuradas (ex: taxas fixas aplicadas antes ou depois das percentuais?) — afeta o valor final e precisa de uma regra explícita e documentada.
- [ ] Taxas devem poder ser desativadas (soft delete) sem afetar cobranças já existentes — confirmado como requisito, mas o mecanismo exato (campo `is_active` + data de vigência?) precisa ser definido na fase de planejamento técnico.
- [ ] Taxas se aplicam sobre o valor de cada profissional dentro do `splitted_billing` (confirmado) — mas o detalhamento de arredondamento (já existe um padrão `Math.floor` + resto na primeira parcela em `calculations.ts`) precisa ser conciliado com o cálculo de taxas percentuais.
- [ ] Definição de baseline para as métricas de sucesso (não há dado quantitativo hoje sobre tempo de fechamento mensal ou uso de planilhas externas).

---

## Users & Context

**Primary User**
- **Who**: Gestor de empresa (manager) responsável por configurar as taxas; e o profissional, que consome o resultado (valor líquido) em suas cobranças. A demanda original partiu dos profissionais.
- **Current behavior**: Cada profissional mantém controle manual e descentralizado de descontos/taxas fora da plataforma.
- **Trigger**: Necessidade de transparência sobre o valor líquido recebido e de consistência conforme a base de profissionais cresce.
- **Success state**: Taxas configuradas uma vez pelo gestor refletem automaticamente em todas as cobranças, sem necessidade de controle paralelo.

**Job to Be Done**
Quando eu configuro uma nova taxa, eu quero que ela seja aplicada a todos os produtos e serviços que geram cobranças na plataforma, inclusive nas cobranças parceladas, para que eu possa oferecer transparência e agilidade no cálculo dos valores finais repassados aos profissionais.

**Non-Users**
Pacientes/gestantes e secretárias (secretárias atuam apenas como staff, mas não são o foco desta funcionalidade — ainda que tenham acesso de leitura conforme as regras de `isStaff`).

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | CRUD de taxas (fixo em R$ ou percentual) em página de configurações de empresa | Núcleo da funcionalidade — sem isso não há o que aplicar |
| Must | Aplicação automática das taxas em todas as cobranças novas, incluindo parceladas | Atende diretamente o JTBD declarado pelo usuário |
| Must | Snapshot da taxa aplicada no momento da criação da cobrança (imutabilidade histórica) | Evita que mudanças futuras na config alterem cobranças já existentes/pagas |
| Must | Log de auditoria para criação/edição/desativação de taxas | Requisito explícito do prompt original e mitigação de risco de disputa |
| Must | Desativação de taxa (soft delete) sem afetar cobranças já geradas | Confirmado como requisito — taxas desativadas não devem sumir do histórico |
| Should | Taxas aplicadas sobre o valor por profissional dentro do `splitted_billing` | Confirmado pelo usuário como o nível correto de aplicação |
| Could | Associar taxas específicas a cada tipo de profissional do sistema | Nice-to-have explícito — útil mas não bloqueia o MVP |
| Won't | Exportação de relatórios em PDF | Removido do escopo por risco técnico — entrega futura dedicada |
| Won't | Aplicação retroativa em cobranças existentes | Quebraria a garantia de imutabilidade histórica |
| Won't | Taxas por tipo de serviço/categoria | Fora de escopo nesta entrega |
| Won't | Integração com emissão de nota fiscal | Fora de escopo — plataforma não emite NF |

### MVP Scope

Gestor cadastra taxas (fixas ou percentuais) em `/settings` (escopo de empresa); taxas aplicam automaticamente em novas cobranças, incluindo parceladas, calculadas sobre o valor de cada profissional no `splitted_billing`; profissional vê o valor líquido refletido na cobrança; toda alteração de taxa é logada.

### User Flow

1. Gestor acessa a nova página de configurações de empresa (padrão de gate `isStaff`/`isManager`, similar a `/users`).
2. Gestor cadastra uma taxa: nome, tipo (fixo/percentual), valor.
3. Taxa fica ativa imediatamente para novas cobranças.
4. Ao criar uma cobrança (parcelada ou não), o sistema aplica as taxas ativas sobre o valor de cada profissional no `splitted_billing`, e armazena um snapshot da configuração aplicada junto à cobrança.
5. Profissional visualiza o valor líquido (após taxas) na cobrança.
6. Gestor pode desativar uma taxa a qualquer momento — cobranças já criadas mantêm o snapshot original; novas cobranças deixam de receber aquela taxa.
7. Toda criação/edição/desativação gera entrada em `activity_logs` (actionType `enterprise`).

---

## Technical Approach

**Feasibility**: MEDIUM

**Architecture Notes**
- Novo conjunto de tabelas/colunas necessário: não existe hoje coluna de configuração de taxas em `enterprises`, nem coluna de snapshot de taxas em `billings` (que hoje só tem `splitted_billing` como jsonb). Será necessária nova migration.
- Pontos de injeção de cálculo já identificados em `apps/web/src/lib/billing/calculations.ts` (`calculateInstallmentAmount` linha 9, `recalculateInstallmentAmounts` linha 28) e em `apps/web/src/services/billing.ts` (`createBilling`, linhas 294-379), onde o `splitted_billing` e os valores por parcela são computados.
- Página de configurações de empresa não tem precedente direto — `/settings` atual é escopo de usuário (Google Calendar). Padrão de gate a seguir: `isStaff`/`isManager` + redirect, como em `apps/web/app/(dashboard)/users/page.tsx`.
- Log de auditoria reutiliza a infraestrutura existente (`apps/web/src/lib/activity-log.ts`, `actionType: "enterprise"`), sem necessidade de nova tabela.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Ordem de aplicação de múltiplas taxas (fixa vs percentual) gerar valores inconsistentes | M | Definir e documentar regra explícita de ordem antes da implementação (fase de planejamento técnico) |
| Arredondamento de taxas percentuais conflitar com o padrão `Math.floor` + resto já usado em parcelamento | M | Tratar explicitamente na fase de planejamento técnico, com casos de teste para parcelas |
| Falta de imutabilidade se o snapshot não for corretamente persistido por cobrança | H se não mitigado | Garantir que o snapshot da taxa aplicada seja gravado atomicamente junto à criação da cobrança, nunca derivado dinamicamente da config atual |

---

## Implementation Phases

<!--
  STATUS: pending | in-progress | complete
  PARALLEL: phases that can run concurrently (e.g., "with 3" or "-")
  DEPENDS: phases that must complete first (e.g., "1, 2" or "-")
  PRP: link to generated plan file once created
-->

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Schema e fundação | Migrations para tabela de taxas (`enterprise_billing_fees` ou similar) e coluna de snapshot em `billings` | complete | - | - | `.claude/PRPs/plans/completed/billing-fees-schema-foundation.plan.md` |
| 2 | CRUD de taxas + página de configurações | Página `/settings` de empresa (gate gestor), actions de criar/editar/desativar taxa, integração com `activity_logs` | complete | - | 1 | `.claude/PRPs/plans/completed/billing-fees-crud-settings.plan.md` |
| 3 | Aplicação automática nas cobranças | Integração do cálculo de taxas em `calculations.ts` e `services/billing.ts`, incluindo parcelas e snapshot por cobrança | complete | - | 1 | `.claude/PRPs/plans/completed/billing-fees-automatic-application.plan.md` |
| 4 | Visualização do valor líquido para o profissional | Exibir valor líquido (pós-taxas) nas telas de cobrança existentes | complete | with 2 | 3 | `.claude/PRPs/plans/completed/billing-fees-net-amount-display.plan.md` |

### Phase Details

**Phase 1: Schema e fundação**
- **Goal**: Criar a base de dados para suportar taxas configuráveis e snapshot imutável por cobrança.
- **Scope**: Nova migration com tabela de taxas (nome, tipo fixo/percentual, valor, ativo/inativo, enterprise_id) e nova coluna jsonb em `billings` para snapshot das taxas aplicadas. Atualizar `database.types.ts` via `pnpm db:types`.
- **Success signal**: Migration aplicada, tipos gerados, sem afetar dados existentes.

**Phase 2: CRUD de taxas + página de configurações**
- **Goal**: Permitir que gestores criem, editem e desativem taxas.
- **Scope**: Nova página de configurações de empresa (gate `isManager`/`isStaff`), server actions via `authActionClient`, integração com `activity_logs` para cada operação.
- **Success signal**: Gestor consegue cadastrar/editar/desativar taxa e ver o log de auditoria correspondente.

**Phase 3: Aplicação automática nas cobranças**
- **Goal**: Taxas ativas aplicam automaticamente a novas cobranças, incluindo parceladas, sobre o valor de cada profissional no `splitted_billing`.
- **Scope**: Alterações em `calculations.ts` e `services/billing.ts`, com regra explícita de ordem de aplicação e arredondamento, e gravação do snapshot da taxa por cobrança.
- **Success signal**: Cobrança criada após configuração de taxa reflete o valor líquido correto, incluindo em cenários parcelados; cobranças antigas permanecem inalteradas.

**Phase 4: Visualização do valor líquido para o profissional**
- **Goal**: Profissional visualiza claramente o valor líquido (pós-taxas) em suas cobranças.
- **Scope**: Ajustes nos componentes de exibição de cobrança (`billing-card`, `installment-card`, etc.) para mostrar bruto vs. líquido.
- **Success signal**: Profissional consegue ver, sem ambiguidade, quanto vai receber líquido em cada cobrança/parcela.

### Parallelism Notes

Fases 2 e 4 podem ser desenvolvidas em paralelo após a Fase 1 (schema), já que tocam áreas diferentes (configuração vs. exibição) — mas a Fase 4 depende dos dados produzidos pela Fase 3 (snapshot da taxa aplicada) para exibir o valor líquido corretamente, então na prática 4 só pode ser finalizada após 3, ainda que o desenvolvimento da UI possa começar em paralelo com mocks.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|---------------|-----------|
| Quem configura as taxas | Gestor configura para a empresa toda | Profissional configura individualmente; modelo híbrido | Confirmado explicitamente pelo usuário via pergunta de esclarecimento |
| Exportação de PDF | Removida do escopo desta entrega | Incluir como parte do MVP | Maior risco técnico identificado (zero infraestrutura de PDF no monorepo); decisão do usuário para reduzir risco |
| Nível de aplicação da taxa | Sobre o valor de cada profissional no `splitted_billing` | Sobre o `total_amount` da cobrança | Confirmado pelo usuário |
| Retroatividade | Taxas não se aplicam a cobranças já existentes | Aplicar retroativamente | Preserva integridade histórica e evita disputas, alinhado à pesquisa de mercado (immutabilidade de rate plans) |

---

## Research Summary

**Market Context**
Plataformas de marketplace (Stripe Connect, Sharetribe) modelam taxas como itens tipados (fixo/percentual/híbrido) e versionados, nunca como um valor único mutável — garantindo que cobranças passadas não mudem quando a configuração muda. Tributos retidos (ISS, INSS) são tratados como categoria distinta da comissão da própria plataforma. Não há padrão único de mercado para ordem de aplicação entre taxas fixas e percentuais — é uma decisão de produto que precisa ser explícita e documentada.

**Technical Context**
Nenhuma tabela hoje suporta configuração de taxas (`enterprises` não tem coluna de config; `billings` só tem `splitted_billing` como jsonb). Os pontos de cálculo já existentes (`calculations.ts`, `services/billing.ts`) são localizados e conhecidos, tornando a integração viável (MEDIUM feasibility). O padrão de página de configurações a nível de empresa não existe ainda — será o primeiro caso, seguindo o gate `isManager`/`isStaff` já usado em `/users`. Infraestrutura de log de auditoria (`activity_logs`) já suporta `actionType: "enterprise"` e pode ser reutilizada sem mudanças de schema.

---

*Generated: 2026-06-22*
*Status: DRAFT - needs validation*