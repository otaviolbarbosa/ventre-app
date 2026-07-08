# Objetivo:

Implementar assinatura eletrônica para os contratos de gestante (feature descrita em
`011-contract.md`), com consentimento explícito, selo de autenticidade no PDF, hash
criptográfico do documento, imutabilidade após assinado e uma página pública de
verificação de autenticidade.

## O que implementar?

- Hoje o botão "Gerar e assinar" (em `apps/web/src/components/shared/patient-contract.tsx`)
  apenas salva um rascunho do contrato (`savePatientContractAction`). Não há consentimento,
  selo, hash nem forma de verificar a autenticidade de um PDF gerado. O contrato também
  pode ser editado livremente depois de "assinado".
- Ao clicar em "Gerar e assinar", deve subir um modal de consentimento explicando o efeito
  legal da assinatura eletrônica (ver seção "Base legal" abaixo) antes de qualquer coisa
  ser salva/assinada. Só depois de confirmar o consentimento (checkbox obrigatório) a
  assinatura é efetivada.
- Ao dar consentimento:
  - Um selo de autenticidade deve ser adicionado ao PDF final, usando como base a imagem
    `apps/web/src/assets/digital-signature-stamp.png` (composição: nome da empresa ou
    profissional CONTRATADA, data e hora da assinatura, e link de verificação de
    autenticidade — layout de referência anexado ao pedido original).
  - Uma hash criptográfica (SHA-256) do PDF final deve ser calculada e salva na tabela
    `contracts`.
  - Um código alfanumérico único de 10 dígitos deve ser gerado e salvo na tabela
    `contracts`, usado para montar o link de verificação (`/check/<codigo>`).
- **Imutabilidade**: depois de assinado, nem o conteúdo do contrato (`title`,
  `clauses_html`, `parties_details`) nem o PDF armazenado podem ser alterados. Isso deve
  ser garantido tanto na aplicação quanto no banco (trigger), não só por convenção da UI.
  - Soft-delete (`is_active = false`, botão "Excluir contrato") continua permitido após
    assinado, pois não altera o conteúdo assinado nem o hash — só some da tela.
- **Página pública de verificação** em `/check/[codigo]`:
  - Pública, sem necessidade de login.
  - Não mostra nenhum dado do contrato antecipadamente. O visitante precisa enviar
    (upload) o arquivo PDF que possui.
  - O servidor recalcula o SHA-256 do arquivo enviado e compara com o `content_hash`
    salvo para aquele código.
  - Se bater: mostrar mensagem de sucesso com ícone de confirmação (ex.: nome da
    contratada e data/hora da assinatura).
  - Se não bater (ou código não existir): mostrar mensagem de erro com ícone de falha
    ("documento não corresponde a nenhum registro autêntico").

## Banco de dados

Nova migration em `packages/supabase/supabase/migrations/`.

**`contracts`** — novas colunas (relevantes apenas quando `is_base_contract = false`):
- `is_signed boolean NOT NULL DEFAULT false`
- `signed_at timestamptz`
- `signed_by uuid REFERENCES users(id)`
- `content_hash text` — SHA-256 hex do PDF final
- `verification_code text` — 10 caracteres alfanuméricos (alfabeto sem caracteres
  ambíguos: sem `0/O/1/I`)
- `signed_document_id uuid REFERENCES patient_documents(id)`
- Índice único parcial em `verification_code` (`WHERE verification_code IS NOT NULL`)
- Trigger `prevent_signed_contract_mutation` (BEFORE UPDATE): quando `OLD.is_signed = true`,
  bloqueia qualquer alteração em `title`, `clauses_html`, `parties_details`,
  `content_hash`, `verification_code`, `signed_at`, `signed_by`, `signed_document_id`, e
  impede que `is_signed` volte para `false`. Só permite mudar `is_active`/`updated_at`
  (necessário para o soft-delete continuar funcionando).

**`patient_documents`** — nova coluna:
- `is_immutable boolean NOT NULL DEFAULT false`
- Atualizar a policy `"Delete own documents"` para
  `USING (uploaded_by = auth.uid() AND is_immutable IS NOT TRUE)`, e a rota
  `app/api/patients/[id]/documents/[documentId]/route.ts` deve responder com erro claro
  (em vez de falha silenciosa) ao tentar excluir um documento imutável.

Rodar `pnpm db:push` e `pnpm db:types` depois da migration (regra do `CLAUDE.md`).

## Fluxo de assinatura

1. Usuário clica em "Gerar e assinar" → abre modal de consentimento (reusar
   `ContentModal` de `@ventre/ui/shared/content-modal`, mesmo padrão do modal de exclusão
   já existente em `patient-contract.tsx`). Conteúdo: identificação de quem vai assinar
   (usuário logado), texto sobre o efeito legal e a imutabilidade, checkbox
   ("Li e concordo em assinar eletronicamente este documento") obrigatório para habilitar
   o botão de confirmação.
2. Ao confirmar, uma nova server action (`signPatientContractAction`) deve:
   - Rejeitar se o contrato já estiver `is_signed = true` (defesa em profundidade).
   - Montar `parties_details` (mesma lógica hoje em `save-patient-contract-action.ts`,
     extrair para um helper compartilhado para reaproveitar também na busca do nome
     "curto" da contratada, usado no selo).
   - Salvar o rascunho atual (`title`, `clauses_html`, `parties_details`).
   - Gerar o `verification_code` (com retry em caso de colisão de unicidade).
   - Renderizar o PDF final (reaproveitando `contract-pdf-document.tsx` /
     `@react-pdf/renderer`, hoje usado em
     `app/api/patients/[id]/contract/pdf/route.ts`), incluindo o selo de autenticidade.
   - Calcular o SHA-256 do PDF gerado.
   - Fazer upload do PDF no bucket `patient_documents` (mesmo padrão da rota de PDF
     existente) e inserir em `patient_documents` com `is_immutable: true`.
   - Atualizar `contracts` com `is_signed`, `signed_at`, `signed_by`, `content_hash`,
     `verification_code`, `signed_document_id`.
3. Depois de assinado:
   - A UI deve ocultar "Editar contrato" e exibir o selo/õinformações de assinatura no
     preview em tela (mesma composição visual do PDF: imagem do selo com nome, data/hora
     e link de verificação sobrepostos).
   - O botão "Baixar contrato" deve reutilizar o PDF já assinado (via
     `signed_document_id`) em vez de gerar um novo a cada clique — preservando a
     imutabilidade e evitando duplicar `patient_documents`.

## Selo de autenticidade

- Base: `apps/web/src/assets/digital-signature-stamp.png` (541×195px).
- Composição (no PDF, via `react-pdf`, e replicada em CSS no preview da tela): imagem de
  fundo + texto sobreposto com nome da empresa/profissional CONTRATADA, "Assinatura
  eletrônica", "Data: dd/mm/aaaa às HH:mm:ss" e "Verificar em: <verifyUrl>", seguindo o
  layout de referência anexado ao pedido original.
- `verifyUrl` = `${NEXT_PUBLIC_APP_URL}/check/${verification_code}`.

## Base legal (art. 4º da Lei 14.063/2020)

O art. 4º classifica assinaturas eletrônicas em simples, avançada e qualificada. O fluxo
aqui (usuário autenticado + consentimento explícito + hash vinculado ao documento +
verificação pública que detecta alteração) se aproxima de uma assinatura eletrônica
avançada — não há certificado ICP-Brasil (isso seria "qualificada", fora de escopo deste
pedido). Os elementos que sustentam essa classificação:
- Identificação do signatário: ação vinculada ao usuário autenticado (`signed_by`).
- Vínculo inequívoco ao documento: hash SHA-256 do PDF final.
- Detecção de alteração posterior: a verificação em `/check/[codigo]` recalcula o hash do
  arquivo enviado e compara com o valor salvo — qualquer alteração no arquivo (mesmo 1
  byte) invalida a verificação.
- Consentimento explícito e registrado: modal com checkbox antes da assinatura, com
  `signed_at` registrado.

## Requisitos não funcionais

- Reaproveitar padrões já existentes no projeto em vez de criar novos: `ContentModal`,
  `authActionClient`/`next-safe-action`, `createServerSupabaseAdmin` para operações que
  precisam bypassar RLS (ex.: a rota pública de verificação), e o pipeline de geração de
  PDF (`@react-pdf/renderer`) já usado em `contract-pdf-document.tsx`.
- Extrair helpers compartilhados para evitar duplicação entre `save-patient-contract-action.ts`,
  a nova `sign-patient-contract-action.ts` e a rota de PDF existente (montagem de
  `parties_details` e renderização do PDF).
- Todas as strings voltadas ao usuário em pt-BR, seguindo convenção do projeto
  (`CLAUDE.md`).
- A rota `/check/[codigo]` deve ficar fora dos grupos `(dashboard)`/`(auth)` (mesmo padrão
  de rotas públicas já existentes, como `app/register-confirmation` e `app/paywall`).
