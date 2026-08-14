# Objetivo

Dar às gestantes acesso próprio à plataforma: cartão pré-natal, agenda (com confirmação
de presença), financeiro (cobranças/parcelas, com registro de pagamento) e uma área de
ferramentas (medidor de contração e contador de batimentos cardíacos — a implementar
depois). Gestante não se cadastra sozinha: precisa de um link de convite gerado por uma
profissional ou por um membro da staff já cadastrado na plataforma.

Este documento é só planejamento — nada deve ser implementado a partir dele sem
alinhamento prévio. Ver "Decisões em aberto" no final.

## O que já existe no código (base a reaproveitar)

Antes de desenhar algo novo, vale registrar o que o projeto já tem pronto ou quase
pronto para isso — importante para não duplicar trabalho:

- **`patients.user_id`** (uuid, nullable, FK para `users.id`) já existe
  (`packages/supabase/supabase/migrations/20260126012100_remote_schema.sql:156`) e já é
  a base de várias RLS que liberam a própria gestante ver seus dados:
  - `patients`: policy `"Team members can view patients"` já inclui
    `OR ("user_id" = "auth"."uid"())`.
  - `patient_documents`, `patient_evolutions`/`pregnancy_evolutions`: já checam
    `patients.user_id = auth.uid()`.
  - `billings` **e `installments`**: ambas já liberam SELECT quando
    `patients.user_id = auth.uid()` (`20260213000001_billing_module.sql`) —
    **financeiro (leitura) já está coberto**, inclusive parcelas.
  - **`appointments` NÃO está coberto** — a policy de SELECT hoje é
    `is_team_member(patient_id) OR professional_id = auth.uid()`, sem checar
    `patients.user_id`. Precisa de policy nova para a agenda funcionar.
- **`user_type`** é um enum `'professional' | 'patient' | 'admin' | 'manager' | 'secretary'`
  (`20260126012100_remote_schema.sql:56`, mais os `ALTER TYPE ... ADD VALUE` em
  `20260306000001` e `20260402000001`). **É `'patient'` no singular**, não `'patients'`
  como mencionado no pedido original — ajustar essa premissa.
- `src/lib/access-control.ts` já tem `isPatient(profile)`, e `useAuth()`
  (`src/providers/auth-provider.tsx`) já expõe `isPatient` — mas nada hoje usa isso para
  rotear ou proteger telas. A área da gestante não existe ainda.
- **Fluxo quase idêntico já implementado para profissionais**, a ser espelhado:
  - Tabela `registration_invites` (`20260410000001_registration_invites.sql`).
  - E-mail de convite: `src/lib/emails/send-professional-invite.ts` (Resend, template
    inline).
  - Rota pública `/complete-registration?riid=<ID>` →
    `src/screens/complete-registration-screen.tsx` (form em 3 steps: senha → dados +
    **avatar** → confirmação) → `src/actions/complete-registration-action.ts`
    (`actionClient` público, sem auth — correto, pois o usuário ainda não existe).
  - A action cria o usuário via `supabaseAdmin.auth.signUp(...)`; a trigger
    `handle_new_user` cuida de inserir a linha em `public.users`.
  - **O upload de avatar já tem precedente pronto para reaproveitar**: no step 2 de
    `complete-registration-screen.tsx`, o usuário escolhe a foto (preview local via
    `URL.createObjectURL`), e o upload real só acontece depois de
    `supabase.auth.signInWithPassword` estabelecer sessão, via
    `POST /api/profile/avatar` (`FormData`). Mesmo padrão serve para o autocadastro da
    gestante (ver "Formulário de autocadastro").
- **Google OAuth já funciona**: `src/components/auth/social-login-buttons.tsx` +
  `useAuth().signInWithGoogle(redirectTo)`, com callback em
  `app/auth/callback/route.ts`. Esse callback já tem um precedente de "efeito colateral
  pós-OAuth via `intent`" (`intent=google_calendar` salva tokens do Calendar) — mesmo
  mecanismo que vamos precisar para finalizar o convite da gestante quando o cadastro for
  via Google (ver "Decisões em aberto").
- **Envio de convite por WhatsApp já tem precedente pronto**: `src/modals/invite-
  professional-modal.tsx` (convite de profissional para o time de uma paciente, tabela
  `team_invites` — conceito diferente, mas o mecanismo de compartilhamento é
  exatamente o que precisamos) já implementa "Copiar link" e "Enviar por WhatsApp" sem
  nenhuma integração de API — é só um deep link client-side:
  ```ts
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  ```
  (sem número de telefone pré-preenchido — abre o seletor de contato do WhatsApp para
  quem está enviando escolher o destinatário). O mesmo componente também dispara envio
  de e-mail via server action. **Reaproveitar esse padrão exato** para o convite da
  gestante (ver ponto 4 abaixo) em vez de integrar uma API de WhatsApp.
- **Componente `src/components/shared/prenatal-card.tsx`** já existe (lado profissional)
  — candidato a reaproveitar em modo leitura na área da gestante.
- **`proxy.ts`** já tem `/register/patient` na lista de rotas públicas
  (`publicRoutes`), mas a rota não existe — parece um placeholder esquecido de um
  planejamento anterior. Conflita com a rota pedida agora (`/patient-registration`).
  Precisa decisão (ver "Decisões em aberto").
- **Achado importante — já existe uma tabela `patient_invite_links`**, presente desde o
  schema original (`20260126012100_remote_schema.sql:142-150`), com RLS já habilitada e
  **nenhum código em `apps/web/src` referenciando ela** — claramente um precursor desta
  feature que ficou pela metade:
  ```sql
  CREATE TABLE public.patient_invite_links (
    id         uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    patient_id uuid REFERENCES patients(id),
    token      text NOT NULL UNIQUE,
    created_by uuid NOT NULL REFERENCES users(id),
    expires_at timestamptz NOT NULL,
    used_at    timestamptz,
    created_at timestamptz DEFAULT now()
  );
  ```
  Policies existentes: INSERT exige `is_team_member(patient_id)` (ou seja, **só cobre o
  tipo 2** hoje — não dá pra criar um link sem `patient_id` já existente e sem já ser do
  time); SELECT libera `is_team_member(patient_id) OR created_by = auth.uid()`; UPDATE é
  `USING (true)` (permissivo demais — item 11 do pedido pede para restringir a
  `service_role`, ver "Banco de dados"). Faltam: coluna para distinguir tipo 1 vs tipo 2,
  `email`/`name`/`phone` de prefill, `enterprise_id`, e uma coluna `metadata` (jsonb)
  para guardar o que foi decidido nos steps "Equipe"/"Empresa"/"Cobrança" quando o
  convite é gerado a partir de `new-patient-modal.tsx` (ver pontos 2 e 3 abaixo).
- **`app/(dashboard)/home/page.tsx`** decide o destino pós-login assumindo
  `user_type === 'professional'` ou staff (`isOnboardingComplete`). Hoje, se uma
  gestante logasse, cairia em `/onboarding` incorretamente — precisa tratamento
  explícito para `user_type === 'patient'`.
- **Achado crítico — trigger `handle_new_user` hardcoda o tipo de usuário**
  (`20260126123930_migration.sql:24-31`): todo `auth.users` novo vira
  `user_type = 'professional'::public.user_type` sempre, independente de qualquer
  metadata. Isso **precisa mudar** — sem isso, qualquer gestante que se autocadastrar
  vira "profissional" no sistema. A trigger precisa ler `user_type` do
  `raw_user_meta_data` (com fallback seguro para `'professional'`, para não quebrar o
  fluxo de convite de profissionais existente) e usar isso no `INSERT`.
- **`installments`** já tem `status public.installment_status` (`'pendente' | 'pago' |
  'atrasado' | 'cancelado'`), `paid_at`, `paid_amount`, `payment_method` — mas
  INSERT/UPDATE/DELETE são **`service_role`-only** hoje (`"Service role manages
  installments"`), mesmo para profissionais. Toda mutação passa por server action com
  `createServerSupabaseAdmin()` (ex. `save-installment-link-action.ts`). O registro de
  pagamento pela gestante (ponto 7) deve seguir o mesmo padrão: action com
  `authActionClient`, validação explícita de que a parcela pertence a um `billing` cujo
  `patient_id` está vinculado a `auth.uid()`, e só então update via admin client — não
  faz sentido abrir uma policy de UPDATE direta para pacientes aqui.
  **Resolvido**: o registro de pagamento pela gestante não vai direto para `'pago'` —
  fica **"em análise"** até a profissional confirmar. Precisa de um novo valor no enum
  `installment_status` (proposta: `'em_analise'`):
  ```sql
  ALTER TYPE public.installment_status ADD VALUE IF NOT EXISTS 'em_analise';
  ```
  A action da gestante (`registerInstallmentPaymentAction`) grava
  `status = 'em_analise'` (+ `paid_amount`/`payment_method` informados, sem tocar
  `paid_at` ainda). Isso implica uma **segunda action, do lado da profissional**, para
  confirmar (`status → 'pago'`, agora sim grava `paid_at`) ou recusar (`status` volta
  para `'pendente'`/`'atrasado'`) o pagamento em análise — essa tela/ação de
  confirmação não foi especificada no pedido original; ver "Decisões em aberto" sobre
  se entra nesta fase ou fica para depois (sem ela, parcelas "em análise" ficam sem
  caminho de saída).
- **`appointments.status`** é `public.appointment_status` (`'agendada' | 'realizada' |
  'cancelada'`) — não existe um valor tipo "confirmada". "Confirmar presença" (ponto 8)
  é um conceito diferente do status gerenciado pela profissional (ciclo de vida do
  atendimento) — precisa de uma coluna própria, não de reaproveitar `status` (ver
  "Banco de dados").
- **Cron jobs já existem** via Vercel Cron (`apps/web/vercel.json` + `app/api/cron/
  <nome>/route.ts`, autenticados com `Bearer ${CRON_SECRET}`) — ex.
  `billing-statuses` roda diariamente e atualiza `installments` vencidas para
  `'atrasado'`. Precedente direto caso a expiração de convites precise de um job ativo
  (ver ponto 9 abaixo — mas o padrão já usado em `registration_invites` é validação
  preguiçosa por `expires_at`, sem cron).

## Escopo desta fase

**Dentro do escopo:**
1. Convite + autocadastro da gestante (rota `/patient-registration?piid=<PATIENT_INVITE_ID>`),
   incluindo upload de avatar no autocadastro.
2. Convite "tipo 1" (novo atendimento) gerado a partir do próprio
   `new-patient-modal.tsx`, via checkbox "Solicitar auto cadastro" (staff ou
   profissional).
3. Envio do link de convite por e-mail e/ou WhatsApp.
4. Área da gestante com 4 seções:
   - Cartão pré-natal (leitura).
   - Agenda (leitura + **confirmar presença** em um atendimento).
   - Financeiro (leitura de cobranças/parcelas + **registrar pagamento** de uma
     parcela, que fica `'em_analise'` até a profissional confirmar).
   - Ferramentas: **Medidor de contração** e **Contador de batimentos cardíacos**
     (nomeadas agora, implementação adiada — ver "Fora do escopo").

**Fora do escopo agora** (mencionar para não perder de vista, mas não detalhar):
- Implementação real das ferramentas (medidor de contração, contador de batimentos).
- Edição de perfil/dados gestacionais pela própria gestante além do básico do
  autocadastro.
- Notificações push específicas para gestante (o pipeline de notificações já suporta
  `patients.user_id`, ver `src/lib/notifications/send.ts` e
  `src/lib/billing/notifications.ts` — só falta a UI consumir).
- App mobile / PWA específico para gestante.
- Convite "tipo 2" (vincular gestante existente) iniciado a partir da ficha da
  paciente — o pedido atual só especificou a UI de convite dentro de
  `new-patient-modal.tsx` (que é sempre "novo atendimento"); a UI do tipo 2 continua
  em aberto (ver "Decisões em aberto").

## Fluxos de convite

### Tipo 1 — Novo atendimento (nenhum registro prévio)

Gerado diretamente do `new-patient-modal.tsx`, com um novo checkbox **"Solicitar auto
cadastro"** (label exata pedida). Ao marcar:

- **Steps 1 (Gestante) e 3 (Endereço) ficam desabilitados** — a gestante preenche nome,
  dados gestacionais e endereço sozinha durante o próprio autocadastro.
  **Step 2 (Contato) permanece habilitado** (resolvido — correção ao rascunho anterior
  deste documento): quem está convidando informa e-mail e/ou telefone da gestante ali
  mesmo, para que o link do convite tenha para onde ser enviado. Esses valores vão para
  `patient_invite_links.email`/`phone` (prefill), e servem tanto para disparar o envio
  (e-mail/WhatsApp) quanto como valor inicial (editável) no formulário de autocadastro.
  `STEP_FIELDS`/validação dos steps 1 e 3 deixam de bloquear o avanço do wizard quando o
  checkbox está marcado; step 2 continua validando normalmente.
- **Step 4 e Step 5 (Cobrança) continuam**, mas em vez de criar a paciente
  imediatamente (via `addPatientAction`), os dados desses dois steps são serializados
  em `patient_invite_links.metadata` (jsonb) e uma nova action
  (`createPatientInviteAction`, nome a definir) cria a linha do convite
  (`invite_type = 'new_patient'`, `patient_id = NULL`).
  - **Resolvido — quem vê "Equipe" vs "Empresa" no modo convite**: a **staff sempre vê
    o step "Equipe"** (nunca "Empresa") — precisa escolher explicitamente qual(is)
    profissional(is) vai(vão) ser responsável(is), já que staff não é profissional e não
    pode assumir esse papel implicitamente; o `enterprise_id` do convite é implícito
    (a própria empresa da staff logada, sem precisar perguntar). Isso implica passar uma
    lista de `professionals` da empresa para o modal quando quem convida é staff e o
    checkbox está ativo — hoje o modal só recebe `enterprises` nesse contexto, precisa
    de ajuste de plumbing (buscar/injetar essa lista na tela que renderiza o modal para
    staff).
  - **Somente profissionais veem "Empresa"**: quando quem convida é uma profissional,
    ela mesma é automaticamente a responsável (implícito, sem precisar do step
    "Equipe") — gravado em `metadata.responsible_professional_id` (ou reaproveitando
    `metadata.professional_ids: [inviterId]`), espelhando a lógica de
    `professional_ids`/`backup_professional_ids` hoje calculada em
    `getBackupProfessionalIds` e usada por `add-patient-action.ts`. O step "Empresa"
    permanece para ela vincular (ou não) o atendimento a uma empresa, igual ao
    comportamento hoje fora do modo convite.
- Billing continua sendo decidido no ato do convite (step 5), não re-perguntado à
  gestante.
- Ao concluir o autocadastro, a action de finalização cria a `patients` row (nome,
  dados gestacionais e endereço vindos do formulário de autocadastro; contato
  pré-preenchido do convite e confirmável pela gestante), `team_members` (a partir do
  `metadata`), a `billings`/`installments` (a partir do `metadata`), atualiza
  `patients.user_id`, e marca `patient_invite_links.used_at` + `patient_id`.

### Tipo 2 — Vincular gestante existente a um novo usuário

Já existe uma `patients` row (criada por uma profissional via `new-patient-modal.tsx`,
com `user_id IS NULL`). O convite aponta para esse `patient_id`. A gestante só precisa
definir credenciais e confirmar/ajustar dados de contato (nome, telefone, email) — os
dados gestacionais e endereço já existem e não são re-coletados. Ao concluir,
`patients.user_id` é preenchido com o novo usuário. **A UI para gerar esse convite não
foi especificada neste pedido** — provavelmente vive na ficha da paciente existente, não
em `new-patient-modal.tsx` (ver "Decisões em aberto").

## Envio do link de convite

Reaproveitar exatamente o padrão de `invite-professional-modal.tsx`:
- **E-mail**: server action dispara envio via Resend, mesmo template/estilo de
  `send-professional-invite.ts`, adaptado para "convite de autocadastro de gestante".
  O endereço já está disponível: no tipo 2, prefill do `patients.email` existente; no
  tipo 1, o e-mail informado no step 2 (Contato), que continua habilitado no modo
  convite (resolvido acima).
- **WhatsApp**: deep link client-side `https://wa.me/?text=<mensagem com o link>`
  (`window.open(...)`), sem integração de API nova — mesma implementação de
  `handleShareWhatsApp` em `invite-professional-modal.tsx`.
- Também oferecer "Copiar link" (mesmo padrão, `navigator.clipboard.writeText`).

## Banco de dados

**Recomendação: estender `patient_invite_links` em vez de criar uma tabela paralela**
(ver achado acima) — ela já existe, já tem RLS, e cobre boa parte do que precisamos.
Migration proposta (nomes/tipos a validar na implementação):

```sql
ALTER TABLE public.patient_invite_links
  ADD COLUMN invite_type   text NOT NULL DEFAULT 'link_existing'
    CHECK (invite_type IN ('new_patient', 'link_existing')),
  ADD COLUMN enterprise_id uuid REFERENCES public.enterprises(id) ON DELETE CASCADE,
  ADD COLUMN name          text,
  ADD COLUMN email         text,
  ADD COLUMN phone         text,
  ADD COLUMN metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT patient_invite_links_link_existing_requires_patient
    CHECK (invite_type = 'new_patient' OR patient_id IS NOT NULL);

-- Item 10: remover o identificador por token — a URL usa o id da linha diretamente.
ALTER TABLE public.patient_invite_links DROP CONSTRAINT patient_invite_links_token_key;
ALTER TABLE public.patient_invite_links DROP COLUMN token;

-- ajustar a policy de INSERT para permitir tipo 'new_patient' sem patient_id:
DROP POLICY "Create invite links" ON public.patient_invite_links;
CREATE POLICY "Create invite links" ON public.patient_invite_links
  FOR INSERT WITH CHECK (
    (invite_type = 'link_existing' AND public.is_team_member(patient_id))
    OR (invite_type = 'new_patient' AND patient_id IS NULL)
    -- 'new_patient' provavelmente deve exigir só que created_by = auth.uid() e
    -- created_by seja profissional ou staff — validar regra exata na decisão sobre
    -- quem pode gerar convite
  );

-- Item 11: restringir o UPDATE a service_role (hoje é USING (true) para qualquer
-- usuário autenticado — quem finaliza o convite é sempre uma server action com
-- createServerSupabaseAdmin()).
DROP POLICY "Update invite links" ON public.patient_invite_links;
CREATE POLICY "Update invite links" ON public.patient_invite_links
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);
```

- `metadata` (jsonb) guarda, para convites tipo `new_patient` gerados a partir de
  `new-patient-modal.tsx`: `professional_ids`, `backup_professional_ids`,
  `enterprise_id` (ou `responsible_professional_id` quando quem convida é a própria
  profissional responsável) e o bloco `billing` completo (mesmo shape de
  `CreatePatientInput["billing"]`, incluindo `splitted_billing`/`installment_amounts`
  quando aplicável).
- `invite_type = 'link_existing'`: exige `patient_id` desde a criação (regra já
  garantida pela policy de INSERT existente).
- `invite_type = 'new_patient'`: `patient_id` fica `NULL` até a conclusão do cadastro —
  quando a gestante termina o formulário, a `patients` row é criada (usando os dados do
  formulário + `metadata`) e este mesmo registro de `patient_invite_links` é atualizado
  com o `patient_id` recém-criado e `used_at`.
- Rota usa o **`id`** da linha (uuid) como identificador na URL — `token` foi removido
  (item 10), resolvendo a ambiguidade que existia antes entre `piid` e `token`.
- **Expiração (item 9)**: convite válido por 7 dias (`expires_at NOT NULL DEFAULT (now()
  + interval '7 days')`, mesmo padrão de `registration_invites`). A expiração é
  **automática por validação preguiçosa** — a rota de autocadastro sempre checa
  `expires_at > now()` antes de aceitar o convite, sem precisar de job ativo (mesmo
  comportamento hoje usado por `registration_invites`/`complete-registration`). Não é
  necessário um cron dedicado para isso; o precedente de cron (`billing-statuses`)
  existe caso o time decida, no futuro, marcar/limpar convites expirados ativamente.

Alterações necessárias em tabelas existentes:
- **Trigger `handle_new_user`**: ler `user_type` do `raw_user_meta_data` (fallback
  `'professional'`) em vez de hardcodar.
- **Nova policy de SELECT em `appointments`** para a própria gestante:
  `EXISTS (SELECT 1 FROM patients WHERE patients.id = appointments.patient_id AND patients.user_id = auth.uid())`.
- **Nova coluna em `appointments` para confirmação de presença (item 8)**:
  `confirmed_by_patient_at timestamptz` (nullable) — não reaproveitar `status`
  (`'agendada'|'realizada'|'cancelada'`), que é o ciclo de vida gerenciado pela
  profissional, um conceito diferente de "a gestante confirmou que vai comparecer".
  Update feito via server action dedicada (`confirmAppointmentAttendanceAction`, nome a
  definir) com checagem explícita de `patients.user_id = auth.uid()`, não por uma
  policy de RLS aberta — mesmo padrão de "defesa em profundidade" já usado em
  `installments`.
- **Registro de pagamento pela gestante (item 7)**: nenhuma mudança de schema
  obrigatória em `installments` (`status`, `paid_at`, `paid_amount`, `payment_method`
  já existem) — só uma nova server action (`registerInstallmentPaymentAction`, nome a
  definir) que valida a posse da parcela (via `billings.patient_id` →
  `patients.user_id = auth.uid()`) e atualiza via `createServerSupabaseAdmin()`, já que
  `installments` é `service_role`-only para mutações. **Decisão de produto em aberto**:
  o registro pela gestante muda `status` direto para `'pago'`, ou precisa de um estado
  intermediário tipo "aguardando confirmação" (novo valor no enum
  `installment_status`) até a profissional confirmar o recebimento? Hoje o enum só tem
  `pendente | pago | atrasado | cancelado`.

`pnpm db:types` depois da migration (regra do `CLAUDE.md`).

## Rota `/patient-registration`

- `/patient-registration?piid=<PATIENT_INVITE_ID>` (renomeada do `/patient-register`
  original — item 1). `piid` recebe o `id` da linha em `patient_invite_links`.
- Sem `piid`: redirecionar para `/login` com mensagem de erro "Você não possui
  permissão para esta ação" — reaproveitar o mecanismo já usado em
  `/login?error=auth_callback_error` (proxy.ts / tela de login já deve tratar `?error=`
  ou similar; validar como o login exibe esse tipo de mensagem hoje, ex. via
  `FlashMessage`).
- Server Component na rota busca o convite via `createServerSupabaseAdmin()`,
  valida `used_at IS NULL` e `expires_at > now()` (mesma lógica de validação de
  `complete-registration-action.ts`, adaptada aos nomes de coluna de
  `patient_invite_links`); se inválido/expirado/inexistente, mesmo redirect de erro.
- Passa os dados do convite (metadata do tipo 1, ou os dados já existentes do
  `patients` no tipo 2) para um Client Component `PatientRegisterScreen`, espelhando
  `complete-registration-screen.tsx`.
- Precisa entrar em `publicRoutes` do `proxy.ts` (hoje só há o placeholder não usado
  `/register/patient`).

## Formulário de autocadastro

Reaproveitar `createPatientSchema`
(`apps/web/src/lib/validations/patient.ts`) como base de validação, e os campos de
`new-patient-modal.tsx` como referência de UI — adaptados ao contexto de autocadastro
(sem seleção de profissional, sem billing, já decididos no convite):

**Tipo 1 (novo atendimento):**
- Senha (ou "Continuar com Google")
- Nome (novo, coletado aqui), telefone e e-mail (prefill de
  `patient_invite_links.phone`/`email`, informados por quem convidou no step 2 do
  modal — editável pela gestante)
- Nome do parceiro, nome do bebê, DPP (com DUM calculada automaticamente, igual ao
  modal atual)
- Endereço (CEP com lookup automático, como no modal) — opcional
- Observações — opcional
- **Avatar** (item 5) — mesmo padrão de `complete-registration-screen.tsx`: seleção com
  preview local, upload real só depois de a sessão existir (`POST
  /api/profile/avatar`).

**Tipo 2 (vincular a paciente existente):**
- Senha (ou "Continuar com Google")
- Confirmar/editar nome, telefone, e-mail (prefill a partir do `patients` existente)
- **Avatar** (item 5), mesmo tratamento acima
- Não repete dados gestacionais/endereço (já existem)

## Autenticação: e-mail/senha e Google

- **E-mail/senha**: reaproveitar `supabaseAdmin.auth.signUp(...)` como em
  `completeRegistrationAction`, passando `options.data.user_type = 'patient'` no
  metadata para a trigger corrigida usar.
- **Google**: reaproveitar `signInWithGoogle`, mas o cadastro por OAuth não passa pela
  server action antes de criar o usuário — a trigger `handle_new_user` vai rodar sem
  saber que é uma gestante (metadata do Google não tem `user_type`). Ponto que precisa
  de desenho explícito antes de implementar:
  - Levar o `piid` (e talvez `invite_type`) adiante via `intent`/`next` no
    `signInWithGoogle(redirectTo)`, chegando em `app/auth/callback/route.ts`.
  - No callback, quando `intent === 'patient_invite'`: depois do
    `exchangeCodeForSession`, atualizar `public.users.user_type = 'patient'` para o
    usuário recém-criado (mesmo padrão do bloco `intent === 'google_calendar'` já
    existente ali), associar/gravar `patients.user_id`, criar a `patients` row se for
    tipo 1, e marcar `patient_invite_links.used_at`/`patient_id`.
  - Esse fluxo ainda precisa coletar os dados adicionais do formulário (DPP, endereço,
    avatar etc.) — como o OAuth já autentica direto, provavelmente exige um passo
    intermediário pós-callback ("complete seus dados") antes de liberar a área da
    gestante, similar ao step 2 do `complete-registration-screen.tsx`.

## Área da gestante

- Novo grupo de rotas (ex. `app/(patient)/...`, paralelo a `app/(dashboard)/...`),
  protegido por `user_type === 'patient'` (checagem em `proxy.ts` e/ou nas próprias
  pages via `getServerAuth()`).
- Ajustar o destino pós-login: `/home` hoje assume profissional/staff
  (`isOnboardingComplete` em `app/(dashboard)/home/page.tsx`) — precisa branch para
  `user_type === 'patient'` redirecionar para a nova área, sem passar pelo onboarding
  de profissional.
- Seções:
  1. **Cartão pré-natal** — leitura; reaproveitar `prenatal-card.tsx` e os
     services/queries já existentes (`src/services/patient.ts` etc.), filtrando pelo
     paciente vinculado ao `auth.uid()` (não mais por `patient_id` de rota).
  2. **Agenda** — leitura das consultas (depende da nova policy RLS em `appointments`
     mencionada acima) **+ botão "Confirmar presença"** por atendimento (item 8),
     chamando a nova action dedicada.
  3. **Financeiro** — cobranças e parcelas (RLS já cobre leitura) **+ ação "Registrar
     pagamento"** por parcela (item 7), chamando a nova action dedicada — sujeito à
     decisão de produto sobre estado intermediário vs. `'pago'` direto.
  4. **Ferramentas** — dois cards nomeados: **Medidor de contração** e **Contador de
     batimentos cardíacos**, ambos com implementação adiada ("em breve" na UI, item 6).
- Navegação própria, mais simples que a do dashboard profissional (sem gestão de
  pacientes/equipe/empresa).

## Requisitos não funcionais

- Todas as strings voltadas à gestante em pt-BR (convenção do `CLAUDE.md`).
- Reaproveitar padrões existentes em vez de criar novos: `actionClient` público para
  ações pré-autenticação (convite/cadastro), `authActionClient` depois de logada,
  `createServerSupabaseAdmin()` para ler/gravar convite antes do login existir, e o
  padrão de compartilhamento de `invite-professional-modal.tsx` (copiar link / e-mail /
  WhatsApp) para o convite da gestante.
- Extrair para um helper compartilhado a lógica de criação de `patients` +
  `team_members` + `billings`/`installments` hoje em `add-patient-action.ts`, para
  reaproveitar tanto na criação direta quanto na finalização do convite tipo 1 (a
  partir do `metadata`), sem duplicar.

## Decisões em aberto (responder antes de implementar)

1. **Rota final**: `/patient-registration` (definida agora) vs `/register/patient` (já
   reservada, não usada, em `proxy.ts`) — limpar o placeholder não usado do
   `publicRoutes`.
2. **Finalização via Google**: confirmar o desenho descrito acima (intent no callback +
   passo pós-OAuth para completar dados) antes de implementar — é o ponto sem
   precedente direto no código hoje.
3. ~~Como a staff escolhe a "Equipe" no modo convite~~ — **resolvido**: staff sempre vê
   "Equipe" (nunca "Empresa"); só profissionais veem "Empresa". Falta só o ajuste de
   plumbing (passar `professionals` da empresa para o modal em contexto de staff).
4. ~~Contato para envio do link no tipo 1~~ — **resolvido**: step 2 (Contato) não é
   desabilitado no modo convite.
5. **Momento de criação da `patients` row no tipo 1**: só na conclusão do cadastro
   (recomendado, evita registros órfãos) — confirmar que não há necessidade de criar
   algo em `patients` já no ato do convite.
6. **UI do convite tipo 2**: onde fica a tela/botão para gerar convite de "vincular
   gestante existente" — provavelmente na ficha da paciente, análogo ao botão
   "Convidar Profissional" de `invite-professional-modal.tsx`, mas não foi
   especificado neste pedido.
7. **Convite já usado**: no tipo 2, se `patients.user_id` já estiver preenchido (link
   usado ou paciente já tinha conta), bloquear com mensagem clara — mesmo padrão do
   "convite já utilizado" de `registration_invites`.
8. **Quem pode gerar convite tipo 1**: qualquer profissional, ou só quem tem
   `user_type` de staff/responsável? A policy de INSERT proposta em "Banco de dados"
   precisa da regra final para `invite_type = 'new_patient'`.
9. ~~Registrar pagamento (item 7) — estado final~~ — **resolvido**: fica `'em_analise'`
   até a profissional confirmar (novo valor no enum `installment_status`).
10. **Confirmação do pagamento pela profissional — entra nesta fase?** A resolução do
    item 9 cria uma parcela `'em_analise'` sem caminho de saída até existir uma ação do
    lado da profissional para confirmar (`→ 'pago'`) ou recusar (`→ 'pendente'`/
    `'atrasado'`) o pagamento informado pela gestante. Isso não foi pedido
    explicitamente — decidir se essa tela/ação de confirmação entra no escopo atual ou
    fica para uma fase seguinte (e, nesse caso, como o time vai lidar com parcelas
    presas em `'em_analise'` até lá).
11. **Confirmar presença (item 8) — efeito colateral**: só grava
    `confirmed_by_patient_at`, ou também deveria notificar a profissional
    responsável (reaproveitando o pipeline de notificações já existente)?
