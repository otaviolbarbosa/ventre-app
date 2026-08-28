# App Mobile Ventre (WebView Wrapper)

## Problem Statement

Hoje o Ventre só existe como web app responsivo (PWA via Serwist). Isso limita o alcance do produto: falta presença nas lojas de aplicativos (App Store/Play Store), o que reduz credibilidade e descoberta, e o push notification via PWA no iOS é pouco confiável (depende de instalação manual à tela de início, iOS 16.4+, comportamento inconsistente). O custo de não resolver isso é engajamento mais baixo do que o possível e uma percepção de produto menos "sério" frente a concorrentes com apps nativos.

## Evidence

- Assunção validada por pesquisa de mercado: apps PWA no iOS têm suporte a push notavelmente mais frágil que apps nativos (taxa de instalação à tela de início costuma ser baixa).
- Decisão estratégica de roadmap — não há um gatilho de dado específico (ex: métrica de churn ou reclamação documentada) motivando o timing; é um próximo passo natural do produto.
- Assumption - precisa validação: não há hoje medição de quantos usuários instalariam um app nativo vs. continuar na web/PWA.

## Proposed Solution

Construir `apps/mobile`, um app React Native (Expo v56+, RN v0.85+) dentro do monorepo Turborepo existente, que envolve a web app de produção (`https://ventre.app/landing`) em uma WebView com uma camada nativa fina: push notifications reaproveitando o backend FCM já existente, deep links para telas específicas, ícone gerado a partir do logo atual, tratamento de estado offline e navegação nativa mínima (botão voltar no Android, splash nativa), e pipeline de deploy via EAS. Essa abordagem evita reconstruir a aplicação em nativo, aproveita 100% da lógica de produto já existente na web, e mitiga o risco de rejeição nas lojas (Apple 4.2 / Google Play 4.3) ao não ser um wrapper "preguiçoso".

## Key Hypothesis

Acreditamos que ter um app nativo nas lojas com push notification confiável e deep links vai aumentar a credibilidade e o engajamento diário de profissionais e pacientes.
Saberemos que estamos certos quando o app se tornar o principal canal de acesso diário à plataforma, reduzindo a dependência da web/PWA — métrica exata de "principal canal" ainda **TBD**, precisa ser definida com dados de uso reais pós-lançamento.

## What We're NOT Building

- Telas nativas em React Native (UI real fora da WebView) — o produto continua sendo a mesma web app; só splash, erro/offline e chrome mínimo são nativos. Motivo: manter esforço de desenvolvimento e manutenção mínimos, sem duplicar lógica de produto.
- Funcionalidade offline real (cache de dados do paciente para uso sem internet) — apenas uma tela de erro/retry quando sem conexão. Motivo: escopo de v1 é provar o wrapper + push + deep link, não reescrever a arquitetura de dados para offline-first.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|---------------|
| Adoção / instalações | TBD — precisa definição pós-lançamento | Analytics de instalação nas lojas (App Store Connect / Play Console) |
| Engajamento via push | TBD — precisa definição pós-lançamento | Taxa de abertura de notificações push comparada ao baseline da web |

## Open Questions

- [ ] Qual é a meta numérica de adoção/engajamento que definirá sucesso? (marcado como TBD pelo usuário)
- [ ] Como a sessão do Supabase Auth vai persistir dentro da WebView entre aberturas do app (cookies/localStorage não pode se perder)? Não foi decidido explicitamente — tratado como risco técnico, não como feature nova de escopo.
- [ ] Existe uma convenção "abençoada" pela Expo para a ponte push-token nativo ↔ WebView? Pesquisa não encontrou um padrão oficial — vai precisar ser uma convenção customizada (`postMessage`/`onMessage`).
- [ ] Quando as contas de desenvolvedor Apple/Google serão criadas? Isso não bloqueia desenvolvimento, mas bloqueia a submissão final.

---

## Users & Context

**Primary User**
- **Quem**: Ambos os tipos de usuário da plataforma — profissionais de saúde (equipe) e pacientes.
- **Comportamento atual**: Usam a web app responsiva/PWA no navegador ou instalada à tela de início.
- **Gatilho**: Precisa checar algo rápido fora do computador (ex: profissional fora do consultório checando agenda/paciente pelo celular).
- **Estado de sucesso**: Consegue abrir o app, ver a informação ou agir a partir de uma notificação push, sem fricção a mais do que a web já oferece.

**Job to Be Done**
Quando preciso checar algo rápido fora do computador, quero abrir o app no celular, para que eu possa ver ou agir na informação sem depender de estar no navegador/desktop.

**Non-Users**
Não há segmentação explícita de não-usuários — o app serve o mesmo público da web (profissionais e pacientes), sem exclusão deliberada de nenhum papel existente.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | WebView apontando para https://ventre.app/landing | É o núcleo do produto — encapsular a web app em produção |
| Must | Push notifications via infraestrutura FCM existente | Motivador principal do app; backend (`push_subscriptions`, edge functions) já existe, só falta registro de token Expo/FCM no app mobile |
| Must | Deep links para páginas específicas (via expo-router) | Notificações e links externos precisam abrir a tela certa, não só a home |
| Must | Ícone do app gerado a partir do logo atual | Necessário para publicação nas lojas |
| Must | Pipeline de deploy via EAS Build/Submit | Necessário para publicar e iterar nas lojas |
| Must | Tratamento de estado offline (tela de erro/retry) | Mitiga o principal motivo de rejeição nas lojas (tela branca sem internet) |
| Must | Navegação nativa mínima (botão voltar Android, splash nativa) | Mitiga risco de rejeição por "wrapper preguiçoso" (Apple 4.2 / Google Play 4.3) |
| Won't | UI nativa real (telas RN fora da WebView) | Fora de escopo explícito da v1 |
| Won't | Funcionalidade offline real (dados cacheados localmente) | Fora de escopo explícito da v1 |

### MVP Scope

O escopo descrito na tabela acima ("Must") é o MVP completo — não há uma versão ainda mais reduzida cogitada pelo usuário. Validar que o wrapper funciona de ponta a ponta (login, navegação, push, deep link) sem rejeição nas lojas é a barra mínima de sucesso técnico.

### User Flow

1. Usuário instala o app pela loja.
2. Abre o app → splash nativa → WebView carrega `https://ventre.app/landing` (sessão Supabase Auth deve persistir entre aberturas).
3. Usuário recebe uma push notification (ex: lembrete de consulta) → toca nela → deep link abre o app diretamente na tela relevante (ex: `/patients/[id]`).
4. Se estiver sem internet, vê uma tela nativa de erro/retry em vez de tela branca.

---

## Technical Approach

**Feasibility**: HIGH

**Architecture Notes**
- Novo pacote `apps/mobile` no Turborepo (`pnpm-workspace.yaml` já inclui `apps/*` automaticamente); seguir convenção `@ventre/*` se precisar consumir `@ventre/supabase` (provavelmente só os subpaths `./client` e `./types`, já que `./server` assume Next.js).
- Stack: `react-native-webview` (núcleo do wrapper) + `expo-notifications` (push) + `expo-router` (deep linking baseado em arquivos) + EAS Build/Submit (deploy).
- Push: reaproveitar `push_subscriptions` (tabela existente) e as edge functions `process-notifications` / `ventre-send-notification` — app mobile só precisa registrar o token Expo/FCM via `Notifications.getExpoPushTokenAsync()` e persistir na mesma tabela.
- Deep link: payload de notificação já usa paths string (ex: `/home`, confirmado em `firebase-messaging-sw.js/route.ts`) — mesmo padrão pode ser mapeado para rotas do `expo-router`.
- Sessão: precisa garantir que cookies/localStorage do Supabase Auth persistam dentro da WebView entre aberturas do app — não há um mecanismo pronto identificado no repo, precisa ser desenhado na fase de planejamento técnico.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Rejeição nas lojas por "wrapper preguiçoso" (Apple 4.2 / Google Play 4.3) | M | Offline handling, navegação nativa mínima e splash nativa já estão no Must Have do MVP |
| Perda de sessão de autenticação dentro da WebView entre aberturas | M | Precisa ser investigado e desenhado explicitamente na fase de implementação (open question) |
| Falta de padrão oficial Expo para ponte push-token ↔ WebView | L | Assumir convenção customizada via `postMessage`/`onMessage`, documentada no plano de implementação |
| Contas de desenvolvedor Apple/Google inexistentes | M | Não bloqueia desenvolvimento; deve ser criada em paralelo antes da fase de submissão/EAS Submit |

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
| 1 | Scaffold do app mobile | Criar `apps/mobile` com Expo + expo-router, integrar ao Turborepo/pnpm workspace, WebView básica apontando para produção | in-progress | - | - | `.claude/PRPs/plans/mobile-app-scaffold.plan.md` |
| 2 | Sessão e navegação nativa | Garantir persistência de sessão Supabase Auth na WebView, botão voltar Android, splash nativa, tela de erro/offline | pending | - | 1 | - |
| 3 | Push notifications | Registro de token Expo/FCM em `push_subscriptions`, recebimento e tratamento de notificações no app | pending | with 4 | 1 | - |
| 4 | Deep linking | Configurar expo-router para mapear paths de notificação/links externos para telas da WebView | pending | with 3 | 1 | - |
| 5 | Ícone do app | Gerar ícones/assets a partir de `apps/web/public/images/ventre-red-bg-logo-only.png` para iOS/Android | pending | with 3, 4 | 1 | - |
| 6 | Deploy via EAS | Configurar `eas.json`, EAS Build e EAS Submit; criar contas de desenvolvedor Apple/Google se ainda não existirem | pending | - | 2, 3, 4, 5 | - |

### Phase Details

**Phase 1: Scaffold do app mobile**
- **Goal**: Ter um app Expo funcional dentro do monorepo, carregando a web app em produção numa WebView.
- **Scope**: `apps/mobile` criado, dependências instaladas, WebView renderizando `https://ventre.app/landing`.
- **Success signal**: App roda localmente (Expo Go ou dev client) e mostra a web app.

**Phase 2: Sessão e navegação nativa**
- **Goal**: Resolver os requisitos mínimos de "não ser wrapper preguiçoso" e garantir experiência de login persistente.
- **Scope**: Persistência de sessão entre aberturas, `BackHandler` no Android, splash nativa, tela de erro/retry offline.
- **Success signal**: Usuário fecha e reabre o app sem precisar logar de novo; app funciona sem crash sem internet.

**Phase 3: Push notifications**
- **Goal**: App mobile recebe push notifications reaproveitando o backend FCM existente.
- **Scope**: Registro de token via `expo-notifications`, upsert em `push_subscriptions`, recebimento de notificação em foreground/background.
- **Success signal**: Notificação de teste enviada pela edge function existente chega no dispositivo.

**Phase 4: Deep linking**
- **Goal**: Notificações e links externos abrem a tela certa dentro do app.
- **Scope**: Configuração de `expo-router` para os paths já usados no payload de notificação (ex: `/patients/[id]`).
- **Success signal**: Tocar numa notificação ou abrir um link `ventre://...` leva à tela correspondente na WebView.

**Phase 5: Ícone do app**
- **Goal**: Ícone do app nas lojas gerado a partir do branding existente.
- **Scope**: Gerar todos os tamanhos/variações necessárias a partir de `ventre-red-bg-logo-only.png`.
- **Success signal**: Ícone aparece corretamente no simulador/dispositivo iOS e Android.

**Phase 6: Deploy via EAS**
- **Goal**: Pipeline de build e submissão pronto para as lojas.
- **Scope**: `eas.json`, perfis de build, EAS Submit configurado; contas de desenvolvedor criadas se necessário.
- **Success signal**: Build gerado via `eas build` instalável em dispositivo físico/TestFlight/Internal Testing.

### Parallelism Notes

Fases 3 (push), 4 (deep linking) e 5 (ícone) podem rodar em paralelo depois que o scaffold (fase 1) existir, pois tocam áreas independentes do app (notificações, roteamento, assets). Fase 2 (sessão/navegação nativa) é sequencial após o scaffold pois afeta o comportamento central da WebView que as outras fases dependem indiretamente. Fase 6 (EAS) depende de todas as anteriores estarem prontas, já que empacota o app completo para as lojas.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|---------------|-----------|
| Localização do projeto | Dentro do monorepo, `apps/mobile` | Repositório separado | Segue convenção Turborepo já estabelecida; facilita reaproveitar `@ventre/supabase` |
| Estratégia de push | Reaproveitar backend FCM existente | Construir sistema de push novo | Backend já existe e funciona; menor esforço, sem duplicar infraestrutura |
| Escopo de "nativo" no MVP | Offline handling + navegação nativa mínima são Must Have | Lançar wrapper puro sem essas camadas | Mitiga risco real de rejeição nas lojas (Apple 4.2 / Google Play 4.3) |
| UI nativa | Nenhuma tela RN real, só WebView + chrome mínimo | Reconstruir telas em nativo | Evita duplicar lógica de produto; objetivo é presença nas lojas + push confiável, não reescrita nativa |

---

## Research Summary

**Market Context**
Apps WebView-wrapper continuam viáveis em 2025/2026 para produtos B2B/SaaS, mas Apple e Google endureceram a fiscalização contra "wrappers preguiçosos" (guideline 4.2 da Apple, política 4.3 do Google Play — Google rejeitou 1.75M submissões em 2025). O padrão usado por ferramentas como MobiLoud e Median é adicionar uma camada nativa fina: push, navegação/chrome nativo, tratamento de offline, splash nativa. Stack padrão: `react-native-webview` + `expo-notifications` + `expo-router` + EAS Build/Submit. Não existe um padrão oficial da Expo para a ponte push-token nativo ↔ WebView; é convenção customizada. Nenhum case público documentado de uma SaaS de saúde/CRM fazendo esse tipo de wrapper foi encontrado — analogias vêm de vendors de wrapper-tooling, não de empresas B2B usando a técnica.

**Technical Context**
O monorepo (Turborepo + pnpm workspaces, convenção `@ventre/*`) já suporta adicionar `apps/mobile` sem fricção estrutural. Já existe infraestrutura de push completa baseada em FCM (`push_subscriptions`, `notifications`, edge functions `process-notifications` e `ventre-send-notification`, triggers de banco via `pg_net`) — o app mobile pode reaproveitar tudo isso, só adicionando o registro de token Expo/FCM. As rotas de deep link já seguem um padrão de path string usado no payload de notificação atual (ex: `/home`, `/patients/[id]`). O ícone fonte (`ventre-red-bg-logo-only.png`, 452×452 PNG) existe e está pronto para uso. Não há EAS config nem workflow de deploy mobile no repositório — será tudo novo, coexistindo com o deploy via Vercel (web) e o GitHub Action de migrations (Supabase).

---

*Generated: 2026-08-04*
*Status: DRAFT - needs validation*
