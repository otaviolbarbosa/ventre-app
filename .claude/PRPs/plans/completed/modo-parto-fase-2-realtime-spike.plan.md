# Feature: Modo Parto — Fase 2: Realtime Spike & Infraestrutura

## Summary

Primeira implementação de Supabase Realtime (`postgres_changes`) no codebase Ventre. Este spike prova que um profissional com o app aberto recebe, em menos de 2s, um evento quando `pregnancies.birth_mode_active` vira `true`, e que a subscription se recupera de forma confiável após queda de rede. O resultado não é uma UI de produto (isso é Fase 5) — é a fundação reutilizável: migration habilitando a tabela para replicação, hook `useBirthModeRealtime`, provider `BirthModeRealtimeProvider` seguindo exatamente o padrão de lifecycle já usado em `use-notifications.ts`/`notifications-provider.tsx`, e um runbook de validação manual dos critérios de sucesso.

## User Story

Como profissional da equipe de cuidado (doula, enfermeira, médica obstetra)
Eu quero saber imediatamente quando o Modo Parto é ativado para uma paciente da minha equipe, mesmo estando em outra tela do Ventre
Para que eu possa me deslocar para o registro do parto em tempo hábil, sem depender de checar manualmente

*(Esta fase entrega apenas a infraestrutura que torna esse "saber imediatamente" tecnicamente possível — a UI de redirect/contagem regressiva é Fase 5.)*

## Problem Statement

Hoje não existe nenhum mecanismo de push em tempo real no Ventre para eventos de banco de dados — a única "atualização ao vivo" existente é polling de 60s (`use-notifications.ts`) combinado com Firebase Cloud Messaging para notificações push nativas. Nenhuma dessas soluções atende ao requisito de "<2s de latência" pedido pelo cliente para o redirect automático do Modo Parto. É preciso validar, antes de comprometer o cronograma de 2 semanas do restante das fases, que Supabase Realtime funciona neste projeto com as políticas de RLS já existentes (`is_team_member`) e que a subscription sobrevive a instabilidade de rede — cenário realista em ambiente hospitalar.

## Solution Statement

1. Nova migration adiciona `public.pregnancies` à publication `supabase_realtime` e define `REPLICA IDENTITY FULL` (necessário para `payload.old` em eventos UPDATE).
2. `config.toml` local passa `[realtime] enabled = true`.
3. Novo hook `use-birth-mode-realtime.ts` abre um `.channel()` filtrado (`birth_mode_active=eq.true`, evento `UPDATE`) em `public.pregnancies`, com padrão de subscribe/cleanup espelhando exatamente `use-notifications.ts` (guarda por `cancelled`, cleanup via `supabase.removeChannel`), e resubscribe manual em `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED` (gap não coberto pelo reconnect automático do socket, confirmado na pesquisa).
4. Novo provider `BirthModeRealtimeProvider` (mesmo esqueleto de `notifications-provider.tsx`) expõe `{ lastActivation, connectionStatus }` via Context, montado dentro de `AuthProvider` em `providers/index.tsx`, atrás de uma flag de ambiente (`NEXT_PUBLIC_BIRTH_MODE_REALTIME_SPIKE`) para não abrir WebSockets para todos os usuários em produção antes da Fase 5 existir.
5. Validação dos critérios de sucesso (latência <2s, reconexão pós-queda) é feita manualmente via runbook documentado (Supabase Studio + DevTools Network throttling), não via nova página de debug permanente.

## Metadata

| Field            | Value                                             |
| ---------------- | -------------------------------------------------- |
| Type             | NEW_CAPABILITY (spike/infra)                       |
| Complexity       | HIGH — tecnologia greenfield no codebase, sem convenção existente |
| Systems Affected | `packages/supabase` (migrations, config.toml), `apps/web` (providers, hooks) |
| Dependencies     | `@supabase/supabase-js@2.91.1` (já instalado, resolve `.channel()`/`postgres_changes` nativamente), `@supabase/ssr` (client factory já em uso) |
| Estimated Tasks  | 7                                                   |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║   ┌─────────────┐         ┌──────────────────┐        ┌─────────────┐         ║
║   │ Profissional│ ──────► │ pregnancies.      │──────► │  Nada       │         ║
║   │ com app     │         │ birth_mode_active │        │  acontece   │         ║
║   │ aberto em   │         │ = true (server)   │        │  no client  │         ║
║   │ outra tela  │         └──────────────────┘        └─────────────┘         ║
║   └─────────────┘                                                             ║
║                                                                                ║
║   USER_FLOW: Nenhum. Não existe canal de propagação em tempo real.            ║
║   PAIN_POINT: Único jeito de saber é o polling de 60s de use-notifications.ts,║
║               que não é o canal certo para este evento nem atende <2s.        ║
║   DATA_FLOW: UPDATE em pregnancies → WAL → nenhuma publication assinada →     ║
║              nenhum evento chega ao browser.                                 ║
║                                                                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║   ┌─────────────┐      ┌──────────────────┐      ┌────────────────────────┐  ║
║   │ Profissional│ ────►│ pregnancies.      │─────►│ supabase_realtime      │  ║
║   │ com app     │      │ birth_mode_active │      │ publication (WAL)      │  ║
║   │ aberto      │      │ = true (server)   │      └───────────┬────────────┘  ║
║   └─────────────┘      └──────────────────┘                  │               ║
║          ▲                                                     ▼               ║
║          │                                          ┌────────────────────────┐║
║          │                                          │ Realtime server        │║
║          │                                          │ (RLS: is_team_member)  │║
║          │                                          └───────────┬────────────┘║
║          │                                                      ▼             ║
║          │                                    ┌──────────────────────────────┐║
║          └────────────────────────────────────│ BirthModeRealtimeProvider    │║
║                    payload.new recebido        │ (channel.on postgres_changes)│║
║                    em <2s                      └──────────────────────────────┘║
║                                                                                ║
║   USER_FLOW: (fundação apenas) — provider recebe payload.new e expõe          ║
║              lastActivation via Context; nenhuma UI de produto ainda.         ║
║   VALUE_ADD: Prova que a base técnica para o redirect automático (Fase 5)     ║
║              é viável dentro do prazo, com padrão de cleanup/reconexão fixado.║
║   DATA_FLOW: UPDATE → publication → Realtime server aplica RLS por assinante  ║
║              → payload entregue ao channel filtrado no client → context state.║
║                                                                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User_Action | Impact |
|----------|--------|-------|-------------|--------|
| `apps/web/src/providers/index.tsx` | Sem provider de Realtime | `BirthModeRealtimeProvider` montado dentro de `AuthProvider` | Nenhuma (invisível ao usuário nesta fase) | Fundação pronta para a Fase 5 consumir `lastActivation`/`connectionStatus` |
| Nenhuma tela nova | — | — | — | Esta fase não altera nenhuma tela — é 100% infraestrutura, validada via runbook manual |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/hooks/use-notifications.ts` | 1-144 | Padrão EXATO de lifecycle (guard por `user`, `cancelled` flag, cleanup) a espelhar no novo hook |
| P0 | `apps/web/src/providers/notifications-provider.tsx` | 1-19 | Esqueleto EXATO de Context + Provider a espelhar |
| P0 | `packages/supabase/supabase/migrations/20260822000002_pregnancies_add_birth_mode_state.sql` | 1-8 | Colunas exatas que o evento Realtime vai observar (`birth_mode_active`, `birth_mode_activated_at`, `birth_mode_activated_by`) |
| P1 | `apps/web/src/providers/index.tsx` | 1-29 | Ordem de composição de providers — novo provider entra dentro de `AuthProvider`, no mesmo nível de `NotificationsProvider` |
| P1 | `apps/web/src/providers/auth-provider.tsx` | 1-97 | Como `user`/`profile` ficam disponíveis via `useAuth()` para gating da subscription |
| P1 | `packages/supabase/supabase/migrations/20260126012100_remote_schema.sql` | 98-108 | Definição de `is_team_member(p_patient_id uuid)` — função `SECURITY DEFINER` que a RLS do Realtime vai avaliar por assinante |
| P1 | `packages/supabase/supabase/migrations/20260313000001_pregnancies_table.sql` | 46-81 | Políticas RLS completas de `pregnancies` (SELECT via `is_team_member` OR paciente dono OR staff enterprise) — é isso que o Realtime vai respeitar automaticamente |
| P2 | `packages/supabase/src/client.ts` | 1-11 | Client browser singleton (`supabase`) — onde `.channel()` será chamado |
| P2 | `packages/supabase/supabase/config.toml` | 60-69 | Bloco `[realtime]` — precisa `enabled = true` para o stack local |

**External Documentation:**

| Source | Section | Why Needed |
|--------|---------|------------|
| [Postgres Changes — Supabase Docs](https://supabase.com/docs/guides/realtime/postgres-changes) | API de `.channel().on('postgres_changes', ...)`, payload shape, publication membership | Confirma sintaxe exata e que `ALTER PUBLICATION ... ADD TABLE` é obrigatório — sem isso nenhum evento dispara |
| [Realtime Authorization — Supabase Docs](https://supabase.com/docs/guides/realtime/authorization) | Diferença entre `postgres_changes` (RLS de tabela) e o novo modelo de Authorization (`realtime.messages`, só Broadcast/Presence) | Confirma que **não** é preciso configurar `realtime.messages`/canais privados — a RLS existente de `pregnancies` já é suficiente |
| [JS Reference: subscribe()](https://supabase.com/docs/reference/javascript/subscribe) | Status values `SUBSCRIBED`/`CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED` | Define os estados que o hook precisa tratar manualmente para resubscribe |
| [JS Reference: removeChannel()](https://supabase.com/docs/reference/javascript/removechannel) | Cleanup de canal | Usar `supabase.removeChannel(channel)` no cleanup do `useEffect`, não `channel.unsubscribe()` sozinho |
| [Supabase CLI config reference](https://supabase.com/docs/guides/local-development/cli/config) | `[realtime] enabled` | Confirma que precisa `supabase stop && supabase start` após mudar o config.toml |

---

## Patterns to Mirror

**LIFECYCLE_PATTERN (guard + cancelled flag + cleanup) — mirror exactly:**
```typescript
// SOURCE: apps/web/src/hooks/use-notifications.ts:41-65
useEffect(() => {
  if (typeof window === "undefined" || !user) return;

  let unsubscribe: (() => void) | undefined;
  let cancelled = false;

  onForegroundMessage((payload) => {
    const { title, body } = payload.notification ?? {};
    if (title) {
      toast(title, { description: body });
      setUnreadCount((c) => c + 1);
    }
  }).then((unsub) => {
    if (cancelled) {
      unsub();
    } else {
      unsubscribe = unsub;
    }
  });

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}, [user]);
```

**PROVIDER_CONTEXT_PATTERN — mirror exactly:**
```typescript
// SOURCE: apps/web/src/providers/notifications-provider.tsx:1-19
"use client";

import { useNotifications } from "@/hooks/use-notifications";
import { createContext, useContext } from "react";

type NotificationsContextType = ReturnType<typeof useNotifications>;

const NotificationsContext = createContext<NotificationsContextType | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const value = useNotifications();
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotificationsContext(): NotificationsContextType {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotificationsContext must be used inside NotificationsProvider");
  return ctx;
}
```

**PROVIDER_COMPOSITION — insert at this exact nesting level:**
```typescript
// SOURCE: apps/web/src/providers/index.tsx:12-28
<PosthogProvider>
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
    <AuthProvider>
      <NotificationsProvider>
        {/* BirthModeRealtimeProvider entra aqui, mesmo nível */}
        <PwaProvider>
          <ConfirmationModalProvider>{children}</ConfirmationModalProvider>
          <PwaInstallBanner />
          <Toaster />
        </PwaProvider>
      </NotificationsProvider>
    </AuthProvider>
  </ThemeProvider>
</PosthogProvider>
```

**MIGRATION_PATTERN — append-only, single-purpose migration file:**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260822000002_pregnancies_add_birth_mode_state.sql
-- Mirror this style: one ALTER TABLE statement block per concern, IF NOT EXISTS on indexes
ALTER TABLE public.pregnancies
  ADD COLUMN birth_mode_active boolean NOT NULL DEFAULT false,
  ...
```

**SUPABASE_CLIENT_IMPORT — browser client is a singleton, not a factory:**
```typescript
// SOURCE: apps/web/src/providers/auth-provider.tsx:6
import { supabase } from "@ventre/supabase";
```

---

## Files to Change

| File | Action | Justification |
|------|--------|----------------|
| `packages/supabase/supabase/migrations/20260822000012_pregnancies_realtime_publication.sql` | CREATE | Adiciona `pregnancies` à publication `supabase_realtime` + `REPLICA IDENTITY FULL` — pré-requisito bloqueante confirmado pela pesquisa, sem isso nenhum evento dispara |
| `packages/supabase/supabase/config.toml` | UPDATE | `[realtime] enabled = true` para o stack local disparar eventos |
| `apps/web/src/hooks/use-birth-mode-realtime.ts` | CREATE | Hook com subscribe/cleanup/resubscribe manual em `postgres_changes` filtrado |
| `apps/web/src/providers/birth-mode-realtime-provider.tsx` | CREATE | Context + Provider expondo `{ lastActivation, connectionStatus }` |
| `apps/web/src/providers/index.tsx` | UPDATE | Monta `BirthModeRealtimeProvider` dentro de `AuthProvider`, mesmo nível de `NotificationsProvider` |
| `apps/web/.env.local.example` (ou equivalente já existente) | UPDATE | Documenta `NEXT_PUBLIC_BIRTH_MODE_REALTIME_SPIKE` como flag de ativação do spike |
| `packages/supabase/src/types/database.types.ts` | UPDATE (gerado) | `pnpm db:types` após a migration — publication/replica identity não alteram o shape de tipos, mas rodar por disciplina do CLAUDE.md |

---

## NOT Building (Scope Limits)

- **UI de redirect com contagem regressiva de 10s** — é a Fase 5, que consome o `connectionStatus`/`lastActivation` deste provider.
- **Barra de notificação persistente** — também Fase 5.
- **Filtragem client-side por equipe (`team_members`)** — não é necessária: a RLS de `pregnancies` já restringe quais linhas cada assinante recebe via `is_team_member`/paciente dono/staff enterprise. Adicionar filtro client-side seria redundante e um novo padrão sem precedente (nenhuma query client-side contra `team_members` existe hoje).
- **Página de debug/teste permanente no app** — a validação de latência/reconexão é feita via runbook manual (Supabase Studio + DevTools), não via UI commitada, para não deixar código de teste morto no bundle de produção.
- **Testes automatizados de integração para o hook/provider** — o repo não tem infraestrutura de testes (Vitest/Jest) configurada; adicionar isso está fora do escopo deste spike. Validação é manual, documentada na Testing Strategy abaixo.
- **Modelo de "Realtime Authorization" (`realtime.messages`, canais privados)** — confirmado pela pesquisa que `postgres_changes` usa RLS de tabela padrão, não o modelo novo; não há necessidade de configurar canais privados nesta fase.

---

## Step-by-Step Tasks

Execute em ordem. Cada task é atômica e verificável independentemente.

### Task 1: CREATE migration `packages/supabase/supabase/migrations/20260822000012_pregnancies_realtime_publication.sql`

- **ACTION**: CREATE nova migration
- **IMPLEMENT**:
  ```sql
  ALTER TABLE public.pregnancies REPLICA IDENTITY FULL;

  ALTER PUBLICATION supabase_realtime ADD TABLE public.pregnancies;
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260822000002_pregnancies_add_birth_mode_state.sql` — um migration por concern, sem lógica condicional desnecessária
- **GOTCHA**: `REPLICA IDENTITY FULL` aumenta o volume de WAL para `pregnancies` — aceitável aqui pois é o único jeito de `payload.old` conter o valor anterior de `birth_mode_active` em eventos UPDATE (confirmado pela pesquisa: PK-only replica identity não inclui colunas alteradas em `old`)
- **GOTCHA**: rodar `pnpm db:push` aplica a migration no Supabase remoto; para o stack local, `supabase stop && supabase start` é necessário para o `config.toml` (Task 2) ter efeito, mas a migration em si é aplicada por `supabase db reset` ou `pnpm db:push`
- **VALIDATE**: `pnpm db:push` roda sem erro; `mcp__supabase__list_migrations` ou `SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime'` confirma `pregnancies` presente

### Task 2: UPDATE `packages/supabase/supabase/config.toml`

- **ACTION**: UPDATE bloco `[realtime]`
- **IMPLEMENT**: trocar `enabled = false` (linha 65) por `enabled = true`
- **GOTCHA**: mudança de `config.toml` só tem efeito após `supabase stop && supabase start` — documentar isso no PR/comentário para quem for rodar localmente
- **VALIDATE**: `supabase stop && supabase start`, depois confirmar container Realtime rodando (`docker ps` ou `supabase status`)

### Task 3: CREATE `apps/web/src/hooks/use-birth-mode-realtime.ts`

- **ACTION**: CREATE hook de subscription Realtime
- **IMPLEMENT**: hook `useBirthModeRealtime()` que:
  1. Recebe `user` de `useAuth()` (padrão idêntico a `use-notifications.ts:13`)
  2. Abre `supabase.channel("birth-mode-activations").on("postgres_changes", { event: "UPDATE", schema: "public", table: "pregnancies", filter: "birth_mode_active=eq.true" }, callback).subscribe(statusCallback)` dentro de um `useEffect` guardado por `if (!user) return`
  3. No `statusCallback`, trata `SUBSCRIBED` (seta `connectionStatus: "connected"`), e `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED` (seta `connectionStatus: "reconnecting"` e chama `.subscribe()` novamente no mesmo objeto de canal — resubscribe manual, já que o reconnect automático do socket não recria a subscription do canal, conforme confirmado na pesquisa)
  4. No callback de `postgres_changes`, seta `lastActivation` com `payload.new` (contém `id`, `birth_mode_active`, `birth_mode_activated_at`, `birth_mode_activated_by`)
  5. Cleanup do `useEffect` chama `supabase.removeChannel(channel)` (não `channel.unsubscribe()` sozinho — `removeChannel` também desregistra do client, conforme consenso da comunidade citado na pesquisa)
  6. Gate por `process.env.NEXT_PUBLIC_BIRTH_MODE_REALTIME_SPIKE === "true"` — se a flag não estiver ativa, o hook não abre nenhum canal (retorna `connectionStatus: "disabled"`)
- **MIRROR**: `apps/web/src/hooks/use-notifications.ts:41-65` — mesmo formato de `useEffect` guardado + cleanup; usar `let cancelled = false` para proteger contra callback resolvendo pós-unmount, igual ao padrão do FCM listener
- **IMPORTS**: `import { supabase } from "@ventre/supabase";` (client singleton, não factory — ver `auth-provider.tsx:6`), `import { useAuth } from "@/hooks/use-auth";`
- **TYPES**: usar `Tables<"pregnancies">` de `@ventre/supabase/types` para tipar `payload.new` em vez de `any`
- **GOTCHA**: nome de canal não pode ser a string literal `"realtime"` (reservada pela lib) — `"birth-mode-activations"` é seguro
- **GOTCHA**: `SECURITY DEFINER` de `is_team_member` funcionando sob avaliação RLS por-assinante do Realtime é uma suposição não documentada oficialmente pela Supabase — validar empiricamente no runbook (Task 6), não assumir que funciona sem teste
- **VALIDATE**: `pnpm check-types`

### Task 4: CREATE `apps/web/src/providers/birth-mode-realtime-provider.tsx`

- **ACTION**: CREATE Context + Provider
- **IMPLEMENT**: espelhar `notifications-provider.tsx` exatamente — `BirthModeRealtimeContext`, `BirthModeRealtimeProvider`, `useBirthModeRealtimeContext()` (lança erro se usado fora do provider)
- **MIRROR**: `apps/web/src/providers/notifications-provider.tsx:1-19`
- **IMPORTS**: `import { useBirthModeRealtime } from "@/hooks/use-birth-mode-realtime";`
- **VALIDATE**: `pnpm check-types`

### Task 5: UPDATE `apps/web/src/providers/index.tsx`

- **ACTION**: ADD `BirthModeRealtimeProvider` à árvore de composição
- **IMPLEMENT**: inserir `<BirthModeRealtimeProvider>` dentro de `<AuthProvider>`, no mesmo nível de `<NotificationsProvider>` (pode envolver `NotificationsProvider` ou ser irmão dele — usar irmão, já que não há dependência entre os dois: `<AuthProvider><NotificationsProvider>...</NotificationsProvider><BirthModeRealtimeProvider>...</BirthModeRealtimeProvider></AuthProvider>` não é válido em JSX com um único `children` — estruturar como aninhamento: `<AuthProvider><BirthModeRealtimeProvider><NotificationsProvider>...`)
- **MIRROR**: `apps/web/src/providers/index.tsx:12-28`
- **GOTCHA**: `BirthModeRealtimeProvider` precisa estar DENTRO de `AuthProvider` (depende de `useAuth()`), mas a ordem relativa a `NotificationsProvider` não importa — são independentes
- **VALIDATE**: `pnpm check-types && pnpm dev` sobe sem erro de contexto

### Task 6: DOCUMENT flag em `apps/web/.env.local.example` (ou arquivo equivalente de exemplo de env já existente no repo)

- **ACTION**: UPDATE arquivo de exemplo de variáveis de ambiente
- **IMPLEMENT**: adicionar `NEXT_PUBLIC_BIRTH_MODE_REALTIME_SPIKE=false` com comentário explicando que é a flag temporária do spike da Fase 2, a ser removida/promovida quando a Fase 5 (UI de produção) estiver pronta
- **GOTCHA**: confirmar o nome exato do arquivo de exemplo já usado no repo antes de criar um novo (buscar por `.env.example` ou `.env.local.example` na raiz de `apps/web`)
- **VALIDATE**: revisão manual — flag documentada e comentada

### Task 7: RUN manual validation runbook (critérios de sucesso da Fase 2)

- **ACTION**: EXECUTE validação manual (não gera código de produção)
- **IMPLEMENT**: com `NEXT_PUBLIC_BIRTH_MODE_REALTIME_SPIKE=true` localmente:
  1. Logar como profissional membro de equipe de uma paciente de teste (`is_team_member` deve retornar true para essa paciente)
  2. Abrir o app em uma aba, confirmar via `console.log`/React DevTools que `connectionStatus` chega a `"connected"`
  3. Em outra aba/terminal, rodar `UPDATE public.pregnancies SET birth_mode_active = true, birth_mode_activated_at = now(), birth_mode_activated_by = '<uuid-do-profissional>' WHERE id = '<uuid-da-gestacao-de-teste>';` via Supabase Studio SQL editor
  4. Cronometrar o tempo até `lastActivation` atualizar no client — deve ser <2s
  5. Repetir o UPDATE logado como profissional SEM vínculo de equipe (`is_team_member` false) — confirmar que o evento NÃO chega (valida que a RLS/`SECURITY DEFINER` está sendo respeitada pelo Realtime, conforme suposição não documentada oficialmente que precisa de verificação empírica)
  6. Simular queda de rede: DevTools → Network → Offline por ~10s, depois voltar Online; confirmar que `connectionStatus` sai de `"connected"` → `"reconnecting"` → volta a `"connected"` sem precisar recarregar a página
  7. Repetir o UPDATE do passo 3 após a reconexão, confirmar que o evento ainda chega (prova que o resubscribe manual funcionou, não só o reconnect do socket)
- **GOTCHA**: se `TIMED_OUT` aparecer de forma espúria mesmo sem queda de rede real, checar a versão do Node.js rodando o stack local (pesquisa aponta Node ≥22 LTS como requisito para evitar falso-positivo de timeout no `realtime-js`)
- **VALIDATE**: todos os 7 passos acima documentados com resultado (sucesso/falha) — se qualquer um falhar, a Fase 2 NÃO está completa e a Fase 5 não deve iniciar

---

## Testing Strategy

### Unit Tests to Write

Nenhum — o repositório não tem infraestrutura de testes automatizados (confirmado: sem `vitest.config.*`/`jest.config.*`/arquivos `*.test.ts*` em todo o monorepo). Adicionar essa infraestrutura está fora do escopo deste spike (ver NOT Building).

### Edge Cases Checklist (cobertos pelo runbook manual, Task 7)

- [ ] Profissional SEM vínculo de equipe não recebe o evento (RLS respeitada)
- [ ] Profissional COM vínculo de equipe recebe o evento em <2s
- [ ] Reconexão automática após queda de rede simulada, sem reload de página
- [ ] Resubscribe funcional pós-reconexão (não só o socket volta — o canal volta a entregar eventos)
- [ ] Cleanup ao desmontar (navegar para fora do app / fechar aba) não deixa canal órfão — checar `supabase.getChannels().length` antes/depois via console

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```
**EXPECT**: Exit 0, sem erros

### Level 2: DATABASE_VALIDATION

```bash
pnpm db:push
pnpm db:types
```
Verificar via MCP Supabase (`mcp__supabase__execute_sql`):
```sql
SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
SELECT relreplident FROM pg_class WHERE oid = 'public.pregnancies'::regclass; -- deve ser 'f' (full)
```
**EXPECT**: `pregnancies` listada na publication; `relreplident = 'f'`

### Level 3: MANUAL_VALIDATION (critério de sucesso da fase)

Executar o runbook completo da Task 7. **EXPECT**: todos os 7 passos com resultado "sucesso", latência medida <2s, reconexão funcional documentada.

---

## Acceptance Criteria

- [ ] Migration aplicada: `pregnancies` na publication `supabase_realtime`, `REPLICA IDENTITY FULL`
- [ ] `config.toml` local com `[realtime] enabled = true`
- [ ] Hook `useBirthModeRealtime` implementado com resubscribe manual em erro/timeout/closed
- [ ] Provider `BirthModeRealtimeProvider` montado em `providers/index.tsx`, gated por flag de ambiente
- [ ] Runbook de validação manual executado com sucesso: latência <2s confirmada, reconexão pós-queda de rede confirmada, RLS respeitada (não-membro não recebe evento)
- [ ] `pnpm check-types` passa sem erros
- [ ] Nenhuma UI de produto nova (fora de escopo desta fase)

---

## Completion Checklist

- [ ] Todas as tasks completadas em ordem de dependência
- [ ] Cada task validada imediatamente após conclusão
- [ ] Level 1: `pnpm check-types` passa
- [ ] Level 2: validação de banco (publication + replica identity) passa
- [ ] Level 3: runbook manual completo, com os 7 passos documentados
- [ ] Todos os Acceptance Criteria atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-------------|
| `SECURITY DEFINER` de `is_team_member` não se comportar como esperado sob avaliação por-assinante do Realtime (não documentado oficialmente) | M | H | Runbook (Task 7, passo 5) testa explicitamente o caso negativo (não-membro) antes de dar a fase como concluída |
| Reconnect automático do socket não recriar a subscription do canal (issue conhecida do `realtime-js`) | H | M | Resubscribe manual implementado explicitamente no hook (Task 3), não depender do comportamento automático |
| `TIMED_OUT` espúrio por versão de Node incompatível no ambiente local | M | L | Checar versão Node ≥22 LTS antes de escalar como problema de rede real |
| `REPLICA IDENTITY FULL` aumentar volume de WAL | L | L | Escopo limitado a uma única tabela (`pregnancies`), aceitável para o volume de escrita esperado |
| Flag de ambiente esquecida em `true` e todos os usuários abrindo WebSocket antes da Fase 5 existir | L | M | Documentar claramente em `.env.local.example` que é uma flag temporária de spike; revisão de PR deve confirmar `false`/ausente em produção até a Fase 5 |

---

## Notes

- Esta fase é bloqueante para a Fase 5 (redirect + barra persistente) e paralela à Fase 1 (já completa) — mas via análise de dependências, a Fase 4 (tela `/modo-parto`) também depende desta fase estar completa antes de começar.
- O nome do canal (`"birth-mode-activations"`) e o padrão de resubscribe manual estabelecidos aqui devem ser reutilizados sem modificação pela Fase 5 — não reinventar a convenção.
- Se o runbook manual (Task 7) falhar em qualquer critério — especialmente RLS não respeitada ou reconexão não funcional — a Fase 5 não deve iniciar até a causa raiz ser corrigida nesta fase.

---

*Generated: 2026-08-20*
