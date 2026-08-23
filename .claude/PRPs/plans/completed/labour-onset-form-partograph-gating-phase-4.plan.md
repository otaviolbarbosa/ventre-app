# Feature: Gating na UI do Modo Parto (Phase 4 — final)

## Summary

Consumir `partographUnlockedAt` (já retornado por `getBirthModeTimelineAction` desde a Phase 3) em `birth-mode-screen.tsx` para: (a) ocultar o tab "Partograma" enquanto a gestação não atingiu o limiar clínico; (b) filtrar os eventos passados a `BirthModePartograph` para incluir apenas os posteriores ao desbloqueio; (c) manter a "Linha do tempo" sempre com o array completo; (d) manter tudo sincronizado via realtime — como a tela hoje NÃO consome nenhuma subscription de `pregnancies` (só de `birth_contractions`/`birth_cervical_dilations`), esta fase também passa a usar o hook `useBirthModeRealtime` já existente para captar a transição de `partograph_unlocked_at` de `null` para setado, sem re-fetch nem recomputação client-side.

## User Story

As a profissional da equipe de cuidado
I want to ver o tab "Partograma" aparecer automaticamente assim que a gestante atinge o limiar clínico (contração 3/3min + dilatação ≥5cm), com o gráfico mostrando apenas os dados a partir desse momento
So that o partograma reflita fielmente apenas a fase ativa do trabalho de parto, sem exigir recarregar a página

## Problem Statement

`birth-mode-screen.tsx` já recebe `partographUnlockedAt: string | null` de `getBirthModeTimelineAction` (Phase 3), mas hoje **descarta esse valor completamente** — não há estado local para ele, o tab "Partograma" está sempre visível assim que existe qualquer evento, e `BirthModePartograph` recebe o mesmo array `events` completo que `BirthModeTimeline`, sem nenhuma filtragem.

## Solution Statement

Adicionar um novo estado `partographUnlockedAt` em `birth-mode-screen.tsx`, populado a partir do `onSuccess` de `getBirthModeTimelineAction` (fetch inicial) e mantido atualizado via uma nova chamada a `useBirthModeRealtime()` (hook já existente, mas não usado nesta tela) — que expõe `lastActivation`, a linha completa de `pregnancies` sempre que há um `UPDATE` com `birth_mode_active=eq.true`. Um `useEffect` filtra por `lastActivation.id === pregnancyId` e, se `partograph_unlocked_at` vier setado, atualiza o estado local (nunca regride, pois só se escreve quando o valor persistido é não-nulo). O tab "Partograma" (`TabsTrigger`/`TabsContent`) só é renderizado quando `partographUnlockedAt` é não-nulo — seguindo o padrão já usado no arquivo (`{!hasFinished && (...)}`) — e um `useMemo` filtra `events` por `occurredAt >= partographUnlockedAt` antes de passá-los a `BirthModePartograph`; `BirthModeTimeline` continua recebendo o array `events` completo, sem alterações no seu uso.

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------|
| Type             | ENHANCEMENT                                                           |
| Complexity       | LOW                                                                   |
| Systems Affected | `apps/web` (screens)                                                  |
| Dependencies     | Nenhuma nova — usa `useBirthModeRealtime` já existente                |
| Estimated Tasks  | 1 (múltiplas edições no mesmo arquivo)                                |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║  fetchTimeline() → onSuccess: seta events, patientId, patientName,             ║
║                                hasFinished, wasActivated                       ║
║                    (data.partographUnlockedAt é lido pela action mas           ║
║                     DESCARTADO — nenhum estado local o recebe)                 ║
║                                                                                 ║
║  ┌──────────────────────────────────────────┐                                 ║
║  │ Tabs (defaultValue="partograph")          │                                 ║
║  │  [Partograma]  [Linha do tempo]           │  ◄── ambos sempre visíveis      ║
║  │                                            │                                 ║
║  │  BirthModePartograph events={events}      │  ◄── TODOS os eventos,          ║
║  │  BirthModeTimeline    events={events}     │      inclusive pré-limiar       ║
║  └──────────────────────────────────────────┘                                 ║
║                                                                                 ║
║  PAIN_POINT: partograma exibido/alimentado antes do limiar clínico ser         ║
║  atingido, distorcendo o gráfico.                                             ║
║                                                                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║  fetchTimeline() → onSuccess: + setPartographUnlockedAt(data.partographUnlockedAt) ║
║                                                                                 ║
║  useBirthModeRealtime() → lastActivation (linha completa de `pregnancies`)     ║
║      │                                                                         ║
║      ▼ useEffect: se lastActivation.id === pregnancyId                        ║
║               && lastActivation.partograph_unlocked_at                        ║
║      │       → setPartographUnlockedAt(...)  (nunca regride)                  ║
║      ▼                                                                         ║
║  ┌──────────────────────────────────────────┐                                 ║
║  │ Tabs (defaultValue = unlocked? "partograph" : "timeline")                  ║
║  │  {unlocked && [Partograma]}  [Linha do tempo]                              ║
║  │                                            │                                 ║
║  │  {unlocked && BirthModePartograph events={filteredEvents}}  ◄── só ≥unlock ║
║  │  BirthModeTimeline    events={events}                       ◄── completo   ║
║  └──────────────────────────────────────────┘                                 ║
║                                                                                 ║
║  VALUE_ADD: partograma só aparece quando clinicamente apropriado, e o          ║
║  gráfico reflete apenas a fase ativa real — sem reload de página, via realtime.║
║                                                                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| Tab "Partograma" | Sempre visível | Oculto até `partographUnlockedAt` ser setado | Não vê um gráfico prematuramente distorcido |
| `BirthModePartograph` | Recebe todos os eventos | Recebe apenas eventos com `occurredAt >= partographUnlockedAt` | Gráfico reflete só a fase ativa real |
| `BirthModeTimeline` | Recebe todos os eventos | Sem mudança — continua completo | Nenhum |
| Transição de estado | N/A | Tab aparece automaticamente ao ser desbloqueado, via realtime (sem reload) | UX contínua durante o acompanhamento |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/screens/birth-mode-screen.tsx` | 1-216 (arquivo inteiro) | Arquivo único a modificar — todos os pontos de integração estão aqui |
| P0 | `apps/web/src/hooks/use-birth-mode-realtime.ts` | 1-72 (arquivo inteiro) | Hook a consumir — `lastActivation` é a linha completa de `pregnancies` (`payload.new as Tables<"pregnancies">`), SEM filtro por `pregnancyId` — o filtro `lastActivation?.id === pregnancyId` deve ser feito no consumidor |
| P0 | `apps/web/src/lib/birth-mode-timeline-data.ts` | 7-15 | Confirma que `BirthModeTimelineData.partographUnlockedAt: string \| null` já existe (Phase 3) |
| P1 | `packages/ui/src/tabs.tsx` | 25-38 | Confirma que `TabsTrigger` já suporta `disabled` nativamente (classes `disabled:pointer-events-none disabled:opacity-50` já presentes) — mas esta fase opta por OCULTAR (não `disabled`), ver seção Patterns |
| P1 | `apps/web/src/components/shared/birth-mode-partograph.tsx` | 72-74 | Confirma prop interface `{ events: BirthModeTimelineEvent[] }` — não precisa de nenhuma mudança, só recebe um array já filtrado |
| P1 | `apps/web/src/components/shared/birth-mode-timeline.tsx` | 121-123 | Idem — não precisa de nenhuma mudança |

**External Documentation:** Nenhuma necessária.

---

## Patterns to Mirror

**ESTADO INDIVIDUAL POR CAMPO (não um objeto único) — padrão já usado no arquivo:**
```typescript
// SOURCE: apps/web/src/screens/birth-mode-screen.tsx:31-36
const [events, setEvents] = useState<BirthModeTimelineEvent[]>([]);
const [patientId, setPatientId] = useState<string | null>(null);
const [patientName, setPatientName] = useState(initialPatientName);
const [hasFinished, setHasFinished] = useState(false);
const [wasActivated, setWasActivated] = useState<boolean | null>(null);
```

**ONSUCCESS POPULANDO OS ESTADOS (padrão a estender):**
```typescript
// SOURCE: apps/web/src/screens/birth-mode-screen.tsx:39-53
const { execute: fetchTimeline, isPending } = useAction(getBirthModeTimelineAction, {
  onSuccess: ({ data }) => {
    if (!data) return;
    setEvents(data.events);
    if (data.patientId) setPatientId(data.patientId);
    if (data.patientName) setPatientName(data.patientName);
    setHasFinished(data.hasFinished);
    setWasActivated(data.wasActivated);
    ...
  },
});
```

**RENDERIZAÇÃO CONDICIONAL COM `&&` (padrão já usado no arquivo — a preferir sobre `disabled`):**
```typescript
// SOURCE: apps/web/src/screens/birth-mode-screen.tsx:175-181, 161-172
{!hasFinished && (
  <BirthModeRegisterButtons
    pregnancyId={pregnancyId}
    events={events}
    onSuccess={() => fetchTimeline({ pregnancyId })}
  />
)}
...
{!hasFinished && patientId && (
  <Button ...>Registrar Nascimento</Button>
)}
```

**`useBirthModeRealtime` — hook a consumir (COMPLETO):**
```typescript
// SOURCE: apps/web/src/hooks/use-birth-mode-realtime.ts:16-72
export function useBirthModeRealtime() {
  const { user } = useAuth();
  const [lastActivation, setLastActivation] = useState<BirthModeActivation | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disabled");

  useEffect(() => {
    if (typeof window === "undefined" || !user) return;
    ...
    const channel = supabase
      .channel(CHANNEL_NAME)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pregnancies", filter: "birth_mode_active=eq.true" },
        (payload) => {
          ...
          setLastActivation(payload.new as BirthModeActivation);
        },
      )
      .subscribe(...);
    ...
  }, [user]);

  return { lastActivation, connectionStatus };
}
```
`BirthModeActivation = Tables<"pregnancies">` — inclui `partograph_unlocked_at`. O canal (`CHANNEL_NAME = "birth-mode-activations"`) NÃO é filtrado por `pregnancyId`, apenas por `birth_mode_active=eq.true` — qualquer gestação ativa pode disparar o listener, então o consumidor DEVE checar `lastActivation?.id === pregnancyId` antes de aplicar o valor.

**TIPO JÁ RETORNADO PELA ACTION (Phase 3, sem mudanças necessárias aqui):**
```typescript
// SOURCE: apps/web/src/lib/birth-mode-timeline-data.ts:7-15
export type BirthModeTimelineData = {
  events: BirthModeTimelineEvent[];
  patientId: string | null;
  patientName: string | null;
  hasFinished: boolean;
  birthModeActive: boolean;
  wasActivated: boolean;
  partographUnlockedAt: string | null;
};
```

---

## Files to Change

| File                                                                 | Action | Justification                                                        |
| ---------------------------------------------------------------------|--------|------------------------------------------------------------------------|
| `apps/web/src/screens/birth-mode-screen.tsx`                        | UPDATE | Único arquivo a mudar — todo o gating de UI vive aqui |

Nenhum outro arquivo precisa de mudanças: `BirthModePartograph`/`BirthModeTimeline` já têm a prop interface correta (`{ events: BirthModeTimelineEvent[] }`); `useBirthModeRealtime` já existe e não precisa de nenhuma alteração; `getBirthModeTimelineAction`/`fetchBirthModeTimelineData` já retornam `partographUnlockedAt` desde a Phase 3.

---

## NOT Building (Scope Limits)

- Filtro/gating na "Linha do tempo" — ela deve continuar mostrando TODOS os eventos, por requisito explícito da PRD.
- Re-bloqueio do tab caso indicadores regridam — não existe tal caminho; `partographUnlockedAt` é monotônico (Phase 3 garante isso no banco).
- Badge/indicador visual de "quando foi desbloqueado" (ex: "desbloqueado às HH:mm") — mencionado como Open Question não resolvida na PRD original; não implementar nesta fase sem confirmação explícita.
- Uso de `disabled` no `TabsTrigger` em vez de ocultar completamente — decisão desta fase é ocultar (`&&`), consistente com o único padrão de visibilidade condicional já usado neste arquivo; `disabled` seria um padrão novo sem precedente no codebase.
- Qualquer mudança em `use-birth-mode-realtime.ts`, `use-birth-mode-timeline-realtime.ts`, `birth-mode-partograph.tsx`, ou `birth-mode-timeline.tsx` — nenhum precisa de alteração.

---

## Step-by-Step Tasks

Execute em ordem. Todas as edições são no mesmo arquivo (`birth-mode-screen.tsx`), mas atômicas e verificáveis independentemente por sub-passo.

### Task 1: UPDATE `apps/web/src/screens/birth-mode-screen.tsx`

- **ACTION**: Adicionar estado, popular no fetch inicial, sincronizar via realtime, filtrar eventos, ocultar o tab condicionalmente
- **IMPLEMENT** (na ordem):

  1. Adicionar import do hook de realtime de `pregnancies` (já existente):
     ```typescript
     import { useBirthModeRealtime } from "@/hooks/use-birth-mode-realtime";
     ```
     Adicionar junto aos imports de hooks existentes (perto de `useBirthModeTimelineRealtime`, linha 11), e `useMemo` ao import de `"react"` (linha 19):
     ```typescript
     import { useCallback, useEffect, useMemo, useRef, useState } from "react";
     ```

  2. Adicionar novo estado, junto aos demais (linhas 31-36):
     ```typescript
     const [partographUnlockedAt, setPartographUnlockedAt] = useState<string | null>(null);
     ```

  3. Popular esse estado no `onSuccess` do fetch inicial (linhas 39-53):
     ```typescript
     const { execute: fetchTimeline, isPending } = useAction(getBirthModeTimelineAction, {
       onSuccess: ({ data }) => {
         if (!data) return;
         setEvents(data.events);
         if (data.patientId) setPatientId(data.patientId);
         if (data.patientName) setPatientName(data.patientName);
         setHasFinished(data.hasFinished);
         setWasActivated(data.wasActivated);
         setPartographUnlockedAt(data.partographUnlockedAt);
         for (const event of data.events) {
           if (event.professionalId) {
             professionalNamesRef.current.set(event.professionalId, event.professionalName);
           }
         }
       },
     });
     ```

  4. Consumir `useBirthModeRealtime` e sincronizar via `useEffect`, logo após a chamada a `useBirthModeTimelineRealtime` (linha 86):
     ```typescript
     const { lastActivation } = useBirthModeRealtime();

     useEffect(() => {
       if (lastActivation?.id === pregnancyId && lastActivation.partograph_unlocked_at) {
         setPartographUnlockedAt(lastActivation.partograph_unlocked_at);
       }
     }, [lastActivation, pregnancyId]);
     ```

  5. Adicionar `useMemo` para os eventos filtrados do partograma, antes do `return` do JSX (perto da declaração de `isExportingPdf`, linha 88, ou logo antes do bloco `Tabs`):
     ```typescript
     const partographEvents = useMemo(() => {
       if (!partographUnlockedAt) return [];
       const unlockedAtMs = new Date(partographUnlockedAt).getTime();
       return events.filter((event) => new Date(event.occurredAt).getTime() >= unlockedAtMs);
     }, [events, partographUnlockedAt]);
     ```

  6. Atualizar o bloco `Tabs` (linhas 190-201) para ocultar o tab "Partograma" e usar `partographEvents`:
     ```tsx
     <Tabs defaultValue={partographUnlockedAt ? "partograph" : "timeline"}>
       <TabsList className="w-full max-w-md">
         {partographUnlockedAt && <TabsTrigger value="partograph">Partograma</TabsTrigger>}
         <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
       </TabsList>
       {partographUnlockedAt && (
         <TabsContent value="partograph">
           <BirthModePartograph events={partographEvents} />
         </TabsContent>
       )}
       <TabsContent value="timeline">
         <BirthModeTimeline events={events} />
       </TabsContent>
     </Tabs>
     ```

- **MIRROR**: Padrão `{!hasFinished && (...)}` já usado no mesmo arquivo (linhas 161-172, 175-181) para a ocultação condicional; padrão de estado individual por campo (linhas 31-36) para o novo `useState`
- **GOTCHA**: `lastActivation` de `useBirthModeRealtime` NÃO é filtrado por `pregnancyId` no hook — o canal `birth-mode-activations` reage a QUALQUER `UPDATE` em `pregnancies` com `birth_mode_active=eq.true`. É obrigatório checar `lastActivation?.id === pregnancyId` antes de aplicar o valor, senão o estado de uma gestação pode vazar para a tela de outra
- **GOTCHA**: Nunca setar `partographUnlockedAt` para `null` a partir do realtime — o `useEffect` só escreve quando `lastActivation.partograph_unlocked_at` é truthy, preservando o comportamento de high-water mark (uma vez setado, nunca é limpo pela UI)
- **GOTCHA**: `defaultValue={partographUnlockedAt ? "partograph" : "timeline"}` é calculado apenas no fetch inicial — como o bloco `Tabs` só renderiza depois que `isPending && events.length === 0` é falso (linha 183), `partographUnlockedAt` já está com o valor correto do primeiro fetch nesse ponto, sem race condition. Se o desbloqueio ocorrer DEPOIS via realtime enquanto o usuário já está na aba "Linha do tempo", o tab "Partograma" aparece automaticamente na lista, mas o `Tabs` (não controlado) não força a troca de aba — comportamento intencional, não interrompe o que o usuário está vendo
- **GOTCHA**: `BirthModeTimeline` continua recebendo `events` (não `partographEvents`) — não trocar por engano
- **VALIDATE**: `pnpm check-types`

---

## Testing Strategy

Mesma realidade das fases anteriores: não há suíte de testes automatizados para este componente (`apps/web` não tem `*.test.tsx` para `birth-mode-screen.tsx` ou telas irmãs). Validação desta fase é manual (via browser) + `pnpm check-types` + build.

### Edge Cases Checklist

- [ ] Gestação sem `partograph_unlocked_at` (ainda não atingiu o limiar) → tab "Partograma" não aparece na `TabsList`; apenas "Linha do tempo" visível e com todos os eventos
- [ ] Gestação com `partograph_unlocked_at` já setado desde o fetch inicial (ex: reabrir a tela depois do desbloqueio) → tab "Partograma" aparece imediatamente, com `defaultValue="partograph"`, mostrando apenas eventos com `occurredAt >= partograph_unlocked_at`
- [ ] Enquanto o usuário está com a tela aberta e o limiar é atingido (via outra aba/dispositivo registrando eventos) → o realtime de `pregnancies` (`useBirthModeRealtime`) entrega a atualização, o tab "Partograma" passa a aparecer sem reload
- [ ] `lastActivation` disparado para uma pregnancy DIFERENTE da atual (`lastActivation.id !== pregnancyId`) → não deve afetar o estado desta tela (checagem de `id` no `useEffect`)
- [ ] Evento de contração/dilatação chega via `useBirthModeTimelineRealtime` (INSERT) ANTES de `partograph_unlocked_at` estar setado → `partographEvents` continua vazio (`[]`) até o unlock chegar; `events`/Linha do tempo já mostra o novo evento imediatamente
- [ ] `partograph_unlocked_at` no passado distante em relação a alguns eventos já registrados → apenas eventos com timestamp igual ou posterior aparecem no gráfico; eventos anteriores continuam na Linha do tempo

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```
**EXPECT**: Exit 0, sem erros de tipo

```bash
./node_modules/.bin/biome lint --write --unsafe apps/web/src/screens/birth-mode-screen.tsx
```
**EXPECT**: 0 issues (usar o binário local diretamente, não `npx biome`, conforme observado em fases anteriores)

### Level 3: FULL_SUITE

```bash
pnpm --filter web build
```
**EXPECT**: Build succeeds, rota `/modo-parto` compila sem erros

### Level 5: BROWSER_VALIDATION

- [ ] Abrir `/modo-parto?pregnancyId=...` para uma gestação recém-ativada (sem eventos ainda) → apenas tab "Linha do tempo" visível
- [ ] Registrar contrações/dilatação até cruzar o limiar (via Phase 3 já implementada) → tab "Partograma" aparece automaticamente, sem reload, mostrando apenas os dados a partir do desbloqueio
- [ ] Verificar que a Linha do tempo sempre mostrou todos os eventos, inclusive os anteriores ao desbloqueio
- [ ] Recarregar a página após o desbloqueio → tab "Partograma" já aparece de início (`defaultValue="partograph"`), com os dados corretos

### Level 6: MANUAL_VALIDATION

1. Ativar Modo Parto para uma gestante de teste (Phase 2).
2. Abrir a tela `/modo-parto` e confirmar que só existe o tab "Linha do tempo".
3. Registrar eventos (contração, dilatação) sem cruzar o limiar → tab "Partograma" continua oculto.
4. Cruzar o limiar (contração ≤3min entre as duas últimas + dilatação ≥5cm) → tab "Partograma" aparece na tela SEM precisar recarregar.
5. Abrir o tab "Partograma" e confirmar que o gráfico só mostra dados a partir do momento do desbloqueio.
6. Abrir o tab "Linha do tempo" e confirmar que TODOS os eventos (inclusive os anteriores ao desbloqueio) estão lá.

---

## Acceptance Criteria

- [ ] Tab "Partograma" oculto enquanto `partographUnlockedAt` é `null`
- [ ] Tab "Partograma" aparece automaticamente (via realtime, sem reload) assim que `partograph_unlocked_at` é setado no banco
- [ ] `BirthModePartograph` recebe apenas eventos com `occurredAt >= partographUnlockedAt`
- [ ] `BirthModeTimeline` continua recebendo o array `events` completo, sem filtragem
- [ ] `lastActivation` de outra gestação (`id` diferente) não afeta o estado desta tela
- [ ] `pnpm check-types` e build passam sem erros

---

## Completion Checklist

- [ ] Task 1: Todas as 6 edições em `birth-mode-screen.tsx` aplicadas
- [ ] Level 1: `pnpm check-types` + Biome passam
- [ ] Level 3: Build passa
- [ ] Level 5/6: Fluxo testado manualmente no browser (idealmente, incluindo a transição em tempo real)
- [ ] Todos os acceptance criteria atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-------------|
| `lastActivation` de outra gestação vazar para esta tela (canal não filtrado por `pregnancyId`) | Medium | Medium | `useEffect` explicitamente checa `lastActivation?.id === pregnancyId` antes de aplicar qualquer valor |
| Tabs não controlado (`defaultValue`) não refletir corretamente o estado inicial se houver alguma condição de corrida entre fetch e primeira renderização | Low | Low | O bloco `Tabs` só é renderizado depois que o primeiro fetch já completou (`isPending && events.length === 0` é falso nesse ponto) — `partographUnlockedAt` já reflete o valor real do servidor quando o `defaultValue` é calculado |
| Filtrar por `occurredAt >= partographUnlockedAt` incluir/excluir incorretamente o evento exato do momento do desbloqueio | Low | Low | Usa `>=` (inclusivo) — o evento que efetivamente cruzou o limiar (e disparou o `partograph_unlocked_at`) é incluído no gráfico, coerente com a lógica server-side da Phase 3 |

---

## Notes

- Esta é a última fase da PRD "labour-onset-form-partograph-gating". Ao concluir, as duas features da PRD original (formulário de início de parto + liberação condicional do partograma) estarão completamente implementadas.
- Decisão de ocultar (não `disabled`) o `TabsTrigger`: embora o primitivo Shadcn/Radix já suporte `disabled` nativamente (confirmado em `packages/ui/src/tabs.tsx`), não há nenhum precedente desse padrão no codebase, enquanto a ocultação condicional via `&&` é o único padrão de visibilidade condicional já em uso neste mesmo arquivo — seguir o padrão existente reduz a superfície de decisões novas.
- `useBirthModeRealtime` é reaproveitado sem nenhuma modificação — ele já está pronto para este uso, apenas nunca havia sido consumido dentro de `birth-mode-screen.tsx` antes desta fase.
