# Feature: Redirecionamento automático para o Modo Parto

## Summary

Hoje o Modo Parto só redireciona a profissional automaticamente quando uma ativação chega em tempo real (evento Realtime de `UPDATE` na tabela `pregnancies`), com uma contagem regressiva de 10s. Se a profissional abre o app (ou volta dele em background) com um parto **já ativo**, ela só vê a barra fixa no topo (`BirthModeStatusBar`) com um botão manual "Voltar" — nada a redireciona automaticamente. Esta feature estende o hook único que já alimenta `BirthModeRealtimeProvider` (`useBirthModeStatus`) com três novos gatilhos de redirecionamento automático: (1) checagem no mount do app, (2) checagem ao voltar do background (`visibilitychange`/`pageshow`), e (3) um timer de inatividade de 2 minutos que, ao expirar, reaproveita o mesmo mecanismo de contagem regressiva de 10s e a mesma UI (`Ir agora` / `Cancelar`) já usada para ativações em tempo real.

## User Story

Como profissional de saúde acompanhando um parto
Eu quero ser redirecionada automaticamente para a tela do Modo Parto sempre que ele estiver ativo — ao abrir o app, ao voltar do background, ou após um período de inatividade navegando em outra tela
Para não perder atualizações críticas de acompanhamento de trabalho de parto por estar em outra parte do app

## Problem Statement

O redirecionamento automático hoje só existe para o instante exato da ativação (evento Realtime). Se a profissional já estava fora do app quando o parto foi ativado, ou navegou para outra tela depois, ela precisa lembrar de voltar manualmente — não há nenhum mecanismo que a traga de volta ao Modo Parto quando ele já está ativo.

## Solution Statement

Estender `useBirthModeStatus` (o único hook que alimenta o contexto do `BirthModeRealtimeProvider`) com:
1. Um efeito de "checagem inicial" que roda uma única vez por sessão/mount do provedor (equivalente a "abrir o app") e redireciona direto se houver parto ativo.
2. Um listener de `visibilitychange` (+ `pageshow` como fallback, por causa de bugs conhecidos do Safari/iOS em PWA standalone) que, ao detectar retorno do background, refaz o fetch e redireciona direto se ainda ativo.
3. Um timer de inatividade de 2 minutos (baseado em `mousedown`, `keydown`, `touchstart`, `scroll`), reiniciado a cada interação, que ao expirar aciona os últimos 10s como uma contagem regressiva cancelável — reaproveitando o mesmo estado `pendingActivation` e a mesma UI do `BirthModeStatusBar` já usados para ativação em tempo real, diferenciados por um novo campo `reason`.

Os gatilhos 1 e 2 são redirecionamentos diretos (sem contagem, sem opção de cancelar) porque o requisito pede explicitamente "abrir direto"/"deve ser direcionado". O gatilho 3 é o único cancelável, por pedido explícito do requisito ("tolera 2 minutos... contagem nos 10 segundos finais como no status bar").

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------|
| Type             | ENHANCEMENT                                                           |
| Complexity       | MEDIUM                                                                |
| Systems Affected | `use-birth-mode-status.ts`, `birth-mode-status-bar.tsx`, Modo Parto   |
| Dependencies     | Nenhuma nova — usa apenas Web APIs nativas (Page Visibility, DOM events) e o `next-safe-action`/Supabase já existentes |
| Estimated Tasks  | 5                                                                     |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                 ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  Abre o app       Parto ativo?      Vê barra fixa "Modo Parto ativo —    ║
║  (mount) ───────► (sim, via poll) ─► {paciente}" + botão "Voltar" manual ║
║                                       (NÃO redireciona sozinho)          ║
║                                                                           ║
║  App volta do     Parto ainda       Barra continua visível, nada muda   ║
║  background ────► ativo? ──────────► (nenhuma checagem é feita aqui)    ║
║                                                                           ║
║  Navegando em     2 min sem         Nada acontece — só a barra fixa      ║
║  outra tela ────► interação ───────► continua no topo indefinidamente   ║
║                                                                           ║
║  PAIN_POINT: só existe redirecionamento automático no instante exato da ║
║  ativação Realtime; qualquer outro momento exige ação manual da usuária ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                 ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  Abre o app       Parto ativo?      router.push direto para             ║
║  (mount) ───────► (1ª checagem) ───► /modo-parto?pregnancyId=X          ║
║                                                                           ║
║  App volta do     Refetch +         router.push direto para             ║
║  background ────► parto ativo? ────► /modo-parto?pregnancyId=X          ║
║  (visibilitychange/pageshow)                                            ║
║                                                                           ║
║  Navegando em     2 min sem         pendingActivation{reason:           ║
║  outra tela ────► interação ───────► "inactivity"} → contagem 10s       ║
║                                       (mesma UI: "Ir agora"/"Cancelar")  ║
║                                       → redireciona se não cancelado    ║
║                                                                           ║
║  VALUE_ADD: a profissional nunca precisa lembrar de voltar sozinha ao   ║
║  Modo Parto enquanto ele estiver ativo, mas ainda tem controle nos      ║
║  últimos 10s do fluxo de inatividade                                    ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes
| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| App mount (qualquer rota, exceto `/modo-parto`) | Mostra barra fixa, sem redirect | Redireciona direto se houver parto ativo | Chega direto na tela certa ao abrir o app |
| Retorno do background (PWA) | Nada | Refetch + redireciona direto se ativo | Nunca fica "esquecida" fora do Modo Parto após minimizar o app |
| 2 min de inatividade navegando com parto ativo | Nada | Contagem regressiva de 10s cancelável, depois redireciona | Pode continuar em outra tela por até ~2min10s antes de ser levada de volta, com chance de cancelar |
| `BirthModeStatusBar` durante contagem | Sempre mostra "Modo Parto ativado para {paciente} — redirecionando em Xs" | Mensagem varia por `reason`: ativação em tempo real vs. inatividade | Texto correto explica por que está sendo redirecionada |

---

## Mandatory Reading

**CRITICAL: O agente de implementação DEVE ler estes arquivos antes de iniciar qualquer task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/hooks/use-birth-mode-status.ts` | 1-95 | Arquivo principal a estender — TODOS os novos efeitos entram aqui, seguindo exatamente o estilo dos efeitos existentes |
| P0 | `apps/web/src/components/shared/birth-mode-status-bar.tsx` | 1-58 | UI da contagem regressiva a reaproveitar — mensagem precisa variar por `reason` |
| P1 | `apps/web/src/hooks/use-birth-mode-realtime.ts` | 1-72 | Mostra o padrão de listener client-side com cleanup (`useEffect` + `removeChannel`) a espelhar para os novos listeners de DOM |
| P1 | `apps/web/src/providers/birth-mode-realtime-provider.tsx` | 1-24 | Confirma que o provider é um wrapper fino de `useBirthModeStatus()` — NÃO criar um novo provider, só estender o hook |
| P1 | `apps/web/src/actions/get-active-birth-mode-pregnancy-action.ts` | 1-18 | Contrato de retorno de `fetchActive()` — usado no refetch do gatilho de visibilidade |
| P2 | `apps/web/app/(dashboard)/modo-parto/page.tsx` | 1-40 | Mostra o padrão de guarda de `birthModeDisabled` (`isDoula && !!disableBirthModeForDoulas`) a replicar nos novos gatilhos |
| P2 | `apps/web/src/lib/birth-mode-uterine-activity-utils.test.ts` | 1-40 | Padrão de teste unitário do projeto (vitest, funções puras) — não há `@testing-library/react`/`renderHook` disponível, então a lógica testável deve ser extraída em funções puras |

**External Documentation:**
| Source | Section | Why Needed |
|--------|---------|------------|
| [MDN — Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) | `visibilitychange` event | Base do gatilho de retorno do background |
| [WebKit Bugzilla #202399](https://bugs.webkit.org/show_bug.cgi?id=202399) | iOS standalone PWA cross-app visibility bug | `visibilitychange` pode disparar `visible` no PWA errado quando várias PWAs estão fixadas na tela inicial — mitigar sempre revalidando com fetch ao servidor, nunca confiando só no client state |
| [WebKit Bugzilla #151234](https://bugs.webkit.org/show_bug.cgi?id=151234) | `hidden` nem sempre dispara em navegações no Safari | Justifica adicionar `pageshow` como fallback além de `visibilitychange` |
| [idletimer.dev docs](https://idletimer.dev/docs/api/props) | Eventos recomendados e throttle | Confirma usar `setTimeout` reset-on-activity (não `setInterval` de polling) e evitar `mousemove` não-throttled |

---

## Patterns to Mirror

**LISTENER_COM_CLEANUP (mesmo padrão do canal Realtime):**
```typescript
// SOURCE: apps/web/src/hooks/use-birth-mode-realtime.ts:21-65
useEffect(() => {
  if (typeof window === "undefined" || !user) return;
  let cancelled = false;
  // ... registra listener/subscription
  return () => {
    cancelled = true;
    // ... remove listener/subscription
  };
}, [user]);
```

**GUARDA_DE_FLAG_DOULA (replicar exatamente):**
```typescript
// SOURCE: apps/web/src/hooks/use-birth-mode-status.ts:22-24
const { user, isProfessional, isDoula } = useAuth();
const disableBirthModeForDoulas = useFeatureFlagEnabled("disable-birth-mode-for-doulas");
const birthModeDisabled = isDoula && !!disableBirthModeForDoulas;
```

**GUARDA_DE_ROTA_ATUAL (não redirecionar se já está no Modo Parto):**
```typescript
// SOURCE: apps/web/src/hooks/use-birth-mode-status.ts:52, 92
if (pathname?.startsWith("/modo-parto")) return;
```

**TICK_DE_CONTAGEM_REGRESSIVA (reaproveitar integralmente, só generalizar o `reason`):**
```typescript
// SOURCE: apps/web/src/hooks/use-birth-mode-status.ts:58-76
// biome-ignore lint/correctness/useExhaustiveDependencies: só o pregnancyId deve reiniciar o interval — secondsLeft é atualizado via updater function, não precisa disparar o effect
useEffect(() => {
  if (!pendingActivation) return;
  const interval = setInterval(() => {
    setPendingActivation((prev) => {
      if (!prev) return prev;
      if (prev.secondsLeft <= 1) {
        router.push(`/modo-parto?pregnancyId=${prev.pregnancyId}`);
        return null;
      }
      return { ...prev, secondsLeft: prev.secondsLeft - 1 };
    });
  }, 1000);
  return () => clearInterval(interval);
}, [pendingActivation?.pregnancyId, router]);
```

**UI_DA_BARRA_DE_CONTAGEM (mensagem a tornar condicional por `reason`):**
```tsx
// SOURCE: apps/web/src/components/shared/birth-mode-status-bar.tsx:20-39
if (pendingActivation) {
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-primary px-4 py-3 text-primary-foreground shadow-lg">
      <div className="flex items-center gap-2">
        <HeartHandshake className="h-5 w-5 shrink-0" />
        <p className="text-sm">
          Modo Parto ativado para {patientName} — redirecionando em {pendingActivation.secondsLeft}s
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="secondary" onClick={goNow}>Ir agora</Button>
        <Button size="sm" variant="ghost" onClick={cancelRedirect}>Cancelar</Button>
      </div>
    </div>
  );
}
```

**TESTE_UNITARIO_FUNCAO_PURA (padrão vitest do projeto):**
```typescript
// SOURCE: apps/web/src/lib/birth-mode-uterine-activity-utils.test.ts:1-9
import { describe, expect, it } from "vitest";
import { computeDuNotations } from "./birth-mode-uterine-activity-utils";

describe("computeDuNotations", () => {
  it("calcula notação única para intervalo de 10 minutos", () => {
    expect(computeDuNotations({ interval_minutes: 10, durations_seconds: [45, 50, 55] })).toEqual([
      `DU 3/10'/50"`,
    ]);
  });
});
```

---

## Files to Change

| File                                                            | Action | Justification                                                                 |
| ----------------------------------------------------------------| ------ | ------------------------------------------------------------------------------|
| `apps/web/src/hooks/use-birth-mode-status.ts`                   | UPDATE | Adicionar checagem no mount, listener de visibilidade, timer de inatividade e generalizar `PendingActivation` com `reason` |
| `apps/web/src/lib/birth-mode-redirect-utils.ts`                 | CREATE | Funções puras testáveis: decisão de redirecionar (`shouldAutoRedirect`) e cálculo do alvo (`resolveAutoRedirectTarget`) |
| `apps/web/src/lib/birth-mode-redirect-utils.test.ts`            | CREATE | Testes unitários das funções puras acima (guardas de rota/flag/lista vazia)   |
| `apps/web/src/components/shared/birth-mode-status-bar.tsx`      | UPDATE | Mensagem do banner passa a variar conforme `pendingActivation.reason`         |

---

## NOT Building (Scope Limits)

- **Sem opção de cancelar os gatilhos 1 (mount) e 2 (retorno do background):** o requisito pede redirecionamento direto nesses dois casos ("deve abrir direto", "deve ser direcionado"), sem mencionar tolerância ou cancelamento — só o gatilho de inatividade (2 min) é cancelável, por pedido explícito.
- **Sem tela/estado de loading dedicado para o redirect de mount/visibilidade:** o `router.push`/`router.replace` já mostra o skeleton nativo do App Router durante a navegação; não criar um spinner extra.
- **Sem alteração no fluxo de ativação em tempo real existente (`reason: "activation"`):** seu comportamento (10s, cancelável) permanece idêntico; só ganha o campo `reason` para diferenciar a mensagem.
- **Sem novo hook de idle-timer genérico/reutilizável (`use-idle-timer.ts`) nem nova dependência (`react-idle-timer`):** a lógica de inatividade é específica do Modo Parto e cabe dentro de `use-birth-mode-status.ts`, seguindo o padrão de hook único que já alimenta o provider — evita abstração prematura.
- **Sem tratamento especial de Service Worker/Serwist:** pesquisa confirmou que não há necessidade de rotear a lógica de visibilidade pelo `sw.ts` — fica inteiramente no client-side React.

---

## Step-by-Step Tasks

### Task 1: CREATE `apps/web/src/lib/birth-mode-redirect-utils.ts`

- **ACTION**: Criar funções puras que encapsulam as decisões de redirecionamento, para permitir teste unitário sem precisar de `renderHook` (indisponível no projeto)
- **IMPLEMENT**:
  ```typescript
  export type AutoRedirectGuardInput = {
    isProfessional: boolean;
    birthModeDisabled: boolean;
    pathname: string | null;
    activePregnancyIds: string[];
  };

  /** Verdadeiro quando um redirecionamento automático (mount, visibilidade ou inatividade) pode ser considerado. */
  export function canConsiderAutoRedirect(input: AutoRedirectGuardInput): boolean {
    return (
      input.isProfessional &&
      !input.birthModeDisabled &&
      input.activePregnancyIds.length > 0 &&
      !input.pathname?.startsWith("/modo-parto")
    );
  }

  /** Resolve o pregnancyId alvo do redirect — sempre o primeiro parto ativo retornado pelo backend. */
  export function resolveAutoRedirectPregnancyId(activePregnancyIds: string[]): string | null {
    return activePregnancyIds[0] ?? null;
  }
  ```
- **MIRROR**: `apps/web/src/lib/birth-mode-uterine-activity-utils.ts` — arquivo de utilitários puros do mesmo domínio, mesmo estilo de exports nomeados
- **GOTCHA**: não importar `useRouter`/`usePathname` aqui — o arquivo deve ficar livre de hooks para ser testável como função pura
- **VALIDATE**: `pnpm check-types`

### Task 2: CREATE `apps/web/src/lib/birth-mode-redirect-utils.test.ts`

- **ACTION**: Testar as funções puras da Task 1
- **IMPLEMENT**: casos — profissional não-profissional retorna `false`; `birthModeDisabled=true` retorna `false`; lista vazia retorna `false`; já em `/modo-parto` ou `/modo-parto?pregnancyId=x` retorna `false`; caso feliz retorna `true`; `resolveAutoRedirectPregnancyId([])` retorna `null`; `resolveAutoRedirectPregnancyId(["a","b"])` retorna `"a"`
- **MIRROR**: `apps/web/src/lib/birth-mode-uterine-activity-utils.test.ts:1-9` (import `describe/expect/it` de `vitest`)
- **VALIDATE**: `pnpm --filter web test birth-mode-redirect-utils`

### Task 3: UPDATE `apps/web/src/hooks/use-birth-mode-status.ts` — generalizar `PendingActivation` com `reason`

- **ACTION**: Adicionar campo `reason` ao tipo e ao efeito de ativação Realtime existente
- **IMPLEMENT**:
  ```typescript
  type PendingActivation = {
    pregnancyId: string;
    secondsLeft: number;
    reason: "activation" | "inactivity";
  };
  ```
  No efeito de ativação Realtime (linha 55 atual), incluir `reason: "activation"` no `setPendingActivation`.
- **MIRROR**: `apps/web/src/hooks/use-birth-mode-status.ts:14-17, 55`
- **GOTCHA**: o efeito de tick (linhas 61-76) não precisa mudar — ele já é agnóstico ao `reason`, só precisa continuar espalhando `...prev` no updater (já faz isso)
- **VALIDATE**: `pnpm check-types`

### Task 4: UPDATE `apps/web/src/hooks/use-birth-mode-status.ts` — redirect no mount e no retorno de background

- **ACTION**: Adicionar dois novos `useEffect`: checagem inicial (uma vez por mount do provider) e listener de visibilidade/pageshow
- **IMPLEMENT**:
  ```typescript
  import { canConsiderAutoRedirect, resolveAutoRedirectPregnancyId } from "@/lib/birth-mode-redirect-utils";

  // ... dentro de useBirthModeStatus, após fetchActive/activePregnancies existentes:

  const hasCheckedInitialRedirect = useRef(false);

  // Checagem no mount — equivale a "abrir o app com parto já ativo"
  useEffect(() => {
    if (hasCheckedInitialRedirect.current) return;
    if (!user) return;

    let cancelled = false;
    (async () => {
      const result = await getActiveBirthModePregnancyAction();
      if (cancelled || hasCheckedInitialRedirect.current) return;
      hasCheckedInitialRedirect.current = true;
      const pregnancies = result?.data?.pregnancies ?? [];
      setActivePregnancies(pregnancies);
      const ids = pregnancies.map((p) => p.id);
      if (canConsiderAutoRedirect({ isProfessional, birthModeDisabled, pathname, activePregnancyIds: ids })) {
        const id = resolveAutoRedirectPregnancyId(ids);
        if (id) router.push(`/modo-parto?pregnancyId=${id}`);
      }
    })();

    return () => { cancelled = true; };
    // biome-ignore lint/correctness/useExhaustiveDependencies: checagem única por mount — só `user` deve disparar; pathname/isProfessional/birthModeDisabled são lidos no momento da resolução via closure, não devem reexecutar o fetch inicial
  }, [user]);

  // Retorno do background — visibilitychange + pageshow como fallback (bug conhecido do Safari/iOS)
  useEffect(() => {
    if (typeof document === "undefined" || !user) return;

    async function checkOnForeground() {
      const result = await getActiveBirthModePregnancyAction();
      const pregnancies = result?.data?.pregnancies ?? [];
      setActivePregnancies(pregnancies);
      const ids = pregnancies.map((p) => p.id);
      if (canConsiderAutoRedirect({ isProfessional, birthModeDisabled, pathname, activePregnancyIds: ids })) {
        const id = resolveAutoRedirectPregnancyId(ids);
        if (id) router.push(`/modo-parto?pregnancyId=${id}`);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") checkOnForeground();
    }
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) checkOnForeground();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [user, isProfessional, birthModeDisabled, pathname, router]);
  ```
- **MIRROR**: `apps/web/src/hooks/use-birth-mode-realtime.ts:21-65` (listener com cleanup); `apps/web/src/hooks/use-birth-mode-status.ts:33-36` (chamada de `getActiveBirthModePregnancyAction`)
- **IMPORTS**: `canConsiderAutoRedirect`, `resolveAutoRedirectPregnancyId` de `@/lib/birth-mode-redirect-utils`
- **GOTCHA (crítico, de pesquisa externa)**: iOS Safari em modo PWA standalone tem bugs documentados (WebKit #202399, #201737) onde `visibilitychange` pode disparar `visible` na PWA errada quando várias estão fixadas na tela inicial, e (#151234) `hidden` às vezes não dispara em certas navegações. Por isso: (a) sempre refazer o fetch ao servidor no handler — nunca redirecionar com base em `activePregnancies` potencialmente desatualizado; (b) registrar `pageshow` com `event.persisted` como fallback, pois é mais confiável que `visibilitychange` no Safari em cenários de bfcache/retomada
- **GOTCHA**: a checagem inicial (Task 4a) e a de visibilidade fazem sua própria chamada a `getActiveBirthModePregnancyAction` em vez de depender do estado `activePregnancies` — isso evita corrida com o polling de 60s e garante dado fresco no momento exato do redirect
- **VALIDATE**: `pnpm check-types`

### Task 5: UPDATE `apps/web/src/hooks/use-birth-mode-status.ts` — timer de inatividade de 2 minutos

- **ACTION**: Adicionar `useEffect` que reinicia um `setTimeout` a cada interação relevante (`mousedown`, `keydown`, `touchstart`, `scroll`) e, ao expirar, aciona o mesmo `pendingActivation` (com `reason: "inactivity"`) usado pelo fluxo de ativação em tempo real — reaproveitando o tick de contagem regressiva já existente (Task 3)
- **IMPLEMENT**:
  ```typescript
  const INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000;
  const COUNTDOWN_MS = COUNTDOWN_SECONDS * 1000; // 10_000

  const activePregnanciesRef = useRef(activePregnancies);
  useEffect(() => {
    activePregnanciesRef.current = activePregnancies;
  }, [activePregnancies]);

  useEffect(() => {
    const ids = activePregnancies.map((p) => p.id);
    const canRedirect = canConsiderAutoRedirect({ isProfessional, birthModeDisabled, pathname, activePregnancyIds: ids });
    if (!canRedirect) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    function scheduleInactivityRedirect() {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // Ao expirar, os últimos 10s são a contagem regressiva cancelável — mesmo mecanismo do tick existente
        setPendingActivation((prev) => {
          if (prev) return prev; // já há uma contagem em andamento (ex.: ativação em tempo real) — não sobrepor
          const id = resolveAutoRedirectPregnancyId(activePregnanciesRef.current.map((p) => p.id));
          if (!id) return prev;
          return { pregnancyId: id, secondsLeft: COUNTDOWN_SECONDS, reason: "inactivity" };
        });
      }, INACTIVITY_TIMEOUT_MS - COUNTDOWN_MS);
    }

    const activityEvents: (keyof WindowEventMap)[] = ["mousedown", "keydown", "touchstart", "scroll"];
    for (const event of activityEvents) {
      window.addEventListener(event, scheduleInactivityRedirect, { passive: true });
    }
    scheduleInactivityRedirect();

    return () => {
      clearTimeout(timeoutId);
      for (const event of activityEvents) {
        window.removeEventListener(event, scheduleInactivityRedirect);
      }
    };
  }, [isProfessional, birthModeDisabled, pathname, activePregnancies]);
  ```
- **MIRROR**: estilo de listener+cleanup de `use-birth-mode-realtime.ts:21-65`; padrão de `setTimeout` reset-on-activity confirmado como preferível a polling por pesquisa externa (idletimer.dev)
- **GOTCHA**: **não** usar `mousemove` na lista de eventos — o requisito só menciona cliques/toques/scrolls/teclas, e pesquisa externa confirma que `mousemove` sem throttle gera excesso de re-execuções; os 4 eventos escolhidos já cobrem "cliques, toques, scrolls e teclas" literalmente
- **GOTCHA**: o efeito depende de `activePregnancies` (array) para re-avaliar `canRedirect` quando o poll de 60s atualiza a lista — isso é intencional e seguro porque `scheduleInactivityRedirect` é reatribuído via closure a cada re-render do efeito, mas o timer só é *resetado* (não *cancelado silenciosamente*) nesses casos; se o parto for desativado nesse meio-tempo, o cleanup do efeito anterior já limpa o timeout pendente antes de decidir se um novo é necessário
- **GOTCHA**: usar a ref `activePregnanciesRef` dentro do `setTimeout` (não o valor capturado no closure do `useEffect`) para pegar a lista mais atual de partos ativos no momento exato em que o timer dispara, já que o timeout pode viver bem mais que um ciclo de render
- **GOTCHA**: se já existir um `pendingActivation` (ex.: countdown de ativação em tempo real rodando), o timer de inatividade não deve sobrepor — verificado via `if (prev) return prev;` dentro do updater
- **VALIDATE**: `pnpm check-types`

### Task 6: UPDATE `apps/web/src/components/shared/birth-mode-status-bar.tsx` — mensagem por `reason`

- **ACTION**: Trocar o texto fixo "Modo Parto ativado para {paciente} — redirecionando em Xs" por uma mensagem condicional ao `pendingActivation.reason`
- **IMPLEMENT**:
  ```tsx
  const countdownMessage =
    pendingActivation?.reason === "inactivity"
      ? `Você será redirecionada ao Modo Parto por inatividade em ${pendingActivation.secondsLeft}s`
      : `Modo Parto ativado para ${patientName} — redirecionando em ${pendingActivation?.secondsLeft}s`;
  ```
  Substituir o `<p>` da linha 25-27 por `<p className="text-sm">{countdownMessage}</p>`.
- **MIRROR**: `apps/web/src/components/shared/birth-mode-status-bar.tsx:20-39` (estrutura do bloco `pendingActivation`, mantendo `goNow`/`cancelRedirect` inalterados)
- **VALIDATE**: `npx biome lint --write --unsafe apps/web/src/components/shared/birth-mode-status-bar.tsx`

---

## Testing Strategy

### Unit Tests to Write

| Test File                                                     | Test Cases                                                                 | Validates                        |
| ---------------------------------------------------------------| -----------------------------------------------------------------------  | ---------------------------------|
| `apps/web/src/lib/birth-mode-redirect-utils.test.ts`          | ver Task 2                                                                | Guardas de decisão de redirect   |

### Edge Cases Checklist

- [ ] Usuário não é `isProfessional` (ex.: gestante logada) — nenhum redirect automático deve ocorrer
- [ ] `disable-birth-mode-for-doulas` ativo + usuária é doula — nenhum redirect automático (mount, visibilidade, ou inatividade)
- [ ] Nenhum parto ativo — nenhum redirect, nenhum timer de inatividade agendado
- [ ] Já está em `/modo-parto` ou `/modo-parto?pregnancyId=X` — nenhum dos três gatilhos deve disparar
- [ ] Parto ativado via Realtime enquanto o timer de inatividade já estava rodando — não deve haver dois `pendingActivation` concorrentes (o `if (prev) return prev` na Task 5 cobre isso)
- [ ] Usuária interage (clica/rola/digita) durante os 2 minutos — timer reinicia, nenhum redirect ocorre
- [ ] Usuária interage durante a contagem final de 10s do fluxo de inatividade — comportamento definido: só o botão "Cancelar" cancela explicitamente; nova interação de mouse/scroll não cancela silenciosamente (evita redirect "fantasma" cancelado sem intenção clara da usuária)
- [ ] App volta do background mas parto foi desativado nesse meio-tempo — o refetch no handler de `visibilitychange` deve refletir isso e não redirecionar
- [ ] Duas abas/instâncias do app abertas — cada uma tem seu próprio timer de inatividade e checagem de mount (comportamento aceito, não mitigado nesta feature)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS
```bash
pnpm check-types
npx biome lint --write --unsafe apps/web/src/hooks/use-birth-mode-status.ts apps/web/src/lib/birth-mode-redirect-utils.ts apps/web/src/components/shared/birth-mode-status-bar.tsx
```
**EXPECT**: Exit 0, sem erros

### Level 2: UNIT_TESTS
```bash
pnpm --filter web test birth-mode-redirect-utils
```
**EXPECT**: Todos os testes passam

### Level 3: FULL_SUITE
```bash
pnpm --filter web test
pnpm check-types
```
**EXPECT**: Nenhuma regressão nos testes existentes (incluindo `birth-mode-uterine-activity-*.test.ts`)

### Level 5: BROWSER_VALIDATION (manual, via Chrome MCP ou dispositivo real)
- [ ] Com um parto ativo no banco (`birth_mode_active = true` para uma paciente da equipe), abrir o app do zero em uma rota diferente de `/modo-parto` → deve redirecionar automaticamente
- [ ] Minimizar o app (ou trocar de aba) e voltar → deve redirecionar automaticamente
- [ ] Navegar para outra tela, não interagir por ~1min50s → verificar que a barra muda para a mensagem de contagem de inatividade nos últimos 10s, com "Ir agora"/"Cancelar" funcionando
- [ ] Repetir o teste de inatividade e clicar em algo antes dos 2 minutos → timer deve reiniciar, sem redirect
- [ ] Testar como doula com a flag `disable-birth-mode-for-doulas` ativa → nenhum dos três gatilhos deve disparar
- [ ] **iOS Safari standalone PWA real** (não simulador) — validar que `visibilitychange`/`pageshow` disparam ao reabrir a PWA a partir da tela inicial, dado os bugs conhecidos do WebKit citados na pesquisa

### Level 6: MANUAL_VALIDATION
Testar em pelo menos um dispositivo iOS real com o app instalado como PWA (home screen), dado que a pesquisa identificou bugs específicos de `visibilitychange` em PWAs standalone no iOS que não aparecem em simuladores/desktop.

---

## Acceptance Criteria

- [ ] Abrir o app com parto ativo redireciona direto para `/modo-parto?pregnancyId=X`
- [ ] Voltar do background com parto ainda ativo redireciona direto
- [ ] 2 minutos de inatividade navegando com parto ativo aciona contagem regressiva de 10s cancelável, idêntica em UI ao fluxo de ativação em tempo real, mas com mensagem diferenciada
- [ ] Nenhum dos três gatilhos dispara para não-profissionais, doulas com a flag desabilitada, ou quando já em `/modo-parto`
- [ ] `pnpm check-types` e `pnpm --filter web test` passam sem regressões
- [ ] Código mirrora exatamente os padrões existentes de `use-birth-mode-status.ts` (nomenclatura, comentários de guarda de dependências, estilo de cleanup)

---

## Completion Checklist

- [ ] Todas as tasks completas na ordem de dependência
- [ ] Cada task validada imediatamente após conclusão
- [ ] Level 1: lint + type-check passam
- [ ] Level 2: testes unitários passam
- [ ] Level 3: suíte completa sem regressões
- [ ] Level 5/6: validação manual em navegador + dispositivo iOS real
- [ ] Todos os critérios de aceitação atendidos

---

## Risks and Mitigations

| Risk               | Likelihood   | Impact       | Mitigation                              |
| ------------------ | ------------ | ------------ | ---------------------------------------- |
| `visibilitychange` não confiável em PWA standalone no iOS (bugs WebKit documentados) | MEDIUM | HIGH (redirect crítico perdido) | Fallback com `pageshow`/`event.persisted`; sempre refetch ao servidor no handler em vez de confiar em estado local; validação manual obrigatória em dispositivo iOS real antes do merge |
| Redirect no mount ser "irritante" se disparar toda vez que o app reabre, mesmo que a profissional só queira checar outra coisa rapidamente | LOW | LOW | Escopo explícito: comportamento pedido literalmente pelo requisito; não mitigado nesta versão (fora do escopo) |
| Timer de inatividade competir com a contagem de ativação em tempo real e gerar dois redirects | LOW | MEDIUM | Guard `if (prev) return prev` no updater do `pendingActivation` (Task 5) garante que só um `pendingActivation` existe por vez |
| Múltiplas abas abertas gerando múltiplos timers/redirects concorrentes | LOW | LOW | Aceito como limitação conhecida, fora do escopo (ver Edge Cases Checklist) |

---

## Notes

- A pesquisa externa confirmou que não há necessidade de nenhuma nova dependência (`react-idle-timer` etc.) — a lógica cabe em ~40 linhas adicionais ao hook existente, seguindo a filosofia do projeto de evitar abstração prematura.
- O uso de `setTimeout` reset-on-activity (em vez de `setInterval` fazendo polling de um timestamp) segue a recomendação encontrada em `idletimer.dev` para o gatilho de disparo; o próprio countdown final de 10s continua usando `setInterval` de 1s, que é o padrão já existente no arquivo e é aceitável para uma janela tão curta (o risco de "drift" por throttling de background citado na pesquisa é irrelevante aqui, pois a aba estará em foreground durante essa contagem, já que ela só é visível quando `showBar`/`pendingActivation` está ativo na tela atual).
- Como não há `@testing-library/react`/`renderHook` no projeto, a estratégia de teste extrai a lógica de decisão para funções puras (`birth-mode-redirect-utils.ts`) em vez de tentar testar os efeitos do hook diretamente — mantém a cobertura de teste possível dentro do padrão de ferramentas já estabelecido no repositório.
