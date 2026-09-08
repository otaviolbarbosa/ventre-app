# Exportação de relatório financeiro (PDF/Excel/CSV)

## Motivação

Hoje a profissional só visualiza na tela (`billing-dashboard-screen.tsx`)
o resumo da sua movimentação financeira do mês selecionado, sem forma de
arquivar ou levar esses dados para fora do app. Vamos adicionar um botão
"Exportar" que gera um relatório financeiro em PDF (para arquivar/imprimir),
Excel (relatório formatado) ou CSV (dado tabular limpo para importar em
outra ferramenta de controle financeiro que a profissional já usa).

> Nota: a spec original recebida do usuário menciona, no requisito do CSV,
> "para que as gestantes possam importar os dados" — isso contradiz o
> restante do documento (que trata sempre da movimentação financeira da
> **profissional**). Está sendo tratado como lapso de digitação: a
> exportação, nos 3 formatos, é sempre uma autoexportação da profissional
> logada, nunca de dados de terceiros.

## Estado atual relevante

- `billing-dashboard-screen.tsx`: tela client-side, mantém `currentMonth`,
  busca dados via `getBillingDashboardAction` e monta 3 seções por status
  através de `useBillingDashboard`.
- `lib/billing/dashboard.ts` — **função pura, sem `"use client"`**:
  `groupBillingsByStatusSections(billings, activeMonth, filter)` agrupa
  installments em `atrasado` / `pendente` / `pago`, cada um já filtrado
  pela janela do mês (`getMonthRange`). Reaproveitável diretamente no
  servidor.
- `lib/billing/calculations.ts` — também puro: `computeAmountCents(installment, appliedFees, professionalId)`
  calcula bruto e líquido (após taxas) por parcela a partir de
  `installment.applied_installment_fees` (já persistido, não recalculado);
  `formatCurrency` formata centavos em BRL.
- `services/billing.ts`:
  - `getBillings(startDate?, endDate?)` já resolve o usuário via
    `getServerUser()` internamente e filtra
    `.not('splitted_billing->>${user.id}', 'is', null)` — ou seja, **já
    retorna apenas billings em que o usuário logado tem parte**, sem
    precisar repassar `professionalId` para a query.
  - `getDashboardMetrics` segue o mesmo padrão (não será usado na
    exportação — os totais do relatório são recalculados a partir dos
    billings agrupados, não dos agregados prontos da dashboard).
- `lib/safe-action.ts`: `authActionClient` já injeta em `ctx`:
  `{ supabase, supabaseAdmin, user, profile }`, onde `profile` é a linha
  completa de `users` (inclui `profile.name`, usado no cabeçalho do PDF).
- Precedente de geração de PDF: `@react-pdf/renderer` já é dependência do
  projeto e é usado para documentos de texto/tabela (não só overlay de
  imagem) em `components/shared/contract-pdf-document.tsx`. O padrão de
  action que gera e devolve o arquivo já existe em
  `actions/export-partograph-pdf-action.ts`, retornando
  `{ pdfBase64, fileName }` para o client decodificar e baixar.
- **Não há** dependência de geração de Excel (`exceljs`/`xlsx`) nem de CSV
  no monorepo hoje.
- `packages/ui/src/dropdown-menu.tsx` já existe (usado no chevron do
  button-group). `button-group` do shadcn **não** está instalado ainda.

## Decisões de escopo (definidas no brainstorm)

- **Período**: não fica preso ao filtro de mês da tela. Qualquer uma das
  3 opções de exportação abre um modal pedindo mês/ano, pré-preenchido
  com o mês atualmente selecionado na tela, editável antes de confirmar.
- **Valores**: cada parcela mostra bruto e líquido lado a lado (não só um
  ou outro).
- **Totais**: PDF e Excel incluem subtotal (bruto/líquido) por seção de
  status e um total geral do mês — são relatórios para leitura. O CSV
  fica **apenas com header + linhas de dado**, sem linha de título e sem
  subtotais, porque seu propósito declarado na spec original é import
  limpo em outra ferramenta financeira, e linhas de subtotal quebrariam
  esse parsing tabular.
- **Colunas** (mesmas nos 3 formatos): Gestante, Descrição, Parcela,
  Status, Data de Vencimento, Data de Pagamento, Valor Bruto, Valor
  Líquido.
- **Escopo de acesso**: sempre autoexportação (`professionalId = ctx.user.id`).
  Não existe modo de exportar dados de outro profissional.

## Design

### Frontend

**`packages/ui`**
- Instalar via `pnpm dlx shadcn@latest add button-group` (rodar dentro de
  `packages/ui`).
- Criar `packages/ui/src/button-group.tsx` encapsulando o primitivo do
  shadcn, expondo as mesmas variantes (`variant`, `size`, `shadow`) de
  `button.tsx` para os botões internos, seguindo o padrão dos demais
  wrappers do pacote (ex.: `card.tsx`, `dialog.tsx`).

**`billing-dashboard-screen.tsx`**
- No header de ações (ao lado do botão "Nova Cobrança"), adicionar um
  `ButtonGroup` com:
  - Botão principal: "Exportar em PDF" (`variant="outline"`, `size="sm"`).
  - Botão chevron (`icon-sm`) abrindo um `DropdownMenu` com os itens
    "Exportar para Excel" e "Exportar para CSV".
- Os 3 itens (botão principal + 2 do dropdown) chamam o mesmo handler
  `openExportModal(format)`.

**Novo `export-billing-report-modal.tsx`**
- Segue a convenção do projeto: `Dialog` no desktop, `Sheet` (bottom) no
  mobile (`window.innerWidth < 640`).
- Conteúdo: o mesmo seletor de mês/ano já usado em `DashboardMetrics`
  (reaproveitar o componente/lógica de navegação de mês), pré-preenchido
  com `activeMonthForHook` da tela.
- Botão "Exportar": dispara `useAction(exportBillingReportAction)` com
  `{ month, format }` (formato vem de qual opção abriu o modal).
- No `onSuccess`, decodifica `fileBase64` (via `atob` + `Uint8Array`) em
  um `Blob` com o `mimeType` retornado, cria um `ObjectURL` e dispara o
  download programaticamente (link temporário clicado via JS, revogado
  logo em seguida). Estado de loading no botão via `isPending`; erro via
  `toast.error` (`sonner`).

### Backend / geração de arquivo

**`lib/billing/report-data.ts`** (novo, isomórfico — sem `"use client"`)

```ts
export type ReportInstallmentRow = {
  patientName: string;
  description: string;
  installmentLabel: string; // "2/6"
  status: "atrasado" | "pendente" | "pago";
  dueDate: string;
  paidAt: string | null;
  grossAmountCents: number;
  netAmountCents: number;
};

export type ReportSection = {
  key: "atrasado" | "pendente" | "pago";
  label: string; // "Vencida" / "A Receber" / "Pago" — via getStatusConfig
  rows: ReportInstallmentRow[];
  subtotalGrossCents: number;
  subtotalNetCents: number;
};

export type BillingReportData = {
  professionalName: string;
  month: string; // "YYYY-MM"
  monthLabel: string; // "Setembro de 2026"
  generatedAt: string; // ISO, hora de geração
  sections: ReportSection[];
  totalGrossCents: number;
  totalNetCents: number;
};

export async function getBillingReportData(params: {
  supabase: SupabaseClient;
  professionalId: string;
  professionalName: string;
  month: string;
}): Promise<BillingReportData>;
```

Implementação: busca `getBillings` com o range do mês (`getMonthRange`),
agrupa com `groupBillingsByStatusSections(billings, month, null)`
(reaproveitado sem alteração), e para cada installment de cada seção
calcula bruto/líquido com `computeAmountCents(installment, appliedFees,
professionalId)` (mesma função usada por `ProfessionalNetAmount` na
tela). Rótulos de seção vêm de `getStatusConfig` (mesmo texto já exibido
na tela: "A Receber" / "Vencida" / "Pago"), não do label interno
`STATUS_SECTIONS` de `dashboard.ts` (esse é "Pendente"/"Em Atraso").

**`actions/export-billing-report-action.ts`** (novo)

```ts
const schema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  format: z.enum(["pdf", "xlsx", "csv"]),
});

export const exportBillingReportAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput: { month, format }, ctx: { supabase, user, profile } }) => {
    const data = await getBillingReportData({
      supabase,
      professionalId: user.id,
      professionalName: profile.name,
      month,
    });

    const { buffer, mimeType, extension } = await buildReportFile(format, data);

    return {
      fileBase64: buffer.toString("base64"),
      fileName: `relatorio-financeiro-${month}.${extension}`,
      mimeType,
    };
  });
```

`buildReportFile` despacha via `import()` dinâmico para o gerador do
formato pedido, evitando carregar `exceljs`/`@react-pdf/renderer` juntos
quando só um é necessário.

**`lib/billing/report-pdf.tsx`** (novo)
- `Document`/`Page` do `@react-pdf/renderer`, seguindo o padrão visual de
  `contract-pdf-document.tsx`.
- Cabeçalho: logo (`assets/ventre.png`), nome da profissional, mês/ano do
  relatório, data de geração (`generatedAt`, formatada `dd/MM/yyyy HH:mm`),
  linha divisória cinza clara (`borderBottomColor: "#e5e5e5"`) no fim do
  cabeçalho.
- Corpo: uma tabela por seção (mesmas colunas da lista de "Colunas"
  acima), com linha de subtotal ao final de cada seção; seções sem
  nenhuma linha não são renderizadas (mesmo comportamento de
  `statusSections.map(... section.billings.length > 0 ...)` na tela).
- Rodapé do documento: total geral (bruto e líquido).
- Paginação: automática pelo `react-pdf` (uso de `View`/`Text` em fluxo
  normal, sem posicionamento absoluto — diferente do overlay do
  partograma).

**`lib/billing/report-excel.ts`** (novo — dependência nova `exceljs`)
- Linha 1: célula mesclada (`mergeCells`) com
  `` `Ventre - Relatório Financeiro de ${monthLabelUpperMonth}/${year}` ``
  (formato `<MÊS>/<ANO>` conforme pedido, ex.: "SETEMBRO/2026").
- Linha 2 em branco, linha 3: header das colunas.
- Dados agrupados por seção (uma coluna "Status" identifica a seção,
  já que é uma única planilha/aba), com linha de subtotal ao final de
  cada bloco de seção e uma linha de total geral ao final.
- Larguras de coluna ajustadas (`worksheet.columns[i].width`) e valores
  monetários com `numFmt: '"R$" #,##0.00'`.

**`lib/billing/report-csv.ts`** (novo — sem dependência nova)
- Helper `escapeCsvField(value: string)`: envolve em aspas duplas e
  escapa aspas internas quando o valor contém vírgula, aspas ou quebra
  de linha.
- Saída: **apenas** a linha de header + uma linha por parcela, sem título
  e sem subtotais (ver "Decisões de escopo").
- Prefixo BOM (`"﻿"`) antes do conteúdo — necessário para Excel no
  Windows reconhecer corretamente UTF-8 e não corromper acentos
  (nomes de gestantes, "Descrição" etc.).
- Separador `,`, quebras de linha `\r\n` (padrão CSV/Excel).

### Nomenclatura de arquivo e mime types

| Formato | Extensão | Mime type |
|---|---|---|
| PDF | `.pdf` | `application/pdf` |
| Excel | `.xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| CSV | `.csv` | `text/csv;charset=utf-8` |

Nome de arquivo: `relatorio-financeiro-{YYYY-MM}.{ext}` (ex.:
`relatorio-financeiro-2026-09.pdf`).

### Erros e edge cases

- Mês sem nenhuma cobrança: gera o relatório normalmente com todas as
  seções vazias/omitidas e totais zerados — não é tratado como erro.
- Falha na geração (ex.: erro do `exceljs`/`react-pdf`): a action lança,
  `next-safe-action` retorna erro estruturado, o modal mostra
  `toast.error("Não foi possível gerar o relatório. Tente novamente.")`
  e não fecha, permitindo nova tentativa.
- `month` fora de um range razoável (ex.: antes da criação da conta) não
  é validado especialmente — simplesmente retorna um relatório vazio,
  mesmo comportamento de "mês sem cobrança".

## Testes

- **Unitário — `report-data.ts`**: agregação correta por seção,
  cálculo de bruto/líquido com e sem taxas aplicadas, split entre
  múltiplos profissionais (installment com `splitted_installment` de
  mais de um profissional só deve refletir a fatia do `professionalId`
  pedido), subtotais e total geral corretos, mês sem billings retorna
  seções vazias e totais zero.
- **Unitário — `report-csv.ts`**: escaping de campos com vírgula, aspas
  e quebra de linha; BOM presente; nenhuma linha de título/subtotal no
  output.
- **Unitário — `report-excel.ts`**: primeira linha mescla o título
  esperado; header na linha correta; subtotais e total geral presentes
  (ler o buffer de volta com `exceljs` para validar).
- **Integração — `export-billing-report-action`**: um teste por formato
  garantindo `mimeType`/extensão corretos e que o conteúdo decodificado
  bate com os dados esperados; caso de mês sem cobranças; caso de
  usuário não autenticado (erro "Não autorizado").
- **Manual**: fluxo completo na tela — abrir modal pelos 3 pontos de
  entrada (botão PDF direto, item Excel, item CSV do dropdown), trocar o
  mês no modal, confirmar, validar o arquivo baixado (abrir o PDF, abrir
  o XLSX no Excel/Google Sheets, importar o CSV em um app financeiro) em
  desktop e mobile (Sheet).

## Fora de escopo

- Agendamento/envio automático de relatórios (ex.: por e-mail todo fim de
  mês) — só exportação sob demanda.
- Exportação de dados de múltiplos meses em um único arquivo (o seletor
  do modal é mês único, conforme decidido no brainstorm).
- Exportação para outro profissional que não o usuário logado.
- Qualquer alteração na tela/tabela de exibição atual (`billing-table.tsx`,
  `BillingGroupCard*`) — o relatório é uma superfície nova, não uma
  refatoração da visualização existente.
