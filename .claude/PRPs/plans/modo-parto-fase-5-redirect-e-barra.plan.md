# Feature: Modo Parto — Fase 5: Redirect Automático + Barra Persistente

## Summary

Productionizar o hook de spike `useBirthModeRealtime` (Fase 2) e construir em cima dele o comportamento de "hijacking suave" pedido no PRD: quando o Modo Parto é ativado para uma paciente da equipe do profissional logado, qualquer um com o Ventre aberto (em qualquer tela) vê uma barra fixa no topo do app com contagem regressiva de 10s e é redirecionado automaticamente para `/modo-parto?pregnancyId=...`, a menos que cancele. Depois disso — ou sempre que o profissional navegar para longe de `/modo-parto` enquanto ela ainda estiver ativa — a mesma barra persiste no topo (sem contagem, só um botão "Voltar ao Modo Parto"), até a gestação sair da lista de partos ativos. Uma única barra/estado (não dois componentes separados) cobre as duas fases pedidas pelo PRD, reaproveitando o `BirthModeRealtimeProvider` já existente na árvore de providers do app.

## User Story

Como profissional da equipe de cuidado (doula, enfermeira, médica obstetra)
Eu quero ser avisado imediatamente e redirecionado quando o Modo Parto for ativado para uma paciente da minha equipe, e ver um indicador persistente enquanto ele estiver ativo
Para que eu não perca o início de um parto em andamento nem esqueça que ele continua ativo enquanto navego por outras telas do Ventre

## Problem Statement

Hoje o hook `useBirthModeRealtime` (Fase 2, spike) recebe eventos de ativação via Supabase Realtime mas não é consumido por nenhum componente — está atrás de uma feature flag (`NEXT_PUBLIC_BIRTH_MODE_REALTIME_SPIKE`) e não dispara nenhuma UI. Não existe nenhuma barra ou notificação persistente no app: um profissional só descobre que o Modo Parto está ativo se estiver manualmente na tela `/modo-parto` ou navegando de volta à ficha da paciente.

## Solution Statement

Estender `BirthModeRealtimeProvider` (já montado em `providers/index.tsx`, acima de todo o app) com um novo hook, `use-birth-mode-status.ts`, que compõe: (1) o `useBirthModeRealtime()` já existente (produtizado, sem feature flag) para detectar novas ativações; (2) polling de 60s de `getActiveBirthModePregnancyAction` (mesmo padrão de `use-notifications.ts:34`) como fonte de verdade de "quais gestações estão com Modo Parto ativo para mim agora", já que o filtro Realtime `birth_mode_active=eq.true` só é reavaliado contra o *novo* valor da linha e portanto não dispara quando a flag volta para `false` — não há como detectar desativação apenas pelo canal atual; (3) uma máquina de estado de contagem regressiva (10s) disparada por ativações novas e não vistas, com dedupe por `id`; (4) `usePathname()` para nunca mostrar a barra quando o usuário já está em `/modo-parto`. O provider expõe um único `showBar` + `pendingActivation` + `activePregnancies` + `cancelRedirect`, consumidos por dois componentes: `<BirthModeStatusBar />` (a barra em si, montada no layout do dashboard) e `<MainContent />` (que ganha padding-top condicional quando a barra está visível, mesmo padrão já usado para o padding-bottom da bottom nav).

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------|
| Type             | NEW_CAPABILITY                                                       |
| Complexity       | MEDIUM                                                                |
| Systems Affected | apps/web (providers, hooks, components, layout) — nenhuma migration nova |
| Dependencies     | `@supabase/supabase-js` ^2.47.0, `next` 16.1.0, `react` ^19.2.0, `next-safe-action` ^8.1.4 |
| Estimated Tasks  | 8                                                                     |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║  Profissional A ativa Modo Parto        Profissional B (equipe da mesma       ║
║  na ficha da paciente                   paciente) está em /home, sem saber    ║
║        │                                                                       ║
║        ▼                                                                       ║
║  UPDATE pregnancies                     B só descobre se abrir manualmente    ║
║  SET birth_mode_active = true           /modo-parto ou a ficha da paciente    ║
║        │                                                                       ║
║        ▼                                                                       ║
║  useBirthModeRealtime() já recebe            ✗ nenhuma UI consome o evento    ║
║  o evento via postgres_changes                (hook está atrás de flag e      ║
║  (Fase 2, spike)                               ninguém importa o hook)        ║
║                                                                                ║
║   USER_FLOW: Ativação acontece silenciosamente para o resto da equipe.        ║
║   PAIN_POINT: Único jeito de saber é procurar manualmente — quebra a          ║
║   promessa central do PRD ("saber imediatamente quando o Modo Parto foi       ║
║   ativado").                                                                   ║
║   DATA_FLOW: Realtime entrega o payload, mas ele morre em `lastActivation`    ║
║   sem nenhum listener de UI.                                                   ║
║                                                                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║  Profissional A ativa Modo Parto        Profissional B, em /home              ║
║        │                                       │                              ║
║        ▼                                       ▼                              ║
║  UPDATE pregnancies                     Barra fixa aparece no topo:           ║
║  SET birth_mode_active = true           "Parto ativado para Maria —           ║
║        │                                 redirecionando em 8s [Cancelar]"     ║
║        ▼                                       │                              ║
║  postgres_changes UPDATE                  8...7...6... (não cancelou)         ║
║  filter birth_mode_active=eq.true              │                              ║
║        │                                       ▼                              ║
║        └──────────────────────────►  router.push("/modo-parto?pregnancyId=…")║
║                                                 │                              ║
║                                                 ▼                              ║
║                                        Profissional B navega para /cadastro   ║
║                                                 │                              ║
║                                                 ▼                              ║
║                                        Barra reaparece (sem contagem):        ║
║                                        "Modo Parto ativo — Maria [Voltar]"    ║
║                                                                                ║
║   USER_FLOW: Ativação → barra + contagem → redirect automático (ou           ║
║   cancelamento) → barra persistente sempre que o profissional sai da tela.   ║
║   VALUE_ADD: Ninguém da equipe perde o início de um parto; retorno à tela    ║
║   de registro é sempre 1 clique de distância.                                ║
║   DATA_FLOW: Realtime (ativação) + polling 60s (`getActiveBirthModePregnancy ║
║   Action`, fonte de verdade contínua) alimentam um único estado no provider. ║
║                                                                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| `apps/web/src/hooks/use-birth-mode-realtime.ts` | Atrás de `NEXT_PUBLIC_BIRTH_MODE_REALTIME_SPIKE`, sem consumidor | Sempre ativo (flag removida), consumido por `use-birth-mode-status.ts` | Ativação passa a gerar UI real |
| `apps/web/app/(dashboard)/layout.tsx` | Sem indicador de Modo Parto | `<BirthModeStatusBar />` fixa no topo, condicional | Visibilidade contínua do parto ativo |
| Qualquer tela do dashboard, enquanto Modo Parto ativo e fora de `/modo-parto` | Nenhuma pista visual | Barra no topo com botão "Voltar" | Retorno em 1 clique |
| Momento da ativação, para membros da equipe com app aberto | Nenhuma notificação | Barra com contagem de 10s + "Cancelar" + "Ir agora" | Redirect automático não-bloqueante |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|-----------------|
| P0 | `apps/web/src/hooks/use-birth-mode-realtime.ts` | 1-73 | Hook a produtizar (remover feature flag) — base do novo `use-birth-mode-status.ts` |
| P0 | `apps/web/src/providers/birth-mode-realtime-provider.tsx` | 1-24 | Provider já montado app-wide — será estendido, não recriado |
| P0 | `apps/web/src/providers/index.tsx` | 1-32 | Confirma que `BirthModeRealtimeProvider` já está dentro de `AuthProvider` (logo `useAuth()` funciona dentro do provider) |
| P0 | `apps/web/src/actions/get-active-birth-mode-pregnancy-action.ts` | 1-18 | Action já pronta (Fase 4) — fonte de verdade via polling; shape de retorno a mirror |
| P0 | `apps/web/app/(dashboard)/layout.tsx` | 1-35 | Ponto de montagem do novo componente de barra, mesmo padrão de `NotificationPermissionPrompt`/`ProfessionalDocumentsBanner` |
| P1 | `apps/web/src/hooks/use-notifications.ts` | 12-38 | Padrão canônico de polling (`setInterval` 60s + fetch imediato + cleanup) a copiar |
| P1 | `apps/web/src/components/layouts/main-content.tsx` | 1-19 | Padrão de `usePathname()` + `cn()` condicional a estender para padding-top da barra |
| P1 | `apps/web/app/(dashboard)/modo-parto/page.tsx` | 14-93 | Contrato de URL (`?pregnancyId=`) e shape de `activePregnancies` que o botão "Voltar" deve navegar para |
| P2 | `apps/web/src/components/shared/professional-documents-banner.tsx` | 1-23 | Precedente mais próximo de "banner fixo global" — estilo a adaptar (mas posicionado no topo, não no rodapé, conforme PRD) |
| P2 | `apps/web/src/providers/auth-provider.tsx` | 165-186 | `isProfessional`/`isObstetrician`/`isNurse`/`isDoula` — gate de quem deve ver a barra |
| P2 | `.env.local.example` | 53 | Remover a variável de flag junto com o hook produtizado |

**External Documentation:**

| Source | Section | Why Needed |
|--------|---------|--------------|
| [Supabase Postgres Changes docs](https://supabase.com/docs/guides/realtime/postgres-changes) | Replica identity / WAL contents | O `filter` de `postgres_changes` é avaliado contra os dados presentes no WAL do evento, que para UPDATE é a linha NOVA por padrão — por isso o canal atual (`birth_mode_active=eq.true`) só dispara em transições `false → true`, nunca em `true → false`. Confirmado via pesquisa dedicada (não há sentença verbatim nos docs oficiais, mas é fortemente evidenciado pelo comportamento documentado de `replica identity` + o caso "soft delete" abaixo) — por isso o polling de 60s é a fonte de verdade para a barra desaparecer, não o canal Realtime |
| [supabase/realtime discussion #15389 — "Realtime, RLS and filters (soft deletes)"](https://github.com/orgs/supabase/discussions/15389) | — | Relato da comunidade confirmando exatamente este cenário (transição de estado que sai da condição do filtro/RLS nunca é entregue) — valida a decisão de não depender do canal Realtime para detectar desativação |
| [Realtime Authorization — Supabase Docs](https://supabase.com/docs/guides/realtime/authorization) | RLS + SELECT policy requirement | Confirma (já citado na Fase 4) que RLS de SELECT é aplicada automaticamente por assinante em `postgres_changes`, sem canal `private` — não é necessário filtro adicional de equipe no client; a policy é avaliada contra a linha nova, mesma ressalva acima |

---

## Patterns to Mirror

**POLLING_60S:**
```typescript
// SOURCE: apps/web/src/hooks/use-notifications.ts:25-38
// COPY THIS PATTERN:
useEffect(() => {
  if (!user) return;
  const fetchUnread = async () => {
    const result = await getUnreadNotificationsCountAction();
    if (result?.data) setUnreadCount(result.data.unreadCount);
  };
  fetchUnread();
  const interval = setInterval(fetchUnread, 60_000);
  return () => clearInterval(interval);
}, [user]);
```

**REALTIME_SUBSCRIPTION_CLEANUP (já existe, só remover a flag):**
```typescript
// SOURCE: apps/web/src/hooks/use-birth-mode-realtime.ts:21-66
// MANTER a estrutura, REMOVER apenas a linha 22:
// if (process.env.NEXT_PUBLIC_BIRTH_MODE_REALTIME_SPIKE !== "true") return;
```

**PATHNAME_CONDITIONAL_CLASS:**
```typescript
// SOURCE: apps/web/src/components/layouts/main-content.tsx:6-19
// MIRROR para adicionar padding-top condicional:
export function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <main className={cn("min-w-0 flex-1 overflow-y-auto", pathname !== "/onboarding" && "pb-24 sm:pb-0")}>
      {children}
    </main>
  );
}
```

**GLOBAL_FIXED_BANNER (adaptar para topo, não rodapé):**
```typescript
// SOURCE: apps/web/src/components/shared/professional-documents-banner.tsx:6
// O padrão de posicionamento fixo + z-50 é o mesmo; trocar bottom-24/bottom-4 por top-0/inset-x-0
<div className="fixed inset-x-0 top-0 z-50 ...">
```

**PROVIDER_CONTEXT_WRAP:**
```typescript
// SOURCE: apps/web/src/providers/birth-mode-realtime-provider.tsx:6-15
// MIRROR — trocar o hook interno de useBirthModeRealtime() por useBirthModeStatus()
type BirthModeRealtimeContextType = ReturnType<typeof useBirthModeStatus>;
const BirthModeRealtimeContext = createContext<BirthModeRealtimeContextType | null>(null);
export function BirthModeRealtimeProvider({ children }: { children: React.ReactNode }) {
  const value = useBirthModeStatus();
  return <BirthModeRealtimeContext.Provider value={value}>{children}</BirthModeRealtimeContext.Provider>;
}
```

**ACTIVE_PREGNANCY_ACTION_SHAPE:**
```typescript
// SOURCE: apps/web/src/actions/get-active-birth-mode-pregnancy-action.ts:5-17
// Retorna: { pregnancies: { id, patient_id, birth_mode_activated_at, birth_mode_activated_by, patient: { name } | null }[] }
```

---

## Files to Change

| File | Action | Justification |
|------|--------|------------------|
| `apps/web/src/hooks/use-birth-mode-realtime.ts` | UPDATE | Remover o gate de feature flag (linha 22) — hook passa a ser produção, não spike |
| `.env.local.example` | UPDATE | Remover `NEXT_PUBLIC_BIRTH_MODE_REALTIME_SPIKE=false` (linha 53) |
| `.env.local` | UPDATE | Remover `NEXT_PUBLIC_BIRTH_MODE_REALTIME_SPIKE=true` (linha 68) — arquivo local, não versionado, mas mantém consistência |
| `apps/web/src/hooks/use-birth-mode-status.ts` | CREATE | Compõe realtime + polling + contagem regressiva + dedupe + `usePathname` em um único hook |
| `apps/web/src/providers/birth-mode-realtime-provider.tsx` | UPDATE | Trocar `useBirthModeRealtime()` por `useBirthModeStatus()` como fonte do contexto |
| `apps/web/src/components/shared/birth-mode-status-bar.tsx` | CREATE | Barra fixa no topo — estado de contagem regressiva OU estado persistente, conforme `pendingActivation` |
| `apps/web/src/components/layouts/main-content.tsx` | UPDATE | Padding-top condicional quando a barra está visível (consome `showBar` do contexto) |
| `apps/web/app/(dashboard)/layout.tsx` | UPDATE | Montar `<BirthModeStatusBar />` ao lado dos outros widgets globais |

---

## NOT Building (Scope Limits)

- **Encerrar o Modo Parto (`birth_mode_active: true → false`)** — nenhuma action nesta fase escreve essa transição; ela é escopo da Fase 6 (extensão do `finish-care-modal.tsx`). Esta fase apenas consome o estado via polling, então funcionará corretamente assim que a Fase 6 existir, sem mudança de código aqui.
- **Notificação push nativa (fora do navegador)** — o PRD já resolveu o canal de "avisar a equipe" via WhatsApp (Fase 3); esta fase é só o comportamento in-app para quem já está com o Ventre aberto.
- **Persistência de "cancelei o redirect" entre sessões/reloads (localStorage)** — cancelar a contagem regressiva apenas transiciona para o estado persistente da mesma sessão; não há necessidade de lembrar a escolha entre reloads, já que a barra persistente continua visível de qualquer forma.
- **Suporte a múltiplas ativações simultâneas com contagens regressivas concorrentes** — se uma segunda ativação chegar enquanto uma contagem já está rodando, a mais nova substitui a pendente (last-write-wins na UI); ambas continuam aparecendo na lista de `activePregnancies` da barra persistente depois.
- **Alterar o canal Realtime para um canal `private`/`broadcast`** — mantém-se `postgres_changes` com RLS automática, mesma decisão já validada nas Fases 2 e 4.

---

## Step-by-Step Tasks

Execute em ordem. Cada task é atômica e verificável independentemente.

### Task 1: UPDATE `apps/web/src/hooks/use-birth-mode-realtime.ts`

- **ACTION**: Remover o gate de feature flag, produtizando o hook
- **IMPLEMENT**: Remover a linha `if (process.env.NEXT_PUBLIC_BIRTH_MODE_REALTIME_SPIKE !== "true") return;` (linha 22). Manter todo o resto do hook idêntico (channel name, filter, reconnect logic, cleanup).
- **MIRROR**: N/A — edição pontual do próprio arquivo
- **GOTCHA**: Não remover a checagem `if (typeof window === "undefined" || !user) return;` — ela continua necessária para SSR/logout
- **VALIDATE**: `pnpm check-types`

### Task 2: UPDATE `.env.local.example` e `.env.local`

- **ACTION**: Remover a variável `NEXT_PUBLIC_BIRTH_MODE_REALTIME_SPIKE` de ambos os arquivos
- **IMPLEMENT**: Deletar a linha 53 de `.env.local.example` e a linha 68 de `.env.local`
- **VALIDATE**: `grep -rn "BIRTH_MODE_REALTIME_SPIKE" apps/web --include="*.ts" --include="*.tsx" --include=".env*"` deve retornar vazio (fora de `.next/`)

### Task 3: CREATE `apps/web/src/hooks/use-birth-mode-status.ts`

- **ACTION**: Hook composto que é a nova fonte de verdade do `BirthModeRealtimeProvider`
- **IMPLEMENT**:
  ```typescript
  "use client";
  import { useBirthModeRealtime } from "@/hooks/use-birth-mode-realtime";
  import { getActiveBirthModePregnancyAction } from "@/actions/get-active-birth-mode-pregnancy-action";
  import { useAuth } from "@/hooks/use-auth";
  import { usePathname, useRouter } from "next/navigation";
  import { useCallback, useEffect, useRef, useState } from "react";

  type ActivePregnancy = Awaited<ReturnType<typeof getActiveBirthModePregnancyAction>>["data"] extends { pregnancies: infer P } ? P[number] : never;
  const COUNTDOWN_SECONDS = 10;

  export function useBirthModeStatus() {
    const { user, isProfessional } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const { lastActivation } = useBirthModeRealtime();

    const [activePregnancies, setActivePregnancies] = useState<ActivePregnancy[]>([]);
    const [pendingActivation, setPendingActivation] = useState<{ pregnancyId: string; secondsLeft: number } | null>(null);
    const seenActivationIds = useRef(new Set<string>());
    const countdownInterval = useRef<ReturnType<typeof setInterval>>();

    const fetchActive = useCallback(async () => {
      const result = await getActiveBirthModePregnancyAction();
      if (result?.data) setActivePregnancies(result.data.pregnancies);
    }, []);

    // polling 60s (mirror use-notifications.ts:25-38)
    useEffect(() => {
      if (!user) return;
      fetchActive();
      const interval = setInterval(fetchActive, 60_000);
      return () => clearInterval(interval);
    }, [user, fetchActive]);

    // nova ativação -> dispara contagem regressiva
    useEffect(() => {
      if (!lastActivation || !user) return;
      if (seenActivationIds.current.has(lastActivation.id)) return;
      seenActivationIds.current.add(lastActivation.id);
      if (pathname?.startsWith("/modo-parto")) return; // já está lá, não precisa redirecionar

      fetchActive(); // atualiza a lista/nome imediatamente
      setPendingActivation({ pregnancyId: lastActivation.id, secondsLeft: COUNTDOWN_SECONDS });
    }, [lastActivation, user, pathname, fetchActive]);

    // tick da contagem regressiva
    useEffect(() => {
      if (!pendingActivation) return;
      countdownInterval.current = setInterval(() => {
        setPendingActivation((prev) => {
          if (!prev) return prev;
          if (prev.secondsLeft <= 1) {
            router.push(`/modo-parto?pregnancyId=${prev.pregnancyId}`);
            return null;
          }
          return { ...prev, secondsLeft: prev.secondsLeft - 1 };
        });
      }, 1000);
      return () => clearInterval(countdownInterval.current);
    }, [pendingActivation?.pregnancyId, router]); // eslint-disable-line react-hooks/exhaustive-deps

    const cancelRedirect = useCallback(() => setPendingActivation(null), []);
    const goNow = useCallback(() => {
      if (!pendingActivation) return;
      router.push(`/modo-parto?pregnancyId=${pendingActivation.pregnancyId}`);
      setPendingActivation(null);
    }, [pendingActivation, router]);

    const showBar = isProfessional && activePregnancies.length > 0 && !pathname?.startsWith("/modo-parto");

    return { activePregnancies, pendingActivation, cancelRedirect, goNow, showBar };
  }
  ```
- **MIRROR**: `apps/web/src/hooks/use-notifications.ts:25-38` (polling), `apps/web/src/hooks/use-birth-mode-realtime.ts:21-66` (padrão de subscribe já encapsulado, reaproveitado via import)
- **IMPORTS**: `getActiveBirthModePregnancyAction`, `useBirthModeRealtime`, `useAuth`, `usePathname`/`useRouter` de `next/navigation`
- **GOTCHA**: O filtro Realtime `birth_mode_active=eq.true` só dispara quando a linha se torna `true` — nunca ao voltar para `false` (ver External Documentation). Por isso `activePregnancies` (via polling) é a única fonte confiável para decidir se a barra persistente deve desaparecer; `pendingActivation`/contagem regressiva é responsabilidade exclusiva do canal Realtime. Usar `seenActivationIds` (um `Set`, não um único valor) porque duas ativações diferentes podem chegar na mesma sessão.
- **VALIDATE**: `pnpm check-types`

### Task 4: UPDATE `apps/web/src/providers/birth-mode-realtime-provider.tsx`

- **ACTION**: Trocar a fonte do contexto de `useBirthModeRealtime()` para `useBirthModeStatus()`
- **IMPLEMENT**: Import `useBirthModeStatus` de `@/hooks/use-birth-mode-status`; substituir `useBirthModeRealtime` por `useBirthModeStatus` nas linhas 3, 6, 11 (mesma estrutura de `createContext`/`Provider`/`useContext` hook exportado)
- **MIRROR**: Estrutura idêntica ao arquivo atual — apenas troca do hook interno
- **GOTCHA**: Qualquer consumidor existente de `useBirthModeRealtimeContext()` (verificar com grep) precisa continuar funcionando — o novo shape é um superset do antigo? Checar se `lastActivation`/`connectionStatus` ainda são necessários em algum lugar; se sim, re-expor via `useBirthModeRealtime()` internamente também ou incluir no retorno do novo hook. Confirmado no Task 3 que `useBirthModeStatus` não repassa `connectionStatus` — se algum componente existente depender disso, adicionar ao retorno do hook.
- **VALIDATE**: `pnpm check-types`; `grep -rn "useBirthModeRealtimeContext" apps/web/src apps/web/app` para confirmar todos os consumidores continuam compilando

### Task 5: CREATE `apps/web/src/components/shared/birth-mode-status-bar.tsx`

- **ACTION**: Componente de barra fixa no topo, com dois estados visuais
- **IMPLEMENT**:
  ```tsx
  "use client";
  import { Button } from "@ventre/ui/button";
  import { HeartHandshake, X } from "lucide-react";
  import { useRouter } from "next/navigation";
  import { useBirthModeRealtimeContext } from "@/providers/birth-mode-realtime-provider";

  export function BirthModeStatusBar() {
    const router = useRouter();
    const { showBar, pendingActivation, activePregnancies, cancelRedirect, goNow } = useBirthModeRealtimeContext();

    if (!showBar) return null;

    const activePregnancy = activePregnancies.find((p) => p.id === (pendingActivation?.pregnancyId ?? activePregnancies[0]?.id));
    const patientName = (activePregnancy?.patient as { name: string } | null)?.name ?? "uma paciente";

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

    const target = activePregnancies.length === 1 ? `/modo-parto?pregnancyId=${activePregnancies[0].id}` : "/modo-parto";
    return (
      <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-primary px-4 py-3 text-primary-foreground shadow-lg">
        <div className="flex items-center gap-2">
          <HeartHandshake className="h-5 w-5 shrink-0" />
          <p className="text-sm">Modo Parto ativo — {patientName}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => router.push(target)}>Voltar</Button>
      </div>
    );
  }
  ```
- **MIRROR**: Posicionamento fixo de `apps/web/src/components/shared/professional-documents-banner.tsx:6` (adaptado para `top-0 inset-x-0`, largura total, não canto)
- **IMPORTS**: `useBirthModeRealtimeContext` de `@/providers/birth-mode-realtime-provider`, `Button` de `@ventre/ui/button`
- **GOTCHA**: Sem `X`/dismiss permanente — a barra não deve poder ser fechada de forma que o usuário perca o acesso ao Modo Parto ativo (decisão do PRD: barra sempre visível enquanto ativo, só "Cancelar" a contagem regressiva, nunca a persistência)
- **VALIDATE**: `pnpm check-types`; abrir no browser com Modo Parto ativo simulado

### Task 6: UPDATE `apps/web/src/components/layouts/main-content.tsx`

- **ACTION**: Adicionar padding-top condicional quando a barra está visível
- **IMPLEMENT**:
  ```tsx
  "use client";
  import { cn } from "@/lib/utils";
  import { usePathname } from "next/navigation";
  import { useBirthModeRealtimeContext } from "@/providers/birth-mode-realtime-provider";

  export function MainContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { showBar } = useBirthModeRealtimeContext();

    return (
      <main
        className={cn(
          "min-w-0 flex-1 overflow-y-auto",
          pathname !== "/onboarding" && "pb-24 sm:pb-0",
          showBar && "pt-14",
        )}
      >
        {children}
      </main>
    );
  }
  ```
- **MIRROR**: `apps/web/src/components/layouts/main-content.tsx:6-19` (mesmo arquivo, extensão pontual)
- **GOTCHA**: `MainContent` está fora de `(dashboard)/modo-parto` também (é usado em todo `(dashboard)/layout.tsx`) — mas como `showBar` já é `false` quando `pathname` começa com `/modo-parto`, o padding nunca aparece nessa própria tela, o que é o comportamento correto (a barra não aparece lá, então não deve haver padding reservado para ela)
- **VALIDATE**: `pnpm check-types`

### Task 7: UPDATE `apps/web/app/(dashboard)/layout.tsx`

- **ACTION**: Montar `<BirthModeStatusBar />` junto aos outros widgets globais
- **IMPLEMENT**: Adicionar `import { BirthModeStatusBar } from "@/components/shared/birth-mode-status-bar";` no topo, e `<BirthModeStatusBar />` logo após `<BottomNav />` (linha 27), antes de `<NotificationPermissionPrompt />`
- **MIRROR**: Padrão de montagem incondicional de `<NotificationPermissionPrompt />` (linha 28) — o próprio componente decide se renderiza algo (`showBar` no contexto), então não precisa de condicional no layout como `ProfessionalDocumentsBanner` (que depende de dado do servidor)
- **VALIDATE**: `pnpm check-types`; `pnpm dev` e confirmar visualmente

### Task 8: Validação de tipos, lint e teste manual ponta a ponta

- **ACTION**: Rodar validação estática e smoke test manual (não há infraestrutura de testes automatizados no repo, confirmado nas fases anteriores)
- **VALIDATE**: `pnpm check-types && npx biome check --write --unsafe apps/web/src/hooks apps/web/src/providers apps/web/src/components/shared apps/web/src/components/layouts apps/web/app/\(dashboard\)/layout.tsx`; depois seguir o checklist manual abaixo

---

## Testing Strategy

Sem infraestrutura de testes automatizados no repo (confirmado nas Fases 1-4). Validação 100% manual + `pnpm check-types`/`biome`.

### Edge Cases Checklist (validação manual)

- [ ] Dois navegadores logados como profissionais diferentes da mesma equipe: ativar Modo Parto em um (via botão na ficha da paciente, Fase 4), confirmar que o outro vê a barra com contagem regressiva em <2s e é redirecionado após 10s
- [ ] Clicar em "Cancelar" durante a contagem regressiva → não navega, barra transiciona para o estado persistente sem contagem
- [ ] Clicar em "Ir agora" → navega imediatamente para `/modo-parto?pregnancyId=...`, contagem para
- [ ] Profissional já em `/modo-parto` quando a ativação chega → nenhuma contagem/redirect dispara (ele já está lá)
- [ ] Profissional sai de `/modo-parto` para outra tela enquanto Modo Parto segue ativo → barra persistente aparece sem contagem regressiva
- [ ] Profissional sem nenhum parto ativo em sua equipe → barra nunca aparece
- [ ] `isPatient` (paciente logada, se aplicável) → barra nunca aparece independentemente de RLS (gate por `isProfessional`)
- [ ] Reload da página com Modo Parto já ativo (sem evento Realtime novo) → barra persistente aparece corretamente via polling inicial (não depende de ter recebido o evento de ativação nesta sessão)
- [ ] Layout mobile (<640px): barra não sobrepõe conteúdo nem a bottom nav

---

## Validation Commands

### Level 1: STATIC_ANALYSIS
```bash
pnpm check-types && npx biome check apps/web/src apps/web/app
```
**EXPECT**: Exit 0, sem erros

### Level 2: BROWSER_VALIDATION
Usar Chrome MCP ou `pnpm dev` manual, dois perfis/abas:
- [ ] Barra de contagem regressiva aparece e conta corretamente
- [ ] Redirect automático funciona após 10s
- [ ] Barra persistente aparece ao navegar para longe de `/modo-parto`
- [ ] Nenhum overlap visual com `BottomNav`/`Sidebar`/outros banners fixos

### Level 3: MANUAL_VALIDATION
Seguir o "Edge Cases Checklist" acima na íntegra.

---

## Acceptance Criteria

- [ ] `useBirthModeRealtime` produtizado (sem feature flag) e usado por `useBirthModeStatus`
- [ ] Ativação de Modo Parto para uma gestação da equipe do usuário dispara barra com contagem regressiva de 10s em <2s
- [ ] Redirect automático funcional ao fim da contagem, cancelável a qualquer momento
- [ ] Barra persistente (sem contagem) aparece sempre que o usuário está fora de `/modo-parto` com Modo Parto ativo para sua equipe
- [ ] Barra nunca aparece em `/modo-parto` nem para usuários sem partos ativos em sua equipe
- [ ] `pnpm check-types` e `biome check` passam sem erros
- [ ] Nenhuma modificação de RLS ou schema necessária (fase é 100% client-side + reaproveitamento de action existente)

---

## Completion Checklist

- [ ] Todas as 8 tasks completas em ordem de dependência
- [ ] Level 1: `pnpm check-types` + `biome check` passam
- [ ] Level 2: Validação manual no browser (desktop + mobile, dois perfis simultâneos) completa
- [ ] Level 3: Edge cases manuais validados
- [ ] Todos os acceptance criteria atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|--------------|
| Filtro Realtime `birth_mode_active=eq.true` nunca dispara na desativação, deixando a barra "presa" até o próximo poll (até 60s de atraso) | HIGH (comportamento confirmado, não é bug) | LOW | Aceito como trade-off explícito — 60s de atraso máximo para a barra sumir é aceitável dado que não há mecanismo de desativação nesta fase mesmo (Fase 6); documentado no Summary e nas GOTCHAs |
| `useBirthModeStatus` roda em todo o app (provider está acima do `(dashboard)/layout.tsx`), incluindo rotas de auth/onboarding onde não há usuário ainda | LOW | LOW | Hook já faz early-return em todos os `useEffect` quando `!user` (mesmo padrão do hook original) |
| Duas ativações quase simultâneas (dois profissionais ativando partos diferentes ao mesmo tempo) podem causar corrida entre duas contagens regressivas | LOW | LOW | Explicitamente fora de escopo (ver "NOT Building") — last-write-wins é aceitável, ambas aparecem depois na barra persistente via `activePregnancies` |
| Consumidores existentes de `useBirthModeRealtimeContext()` podem depender de `connectionStatus`/`lastActivation` que o novo hook não repassa | MED | MED | Task 4 inclui verificação explícita via grep antes de finalizar; se necessário, incluir esses campos no retorno de `useBirthModeStatus` |
| Barra fixa no topo pode sobrepor conteúdo em telas já apertadas (mobile) sem o padding-top compensar corretamente | LOW | MED | Task 6 adiciona padding condicional espelhando o padrão já usado para `BottomNav`; validado manualmente em viewport <640px (Level 2/3) |

---

## Notes

- Esta fase é inteiramente client-side: nenhuma migration, nenhuma nova action de escrita, nenhuma mudança de RLS. A única "escrita" nova é a remoção da feature flag do hook de spike.
- A decisão de usar **um único componente com dois estados visuais** (em vez de dois componentes separados — um para a notificação de contagem regressiva e outro para a barra persistente) foi tomada para simplificar a implementação e evitar dois elementos fixos competindo por espaço no topo simultaneamente; o PRD não exige que sejam visualmente distintos, apenas que o comportamento (auto-redirect com cancelamento vs. indicador persistente) exista.
- Quando a Fase 6 implementar a transição `birth_mode_active: true → false`, esta fase não precisa de nenhuma mudança de código — o polling de 60s em `useBirthModeStatus` já vai refletir a desativação automaticamente na próxima consulta.

---

*Generated: 2026-08-20*
