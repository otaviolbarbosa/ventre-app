# Editor de texto rico baseado em modelos (`templated-rich-editor`)

## Motivação

Este é o primeiro passo de uma iniciativa maior — prescrições e documentos
do prontuário da gestante (receitas, solicitações de exame/cirurgia,
laudos, atestados, declarações, relatórios). Pesquisa de compliance prévia
mostrou que receitas de medicamento exigem assinatura ICP-Brasil (via
integração com provedor certificado, ex. Memed) e ficam fora deste
trabalho; os demais tipos de documento podem usar um selo de autenticação
próprio + rota de verificação pública, seguindo o mesmo padrão já usado
por `contracts` (`verification_code` + hash, rota `/check/[codigo]`).

Este documento cobre só a peça de infraestrutura comum a todos esses
documentos: um editor de texto rico onde a profissional monta o
documento a partir de **blocos de conteúdo reutilizáveis (modelos)** —
cada bloco pode ser inserido a partir de uma lista de modelos salvos,
editado livremente, reordenado por drag-and-drop, e salvo de volta como
modelo (sobrescrevendo o atual ou criando um novo). As telas de cada tipo
de documento (e a tabela que persiste o documento final) ficam para specs
futuras — ver "Fora de escopo".

O requisito original de que "o documento deve ser salvo de forma que os
blocos possam ser recuperados/editados depois" é resolvido no nível do
editor, não da tabela de documentos: `onChange` entrega o JSON do
ProseMirror (não HTML), que preserva `templateId`/`category`/`label` de
cada bloco com precisão. Qualquer consumidor futuro (a tabela
`documents`) só precisa persistir esse JSON como veio — a
recuperabilidade dos blocos já está garantida por este componente.

## Estado atual relevante

- `packages/ui/src/shared/rich-editor/rich-editor.tsx` é o único editor
  rico existente hoje: Tiptap v3 (`@tiptap/react`, `@tiptap/starter-kit`,
  `@tiptap/extension-text-align`, `@tiptap/extension-text-style`,
  `@tiptap/pm`, todos `^3.0.0` — ver `packages/ui/package.json:39-43`),
  sem nenhuma extensão de drag-handle instalada. Armazena conteúdo como
  **string HTML** (`editor.getHTML()`/`setContent(html)`), usado hoje só
  para as cláusulas de contrato.
- **Precedente de "modelos" já existe, mas para contratos**: não há uma
  tabela `templates` dedicada — um "modelo de contrato" é uma linha de
  `contracts` com `is_base_contract=true`, `patient_id`/`pregnancy_id`
  nulos, conteúdo em `clauses_html` (HTML string), owner em `user_id`,
  escopo pessoal vs. empresa em `enterprise_id` (`null` = pessoal).
  Ver `personal-contract-settings-screen.tsx` e
  `apps/web/src/actions/save-personal-contract-action.ts`.
- **O fluxo "sobrescrever vs. criar novo" já está resolvido** para
  contratos e deve ser espelhado aqui, não reinventado:
  `apps/web/src/components/shared/save-contract-choice-modal.tsx`
  (dois botões: "Salvar no modelo atual" / "Criar novo modelo", sobre
  `ContentModal`) seguido de
  `apps/web/src/components/shared/save-new-template-modal.tsx` (campo de
  nome, sobre `ContentModal` também) quando "criar novo" é escolhido.
  Orquestração em `personal-contract-settings-screen.tsx:284-320`: se
  `contractId` está presente a action faz `update`, senão `insert`
  (`save-personal-contract-action.ts:16-41`). Nenhum dos dois componentes
  tem texto genérico o bastante para reuso direto (fala "modelo de
  contrato"), mas a estrutura é exatamente o que precisamos — vamos criar
  análogos com a copy certa, não reaproveitar os arquivos de contrato.
- `packages/ui/src/shared/content-modal/content-modal.tsx` (shell
  genérico Dialog/Sheet, usado pelos dois componentes acima) e
  `packages/ui/src/shared/confirm-modal/confirm-modal.tsx` (confirmação
  binária) são os dois primitivos de modal disponíveis — confirmado com
  o usuário: `ContentModal` para o fluxo de 3 saídas (sobrescrever/criar
  novo/cancelar), `ConfirmModal` para a remoção de bloco (binário).
- Identidade: não existe tabela `professionals` separada —
  `public.users.id = auth.uid()` (`is_team_member`,
  `20260126012100_remote_schema.sql:98-107`). Enums relevantes no mesmo
  arquivo: `professional_type` = `obstetra | enfermeiro | doula | fisio`;
  `user_type` = `professional | patient | manager | secretary | admin`.
- Ação server-side de referência (`next-safe-action`):
  `apps/web/src/actions/get-patient-documents-action.ts` — padrão
  `authActionClient.inputSchema(schema).action(async ({ parsedInput, ctx: { supabase, user } }) => {...})`,
  erros do Supabase viram `throw new Error(error.message)` (sem
  `returnValidationErrors`). `authActionClient` definido em
  `apps/web/src/lib/safe-action.ts:14-42`.
- Migrations seguem `YYYYMMDDHHMMSS_descricao.sql`; nenhum arquivo com
  prefixo `20260915` existe ainda (`packages/supabase/supabase/migrations/`,
  mais recente hoje: `20260912000000_stripe_payment_link_add_days_off.sql`).

## Decisões de escopo (definidas no brainstorm)

- **Sem `<script>` para delimitar blocos.** `<script>` tem *content
  model* de raw-text no parser HTML — filhos como `<p>`/`<span>` dentro
  dele não viram elementos DOM de verdade, e o elemento é
  `display:none` e não-focável independente disso. O bloco vira
  invisível e não-editável, o oposto do que a imagem de referência
  mostra. Usamos um Node Tiptap customizado renderizado como
  `<div data-type="template-block">` — satisfaz os mesmos 3 requisitos
  originais (sem interferência no `contenteditable`, sem efeito visual
  por padrão fora do editor, fácil de remover antes do PDF) sem o
  problema técnico.
- **Chrome do bloco via NodeView React, não via listener pós-carga.** Um
  listener que injeta DOM depois do `setContent` não sobrevive ao ciclo
  de vida do ProseMirror: a cada transação (undo/redo, digitação, paste)
  o ProseMirror resincroniza o DOM com seu modelo interno e descarta
  nós que não gerencia — ainda mais frágil aqui porque o `RichEditor`
  já roda com `shouldRerenderOnTransaction: true`. Um NodeView
  (`ReactNodeViewRenderer`) é a unidade que o Tiptap espera: monta/
  desmonta automaticamente e sobrevive a undo/redo e paste.
- **Drag-and-drop sem dependência nova.** O Tiptap já suporta isso
  nativamente: um node com `draggable: true` cujo NodeView contém um
  elemento marcado com o atributo `data-drag-handle` usa esse elemento
  (não o bloco inteiro) como alça de arraste. Isso cobre exatamente o
  ícone de grip mostrado na imagem, sem precisar adicionar
  `@tiptap/extension-drag-handle-react` (que resolve um problema
  diferente — handle flutuante estilo Notion que segue qualquer nó sob o
  mouse). *(Correção em relação ao que eu disse antes no brainstorm —
  não precisamos dessa dependência.)*
- **Conteúdo armazenado como JSON do ProseMirror, não HTML** — desvio
  proposital do padrão usado em `RichEditor`/`contracts.clauses_html`.
  Os atributos estruturados do bloco (`templateId`, `category`, etc.)
  são frágeis em round-trip de HTML via `contenteditable` (navegadores
  podem normalizar/perder atributos custom); como JSON, sobrevivem
  exatamente. A conversão para HTML/PDF acontece por uma transformação
  sobre essa árvore JSON, não por string.
- **Sem nesting de `templateBlock` dentro de si mesmo.** O `content`
  do node usa um grupo específico (parágrafo, heading, listas) que
  exclui `templateBlock`, para não complicar a lógica de "desembrulhar"
  na geração do PDF nem a UI de drag/salvar/remover com blocos
  aninhados.
- **Modelos `scope='global'` são somente leitura para profissionais.**
  Só `apps/admin` (client admin, bypass de RLS) escreve nessas linhas —
  mesmo padrão hoje usado para planos/links de pagamento. Se o bloco
  atual referencia um modelo global, a opção "Sobrescrever" fica
  indisponível no fluxo de salvar — só "Criar novo modelo" (que sempre
  cria `scope='personal'`).
- **Tabela `document_templates` nova**, não reaproveitar `contracts`
  como foi feito para modelos de contrato — ali "modelo" e "documento
  final" são a mesma tabela por conveniência histórica; aqui, como
  vários tipos de documento vão compartilhar a mesma tabela de modelos,
  criar uma tabela dedicada evita colunas irrelevantes (`patient_id`,
  colunas de assinatura, etc.) vazando pro conceito de modelo.

## Design

### Banco de dados

Nova migration `packages/supabase/supabase/migrations/20260915000000_document_templates.sql`:

```sql
create type public.document_template_category as enum (
  'prescricao',
  'exame',
  'cirurgia',
  'laudo',
  'atestado',
  'declaracao',
  'relatorio'
);

create table public.document_templates (
  id uuid primary key default extensions.uuid_generate_v4(),
  owner_id uuid references public.users(id) on delete cascade,
  scope text not null default 'personal' check (scope in ('personal', 'global')),
  category public.document_template_category not null,
  title text not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_templates_owner_scope_check check (
    (scope = 'personal' and owner_id is not null)
    or (scope = 'global' and owner_id is null)
  )
);

create index idx_document_templates_owner on public.document_templates (owner_id);
create index idx_document_templates_category on public.document_templates (category);

alter table public.document_templates enable row level security;

create policy "Users can view own and global templates"
  on public.document_templates for select
  using (scope = 'global' or owner_id = auth.uid());

create policy "Users can insert own personal templates"
  on public.document_templates for insert
  with check (scope = 'personal' and owner_id = auth.uid());

create policy "Users can update own personal templates"
  on public.document_templates for update
  using (scope = 'personal' and owner_id = auth.uid())
  with check (scope = 'personal' and owner_id = auth.uid());

create policy "Users can delete own personal templates"
  on public.document_templates for delete
  using (scope = 'personal' and owner_id = auth.uid());

create trigger set_updated_at
  before update on public.document_templates
  for each row execute function public.handle_updated_at();
```

Nenhuma policy de INSERT/UPDATE/DELETE cobre `scope='global'` — essas
linhas só são graváveis via `supabaseAdmin` (service role) em
`apps/admin`, que fica fora de escopo desta tarefa (ver "Fora de
escopo"). `handle_updated_at()` já existe
(`20260126012100_remote_schema.sql:88-96`) e é reaproveitado.

Após aplicar: `pnpm db:push` (ou `db:types` sozinho em ambiente local)
seguido de `pnpm db:types` para regenerar
`packages/supabase/src/types/database.types.ts`.

### Componente do editor

Novo diretório `packages/ui/src/shared/templated-rich-editor/`:

- **`templated-rich-editor.tsx`** — componente principal. Props:
  `content: JSONContent`, `onChange: (json: JSONContent) => void`,
  `category: DocumentTemplateCategory`, `disabled?`, `className?`.
  Reaproveita a mesma toolbar (fonte/tamanho/negrito/alinhamento) do
  `RichEditor` — decisão de duplicar vs. extrair um subcomponente
  compartilhado fica para quando houver um segundo consumidor real (ver
  "Fora de escopo"). Extensões: `StarterKit`, `TextStyleKit`,
  `TextAlign` (mesma config do `RichEditor`) + o novo `TemplateBlock`.
  Renderiza a lista de modelos disponíveis (`ModelosSidebar`, busca via
  `list-document-templates-action` filtrado por `category`) ao lado do
  `EditorContent`, com botão "+" por item que insere o modelo na posição
  do cursor (ou no fim, se não houver seleção de bloco ativa).
- **`template-block-node.ts`** — definição do Node Tiptap:

  ```ts
  export const TemplateBlock = Node.create({
    name: "templateBlock",
    group: "block",
    content: "templateBlockContent+", // exclui templateBlock — sem nesting
    draggable: true,
    isolating: true, // backspace/merge não atravessa o limite do bloco
    addAttributes() {
      return {
        templateId: { default: null },
        templateScope: { default: null }, // 'personal' | 'global' | null
        label: { default: null },
      };
    },
    parseHTML() {
      return [{ tag: 'div[data-type="template-block"]' }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["div", mergeAttributes(HTMLAttributes, { "data-type": "template-block" }), 0];
    },
    addNodeView() {
      return ReactNodeViewRenderer(TemplateBlockView);
    },
  });
  ```

  O grupo `templateBlockContent` precisa ser adicionado explicitamente a
  cada node do `StarterKit` que deve poder aparecer dentro do bloco
  (`Paragraph.extend({ addOptions: ... group: "block templateBlockContent" })`,
  idem para `Heading`/`BulletList`/`OrderedList`) — o Tiptap não deixa
  restringir `content` a um grupo novo sem que os nodes-alvo declarem
  esse grupo. **Risco técnico a validar cedo na implementação**: se
  `extend()` desses nodes built-in não se comportar como esperado (ex.
  nested lists, ou conflito com o `templateBlock` sendo `group: "block"`
  simultaneamente elegível para o grupo `block` do doc raiz), a
  alternativa é validar o "sem nesting" via `NodeView` (rejeitar drop de
  `templateBlock` dentro de outro) em vez de via schema — mais simples
  de implementar, ainda que menos declarativo.

- **`template-block-view.tsx`** — NodeView React
  (`NodeViewWrapper`/`NodeViewContent`). Chrome (borda, header com
  label, ícone de drag com `data-drag-handle`, ícone salvar, ícone
  remover) só renderiza quando `editor.isEditable`; fora disso o wrapper
  não aplica nenhuma classe visual — o `<div data-type="template-block">`
  fica "invisível" estruturalmente, pronto pra ser removido no unwrap do
  PDF sem deixar rastro.
- **`save-block-choice-modal.tsx`** — análogo ao
  `SaveContractChoiceModal`: título "Salvar modelo", descrição "Deseja
  sobrescrever o modelo atual ou criar um novo?", botões "Sobrescrever
  modelo atual" / "Criar novo modelo". Some o botão de sobrescrever
  quando `templateScope === 'global'`.
- **`save-block-template-modal.tsx`** — análogo ao
  `SaveNewTemplateModal`: campo de nome + botões Cancelar/Salvar.

Fluxo de inserção de bloco vazio: botão "+" entre blocos insere um
`templateBlock` com `templateId: null`, `content` = um parágrafo vazio,
posicionado exatamente ali (`editor.chain().insertContentAt(pos, {...}).run()`).

### Ações do servidor

`apps/web/src/actions/`, todas `authActionClient`, seguindo o padrão de
`get-patient-documents-action.ts`:

- **`list-document-templates-action.ts`** — input `{ category }`; query
  `document_templates` com `.or("scope.eq.global,owner_id.eq." + user.id)`
  filtrado por `category`, ordenado por `scope` (pessoal primeiro) então
  `title`.
- **`create-document-template-action.ts`** — input
  `{ category, title, content: z.any() }` (JSON do ProseMirror); insere
  sempre com `scope: "personal", owner_id: user.id`.
- **`update-document-template-action.ts`** — input
  `{ templateId, title?, content }`; `update` filtrado por
  `.eq("id", templateId).eq("owner_id", user.id).eq("scope", "personal")`
  — zero linhas afetadas (template de outro usuário ou global) vira erro
  explícito, não sucesso silencioso.
- **`delete-document-template-action.ts`** — input `{ templateId }`,
  mesmo filtro de ownership do update.

Nenhuma action de escrita para `scope='global'` nesta tarefa — gestão de
modelos globais via `apps/admin` fica para depois.

### Fluxo "salvar bloco como modelo"

1. Clique no ícone de salvar do bloco.
2. Se `attrs.templateId` existe **e** `attrs.templateScope === 'personal'`
   → abre `SaveBlockChoiceModal`.
   - "Sobrescrever modelo atual" → `updateDocumentTemplateAction({ templateId, content })`.
   - "Criar novo modelo" → fecha esse modal, abre `SaveBlockTemplateModal`.
3. Se `attrs.templateId` é `null` **ou** `attrs.templateScope === 'global'`
   → pula direto para `SaveBlockTemplateModal`.
4. `SaveBlockTemplateModal` confirmado → `createDocumentTemplateAction({ category, title, content })`;
   ao suceder, `editor.commands.updateAttributes("templateBlock", { templateId: novoId, templateScope: "personal", label: title })`
   no node local (via `getPos` do NodeView), sem precisar recarregar o
   documento inteiro.
5. Toast de sucesso/erro (`sonner`) em ambos os caminhos.

Remoção de bloco: ícone remover → `ConfirmModal` existente
(`title: "Remover bloco"`, `variant: "destructive"`) → ao confirmar,
`editor.commands.deleteRange({ from: getPos(), to: getPos() + node.nodeSize })`.

### Segurança

- RLS isola por `owner_id = auth.uid()`; as actions de update/delete
  revalidam ownership explicitamente na query (defesa em profundidade,
  mesmo padrão de `save-personal-contract-action.ts:16-28`), então um
  `templateId` de outro usuário ou global retorna erro mesmo se a UI
  falhar em esconder o botão.
- Nenhum dado de paciente trafega nesta camada — `document_templates`
  não tem `patient_id`/`pregnancy_id`; conteúdo de modelo é
  genérico/reutilizável por definição.

## Testes

- Unit, `list/create/update/delete-document-template-action`:
  - lista retorna só `scope=global` + próprios `scope=personal`,
    filtrado por `category`.
  - `create` sempre grava `scope='personal'` e `owner_id=user.id`
    independente do que o input tentar forçar.
  - `update`/`delete` de template de outro usuário falha com erro
    explícito (zero linhas afetadas).
  - `update`/`delete` de template `scope='global'` falha do mesmo jeito.
- Unit, transformação de "unwrap" (função pura, usada por preview e
  futura geração de PDF): dado um doc JSON do ProseMirror com nós
  `templateBlock` (aninhados em posições variadas), retorna o doc com
  esses nós substituídos por seu `content`, preservando ordem e demais
  nós intactos.
- Component, `TemplatedRichEditor`:
  - inserir um modelo da sidebar cria um `templateBlock` com
    `templateId`/`templateScope`/`label` corretos.
  - "+" entre blocos insere bloco vazio na posição certa (não no fim do
    doc).
  - salvar com `templateId` pessoal existente abre o modal de escolha;
    sem `templateId`, ou com `templateScope='global'`, pula direto para
    o modal de nome.
  - remover bloco exige confirmação via `ConfirmModal` e só remove após
    confirmar.
  - conteúdo do editor não pode receber `<script>` colado/injetado como
    HTML — regressão específica para a decisão de design acima (colar
    HTML externo com `<script>` deve ser sanitizado pelo Tiptap como já
    acontece hoje, não criar um `templateBlock`).

## Fora de escopo

- Tabela `documents` para persistir os documentos finais (prescrição,
  atestado, etc.), com `verification_code`, PDF, compartilhamento — cada
  tipo de documento tem requisitos próprios (ex.: atestado precisa
  esconder CID por padrão) e vai virar spec(s) separada(s).
- Telas de cada tipo de documento (solicitação de exame, atestado,
  laudo, etc.) que vão consumir o `templated-rich-editor`.
- Integração com Memed (ou equivalente) para receita de medicamento
  assinada digitalmente — sub-projeto separado, já identificado no
  brainstorm inicial.
- CRUD de modelos `scope='global'` via `apps/admin` — hoje só leitura
  funciona no app principal; a escrita fica para uma spec futura de
  "biblioteca de modelos gerenciada pelo Ventre".
- Gating por `professional_type` (ex.: impedir doula/fisio de usar
  certas categorias de documento/modelo) — pertence à tela de cada tipo
  de documento, não ao editor genérico.
- Extrair uma toolbar compartilhada entre `RichEditor` e
  `templated-rich-editor` — evitar abstração prematura com um único
  consumidor de cada.
- Compartilhamento do documento final (patient area / link / WhatsApp)
  — depende da tabela `documents` (fora de escopo acima).
