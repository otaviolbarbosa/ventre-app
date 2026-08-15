# Feature: Home da Gestante — Contratos Pendentes e Assinados (Fase 5)

## Summary

Fase 5 do PRD `patient-contract-signature`. Hoje a gestante não tem nenhuma visibilidade sobre
o próprio contrato: `patient-home-screen.tsx` não busca nem exibe dado de `contracts`, e as duas
ações já implementadas nas Fases 2-3 (`sign-contract-as-patient-action.ts`,
`create-contract-change-request-action.ts`) não são chamadas por nenhum componente — inclusive
o componente de solicitar alteração (`RequestContractChangeDialog`) já existe e está pronto,
mas não está montado em lugar nenhum. Este plano fecha esse loop: adiciona uma seção de
contratos pendentes/assinados na home da gestante (mirror direto do padrão já usado para
consultas e financeiro em `src/services/patient-self.ts` + `src/components/patient-area/`), e
uma página mínima de contrato (`app/(patient)/contrato/[id]`) onde a gestante efetivamente lê o
contrato, assina, ou solicita alteração — sem essa página, os itens da lista na home não
teriam para onde levar.

## User Story

Como gestante, quero ver na minha home se tenho um contrato pendente de assinatura ou já
assinado, e poder abri-lo para ler, assinar ou solicitar alteração, para não depender de a
profissional me avisar por outro canal.

## Problem Statement

`patient-home-screen.tsx` (`apps/web/src/screens/patient-home-screen.tsx:5-9`) só recebe
`name`, `pregnancy`, `error` como props — nenhum dado de contrato chega a essa tela. As duas
mutations do lado da gestante já existentes (`signContractAsPatientAction`,
`createContractChangeRequestAction`) e o componente `RequestContractChangeDialog` (já
implementado, aceita `patientId`) não são referenciados por nenhuma página — confirmado por
busca no repositório inteiro.

## Solution Statement

Adicionar `getMyContracts()` em `src/services/patient-self.ts` (mesmo padrão de
`getMyPatientAppointments`/`getMyBillingSummary`: resolve `patientId` via
`patients.user_id = auth.uid()`, depois query filtrada, sem admin client — a RLS de leitura da
gestante em `contracts` já existe desde a Fase 1). Passar essa lista para
`PatientHomeScreen` via `app/(dashboard)/home/page.tsx`, e renderizar uma nova seção (novo
componente `contract-list.tsx` em `src/components/patient-area/`, mirror de
`appointment-list.tsx`) classificando cada contrato em "pendente" (`fully_signed_at IS NULL`)
ou "assinado" (`fully_signed_at IS NOT NULL`), cada item linkando para
`/contrato/[id]`. Criar essa rota (`app/(patient)/contrato/[id]/page.tsx`) como uma página
mínima e nova (`getMyContractById` em `patient-self.ts`) que renderiza `clauses_html`
(sanitizado via `sanitizeClausesHtml`, já exportado de `@/lib/contract-pdf`), o status de
assinatura de cada parte, e monta `RequestContractChangeDialog` (componente já pronto) mais um
botão "Assinar contrato" ligado a `signContractAsPatientAction` (componente novo). Atualizar
`revalidatePath` nas duas actions para também invalidar `/home` e a nova rota de contrato, já
que hoje ambas só revalidam `/patients/${patientId}/profile` — rota que a gestante não acessa.

## Metadata

| Field            | Value                                             |
| ---------------- | -------------------------------------------------- |
| Type             | ENHANCEMENT                                        |
| Complexity       | MEDIUM                                             |
| Systems Affected | apps/web (services, screens, components, actions, novas rotas `app/(patient)/contrato`) |
| Dependencies     | Nenhuma nova — reaproveita `sanitizeClausesHtml` (`@/lib/contract-pdf`), `RichEditor`/`ContentModal` já em uso, `next-safe-action` já em uso. Nenhuma pesquisa externa necessária (sem lib nova). |
| Estimated Tasks  | 8                                                   |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  app/(dashboard)/home/page.tsx                                               ║
║    └─► getMyPregnancy() ──► <PatientHomeScreen name pregnancy error />       ║
║         (nenhum dado de contrato buscado)                                     ║
║                                                                               ║
║  PatientHomeScreen: saudação + card de gestação + grid de 3 links            ║
║  (Cartão pré-natal / Agenda / Financeiro) — sem menção a contrato             ║
║                                                                               ║
║  signContractAsPatientAction, createContractChangeRequestAction,             ║
║  RequestContractChangeDialog: existem mas não são chamados/montados          ║
║  por nenhuma UI (confirmado por busca no repo inteiro)                        ║
║                                                                               ║
║  USER_FLOW: gestante nunca vê que há um contrato — a única forma de          ║
║  a profissional confirmar assinatura é fora da plataforma.                    ║
║  PAIN_POINT: 2 ações e 1 componente prontos, zero pontos de entrada.          ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  app/(dashboard)/home/page.tsx                                               ║
║    ├─► getMyPregnancy()                                                       ║
║    └─► getMyContracts() ──► <PatientHomeScreen ... contracts={contracts} />  ║
║                                                                               ║
║  PatientHomeScreen: + nova seção "Contratos" (ContractList) entre o card     ║
║  de gestação e o grid de links — pendentes primeiro (Badge "Pendente"),      ║
║  depois assinados (Badge "Assinado"), cada item ──► Link /contrato/[id]      ║
║                                                                               ║
║  app/(patient)/contrato/[id]/page.tsx (NOVA ROTA)                            ║
║    └─► getMyContractById(id) ──► clauses_html (read-only) + status +         ║
║         [Assinar contrato] (signContractAsPatientAction) OU                  ║
║         [Solicitar alteração] (RequestContractChangeDialog, já existia)      ║
║                                                                               ║
║  USER_FLOW: gestante vê pendência na home, abre, lê, assina ou pede          ║
║  alteração — sem sair da plataforma.                                          ║
║  VALUE_ADD: fecha o loop de UI que faltava desde as Fases 2-3.                ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| `apps/web/app/(dashboard)/home/page.tsx` | Só busca `getMyPregnancy()` | Também busca `getMyContracts()` | Home passa a ter dado de contrato disponível |
| `apps/web/src/screens/patient-home-screen.tsx` | Sem seção de contrato | Nova seção `ContractList` entre o card de gestação e o grid de links | Gestante vê pendências/assinados sem navegar |
| `apps/web/app/(patient)/contrato/[id]/page.tsx` | Rota não existe | Nova rota: lê contrato, assina, ou solicita alteração | Primeiro ponto de entrada funcional para os fluxos das Fases 2-3 |
| `sign-contract-as-patient-action.ts` / `create-contract-change-request-action.ts` | `revalidatePath` só em `/patients/${patientId}/profile` | Também revalida `/home` e `/contrato/${contractId}` | Lista na home e página do contrato refletem o novo estado imediatamente após ação |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|-----------------|
| P0 | `apps/web/src/services/patient-self.ts` | 1-117 | Padrão exato a mirror para `getMyContracts`/`getMyContractById` — `getMyPatientId()` interno, retorno `{ data, error? }`, sem admin client |
| P0 | `apps/web/src/screens/patient-home-screen.tsx` | 1-73 | Componente a editar (Task 3) — props type, ordem das seções, estilo visual (`text-[#433831]`, `rounded-2xl bg-white shadow-sm`) |
| P0 | `apps/web/app/(dashboard)/home/page.tsx` | 1-39 | Ponto de entrada a editar (Task 4) — branch `user_type === "patient"` |
| P0 | `apps/web/src/components/patient-area/appointment-list.tsx` | 1-95 | MIRROR exato para `contract-list.tsx` (Task 2) — card `rounded-2xl bg-white p-4 shadow-sm`, `Badge` de status, empty state, `useAction` + `router.refresh()` |
| P0 | `apps/web/app/(patient)/agenda/page.tsx` | 1-13 | MIRROR para a nova rota `app/(patient)/contrato/[id]/page.tsx` (Task 5) — padrão "Server Component busca via `getMy*`, passa para componente client" |
| P0 | `apps/web/src/actions/sign-contract-as-patient-action.ts` | 1-78 | Action já existente a consumir na Task 6 (`revalidatePath`) e a wire no componente da Task 5 — nota o `revalidatePath` atual em `:70` |
| P0 | `apps/web/src/actions/create-contract-change-request-action.ts` | 1-63 | Idem, `revalidatePath` em `:54` |
| P0 | `apps/web/src/components/shared/request-contract-change-dialog.tsx` | 1-80 | Componente JÁ PRONTO a montar na Task 5 — recebe só `patientId` (+ `triggerLabel` opcional), não precisa de alteração |
| P1 | `apps/web/app/(patient)/layout.tsx` | 1-27 | Layout que já guarda `user_type !== "patient"` — a nova rota herda essa proteção automaticamente por estar em `app/(patient)/` |
| P1 | `apps/web/src/actions/sign-patient-contract-action.ts` | 32-62 | Referência de como `patients.created_by`/`enterprise_id` distinguem contrato solo vs empresa — não precisa reimplementar aqui, só contexto |
| P1 | `apps/web/src/lib/contract-pdf.ts` | 19 (ver `sanitizeClausesHtml`) | Função exportada a reaproveitar na Task 5 para renderizar `clauses_html` com segurança (em vez de duplicar a lógica local de `patient-contract.tsx:61`) |
| P1 | `apps/web/src/components/shared/patient-contract.tsx` | 337-354, 736-750 | Referência de estilo para renderização read-only de `clauses_html` (classes Tailwind de tipografia) e do bloco de "Assinado eletronicamente" (comentado, mas mostra o formato esperado: data + código de verificação) |
| P1 | `packages/supabase/supabase/migrations/20260814000004_contracts_rewrite_immutability_and_patient_rls.sql` | 41-53 | RLS já concede `SELECT` à gestante em `contracts` via `patients.user_id = auth.uid()` — nenhuma migração nova necessária nesta fase |
| P2 | `apps/web/src/components/patient-area/billing-summary.tsx` | (arquivo inteiro) | Segundo exemplo do mesmo padrão de lista, para confirmar convenções de empty-state/estilo |

**External Documentation**: nenhuma — feature inteira construída com padrões já em produção
neste repositório (Next.js App Router dynamic route + Server Component fetch, já usado em
`app/(patient)/agenda` e `app/(patient)/financeiro`), sem biblioteca nova.

---

## Patterns to Mirror

**PATIENT-SELF QUERY (a estender):**

```typescript
// SOURCE: apps/web/src/services/patient-self.ts:98-116 (getMyBillingSummary)
// COPY THIS PATTERN:
export async function getMyBillingSummary(): Promise<{
  billings: BillingWithInstallments[];
  error?: string;
}> {
  const { supabase } = await getServerAuth();
  const { patientId, error } = await getMyPatientId();

  if (!patientId) {
    return { billings: [], error };
  }

  const { data } = await supabase
    .from("billings")
    .select("*, installments(*)")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  return { billings: (data as BillingWithInstallments[]) ?? [] };
}
```

**PAGE → SERVER-FETCH → CLIENT LIST COMPONENT:**

```tsx
// SOURCE: apps/web/app/(patient)/agenda/page.tsx:1-13
// COPY THIS PATTERN:
import AppointmentList from "@/components/patient-area/appointment-list";
import { getMyPatientAppointments } from "@/services/patient-self";

export default async function PatientAgendaPage() {
  const { appointments } = await getMyPatientAppointments();

  return (
    <div className="space-y-4 px-4 py-6">
      <h1 className="font-bold text-2xl text-[#433831]">Agenda</h1>
      <AppointmentList appointments={appointments} />
    </div>
  );
}
```

**CARD-LIST WITH STATUS BADGE + EMPTY STATE:**

```tsx
// SOURCE: apps/web/src/components/patient-area/appointment-list.tsx:37-92
// COPY THIS PATTERN (trocar isConfirmed por fully_signed_at !== null):
if (appointments.length === 0) {
  return (
    <div className="rounded-2xl bg-white p-6 text-center text-muted-foreground text-sm shadow-sm">
      Nenhuma consulta agendada.
    </div>
  );
}

return (
  <div className="space-y-3">
    {appointments.map((appointment) => {
      const isConfirmed = !!appointment.confirmed_by_patient_at;
      return (
        <div key={appointment.id} className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>{/* ...detalhes... */}</div>
            {isConfirmed && (
              <Badge variant="outline" className="shrink-0 border-primary/40 text-primary">
                <Check className="mr-1 h-3 w-3" />
                Confirmada
              </Badge>
            )}
          </div>
        </div>
      );
    })}
  </div>
);
```

**HOME SCREEN PROPS TYPE (a estender):**

```typescript
// SOURCE: apps/web/src/screens/patient-home-screen.tsx:5-9
type PatientHomeScreenProps = {
  name: string | null | undefined;
  pregnancy: Tables<"pregnancies"> | null;
  error: string | null | undefined;
};
```

**READ-ONLY CLAUSES HTML RENDER:**

```tsx
// SOURCE: apps/web/src/components/shared/patient-contract.tsx:736-746
// COPY THIS PATTERN:
<div
  className="[&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:italic [&_em]:italic [&_h1]:mb-2 [&_h1]:font-bold [&_h1]:text-2xl [&_h2]:mb-2 [&_h2]:font-semibold [&_h2]:text-xl [&_h3]:mb-1 [&_h3]:font-semibold [&_h3]:text-lg [&_li]:ml-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-6"
  // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitizado via sanitizeClausesHtml antes de chegar aqui
  dangerouslySetInnerHTML={{ __html: sanitizeClausesHtml(contract.clauses_html) }}
/>
```

**SIGN ACTION USAGE (via `useAction`, mirror do dialog já existente):**

```tsx
// SOURCE: apps/web/src/components/shared/request-contract-change-dialog.tsx:23-32
// COPY THIS PATTERN para o botão "Assinar contrato":
const { execute, isExecuting } = useAction(signContractAsPatientAction, {
  onSuccess: () => {
    toast.success("Contrato assinado com sucesso.");
    router.refresh();
  },
  onError: ({ error }) => {
    toast.error(error.serverError ?? "Erro ao assinar contrato. Tente novamente.");
  },
});
```

---

## Files to Change

| File | Action | Justification |
|------|--------|------------------|
| `apps/web/src/services/patient-self.ts` | UPDATE | Adiciona `getMyContracts()` e `getMyContractById(contractId)` |
| `apps/web/src/components/patient-area/contract-list.tsx` | CREATE | Novo componente de lista, mirror de `appointment-list.tsx` |
| `apps/web/src/screens/patient-home-screen.tsx` | UPDATE | Adiciona prop `contracts` + renderiza `ContractList` |
| `apps/web/app/(dashboard)/home/page.tsx` | UPDATE | Chama `getMyContracts()` e passa para `PatientHomeScreen` |
| `apps/web/app/(patient)/contrato/[id]/page.tsx` | CREATE | Nova rota — Server Component que busca via `getMyContractById` |
| `apps/web/src/components/patient-area/contract-detail.tsx` | CREATE | Componente client da nova rota — renderiza clausulas, status, botão assinar, `RequestContractChangeDialog` |
| `apps/web/src/actions/sign-contract-as-patient-action.ts` | UPDATE | Adiciona `revalidatePath("/home")` e `revalidatePath(\`/contrato/${existing.id}\`)` |
| `apps/web/src/actions/create-contract-change-request-action.ts` | UPDATE | Idem |

---

## NOT Building (Scope Limits)

- Preview de PDF real (`pdf.js`) — é a Fase 7 (Should-have), explicitamente separada no PRD; esta
  fase renderiza `clauses_html` como HTML sanitizado, igual ao que `patient-contract.tsx` já faz
  no lado da profissional.
- Suporte a múltiplos contratos ativos simultâneos por gestante — o modelo de dados atual
  garante no máximo um contrato `is_active = true, is_base_contract = false` por
  `patient_id`; `getMyContracts()` retorna todos os não-base (incluindo histórico futuro de
  revogados, Fase 6), mas a UI desta fase não precisa de paginação/filtro adicional além de
  "pendente" vs "assinado".
- Fluxo de revogação/recriação pós-assinatura completa — Fase 6, fora de escopo.
- Notificações — Fase 4, plano já gerado separadamente
  (`patient-contract-signature-phase-4-notifications.plan.md`); esta fase não duplica esse
  trabalho, apenas garante que os caminhos de UI que a Fase 4 notifica tenham para onde levar
  o usuário.
- Exibir histórico completo de solicitações de alteração já resolvidas na página de contrato —
  MVP mostra apenas se há uma solicitação **pendente** (bloqueia nova solicitação e oculta o
  botão de assinar, mirror da constraint `one_pending_change_request_per_contract`); histórico
  completo pode ser adicionado depois sem mudar o modelo de dados.

---

## Step-by-Step Tasks

Execute em ordem. Cada task é atômica e verificável independentemente.

### Task 1: UPDATE `apps/web/src/services/patient-self.ts`

- **ACTION**: Adicionar `getMyContracts()` e `getMyContractById(contractId)`
- **IMPLEMENT**:
  ```typescript
  export type Contract = Tables<"contracts">;

  export async function getMyContracts(): Promise<{
    contracts: Contract[];
    error?: string;
  }> {
    const { supabase } = await getServerAuth();
    const { patientId, error } = await getMyPatientId();

    if (!patientId) {
      return { contracts: [], error };
    }

    const { data } = await supabase
      .from("contracts")
      .select("*")
      .eq("patient_id", patientId)
      .eq("is_base_contract", false)
      .order("created_at", { ascending: false });

    return { contracts: data ?? [] };
  }

  export async function getMyContractById(contractId: string): Promise<{
    contract: Contract | null;
    changeRequests: Tables<"contract_change_requests">[];
    error?: string;
  }> {
    const { supabase } = await getServerAuth();
    const { patientId, error } = await getMyPatientId();

    if (!patientId) {
      return { contract: null, changeRequests: [], error };
    }

    const { data: contract } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", contractId)
      .eq("patient_id", patientId)
      .maybeSingle();

    if (!contract) {
      return { contract: null, changeRequests: [], error: "Contrato não encontrado" };
    }

    const { data: changeRequests } = await supabase
      .from("contract_change_requests")
      .select("*")
      .eq("contract_id", contractId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    return { contract, changeRequests: changeRequests ?? [] };
  }
  ```
- **MIRROR**: `apps/web/src/services/patient-self.ts:98-116` (`getMyBillingSummary`, mesma
  estrutura `{ data, error? }` sem admin client)
- **GOTCHA**: `getMyContractById` filtra por `.eq("patient_id", patientId)` (não só `.eq("id", contractId)`) — defesa em profundidade além da RLS, mesmo padrão de `sign-contract-as-patient-action.ts:17-25` (checar posse antes de confiar só na política). Não usar `supabaseAdmin` aqui — a RLS de leitura da gestante já cobre o caso (`20260814000004_...sql:48-52`).
- **VALIDATE**: `pnpm check-types`

### Task 2: CREATE `apps/web/src/components/patient-area/contract-list.tsx`

- **ACTION**: Componente client de lista, mirror de `appointment-list.tsx`
- **IMPLEMENT**:
  ```tsx
  "use client";

  import type { Contract } from "@/services/patient-self";
  import { Badge } from "@ventre/ui/badge";
  import { Check, Clock } from "lucide-react";
  import Link from "next/link";
  import dayjs from "dayjs";

  export default function ContractList({ contracts }: { contracts: Contract[] }) {
    if (contracts.length === 0) {
      return (
        <div className="rounded-2xl bg-white p-6 text-center text-muted-foreground text-sm shadow-sm">
          Nenhum contrato disponível.
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {contracts.map((contract) => {
          const isFullySigned = !!contract.fully_signed_at;
          return (
            <Link
              key={contract.id}
              href={`/contrato/${contract.id}`}
              className="block rounded-2xl bg-white p-4 shadow-sm transition-colors hover:border-primary"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#433831]">{contract.title}</p>
                  <p className="text-muted-foreground text-sm">
                    Criado em {dayjs(contract.created_at).format("DD/MM/YYYY")}
                  </p>
                </div>
                {isFullySigned ? (
                  <Badge variant="outline" className="shrink-0 border-primary/40 text-primary">
                    <Check className="mr-1 h-3 w-3" />
                    Assinado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0 border-amber-400/40 text-amber-700">
                    <Clock className="mr-1 h-3 w-3" />
                    Pendente
                  </Badge>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    );
  }
  ```
- **MIRROR**: `apps/web/src/components/patient-area/appointment-list.tsx:37-94` (estrutura, cores, `rounded-2xl bg-white p-4 shadow-sm`)
- **GOTCHA**: Este componente não precisa de `useAction`/mutação — é puramente uma lista navegável (diferente de `appointment-list.tsx`, que tem um botão de ação inline). Não importar `next-safe-action/hooks` aqui.
- **VALIDATE**: `pnpm check-types`

### Task 3: UPDATE `apps/web/src/screens/patient-home-screen.tsx`

- **ACTION**: Adicionar prop `contracts` e renderizar `ContractList` entre o card de gestação e o grid de links
- **IMPLEMENT**:
  ```tsx
  import ContractList from "@/components/patient-area/contract-list";
  import type { Contract } from "@/services/patient-self";

  type PatientHomeScreenProps = {
    name: string | null | undefined;
    pregnancy: Tables<"pregnancies"> | null;
    contracts: Contract[];
    error: string | null | undefined;
  };

  export default function PatientHomeScreen({ name, pregnancy, contracts, error }: PatientHomeScreenProps) {
    // ... (mantém o resto igual)

    return (
      <div className="space-y-6 px-4 py-6">
        {/* ... saudação, error, pregnancy card ... */}

        {contracts.length > 0 && (
          <div>
            <p className="mb-2 text-muted-foreground text-xs uppercase tracking-wide">Contratos</p>
            <ContractList contracts={contracts} />
          </div>
        )}

        {/* ... grid de links ... */}
      </div>
    );
  }
  ```
- **MIRROR**: `apps/web/src/screens/patient-home-screen.tsx:29-49` (mesmo padrão condicional `{pregnancy && (...)}` usado para o card de gestação)
- **GOTCHA**: Omitir a seção inteira (`contracts.length > 0 &&`) quando não há contrato — não renderizar um empty-state permanente na home (diferente de `/contrato` e `/financeiro`, que são páginas dedicadas onde faz sentido mostrar "nenhum X"); a home deve ficar limpa quando não há nada pendente/assinado ainda.
- **VALIDATE**: `pnpm check-types`

### Task 4: UPDATE `apps/web/app/(dashboard)/home/page.tsx`

- **ACTION**: Buscar `getMyContracts()` e passar para `PatientHomeScreen`
- **IMPLEMENT**:
  ```tsx
  import { getMyContracts, getMyPregnancy } from "@/services/patient-self";
  // ...
  if (profile?.user_type === "patient") {
    const [{ patient, pregnancy, error }, { contracts }] = await Promise.all([
      getMyPregnancy(),
      getMyContracts(),
    ]);
    return (
      <PatientHomeScreen
        name={profile?.name ?? patient?.name}
        pregnancy={pregnancy}
        contracts={contracts}
        error={error}
      />
    );
  }
  ```
- **MIRROR**: `apps/web/app/(dashboard)/home/page.tsx:14-22` (estrutura atual, agora paralelizando as duas buscas com `Promise.all` em vez de sequencial)
- **VALIDATE**: `pnpm check-types`

### Task 5: CREATE `apps/web/app/(patient)/contrato/[id]/page.tsx` e `apps/web/src/components/patient-area/contract-detail.tsx`

- **ACTION**: Nova rota + componente client que renderiza o contrato, permite assinar ou solicitar alteração
- **IMPLEMENT** (`page.tsx`):
  ```tsx
  import ContractDetail from "@/components/patient-area/contract-detail";
  import { getMyContractById, getMyPatientId } from "@/services/patient-self";
  import { notFound } from "next/navigation";

  export default async function PatientContractPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { contract, changeRequests, error } = await getMyContractById(id);

    if (!contract) notFound();

    return (
      <div className="space-y-4 px-4 py-6">
        <h1 className="font-bold text-2xl text-[#433831]">{contract.title}</h1>
        <ContractDetail contract={contract} changeRequests={changeRequests} />
      </div>
    );
  }
  ```
  **IMPLEMENT** (`contract-detail.tsx`):
  ```tsx
  "use client";

  import { signContractAsPatientAction } from "@/actions/sign-contract-as-patient-action";
  import { RequestContractChangeDialog } from "@/components/shared/request-contract-change-dialog";
  import { sanitizeClausesHtml } from "@/lib/contract-pdf";
  import type { Contract } from "@/services/patient-self";
  import { Badge } from "@ventre/ui/badge";
  import { Button } from "@ventre/ui/button";
  import { Check, Loader2 } from "lucide-react";
  import { useAction } from "next-safe-action/hooks";
  import { useRouter } from "next/navigation";
  import { toast } from "sonner";
  import type { Tables } from "@ventre/supabase";

  export default function ContractDetail({
    contract,
    changeRequests,
  }: {
    contract: Contract;
    changeRequests: Tables<"contract_change_requests">[];
  }) {
    const router = useRouter();
    const isFullySigned = !!contract.fully_signed_at;
    const hasPendingChangeRequest = changeRequests.length > 0;

    const { execute, isExecuting } = useAction(signContractAsPatientAction, {
      onSuccess: () => {
        toast.success("Contrato assinado com sucesso.");
        router.refresh();
      },
      onError: ({ error }) => {
        toast.error(error.serverError ?? "Erro ao assinar contrato. Tente novamente.");
      },
    });

    return (
      <div className="space-y-4">
        {isFullySigned && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800 text-sm">
            <Check className="size-4 shrink-0" />
            <span>
              Assinado por ambas as partes em{" "}
              {new Date(contract.fully_signed_at as string).toLocaleDateString("pt-BR")}
              {contract.verification_code ? ` · Código ${contract.verification_code}` : ""}
            </span>
          </div>
        )}

        {hasPendingChangeRequest && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 text-sm">
            Sua solicitação de alteração está aguardando revisão da profissional.
          </div>
        )}

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div
            className="[&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:italic [&_em]:italic [&_h1]:mb-2 [&_h1]:font-bold [&_h1]:text-2xl [&_h2]:mb-2 [&_h2]:font-semibold [&_h2]:text-xl [&_h3]:mb-1 [&_h3]:font-semibold [&_h3]:text-lg [&_li]:ml-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-6"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitizado via sanitizeClausesHtml
            dangerouslySetInnerHTML={{ __html: sanitizeClausesHtml(contract.clauses_html) }}
          />
        </div>

        {!isFullySigned && contract.is_signed && !hasPendingChangeRequest && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={isExecuting} onClick={() => execute({ patientId: contract.patient_id as string })}>
              {isExecuting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assinar contrato
            </Button>
            <RequestContractChangeDialog patientId={contract.patient_id as string} />
          </div>
        )}
      </div>
    );
  }
  ```
- **MIRROR**: `apps/web/src/components/shared/patient-contract.tsx:736-750` (render read-only de clausulas), `apps/web/src/components/patient-area/appointment-list.tsx:27-35` (padrão `useAction` com `toast` + `router.refresh()`), `apps/web/src/components/shared/request-contract-change-dialog.tsx:12-18` (props do componente já pronto — só passar `patientId`)
- **GOTCHA**: `contract.patient_id` é `string | null` no tipo gerado (`Tables<"contracts">`) porque a coluna é nullable para contratos-base (`is_base_contract = true`); como esta página só é alcançável para contratos não-base (filtro em `getMyContracts`/`getMyContractById` não impõe isso explicitamente — considerar adicionar `.eq("is_base_contract", false)` no filtro de `getMyContractById` na Task 1 para reforçar essa garantia, evitando o cast `as string` ficar sem lastro). O botão "Assinar" só aparece quando `contract.is_signed` (profissional já assinou) e não há solicitação de alteração pendente — mirror da própria checagem de `sign-contract-as-patient-action.ts:36-38`, evitando um clique que a action rejeitaria de qualquer forma.
- **VALIDATE**: `pnpm check-types`

### Task 6: UPDATE `apps/web/src/actions/sign-contract-as-patient-action.ts`

- **ACTION**: Revalidar `/home` e a rota do contrato, além da rota da profissional já revalidada
- **IMPLEMENT**: Trocar a linha `revalidatePath(\`/patients/${patientId}/profile\`);` (linha 70) por:
  ```typescript
  revalidatePath(`/patients/${patientId}/profile`);
  revalidatePath("/home");
  revalidatePath(`/contrato/${existing.id}`);
  ```
- **MIRROR**: Chamada única já existente em `sign-contract-as-patient-action.ts:70`; múltiplas chamadas de `revalidatePath` na mesma action é padrão Next.js suportado nativamente (App Router), sem gotcha adicional
- **VALIDATE**: `pnpm check-types`

### Task 7: UPDATE `apps/web/src/actions/create-contract-change-request-action.ts`

- **ACTION**: Mesma extensão de `revalidatePath`
- **IMPLEMENT**: Trocar a linha `revalidatePath(\`/patients/${patientId}/profile\`);` (linha 54) por:
  ```typescript
  revalidatePath(`/patients/${patientId}/profile`);
  revalidatePath("/home");
  revalidatePath(`/contrato/${existing.id}`);
  ```
- **MIRROR**: Mesmo padrão da Task 6
- **VALIDATE**: `pnpm check-types`

### Task 8: Validação estática completa e manual

- **ACTION**: `pnpm check-types` no monorepo inteiro + exercício manual do fluxo
- **IMPLEMENT**: `pnpm check-types`; depois, logado como gestante de teste com um contrato já assinado pela profissional (`is_signed = true`, `fully_signed_at IS NULL`): confirmar que a home mostra o item "Pendente", que `/contrato/[id]` renderiza o texto, que "Assinar contrato" funciona e depois disso a home mostra "Assinado" e a rota reflete `fully_signed_at`.
- **VALIDATE**: Exit 0 em `check-types`; fluxo manual completo sem erro no console do navegador nem no servidor Next.js

---

## Testing Strategy

### Unit Tests to Write

Não há suíte de testes existente em `apps/web` (0 arquivos `*.test.tsx`/`*.test.ts` sob
`apps/web`, confirmado pelo agente de exploração) — este plano não introduz um padrão de teste
novo, mantendo consistência com o restante do domínio de patient-area. Validação é via Level 1
(types) e Level 6 (manual) abaixo.

### Edge Cases Checklist

- [ ] Gestante sem nenhum contrato ainda — `getMyContracts()` retorna `[]`, seção inteira omitida na home (Task 3 GOTCHA)
- [ ] Contrato existe mas profissional ainda não assinou (`is_signed = false`) — item aparece como "Pendente" na lista, mas a página de detalhe não mostra botão de assinar (guard `contract.is_signed` na Task 5)
- [ ] Contrato com solicitação de alteração pendente — botões de assinar/solicitar nova alteração ficam ocultos, mostra aviso "aguardando revisão" (guard `hasPendingChangeRequest`)
- [ ] Gestante tenta acessar `/contrato/[id]` de um contrato que não é dela — `getMyContractById` filtra por `patient_id` da própria gestante, retorna `null` → `notFound()`
- [ ] Contrato totalmente assinado — home mostra "Assinado", página de detalhe mostra o aviso verde com data + código de verificação, nenhum botão de ação

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```

**EXPECT**: Exit 0, sem erros

### Level 5: BROWSER_VALIDATION

- [ ] Home da gestante renderiza a seção de contratos quando há ao menos um contrato
- [ ] Clicar em um item pendente navega para `/contrato/[id]` e renderiza o texto do contrato
- [ ] Botão "Assinar contrato" funciona end-to-end e a home reflete o novo estado após `router.refresh()`
- [ ] `RequestContractChangeDialog` abre, envia, e a página do contrato passa a mostrar o aviso de solicitação pendente

### Level 6: MANUAL_VALIDATION

Ver Task 8.

---

## Acceptance Criteria

- [ ] `getMyContracts()` e `getMyContractById()` seguem exatamente o padrão de `getMyPatientId()`/RLS já usado em `patient-self.ts`
- [ ] Home da gestante mostra contratos pendentes e assinados, cada um linkando para `/contrato/[id]`
- [ ] `/contrato/[id]` permite ler o contrato, assinar (quando aplicável), e solicitar alteração (componente já existente, agora montado)
- [ ] `sign-contract-as-patient-action.ts` e `create-contract-change-request-action.ts` revalidam `/home` e a rota do contrato, além da rota da profissional já revalidada
- [ ] `pnpm check-types` passa sem erros
- [ ] Nenhuma nova migração de banco necessária (RLS da Fase 1 já cobre a leitura)

---

## Completion Checklist

- [ ] Todas as 8 tasks completadas em ordem de dependência
- [ ] Level 1 (static analysis) passa
- [ ] Level 5 (browser validation) passa
- [ ] Level 6 (manual validation) passa
- [ ] Todos os critérios de aceitação atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|--------------|
| Escopo da Fase 5 no PRD menciona só "seção em `patient-home-screen.tsx`", mas sem uma página de destino os itens da lista não teriam ação nenhuma (assinar/solicitar alteração ficariam inacessíveis) | MEDIUM | HIGH | Este plano inclui a rota `/contrato/[id]` como extensão mínima necessária para a seção da home ser funcional — documentado explicitamente aqui para não ser lido como scope creep não intencional |
| `contract.patient_id` é nullable no tipo gerado, usado com `as string` na Task 5 | LOW | LOW | Reforçar o filtro `.eq("is_base_contract", false)` em `getMyContractById` (Task 1 GOTCHA) garante que só contratos com `patient_id` preenchido cheguem a essa página |
| Dois `revalidatePath` adicionais por action podem invalidar rotas que nem sempre existem ainda (ex: se `existing.id` mudar de contexto) | LOW | LOW | `revalidatePath` do Next.js é no-op seguro para rotas que não estão em cache — nenhum erro é lançado se a rota não foi visitada ainda |

---

## Notes

- A Fase 7 (preview `pdf.js`) provavelmente vai querer envolver o bloco de
  `dangerouslySetInnerHTML` desta página (`contract-detail.tsx`) com um componente de preview
  real de PDF — nenhuma mudança estrutural adicional prevista aqui além de trocar esse bloco no
  futuro.
- A Fase 6 (revogação/recriação) vai adicionar múltiplos contratos históricos por gestante — o
  design de `getMyContracts()` já retorna uma lista (não um único registro), então nenhuma
  mudança de contrato de dados é esperada quando essa fase chegar.
