# Feature: Modelo de Dados de Assinatura Dupla (Fase 1 — Assinatura da Gestante)

## Summary

Hoje `contracts` guarda assinatura em colunas singulares (`is_signed`, `signed_at`, `signed_by`,
`signed_ip`, `signed_user_agent`, `content_hash`, `verification_code`, `signed_document_id`) e um
trigger `BEFORE UPDATE ... WHEN (OLD.is_signed = true)` trava a linha inteira assim que a
profissional assina — não sobra espaço para uma segunda assinatura independente da gestante.
Esta fase introduz uma tabela filha `contract_signatures` (uma linha por papel: `professional` |
`patient`), uma nova coluna `contracts.fully_signed_at` que só é setada quando **ambos** os papéis
tiverem assinado, um trigger de conclusão (`AFTER INSERT` na tabela filha) que faz essa checagem
com lock de linha para evitar corrida, e uma nova política de RLS dando à gestante acesso de
leitura ao próprio contrato. O trigger de imutabilidade existente é reescrito para também
considerar `fully_signed_at`, sem quebrar o comportamento atual (contratos já assinados só pela
profissional continuam travados exatamente como hoje, via backfill). A ação de assinatura da
profissional (`sign-patient-contract-action.ts`) passa a gravar também na tabela nova, para que a
Fase 2 (assinatura da gestante) já encontre dados reais para trabalhar.

## User Story

Como profissional que já assina contratos pela plataforma, quero que minha assinatura continue
funcionando exatamente como hoje, mas que o contrato só fique definitivamente imutável quando a
gestante também tiver assinado — para que ambas as assinaturas coexistam sem uma travar a outra.

## Problem Statement

O schema atual de `contracts` modela apenas UM signatário. Introduzir uma segunda assinatura
independente (gestante) exige um redesenho de dados que não regrida o fluxo de assinatura da
profissional já em produção.

## Solution Statement

Tabela filha `contract_signatures` (um registro imutável por papel, com trilha de auditoria
própria: IP, user-agent, timestamp, verification code) + nova coluna `contracts.fully_signed_at`
setada por um trigger de conclusão que dispara quando as duas linhas (`professional` e `patient`)
existirem para o mesmo contrato. O trigger de imutabilidade de `contracts` passa a travar em
`OLD.is_signed = true OR OLD.fully_signed_at IS NOT NULL` — união com a condição atual, portanto
estritamente aditivo. RLS de `contracts` ganha um novo branch de SELECT para a gestante,
espelhando o padrão já usado em `appointments`.

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------|
| Type             | ENHANCEMENT (extends a live, production feature)                     |
| Complexity       | HIGH (rewrites a production immutability trigger)                    |
| Systems Affected | `packages/supabase` (migrations, RLS, triggers, generated types), `apps/web/src/actions/sign-patient-contract-action.ts` |
| Dependencies     | PostgreSQL 15 (Supabase-hosted), `@supabase/ssr`, `next-safe-action` (existing, no version change) |
| Estimated Tasks  | 8                                                                     |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════╗
║                          BEFORE STATE                              ║
╠═══════════════════════════════════════════════════════════════════╣
║  contracts row                                                     ║
║  ┌────────────────────────────────────────────────────────────┐   ║
║  │ is_signed | signed_at | signed_by | signed_ip | ...         │   ║
║  └────────────────────────────────────────────────────────────┘   ║
║         ▲                                                          ║
║         │ single UPDATE, professional signs                        ║
║  ┌─────────────┐                                                   ║
║  │ Professional│──sign──► is_signed=true ──► TRIGGER FIRES ──►     ║
║  └─────────────┘                              row frozen forever   ║
║                                                                     ║
║  DATA_FLOW: one signer → one UPDATE → row immutable immediately.   ║
║  PAIN_POINT: no room for a second, independent signature — the     ║
║  gestante has no column/table to sign into without either reusing  ║
║  the same (now-frozen) columns or bypassing the trigger.           ║
╚═══════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════╗
║                           AFTER STATE                               ║
╠═══════════════════════════════════════════════════════════════════╣
║  contracts row                    contract_signatures (child)      ║
║  ┌─────────────────────────┐      ┌─────────────────────────────┐ ║
║  │ is_signed (legacy, kept)│      │ contract_id | signer_role    │ ║
║  │ fully_signed_at (NEW)   │◄─┐   │ signer_id | signed_at | ip.. │ ║
║  └─────────────────────────┘  │   └─────────────────────────────┘ ║
║                                │            ▲            ▲         ║
║               AFTER INSERT trigger:         │            │         ║
║               lock parent row (FOR NO KEY UPDATE),        │         ║
║               check EXISTS(role='professional')            │         ║
║                 AND EXISTS(role='patient')                 │         ║
║               → if both: UPDATE contracts.fully_signed_at  │         ║
║                                │                            │         ║
║  ┌─────────────┐               │            ┌─────────────┐         ║
║  │ Professional│──INSERT row───┘            │  Gestante   │──INSERT ║
║  │   assina    │  (role=professional)       │   assina    │  row────║
║  └─────────────┘                            │  (Fase 2)   │  (role= ║
║                                              └─────────────┘  patient)║
║                                                                     ║
║  DATA_FLOW: each signer inserts their own row (own hash/IP/UA/     ║
║  timestamp). Parent only freezes once BOTH rows exist.             ║
║  VALUE_ADD: signing order is irrelevant, each signature has its    ║
║  own independent audit trail, and the row stays editable for       ║
║  "solicitar alteração" (Fase 3) until it's genuinely fully signed. ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

Esta fase é puramente de dados/infraestrutura — não há UI nova. A única mudança de comportamento
observável é: contratos assinados **antes** desta migração continuam se comportando exatamente
como hoje (backfill grava `fully_signed_at = signed_at` para eles), e a ação de assinatura da
profissional passa a também gravar uma linha em `contract_signatures` a cada nova assinatura.

| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| `sign-patient-contract-action.ts` (profissional assina) | Só grava colunas de `contracts` | Grava colunas de `contracts` **e** insere linha em `contract_signatures` | Nenhum — comportamento visível idêntico, prepara dado para Fase 2 |
| RLS de `contracts` | Gestante sem nenhum acesso de leitura | Gestante pode ler o próprio contrato (`patients.user_id = auth.uid()`) | Nenhum ainda na UI (Fase 2/5 vão consumir isso) — só a permissão passa a existir |

---

## Mandatory Reading

**CRITICAL: Ler estes arquivos antes de iniciar qualquer task.**

| Priority | File | Lines | Why Read This |
|----------|------|-------|-----------------|
| P0 | `packages/supabase/supabase/migrations/20260706000001_contract_signature.sql` | 1-86 (full file) | Trigger/coluna atual a ser estendido — NÃO reescrever do zero, adicionar em cima |
| P0 | `apps/web/src/actions/sign-patient-contract-action.ts` | 1-174 (full file) | Ação a ser adaptada (task 7) — mirror seu estilo de error handling/compensação |
| P1 | `packages/supabase/supabase/migrations/20260710000003_appointments_patient_rls_and_confirm.sql` | 1-10 (full file) | Padrão exato de RLS "leitura pelo próprio paciente" a copiar |
| P1 | `packages/supabase/supabase/migrations/20260318000003_team_members_unique_constraint_with_backup.sql` | 1-6 (full file) | Padrão de `UNIQUE (parent_id, role)` para tabela filha |
| P1 | `packages/supabase/supabase/migrations/20260807000010_notify_payment_received_trigger.sql` | full file | Estilo mais recente de `SECURITY DEFINER` trigger function (a usar no novo trigger de conclusão) |
| P2 | `packages/supabase/supabase/migrations/20260627000001_contracts.sql` | 1-123 (full file) | RLS completo atual de `contracts` — base para o `DROP POLICY`/`CREATE POLICY` da task 5 |
| P2 | `packages/supabase/src/types/database.types.ts` | 314-424 (região `contracts`) | Confirma o shape atual antes de rodar `pnpm db:types` |

**External Documentation:**

| Source | Section | Why Needed |
|--------|---------|--------------|
| [PostgreSQL 18 Docs — Overview of Trigger Behavior](https://www.postgresql.org/docs/current/trigger-definition.html) | ROW vs STATEMENT, atomicidade transacional | Confirma que o trigger `AFTER INSERT` roda na mesma transação do INSERT — base da segurança do padrão "contar linhas filhas → virar flag no pai" |
| [PostgreSQL 18 Docs — Explicit Locking, 13.3](https://www.postgresql.org/docs/current/explicit-locking.html) | `FOR UPDATE`/`FOR NO KEY UPDATE` | Uso de `SELECT ... FOR NO KEY UPDATE` no trigger de conclusão para serializar duas assinaturas quase-simultâneas do mesmo contrato |
| [PostgreSQL 18 Docs — CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html) | `CONSTRAINT` / `DEFERRABLE` | Confirma que constraint triggers deferíveis são desnecessários aqui — `UNIQUE (contract_id, signer_role)` já resolve o "no máximo 1 por papel" imediatamente |
| [Planalto.gov.br — MP 2.200-2/2001, Art. 10](https://www.planalto.gov.br/ccivil_03/mpv/antigas_2001/2200-2.htm) | Art. 10, §2º | Fonte primária confirmando que assinatura eletrônica não-ICP-Brasil é válida se aceita pelas partes — sustenta a decisão de não exigir certificado qualificado (já registrada no PRD) |

---

## Patterns to Mirror

**MIGRATION_STRUCTURE (single-purpose, timestamp-prefixed):**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260630000001_contracts_add_title.sql
ALTER TABLE public.contracts ADD COLUMN title text NOT NULL DEFAULT '';
```

**COMPOSITE_UNIQUE_PER_ROLE (child table, one row per role):**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260318000003_team_members_unique_constraint_with_backup.sql
ALTER TABLE team_members
  DROP CONSTRAINT team_members_patient_id_professional_type_key;
ALTER TABLE team_members
  ADD CONSTRAINT team_members_patient_id_professional_type_is_backup_key
  UNIQUE (patient_id, professional_type, is_backup);
```

**IMMUTABILITY_TRIGGER (plain, WHEN clause, RAISE EXCEPTION em português):**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260706000001_contract_signature.sql:20-49
CREATE OR REPLACE FUNCTION public.prevent_signed_contract_mutation()
RETURNS trigger AS $$
BEGIN
  IF (OLD.title IS DISTINCT FROM NEW.title)
     -- ... demais colunas ...
     OR (OLD.is_signed IS DISTINCT FROM NEW.is_signed) THEN
    RAISE EXCEPTION 'Contrato assinado é imutável e não pode ser alterado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_signed_contract_update
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW WHEN (OLD.is_signed = true)
  EXECUTE FUNCTION public.prevent_signed_contract_mutation();
```

**SECURITY_DEFINER_TRIGGER (estilo mais recente, para o novo trigger de conclusão):**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260807000010_notify_payment_received_trigger.sql
CREATE OR REPLACE FUNCTION public.notify_payment_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- ...
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_payment_received failed: %', SQLERRM;
END;
$$;
```

**PATIENT_READ_RLS (DROP + CREATE, não ALTER POLICY, quando adiciona novo branch):**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260710000003_appointments_patient_rls_and_confirm.sql
DROP POLICY "View appointments" ON public.appointments;
CREATE POLICY "View appointments" ON public.appointments FOR SELECT USING (
  public.is_team_member(patient_id)
  OR professional_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.patients WHERE patients.id = appointments.patient_id AND patients.user_id = auth.uid())
);
```

**SIGN_ACTION_STRUCTURE (safe-action, compensação em caso de falha):**
```typescript
// SOURCE: apps/web/src/actions/sign-patient-contract-action.ts:132-156
const { error: signError } = await supabase
  .from("contracts")
  .update({ is_signed: true, signed_at, signed_by, signed_ip, signed_user_agent, content_hash, verification_code, signed_document_id })
  .eq("id", contractId);

if (signError) {
  await supabaseAdmin.from("patient_documents").update({ is_immutable: false }).eq("id", uploadedDocument.id);
  await supabaseAdmin.from("patient_documents").delete().eq("id", uploadedDocument.id);
  await supabaseAdmin.storage.from("patient-documents").remove([storagePath]);
  throw new Error("Erro ao assinar contrato. Tente novamente.");
}
```

---

## Files to Change

| File | Action | Justification |
|------|--------|-----------------|
| `packages/supabase/supabase/migrations/<ts1>_contracts_add_fully_signed_at.sql` | CREATE | Nova coluna que representa "ambas as partes assinaram" — desacoplada de `is_signed` |
| `packages/supabase/supabase/migrations/<ts2>_create_contract_signatures_table.sql` | CREATE | Tabela filha + índices + RLS + triggers de imutabilidade da própria linha de assinatura |
| `packages/supabase/supabase/migrations/<ts3>_contract_signatures_completion_trigger.sql` | CREATE | Trigger `AFTER INSERT` que verifica os dois papéis e seta `fully_signed_at`, com lock de linha |
| `packages/supabase/supabase/migrations/<ts4>_contracts_rewrite_immutability_and_patient_rls.sql` | CREATE | Reescreve `prevent_signed_contract_mutation` (união com `fully_signed_at`) + `DROP`/`CREATE POLICY "View contracts"` com branch da gestante |
| `packages/supabase/supabase/migrations/<ts5>_backfill_contract_signatures.sql` | CREATE | Migração de dados: para cada `contracts` com `is_signed = true`, insere linha `role='professional'` em `contract_signatures` e seta `fully_signed_at = signed_at` |
| `apps/web/src/actions/sign-patient-contract-action.ts` | UPDATE | Após a UPDATE final de `contracts`, insere a linha correspondente em `contract_signatures` (role `professional`) |
| `packages/supabase/src/types/database.types.ts` | UPDATE (gerado) | Rodar `pnpm db:types` após aplicar as migrations — não editar manualmente |

---

## NOT Building (Scope Limits)

- Ação de assinatura da gestante (`sign-patient-contract-*-action.ts` para o papel `patient`) — isso é a Fase 2 do PRD, esta fase só prepara o dado/schema.
- UI de qualquer tipo (home da gestante, preview, badges de assinatura) — Fases 5 e 7.
- Fluxo de "solicitar alteração" — Fase 3.
- Renomear/remover as colunas legadas `is_signed`/`signed_*` de `contracts` — mantidas por compatibilidade com os consumidores existentes (`api/check/[codigo]/route.ts`, `whatsapp-queue-handlers.ts`, `patient-contract.tsx`); uma eventual depreciação é decisão de uma fase futura, não desta.
- Bloqueio de `[não informado]` na geração/assinatura — Fase 2 do PRD.

---

## Step-by-Step Tasks

Execute em ordem. Cada task é atômica e validável independentemente.

### Task 1: CREATE `packages/supabase/supabase/migrations/<ts1>_contracts_add_fully_signed_at.sql`

- **ACTION**: Adicionar coluna nova em `contracts`
- **IMPLEMENT**:
  ```sql
  ALTER TABLE public.contracts
    ADD COLUMN fully_signed_at timestamptz;
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260630000001_contracts_add_title.sql` (ALTER TABLE de coluna única)
- **GOTCHA**: Nullable, sem default — só é setada pelo trigger de conclusão (task 3) ou pelo backfill (task 6). Nunca escrita diretamente pela aplicação.
- **VALIDATE**: `pnpm db:push` (aplica a migration ao Supabase local/remoto conforme config do projeto)

### Task 2: CREATE `packages/supabase/supabase/migrations/<ts2>_create_contract_signatures_table.sql`

- **ACTION**: Criar a tabela filha de assinaturas
- **IMPLEMENT**:
  ```sql
  CREATE TABLE public.contract_signatures (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    signer_role text NOT NULL CHECK (signer_role IN ('professional', 'patient')),
    signer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    signed_at timestamptz NOT NULL DEFAULT now(),
    signed_ip text,
    signed_user_agent text,
    verification_code text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT contract_signatures_contract_id_signer_role_key UNIQUE (contract_id, signer_role)
  );

  CREATE INDEX idx_contract_signatures_contract_id ON public.contract_signatures (contract_id);

  ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "View contract signatures" ON public.contract_signatures FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contracts
      WHERE contracts.id = contract_signatures.contract_id
      AND (
        public.is_team_member(contracts.patient_id)
        OR public.is_enterprise_patient(contracts.patient_id)
        OR EXISTS (SELECT 1 FROM public.patients WHERE patients.id = contracts.patient_id AND patients.user_id = auth.uid())
      )
    )
  );

  CREATE POLICY "Insert own contract signature" ON public.contract_signatures FOR INSERT WITH CHECK (
    signer_id = auth.uid()
  );

  -- Nenhuma policy de UPDATE/DELETE: RLS nega por padrão para authenticated/anon.
  -- Trigger abaixo bloqueia mesmo service_role, mesmo padrão de patient_documents.is_immutable.
  CREATE OR REPLACE FUNCTION public.prevent_contract_signature_mutation()
  RETURNS trigger AS $$
  BEGIN
    RAISE EXCEPTION 'Assinatura de contrato é imutável e não pode ser alterada';
    RETURN OLD;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER prevent_contract_signature_update
    BEFORE UPDATE ON public.contract_signatures
    FOR EACH ROW EXECUTE FUNCTION public.prevent_contract_signature_mutation();

  CREATE TRIGGER prevent_contract_signature_delete
    BEFORE DELETE ON public.contract_signatures
    FOR EACH ROW EXECUTE FUNCTION public.prevent_contract_signature_mutation();

  GRANT SELECT, INSERT ON TABLE public.contract_signatures TO authenticated, service_role;
  GRANT SELECT ON TABLE public.contract_signatures TO anon;
  ```
- **MIRROR**: constraint única `packages/supabase/supabase/migrations/20260318000003_team_members_unique_constraint_with_backup.sql`; RLS de leitura via `EXISTS`/`is_team_member` `packages/supabase/supabase/migrations/20260627000001_contracts.sql:39-56`; trigger de imutabilidade `packages/supabase/supabase/migrations/20260706000001_contract_signature.sql:74-85` (`prevent_immutable_document_delete`)
- **IMPORTS**: N/A (SQL puro)
- **GOTCHA**: `signer_role` usa `CHECK` em vez de enum Postgres — mais simples de alterar depois se surgir um terceiro papel; segue o estilo de `CHECK` já usado no projeto em vez de criar um novo `CREATE TYPE`. A policy de INSERT só valida `signer_id = auth.uid()` — a checagem de "esse usuário é de fato o profissional responsável/gestante deste contrato" fica a cargo da server action (Task 7 e Fase 2), igual ao padrão já usado em `sign-patient-contract-action.ts` hoje (RLS + validação em código, defesa em profundidade).
- **VALIDATE**: `pnpm db:push`

### Task 3: CREATE `packages/supabase/supabase/migrations/<ts3>_contract_signatures_completion_trigger.sql`

- **ACTION**: Trigger que verifica os dois papéis e seta `fully_signed_at` no pai
- **IMPLEMENT**:
  ```sql
  CREATE OR REPLACE FUNCTION public.check_contract_fully_signed()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  DECLARE
    v_has_professional boolean;
    v_has_patient boolean;
  BEGIN
    -- Lock da linha pai evita corrida entre duas assinaturas quase-simultâneas
    PERFORM 1 FROM public.contracts WHERE id = NEW.contract_id FOR NO KEY UPDATE;

    SELECT EXISTS (SELECT 1 FROM public.contract_signatures WHERE contract_id = NEW.contract_id AND signer_role = 'professional')
      INTO v_has_professional;
    SELECT EXISTS (SELECT 1 FROM public.contract_signatures WHERE contract_id = NEW.contract_id AND signer_role = 'patient')
      INTO v_has_patient;

    IF v_has_professional AND v_has_patient THEN
      UPDATE public.contracts SET fully_signed_at = now() WHERE id = NEW.contract_id AND fully_signed_at IS NULL;
    END IF;

    RETURN NEW;
  END;
  $$;

  CREATE TRIGGER contract_signatures_check_completion
    AFTER INSERT ON public.contract_signatures
    FOR EACH ROW EXECUTE FUNCTION public.check_contract_fully_signed();
  ```
- **MIRROR**: estilo `SECURITY DEFINER` de `packages/supabase/supabase/migrations/20260807000010_notify_payment_received_trigger.sql`
- **GOTCHA**: `UPDATE ... WHERE fully_signed_at IS NULL` torna a operação idempotente — mesmo se o trigger disparar mais de uma vez (ex.: em teoria futura de mais papéis), não sobrescreve o timestamp da primeira conclusão. O `PERFORM ... FOR NO KEY UPDATE` é essencial: sem ele, duas transações concorrentes inserindo `professional` e `patient` ao mesmo tempo poderiam cada uma enxergar `count = 1` e nenhuma setar `fully_signed_at` (ver pesquisa Postgres — "Explicit Locking" / atomicidade de trigger é por transação, não entre transações concorrentes).
- **VALIDATE**: `pnpm db:push`, depois teste manual via SQL: inserir uma linha `professional` para um contrato de teste, confirmar `fully_signed_at IS NULL`; inserir a linha `patient`, confirmar `fully_signed_at IS NOT NULL`.

### Task 4: CREATE `packages/supabase/supabase/migrations/<ts4>_contracts_rewrite_immutability_and_patient_rls.sql`

- **ACTION**: Reescrever o trigger de imutabilidade de `contracts` (união com `fully_signed_at`) e adicionar RLS de leitura da gestante
- **IMPLEMENT**:
  ```sql
  CREATE OR REPLACE FUNCTION public.prevent_signed_contract_mutation()
  RETURNS trigger AS $$
  BEGIN
    IF (OLD.title IS DISTINCT FROM NEW.title)
       OR (OLD.clauses_html IS DISTINCT FROM NEW.clauses_html)
       OR (OLD.parties_details IS DISTINCT FROM NEW.parties_details)
       OR (OLD.patient_id IS DISTINCT FROM NEW.patient_id)
       OR (OLD.pregnancy_id IS DISTINCT FROM NEW.pregnancy_id)
       OR (OLD.user_id IS DISTINCT FROM NEW.user_id)
       OR (OLD.enterprise_id IS DISTINCT FROM NEW.enterprise_id)
       OR (OLD.is_base_contract IS DISTINCT FROM NEW.is_base_contract)
       OR (OLD.is_signed IS DISTINCT FROM NEW.is_signed)
       OR (OLD.signed_at IS DISTINCT FROM NEW.signed_at)
       OR (OLD.signed_by IS DISTINCT FROM NEW.signed_by)
       OR (OLD.signed_ip IS DISTINCT FROM NEW.signed_ip)
       OR (OLD.signed_user_agent IS DISTINCT FROM NEW.signed_user_agent)
       OR (OLD.content_hash IS DISTINCT FROM NEW.content_hash)
       OR (OLD.verification_code IS DISTINCT FROM NEW.verification_code)
       OR (OLD.signed_document_id IS DISTINCT FROM NEW.signed_document_id)
       OR (OLD.fully_signed_at IS DISTINCT FROM NEW.fully_signed_at)
       OR (OLD.created_at IS DISTINCT FROM NEW.created_at) THEN
      RAISE EXCEPTION 'Contrato assinado é imutável e não pode ser alterado';
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER prevent_signed_contract_update ON public.contracts;
  CREATE TRIGGER prevent_signed_contract_update
    BEFORE UPDATE ON public.contracts
    FOR EACH ROW WHEN (OLD.is_signed = true OR OLD.fully_signed_at IS NOT NULL)
    EXECUTE FUNCTION public.prevent_signed_contract_mutation();

  DROP POLICY "View contracts" ON public.contracts;
  CREATE POLICY "View contracts" ON public.contracts FOR SELECT USING (
    (is_base_contract = true AND user_id = auth.uid())
    OR (is_base_contract = true AND enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid() AND enterprise_id IS NOT NULL
    ))
    OR (patient_id IS NOT NULL AND (
      public.is_team_member(patient_id)
      OR public.is_enterprise_patient(patient_id)
      OR EXISTS (SELECT 1 FROM public.patients WHERE patients.id = contracts.patient_id AND patients.user_id = auth.uid())
    ))
  );
  ```
- **MIRROR**: `DROP POLICY` + `CREATE POLICY` de `packages/supabase/supabase/migrations/20260710000003_appointments_patient_rls_and_confirm.sql`
- **GOTCHA**: A condição do `WHEN` do trigger vira `OLD.is_signed = true OR OLD.fully_signed_at IS NOT NULL` — estritamente uma união com a condição atual (`OLD.is_signed = true`), então nenhum contrato hoje travado deixa de travar. Contratos futuros com `is_signed = true` (só profissional assinou) e `fully_signed_at IS NULL` continuam travados também pela condição antiga — isso é **intencional nesta fase** (preserva 100% o comportamento atual); a Fase 3 (solicitar alteração) é quem vai decidir se esse estado intermediário precisa ficar mutável, não é escopo desta fase.
- **VALIDATE**: `pnpm db:push`

### Task 5: CREATE `packages/supabase/supabase/migrations/<ts5>_backfill_contract_signatures.sql`

- **ACTION**: Migrar dados existentes para a tabela nova, preservando o estado atual
- **IMPLEMENT**:
  ```sql
  INSERT INTO public.contract_signatures (contract_id, signer_role, signer_id, signed_at, signed_ip, signed_user_agent, verification_code)
  SELECT id, 'professional', signed_by, signed_at, signed_ip, signed_user_agent, verification_code
  FROM public.contracts
  WHERE is_signed = true AND signed_by IS NOT NULL
  ON CONFLICT (contract_id, signer_role) DO NOTHING;

  UPDATE public.contracts
  SET fully_signed_at = signed_at
  WHERE is_signed = true AND fully_signed_at IS NULL;
  ```
- **GOTCHA**: Roda DEPOIS que a tabela/trigger de conclusão já existem (tasks 2-3) — mas como esse INSERT em massa dispara o trigger `AFTER INSERT` por linha, e o trigger só seta `fully_signed_at` quando os DOIS papéis existirem (o que nunca é o caso aqui, já que só inserimos `professional`), o `UPDATE` explícito logo depois é necessário para igualar o estado histórico (contratos hoje assinados = "totalmente assinados" no mundo antigo, onde só havia um signatário). `signed_by IS NOT NULL` evita violar o `NOT NULL` de `signer_id` em linhas antigas corrompidas/parciais, se existirem — checar manualmente antes de aplicar em produção se `count(*) FROM contracts WHERE is_signed = true AND signed_by IS NULL` for maior que zero.
- **VALIDATE**: Após `pnpm db:push`, rodar via Supabase MCP ou SQL client: `SELECT count(*) FROM contracts WHERE is_signed = true AND fully_signed_at IS NULL;` deve retornar `0`. `SELECT count(*) FROM contract_signatures WHERE signer_role = 'professional';` deve bater com `SELECT count(*) FROM contracts WHERE is_signed = true AND signed_by IS NOT NULL;`.

### Task 6: UPDATE `packages/supabase/src/types/database.types.ts` (regenerar, não editar à mão)

- **ACTION**: Regenerar tipos gerados após as 5 migrations acima
- **IMPLEMENT**: N/A — comando, não código manual
- **VALIDATE**: `pnpm db:types` (conforme `CLAUDE.md`: "After writing migrations, always run `pnpm db:types`"), depois `pnpm check-types` para confirmar que nada quebrou nos consumidores existentes de `Tables<"contracts">`

### Task 7: UPDATE `apps/web/src/actions/sign-patient-contract-action.ts`

- **ACTION**: Após a UPDATE final de `contracts` (linhas 132-144 do arquivo atual), inserir a linha correspondente em `contract_signatures`
- **IMPLEMENT**: Logo após o bloco de sucesso da UPDATE (antes do `revalidatePath`/WhatsApp/PostHog em torno da linha 158), adicionar:
  ```typescript
  const { error: signatureInsertError } = await supabase.from("contract_signatures").insert({
    contract_id: contractId,
    signer_role: "professional",
    signer_id: user.id,
    signed_at: signedAt,
    signed_ip: signedIp,
    signed_user_agent: signedUserAgent,
    verification_code: verificationCode,
  });

  if (signatureInsertError) {
    console.error("[signPatientContractAction] failed to record contract_signatures row", signatureInsertError);
  }
  ```
- **MIRROR**: estilo de log não-bloqueante já usado para o envio de WhatsApp na mesma função (`apps/web/src/actions/sign-patient-contract-action.ts:158-164` — erro logado via `console.error`, não interrompe o fluxo)
- **GOTCHA**: **Decisão deliberada de não tratar essa falha como fatal** (não entra no bloco de compensação que já existe para a UPDATE de `contracts`) — o contrato já está assinado e o PDF já foi gerado/upload feito nesse ponto; falhar a ação inteira por causa da tabela de auditoria adicional geraria uma experiência pior (usuária vê erro genérico apesar da assinatura ter sido bem-sucedida) do que simplesmente logar e permitir investigação manual. Reavaliar esse trade-off quando a Fase 3/6 (revogação) passar a depender criticamente de `contract_signatures` estar sempre populada.
- **VALIDATE**: `pnpm check-types`, depois teste manual: assinar um contrato de teste como profissional pela UI existente, confirmar via SQL que apareceu uma linha em `contract_signatures` com `signer_role = 'professional'` e os mesmos `signed_at`/`signed_ip`/`signed_user_agent`/`verification_code` da linha de `contracts`.

### Task 8: Validação end-to-end da Fase 1

- **ACTION**: Confirmar que nada regrediu no fluxo de assinatura da profissional já em produção
- **IMPLEMENT**: N/A — checklist manual
- **VALIDATE**:
  1. Assinar um novo contrato de teste como profissional (UI existente) → sucesso, PDF gerado, `is_signed = true`, `fully_signed_at` continua `NULL` (só um papel assinou) — **diferença intencional vs. hoje**: antes desta fase, qualquer UPDATE nesse contrato seria bloqueada porque `is_signed = true`; confirmar que ainda é bloqueada (a condição `WHEN` mantém `OLD.is_signed = true` como gatilho).
  2. Tentar um `UPDATE clauses_html` direto via SQL nesse contrato → deve continuar lançando `'Contrato assinado é imutável e não pode ser alterado'`.
  3. Tentar `INSERT` duas linhas `contract_signatures` com o mesmo `(contract_id, signer_role)` → deve violar a constraint única.
  4. Tentar `UPDATE`/`DELETE` em uma linha de `contract_signatures` já existente (via `service_role`, simulando bypass de RLS) → deve lançar `'Assinatura de contrato é imutável e não pode ser alterada'`.
  5. Logar como uma gestante de teste (`patients.user_id = auth.uid()`) e confirmar via SQL/Supabase client que agora consegue `SELECT` o próprio `contracts` (antes desta fase, retornava vazio).

---

## Testing Strategy

Não há suíte de testes automatizados de integração de banco identificada no repositório para
migrations — a validação desta fase é primariamente SQL manual (via Supabase MCP ou SQL client) e
`pnpm check-types`, seguindo o padrão observado nas migrations anteriores do projeto (nenhuma tem
teste automatizado dedicado).

### Edge Cases Checklist

- [ ] Duas assinaturas quase-simultâneas (professional e patient) para o mesmo `contract_id` — confirmar que `fully_signed_at` é setado exatamente uma vez (lock `FOR NO KEY UPDATE` no trigger de conclusão)
- [ ] Tentativa de inserir `contract_signatures` com `signer_role` fora de `('professional', 'patient')` — deve violar o `CHECK`
- [ ] Contrato com `is_signed = true` mas `signed_by IS NULL` (dado histórico corrompido, se existir) — não deve quebrar o backfill (task 5 filtra `signed_by IS NOT NULL`)
- [ ] `UPDATE` de `is_active`/`updated_at` em um contrato com `fully_signed_at IS NOT NULL` — deve continuar permitido (essas colunas não entram na lista do `IF` do trigger de imutabilidade, mantendo o comportamento de soft-delete já usado por `deactivate-patient-contract-action.ts`)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```

**EXPECT**: Exit 0, sem erros de tipo (principalmente em `sign-patient-contract-action.ts` e qualquer arquivo que use `Tables<"contracts">`/`Tables<"contract_signatures">`)

### Level 2: DATABASE_MIGRATION

```bash
pnpm db:push
pnpm db:types
```

**EXPECT**: Migrations aplicadas sem erro; `database.types.ts` atualizado incluindo `contract_signatures` e `contracts.fully_signed_at`

### Level 3: DATABASE_VALIDATION (via Supabase MCP ou SQL client)

- [ ] Tabela `contract_signatures` existe com as colunas/constraint/RLS esperadas
- [ ] `contracts.fully_signed_at` existe, nullable
- [ ] Trigger `contract_signatures_check_completion` existe e é `AFTER INSERT`
- [ ] Trigger `prevent_signed_contract_update` foi recriado com o novo `WHEN`
- [ ] Policy `"View contracts"` inclui o branch `patients.user_id = auth.uid()`
- [ ] Backfill: `SELECT count(*) FROM contracts WHERE is_signed = true AND fully_signed_at IS NULL` = `0`

### Level 4: MANUAL_VALIDATION

Checklist da Task 8, executado manualmente contra o ambiente de desenvolvimento/staging do
Supabase antes de considerar a fase concluída.

---

## Acceptance Criteria

- [ ] `contract_signatures` criada com `UNIQUE (contract_id, signer_role)`, RLS, e triggers de imutabilidade própria
- [ ] `contracts.fully_signed_at` existe e só é setada quando ambos os papéis assinam
- [ ] Trigger de imutabilidade de `contracts` reescrito sem regredir o comportamento atual (união, não substituição)
- [ ] Gestante ganha RLS de leitura no próprio contrato
- [ ] Assinatura da profissional (fluxo já em produção) continua funcionando idêntico ao usuário final, e agora também popula `contract_signatures`
- [ ] Backfill executado e validado (nenhum contrato já assinado ficou com `fully_signed_at IS NULL`)
- [ ] `pnpm check-types` e `pnpm db:types` passam sem erro

---

## Completion Checklist

- [ ] Tasks 1-8 executadas em ordem
- [ ] Level 1: `pnpm check-types` passa
- [ ] Level 2: migrations aplicadas + tipos regenerados
- [ ] Level 3: validação de schema/trigger/RLS via Supabase MCP
- [ ] Level 4: checklist manual da Task 8 concluído
- [ ] Todos os Acceptance Criteria atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|--------------|
| Reescrever o trigger de imutabilidade quebra o fluxo de assinatura da profissional já em produção | M | HIGH | Condição do `WHEN` é uma união estrita (`OLD.is_signed = true OR ...`) — nunca remove a trava existente, só adiciona uma nova. Validar com Task 8 antes de mergear. |
| Corrida entre duas assinaturas quase-simultâneas deixa `fully_signed_at` nunca setado | L | MED | `SELECT ... FOR NO KEY UPDATE` no trigger de conclusão serializa as duas transações no mesmo `contract_id` (ver pesquisa Postgres — Explicit Locking) |
| Backfill falha silenciosamente para contratos com dado histórico incompleto (`signed_by IS NULL`) | L | LOW | Filtro explícito `signed_by IS NOT NULL` no INSERT; checagem manual recomendada antes de rodar em produção (contar quantos contratos caem nesse caso) |
| `contract_signatures` insert na Task 7 falha e ninguém percebe (log apenas, não fatal) | M | LOW | Decisão deliberada documentada na Task 7 — reavaliar quando Fase 3/6 passarem a depender criticamente dessa tabela sempre estar populada |

---

## Notes

Esta fase é a única, das 7 planejadas no PRD, que mexe em um trigger de imutabilidade já protegendo
dados em produção — por isso o desenho aqui prioriza união/aditividade sobre qualquer reescrita
destrutiva. As Fases 2 e 3 do PRD podem começar em paralelo assim que esta fase estiver completa e
validada (Task 8), pois ambas dependem apenas do schema aqui criado, não uma da outra.

---

*Generated: 2026-08-14*
