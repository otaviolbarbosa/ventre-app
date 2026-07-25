# Feature: Corrigir cache da home e reduzir chamadas duplicadas

## Summary

A tela `/home` dispara 3 Server Actions em paralelo no mount (`getHomeDataAction`, `getHomePatientsAction`, `getPatientsAction`), e uma delas (`getPatientsAction`, que busca *todas* as pacientes ativas) só é usada dentro do modal "Novo Agendamento" — que pode nunca ser aberto. Além disso, o `unstable_cache` de `getHomeDataAction` está quebrado por recriar o wrapper a cada chamada (mesmo anti-padrão já documentado e corrigido em `home-patients-cache.ts`). Por fim, `finishPatientCareAction` finaliza o acompanhamento de uma gestante sem invalidar as tags de cache da home, deixando dado stale até o TTL expirar.

## User Story

Como profissional de saúde
Eu quero que a tela inicial (`/home`) carregue rápido e sem chamadas desnecessárias
Para que eu veja dados atualizados sem sobrecarregar o banco a cada abertura da página

## Problem Statement

1. `getCachedHomeData` (`apps/web/src/services/home.ts:206-211`) recria o wrapper `unstable_cache` a cada invocação (arrow function inline dentro da função exportada), impedindo o cache de funcionar de forma consistente.
2. `getPatientsAction` é disparada no mount de `HomeScreen` mesmo que o usuário nunca abra o modal "Novo Agendamento", gerando uma query extra desnecessária em toda visita a `/home`.
3. `finishPatientCareAction` (`apps/web/src/actions/finish-patient-care-action.ts`) não invalida `home-patients-{userId}`, `home-data-{userId}` nem `enterprise-patients-{enterpriseId}`, deixando a home com dado stale (paciente finalizada ainda aparecendo, DPP desatualizado) após encerrar o acompanhamento.

## Solution Statement

- Espelhar em `home.ts` o padrão de memoização por usuário já usado em `home-patients-cache.ts` (Map em nível de módulo, uma única instância de `unstable_cache` por `userId`).
- Tornar a busca de `getPatientsAction` lazy em `HomeScreen`, disparando-a apenas quando `showNewAppointment` se torna `true` pela primeira vez.
- Adicionar as mesmas chamadas `revalidateTag` de `delete-pregnancy-action.ts`/`add-patient-action.ts` em `finish-patient-care-action.ts`.

## Metadata

| Field             | Value                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| Type              | BUG_FIX                                                                                                     |
| Complexity        | LOW                                                                                                          |
| Systems Affected  | apps/web (home screen, home data services, patient actions)                                                |
| Dependencies      | next 16.1.0 (`unstable_cache`, `revalidateTag`), next-safe-action                                            |
| Estimated Tasks   | 3                                                                                                            |

---

## UX Design

### Before State

```
╔════════════════════════════════════════════════════════════════╗
║ Mount /home                                                     ║
║  ├─ fetchHomeData()      → DB query (cache quebrado: sempre     ║
║  │                          bate no Supabase, mesmo dentro do    ║
║  │                          TTL de 1h)                           ║
║  ├─ fetchPatients()      → DB query (cache ok, per-user memo)   ║
║  └─ fetchAllPatients()   → DB query TODAS pacientes ativas,     ║
║                             mesmo que o modal nunca seja aberto  ║
║                                                                    ║
║ finishPatientCareAction() → revalidatePath("/patients") apenas  ║
║   Home continua servindo cache stale até o TTL expirar           ║
╚════════════════════════════════════════════════════════════════╝
```

### After State

```
╔════════════════════════════════════════════════════════════════╗
║ Mount /home                                                     ║
║  ├─ fetchHomeData()      → cache per-user real (hit dentro do   ║
║  │                          TTL de 1h, sem round-trip ao DB)     ║
║  ├─ fetchPatients()      → cache ok (já funcionava)              ║
║  └─ (getPatientsAction NÃO é chamada aqui)                       ║
║                                                                    ║
║ Usuário clica "Novo Agendamento" → showNewAppointment=true       ║
║  └─ fetchAllPatients()   → dispara só agora (uma vez)            ║
║                                                                    ║
║ finishPatientCareAction() → revalidateTag home-patients/home-data║
║   /enterprise-patients + revalidatePath("/patients")             ║
║   Home reflete a mudança imediatamente na próxima visita         ║
╚════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location                                | Before                              | After                                       | User Impact                                  |
| ---------------------------------------- | ------------------------------------ | -------------------------------------------- | ---------------------------------------------- |
| `home-screen.tsx` mount effect           | 3 actions disparadas em paralelo     | 2 actions no mount                            | Menos carga no DB a cada abertura de `/home`   |
| Modal "Novo Agendamento"                 | Dados já carregados (potencialmente sem uso) | Dados buscados só ao abrir o modal   | Sem mudança perceptível de UX, só menos I/O    |
| Finalizar acompanhamento                 | Home pode mostrar dado stale por até 1h | Home atualizada na próxima navegação      | Paciente finalizada some da home imediatamente |

---

## Mandatory Reading

| Priority | File                                                     | Lines   | Why Read This                                                        |
| -------- | --------------------------------------------------------- | ------- | ------------------------------------------------------------------- |
| P0       | `apps/web/src/services/home-patients-cache.ts`             | 147-169 | Padrão exato de memoização por usuário a replicar em `home.ts`      |
| P0       | `apps/web/src/services/home.ts`                             | 206-211 | Função quebrada a corrigir                                          |
| P0       | `apps/web/src/actions/delete-pregnancy-action.ts`           | 42-48   | Padrão exato de `revalidateTag` a replicar em `finish-patient-care-action.ts` |
| P1       | `apps/web/src/actions/add-patient-action.ts`                | 58-63   | Segunda referência confirmando o mesmo padrão de tags                |
| P1       | `apps/web/src/screens/home-screen.tsx`                      | 245-273, 499-504 | Onde `fetchAllPatients` é chamada e onde o modal consome `allPatients` |

---

## Patterns to Mirror

**MEMOIZED unstable_cache POR USUÁRIO:**

```typescript
// SOURCE: apps/web/src/services/home-patients-cache.ts:147-169
// unstable_cache must be a stable function reference created at module level.
// Inline creation (inside getCachedHomePatients) creates a new cache namespace on every
// call, causing consistent cache misses. We memoize one cache function per userId so
// the reference is stable and per-user tags remain valid for targeted revalidation.
type CachedFetchFn = (params: FetchParams) => Promise<HomePatientItem[]>;
const userCacheFns = new Map<string, CachedFetchFn>();

function getOrCreateUserCacheFn(userId: string): CachedFetchFn {
  if (!userCacheFns.has(userId)) {
    userCacheFns.set(
      userId,
      unstable_cache(fetchHomePatients, ["home-patients", userId], {
        tags: [`home-patients-${userId}`],
        revalidate: 300,
      }),
    );
  }
  return userCacheFns.get(userId) as CachedFetchFn;
}

export function getCachedHomePatients(params: FetchParams): Promise<HomePatientItem[]> {
  return getOrCreateUserCacheFn(params.userId)(params);
}
```

**REVALIDATE TAGS AO MUTAR DADOS DA PACIENTE:**

```typescript
// SOURCE: apps/web/src/actions/delete-pregnancy-action.ts:42-48
revalidatePath("/patients");
revalidateTag(`home-patients-${user.id}`, { expire: 300 });
revalidateTag(`home-data-${user.id}`, { expire: 300 });

if (profile.enterprise_id) {
  revalidateTag(`enterprise-patients-${profile.enterprise_id}`, { expire: 300 });
}
```

**LAZY FETCH NO CLIENTE (padrão já usado em `handleFilterChange`/`handleDppFilterChange` de `home-screen.tsx`, adaptado para first-open):**

```typescript
// SOURCE: apps/web/src/screens/home-screen.tsx:249-250 (estado existente)
const [showNewAppointment, setShowNewAppointment] = useState(false);
```

---

## Files to Change

| File                                                    | Action | Justification                                                                 |
| --------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| `apps/web/src/services/home.ts`                            | UPDATE | Corrigir `getCachedHomeData` para memoizar o wrapper `unstable_cache` por usuário |
| `apps/web/src/screens/home-screen.tsx`                      | UPDATE | Tornar `fetchAllPatients()` lazy, disparada apenas na primeira abertura do modal |
| `apps/web/src/actions/finish-patient-care-action.ts`        | UPDATE | Adicionar `revalidateTag` para `home-patients`, `home-data` e `enterprise-patients` |

---

## NOT Building (Scope Limits)

- Não vou unificar/deduplicar as queries de `getHomeDataAction` e `getHomePatientsAction` (elas servem propósitos distintos: resumo/DPP vs. lista filtrada) — fora do escopo pedido.
- Não vou alterar o TTL de nenhuma cache (`revalidate: 3600` em `home-data`, `revalidate: 300` em `home-patients`) — mantém os valores existentes.
- Não vou tocar em `home-enterprise-screen.tsx` / `enterprise-home-patients-cache.ts` — o bug de cache reportado é específico de `home.ts`, e esse outro arquivo já segue o padrão correto.

---

## Step-by-Step Tasks

### Task 1: UPDATE `apps/web/src/services/home.ts`

- **ACTION**: Substituir a criação inline do `unstable_cache` por uma função memoizada por `userId`, no mesmo padrão de `home-patients-cache.ts:147-169`.
- **IMPLEMENT**:
  ```typescript
  type CachedHomeDataFn = () => Promise<HomeData>;
  const userHomeDataCacheFns = new Map<string, CachedHomeDataFn>();

  function getOrCreateHomeDataCacheFn(userId: string): CachedHomeDataFn {
    if (!userHomeDataCacheFns.has(userId)) {
      userHomeDataCacheFns.set(
        userId,
        unstable_cache(() => fetchHomeData(userId), ["home-data", userId], {
          tags: [`home-data-${userId}`],
          revalidate: 3600,
        }),
      );
    }
    return userHomeDataCacheFns.get(userId) as CachedHomeDataFn;
  }

  export function getCachedHomeData(userId: string): Promise<HomeData> {
    return getOrCreateHomeDataCacheFn(userId)();
  }
  ```
- **MIRROR**: `apps/web/src/services/home-patients-cache.ts:147-169` (mesma estrutura, adaptada para `HomeData` sem parâmetros de filtro)
- **GOTCHA**: Manter a mesma tag `home-data-${userId}` e `revalidate: 3600` — outras actions (`add-patient-action.ts`, `delete-pregnancy-action.ts`) já dependem dessa tag para invalidação.
- **VALIDATE**: `pnpm check-types`

### Task 2: UPDATE `apps/web/src/screens/home-screen.tsx`

- **ACTION**: Remover `fetchAllPatients()` do `useEffect` de mount (linha 272) e disparar a busca lazy quando o modal de novo agendamento é aberto pela primeira vez.
- **IMPLEMENT**:
  1. Remover `fetchAllPatients();` do `useEffect` em `home-screen.tsx:269-273`.
  2. Adicionar um `useEffect` que dispara `fetchAllPatients()` quando `showNewAppointment` se torna `true` e os dados ainda não foram buscados (usar `allPatientsResult.data` como guarda para não refazer fetch em reaberturas):
     ```typescript
     useEffect(() => {
       if (showNewAppointment && !allPatientsResult.data) {
         fetchAllPatients();
       }
       // eslint-disable-next-line react-hooks/exhaustive-deps
     }, [showNewAppointment]);
     ```
  3. Ajustar o comentário biome-ignore na linha 268 se necessário (o efeito de mount deixa de disparar 3 actions, passa a disparar 2).
- **MIRROR**: Padrão de `useEffect` condicional já usado no arquivo (ex.: `handleDppFilterChange`, `useEffect` de cleanup em `home-screen.tsx:322-326`)
- **GOTCHA**: `allPatients` (linha 284: `allPatientsResult.data?.patients ?? []`) precisa continuar retornando `[]` antes do primeiro fetch — o `NewAppointmentModal` já deve lidar com lista vazia enquanto carrega (verificar rapidamente o componente, mas não é esperado quebrar pois hoje a lista também começa vazia até a resposta chegar).
- **VALIDATE**: `pnpm check-types`

### Task 3: UPDATE `apps/web/src/actions/finish-patient-care-action.ts`

- **ACTION**: Adicionar `revalidateTag` para as mesmas tags de `delete-pregnancy-action.ts`, logo após a mutação principal e antes/junto do `revalidatePath` existente.
- **IMPLEMENT**:
  ```typescript
  import { revalidatePath, revalidateTag } from "next/cache";
  // ...
  revalidatePath("/patients");
  revalidateTag(`home-patients-${user.id}`, { expire: 300 });
  revalidateTag(`home-data-${user.id}`, { expire: 300 });

  if (profile.enterprise_id) {
    revalidateTag(`enterprise-patients-${profile.enterprise_id}`, { expire: 300 });
  }
  ```
- **MIRROR**: `apps/web/src/actions/delete-pregnancy-action.ts:6,42-48`
- **GOTCHA**: O import atual é `import { revalidatePath } from "next/cache";` (linha 5) — precisa virar `import { revalidatePath, revalidateTag } from "next/cache";`.
- **VALIDATE**: `pnpm check-types`

---

## Testing Strategy

Sem suíte de testes automatizados para esses arquivos no repositório atual (verificar se existe antes de assumir). Validação primária é `pnpm check-types` + validação manual.

### Edge Cases Checklist

- [ ] Usuário nunca abre o modal "Novo Agendamento" — `getPatientsAction` nunca deve ser chamada.
- [ ] Usuário abre e fecha o modal múltiplas vezes — `fetchAllPatients()` deve disparar apenas na primeira abertura (guard via `allPatientsResult.data`).
- [ ] Duas requisições concorrentes de `getCachedHomeData` para o mesmo `userId` — devem compartilhar a mesma entrada de cache (sem race condition nova introduzida pelo `Map`).
- [ ] Finalizar acompanhamento de uma paciente sem `enterprise_id` no profile — não deve tentar invalidar `enterprise-patients-undefined`.
- [ ] Finalizar acompanhamento e voltar para `/home` — paciente finalizada não deve mais aparecer na lista/DPP.

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```

**EXPECT**: Exit 0, sem erros de tipo.

```bash
npx biome lint --write --unsafe apps/web/src/services/home.ts apps/web/src/screens/home-screen.tsx apps/web/src/actions/finish-patient-care-action.ts
```

**EXPECT**: Sem warnings de ordenação de classes/imports.

### Level 2: MANUAL_VALIDATION

1. Rodar `pnpm dev`, abrir `/home` no browser com DevTools Network aberto.
2. Confirmar que apenas 2 chamadas a Server Actions (`getHomeDataAction`, `getHomePatientsAction`) disparam no load inicial — sem `getPatientsAction`.
3. Clicar em "Novo Agendamento" e confirmar que `getPatientsAction` dispara nesse momento, populando o seletor de pacientes do modal.
4. Fechar e reabrir o modal — confirmar que `getPatientsAction` NÃO dispara de novo (guard funcionando).
5. Finalizar o acompanhamento de uma gestante de teste (via fluxo existente) e voltar para `/home` — confirmar que ela some da lista/DPP imediatamente, sem esperar o TTL.

---

## Acceptance Criteria

- [ ] `getCachedHomeData` usa uma instância de `unstable_cache` memoizada por `userId`, espelhando `home-patients-cache.ts`.
- [ ] `getPatientsAction` não é mais chamada no mount de `HomeScreen`; passa a ser chamada apenas na primeira abertura do modal "Novo Agendamento".
- [ ] `finishPatientCareAction` invalida `home-patients-{userId}`, `home-data-{userId}` e, quando aplicável, `enterprise-patients-{enterpriseId}`.
- [ ] `pnpm check-types` passa sem erros.
- [ ] Nenhuma regressão visual/funcional na home ou no modal de novo agendamento.

---

## Completion Checklist

- [ ] Task 1 implementada e validada (`pnpm check-types`)
- [ ] Task 2 implementada e validada (`pnpm check-types` + teste manual do modal)
- [ ] Task 3 implementada e validada (`pnpm check-types` + teste manual de finalização)
- [ ] Validação manual completa (5 passos da seção Manual Validation)
- [ ] Todos os critérios de aceitação atendidos

---

## Risks and Mitigations

| Risk                                                                 | Likelihood | Impact | Mitigation                                                                                   |
| ---------------------------------------------------------------------- | ------------ | -------- | ----------------------------------------------------------------------------------------------- |
| Guard `!allPatientsResult.data` nunca refaz fetch após erro de rede    | LOW          | LOW      | `next-safe-action` mantém `result.data` undefined em caso de erro, então o guard permite retry na próxima abertura do modal |
| Memoização por `userId` em `Map` cresce indefinidamente em long-running server | LOW          | LOW      | Mesmo padrão já em produção em `home-patients-cache.ts` sem problemas reportados; fora do escopo desta correção |
| Import duplicado/quebrado em `finish-patient-care-action.ts`           | LOW          | MED      | Validado via `pnpm check-types` no Task 3                                                    |

---

## Notes

Este plano foi gerado a partir de investigação direta do código já realizada nesta sessão (leitura completa dos 3 services/actions envolvidos e comparação com os padrões existentes em `home-patients-cache.ts`, `delete-pregnancy-action.ts` e `add-patient-action.ts`), sem necessidade de exploração adicional via agentes — o escopo é pequeno (3 arquivos) e os padrões a seguir já são exemplares dentro do próprio módulo.
