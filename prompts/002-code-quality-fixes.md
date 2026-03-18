# PRD — Correções de Qualidade de Código (apps/web)

## Objetivo

Corrigir os anti-patterns e más práticas identificados no diagnóstico de qualidade do projeto Nascere. As correções estão ordenadas por prioridade e agrupadas por tema para facilitar a execução sequencial.

---

## Fase 1 — Correções Críticas de Segurança e Bugs

### 1.1 Deletar endpoint de debug de notificações

**Arquivo:** `apps/web/app/api/notifications/test/route.ts`

- Deletar o arquivo completamente. O próprio arquivo contém o comentário `DELETE THIS FILE after testing`.

---

### 1.2 Remover logs de debug do webhook Stripe

**Arquivo:** `apps/web/app/api/stripe/webhook/route.ts`

- Remover todos os `console.log` numerados `#1` a `#11`.
- Remover o `console.log(subscriptionData)` que vaza dados de assinatura.
- Manter apenas `console.error` para erros reais.

---

### 1.3 Corrigir open redirect em `auth/callback/route.ts`

**Arquivo:** `apps/web/app/auth/callback/route.ts`

- Antes de usar o parâmetro `next`, validar que começa com `/` e não começa com `//`.
- Se inválido, usar `/home` como fallback.

```ts
const next = searchParams.get("next") ?? "/home";
const safePath = next.startsWith("/") && !next.startsWith("//") ? next : "/home";
```

---

### 1.4 Corrigir bug: `total_amount` sempre 0 nas métricas do dashboard

**Arquivo:** `apps/web/src/services/billing.ts` (função `getDashboardMetrics`)

- `metrics.total_amount` é inicializado como `0` e nunca somado.
- Somar `billing.total_amount` de cada billing no loop de métricas.
- Corrigir `pending_amount` que resulta negativo por depender de `total_amount = 0`.

---

### 1.5 Remover JSX inalcançável em `patients/[id]/page.tsx`

**Arquivo:** `apps/web/app/(dashboard)/patients/[id]/page.tsx`

- Remover `return <>Teste</>` após `redirect()` (código inalcançável, string de dev leftover).

---

## Fase 2 — Performance e Dados

### 2.1 Refatorar `safe-action.ts` — lazy admin client e profile fetch otimizado

**Arquivo:** `apps/web/src/lib/safe-action.ts`

- `createServerSupabaseAdmin()` é instanciado em toda action mesmo quando não utilizado. Avaliar inicialização lazy ou mover para middleware separado.
- O fetch de `supabase.from("users").select("*")` ocorre incondicionalmente em toda execução. Mover para dentro da action quando necessário, ou usar o `user` retornado pelo `getServerUser()` diretamente sem segunda query quando apenas o `id` é necessário.

---

### 2.2 Eliminar N+2 queries em `getMyPatients` e `getEnterprisePatients`

**Arquivos:**
- `apps/web/src/services/patient.ts`
- `apps/web/src/actions/get-enterprise-patients-action.ts`

Problema: a tabela `team_members` é consultada duas vezes no mesmo fluxo (uma vez para obter IDs de pacientes, outra para construir o `teamMembersMap`).

- Consolidar em uma única query usando JOIN ou estruturando o resultado da primeira query para construir o mapa diretamente.

---

### 2.3 Extrair lógica de filtro DPP duplicada

**Arquivos com código idêntico:**
- `apps/web/src/services/patient.ts`
- `apps/web/src/actions/get-enterprise-patients-action.ts`
- `apps/web/src/actions/get-home-patients-action.ts`
- `apps/web/src/actions/get-enterprise-home-patients-action.ts`

- Extrair o bloco de filtro DPP por trimestre para uma função utilitária compartilhada em `apps/web/src/lib/` (ex: `dpp-filter.ts`).
- Cada action/service deve chamar essa função em vez de duplicar o código.

---

### 2.4 Corrigir N+1 queries no cron de billing-notifications

**Arquivo:** `apps/web/app/api/cron/billing-notifications/route.ts`

- Coletar todos os `user_id` das notificações antes do loop.
- Buscar todas as preferências em uma única query `.in("user_id", userIds)`.
- Construir um Map `userId → preferences` e consultar o Map dentro do loop.

---

### 2.5 Remover `export const revalidate` de páginas que re-buscam dados no cliente

**Arquivos:**
- `apps/web/app/(dashboard)/home/page.tsx` — `revalidate = 600`
- `apps/web/app/(dashboard)/billing/page.tsx` — `revalidate = 300`

Problema: a página cacheia HTML por N segundos no servidor, mas o componente filho re-busca dados frescos via server action no mount — tornando o cache inútil e criando inconsistência visual na hidratação.

- Remover as diretivas `export const revalidate`.

---

## Fase 3 — Arquitetura e Componentes

### 3.1 Corrigir `redirect()` em event handlers de Client Components

**Arquivos:**
- `apps/web/src/screens/home-screen.tsx` (função `handleOpenAppointments`)
- `apps/web/src/screens/home-enterprise-screen.tsx` (mesma função)

- Substituir `redirect("/appointments")` por `router.push("/appointments")` usando `useRouter` do `next/navigation`.

---

### 3.2 Consolidar funções de auth duplicadas

**Arquivos:**
- `apps/web/src/services/auth.ts` — contém `getProfile`, `getCurrentUser`, `getAuthData`
- `apps/web/src/lib/server-auth.ts` — contém `getServerAuth` (memoizado com `React.cache()`)

- As três funções em `auth.ts` são redundantes com `getServerAuth`.
- Substituir todas as chamadas a `getProfile()` / `getCurrentUser()` / `getAuthData()` por `getServerAuth()`.
- Após migrar todos os consumidores, deletar as funções duplicadas.

---

### 3.3 Corrigir `FilterType` local — usar tipo canônico `PatientFilter`

**Arquivos:**
- `apps/web/src/screens/home-screen.tsx:43`
- `apps/web/src/screens/home-enterprise-screen.tsx:42`

- Remover as declarações locais `type FilterType = ...`.
- Importar `PatientFilter` de `@/types` e usar `Exclude<PatientFilter, "finished">` como tipo do state de filtro.

---

### 3.4 Extrair componente `DppMonthCarousel`

**Arquivos com JSX idêntico:**
- `apps/web/src/screens/home-screen.tsx`
- `apps/web/src/screens/home-enterprise-screen.tsx`
- `apps/web/src/screens/patients-screen.tsx`
- `apps/web/src/screens/patients-enterprise-screen.tsx`

- Criar `apps/web/src/components/shared/dpp-month-carousel.tsx`.
- Props: `items: { month: string; count: number; trend?: number }[]`, `selectedDpp: string | null`, `onSelect: (month: string | null) => void`.
- Substituir o bloco duplicado nas 4 telas pelo novo componente.

---

### 3.5 Extrair componente `FilterDropdown`

**Arquivos com código idêntico:**
- As mesmas 4 telas do item 3.4, para o dropdown de filtro com `handleClickOutside` e `filterRef`.

- Criar `apps/web/src/components/shared/filter-dropdown.tsx`.
- Props: `options: { value: string; label: string }[]`, `value: string`, `onChange: (value: string) => void`.
- Encapsular o `useRef`, `useEffect` de click-outside e o JSX do dropdown.
- Substituir nas 4 telas.

---

### 3.6 Consolidar constante `PATIENTS_PER_PAGE`

**Arquivos com a constante duplicada:**
- `apps/web/src/services/patient.ts`
- `apps/web/src/actions/get-enterprise-patients-action.ts`
- `apps/web/src/screens/patients-screen.tsx`
- `apps/web/src/screens/patients-enterprise-screen.tsx`

- Definir `export const PATIENTS_PER_PAGE = 10` em `apps/web/src/lib/constants.ts`.
- Importar e usar nas 4 ocorrências.

---

### 3.7 Eliminar duplicação de lógica de criação de paciente

**Arquivos:**
- `apps/web/app/api/patients/route.ts` — re-implementa criação manual
- `apps/web/src/services/patient.ts:createPatient` — implementação canônica

- Refatorar o POST handler em `api/patients/route.ts` para chamar `createPatient()` do service.
- Corrigir a discrepância no campo `dum` que a rota omite mas o service inclui.

---

### 3.8 Memoizar cálculo de idade gestacional

**Arquivos:**
- `apps/web/src/screens/patients-screen.tsx`
- `apps/web/src/screens/patients-enterprise-screen.tsx`

- Envolver a lista processada com cálculo de `calculateGestationalAge` em um `useMemo` dependente da lista de pacientes.

---

## Fase 4 — Error Handling e UX

### 4.1 Adicionar `error.tsx` e `loading.tsx` no dashboard

**Arquivos a criar:**
- `apps/web/app/(dashboard)/error.tsx` — Client Component com UI amigável de erro e botão de retry
- `apps/web/app/(dashboard)/loading.tsx` — Skeleton ou spinner para carregamento de rotas

---

### 4.2 Corrigir tela em branco quando paciente não encontrado

**Arquivo:** `apps/web/app/(dashboard)/patients/[id]/profile/page.tsx`

- Substituir `return null` por um componente de estado vazio (`EmptyState`) com mensagem explicativa quando o paciente não for encontrado.

---

### 4.3 Validar `params.id` como string nos sub-routes de paciente

**Arquivos:**
- `apps/web/app/(dashboard)/patients/[id]/layout.tsx:16`
- `apps/web/app/(dashboard)/patients/[id]/billing/page.tsx:22`
- `apps/web/app/(dashboard)/patients/[id]/profile/page.tsx:30`

- Substituir `params.id as string` por verificação runtime:
```ts
const patientId = Array.isArray(params.id) ? params.id[0] : params.id;
```

---

## Fase 5 — Limpeza e Consistência

### 5.1 Corrigir typo `font-poppings`

**Arquivo:** `apps/web/src/screens/home-screen.tsx:425`

- Corrigir `font-poppings` → `font-poppins`.

---

### 5.2 Remover dead code: `useFieldArray` sem UI em `new-billing-modal.tsx`

**Arquivo:** `apps/web/src/modals/new-billing-modal.tsx`

- O JSX de links de pagamento está comentado mas `useFieldArray`, `replace` e o `useEffect` de sincronização ainda executam.
- Remover `useFieldArray`, `replace` e o `useEffect` que sincroniza o array com `installment_count` enquanto o UI correspondente permanecer comentado.

---

### 5.3 Remover supressão Biome sem explicação em `patient-info.tsx`

**Arquivo:** `apps/web/src/components/shared/patient-info.tsx`

- Remover o comentário `// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>` — a supressão é desnecessária pois as deps `[patient]` já estão corretas e `form` é uma referência estável do `useForm`.

---

### 5.4 Validar variáveis de ambiente em vez de usar `as string`

**Arquivo:** `packages/supabase/src/server.ts`

- Substituir `process.env.SUPABASE_URL as string` por runtime assertion:
```ts
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
```

---

### 5.5 Usar `supabase` normal em `getEnterpriseBillings`

**Arquivo:** `apps/web/src/services/billing.ts:80`

- A query de leitura de billings usa `supabaseAdmin` sem justificativa.
- Substituir pelo client com RLS (`supabase`).

---

## Resumo por Fase

| Fase | Itens | Prioridade |
|------|-------|------------|
| 1 — Segurança e Bugs | 1.1–1.5 | Alta |
| 2 — Performance e Dados | 2.1–2.5 | Alta |
| 3 — Arquitetura e Componentes | 3.1–3.8 | Média |
| 4 — Error Handling e UX | 4.1–4.3 | Média |
| 5 — Limpeza e Consistência | 5.1–5.5 | Baixa |
