# Partograma: overlay sobre template oficial + storage + PDF com cabeçalho

## Objetivo
Substituir os mini-gráficos SVG desenhados do zero no PDF do partograma por um overlay
plotado sobre o template oficial do Ministério da Saúde (`prompts/017-partograph/partograma_vs_ok.png`),
seguindo os símbolos definidos na legenda do formulário. A imagem final resultante é salva
no Supabase Storage (bucket `partograph`, pasta `pregnancy.id/`) e depois embutida no PDF,
que passa a ter um cabeçalho com a logo da Ventre e dados da gestante/gestação.

## Fora de escopo
- Preencher os campos de cabeçalho impressos no próprio template (Gravidez, Aborto,
  Paridade, Cesariana, N° Prontuário) — esses dados não são capturados hoje no modo parto.
  Ficam em branco no template; os dados que temos (nome, idade gestacional, DUM/DPP) vão no
  cabeçalho do PDF, fora da imagem do template.
- Qualquer UI para navegar/baixar o histórico de imagens salvas no bucket — este trabalho
  cobre apenas a geração e o upload no momento da exportação do PDF.
- Testes visuais automatizados (nenhuma infraestrutura de visual diff existe no repo hoje).

## Arquitetura

```
export-partograph-pdf-action.ts
  → fetchBirthModeTimelineData (existente)
  → fetchPregnancyHeaderInfo (novo — nome, DUM/DPP, idade gestacional)
  → renderPartographImageBuffer(events)     [partograph-image.ts, novo]
      → builds SVG overlay (partograph-overlay-svg.ts, novo)
      → sharp(template).composite([svg]).png().toBuffer()
  → uploadPartographImage(buffer, pregnancyId)   [partograph-storage.ts, novo]
      → supabaseAdmin.storage.from("partograph").upload(`${pregnancyId}/partograma_${Date.now()}.png`, ...)
  → renderPartographPdfBuffer({ headerInfo, imageBuffer })  [partograph-pdf.ts, reescrito]
      → PartographPdfDocument: header (logo + info) + <Image src={imageBuffer}>
```

## Componentes novos/alterados

### 1. `apps/web/src/assets/partograph-template.png`
Cópia de `prompts/017-partograph/partograma_vs_ok.png` (595×841px, A4 @72dpi). Vira asset de
build, carregado pelo `sharp` no servidor.

### 2. Calibração da grade (`apps/web/src/lib/partograph-template-calibration.ts`)
Constantes com o bounding box em pixels de cada faixa plotável do template, medidas via
script utilitário de análise de pixel (`scripts/calibrate-partograph-template.ts`, não
distribuído — roda uma vez para imprimir as coordenadas, que são então hardcoded como
constantes documentadas). O script varre a imagem por linhas de grade (pixels escuros
horizontais/verticais) para achar os limites exatos de cada faixa, evitando medição visual
aproximada.

Faixas calibradas: FCF, L.A./Bolsa, dilatação/descida (dupla escala: 0–10cm à esquerda,
-3..+4 De Lee à direita), contrações, ocitocina (concentração + gotejamento), medicamentos,
pulso e P.A., temperatura, urina (proteína/cetonúria/volume). Cada faixa expõe:
`{ x0, x1, yTop, yBottom, hourColumns: number[] }` (posição em px de cada coluna de hora
1–24) mais, quando aplicável, `valueToY(value): number` para a escala vertical daquela faixa.

### 3. `apps/web/src/lib/partograph-overlay-svg.ts` (novo, server-only)
Monta uma string SVG 595×841 com os elementos de cada faixa, reaproveitando
`resolveChartT0`, `hoursSince`, `computeAlertActionLines` de `birth-mode-chart-utils.ts`.

Símbolos por faixa (confirmados com o usuário):
- **FCF**: linha conectando pontos, marcador de ponto por leitura, restrita à grade 100–180bpm.
- **L.A./Bolsa**: texto curto (código de `AMNIOTIC_FLUID_TYPE_LABELS`) na célula da hora mais
  próxima de cada evento de rotura de membrana.
- **Dilatação**: triângulo (▲) por leitura — **o vértice superior do triângulo marca o valor
  exato no eixo Y**, não o centroide da forma — conectados por linha sólida, mais as linhas
  de alerta/ação tracejadas (via `computeAlertActionLines`).
- **Descida (De Lee)**: círculo (○) por leitura, conectado por linha tracejada, no eixo
  espelhado à direita (-3..+4).
- **Contrações**: uma barra por coluna de hora, altura = frequência/10min; padrão de
  preenchimento por faixa de duração (pontilhado <20s, hachurado 20–40s, sólido >40s —
  convenção clássica MS).
- **Ocitocina**: altura da barra = gotas/min por coluna; concentração (U/L) impressa como
  número acima da barra.
- **Medicamentos/fluidos**: texto na célula da linha, uma linha por evento (múltiplos eventos
  na mesma hora empilham).
- **Pulso e P.A.**: P.A. como seta vertical dupla entre sistólica/diastólica por coluna;
  pulso como ponto conectado por linha.
- **Temperatura**: ponto conectado por linha.
- **Urina**: proteína/cetonúria como texto curto, volume como número, cada um na sua linha.

### 4. `apps/web/src/lib/partograph-image.ts` (novo, server-only)
```ts
export async function renderPartographImageBuffer(
  events: BirthModeTimelineEvent[],
): Promise<Buffer> // PNG 595x841
```
Usa `sharp` (dependência nova, adicionada explicitamente a `apps/web/package.json` — já
presente transitivamente via Next, mas não resolvível como import direto sem declará-la).

### 5. Migration: bucket + RLS
`packages/supabase/supabase/migrations/<timestamp>_partograph_storage_bucket.sql`
- `INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('partograph', 'partograph', false, 10485760) ON CONFLICT (id) DO NOTHING;`
- Policies em `storage.objects` para `bucket_id = 'partograph'`, seguindo o padrão de
  `patient_documents`/`payments`: pasta = `pregnancy_id`
  (`(storage.foldername(name))[1]::uuid`), verificado via subquery que resolve
  `patient_id` a partir de `pregnancies` e chama `is_team_member(patient_id)` (mais a
  variante "própria gestante" via `patients.user_id = auth.uid()`, igual ao padrão de
  `patient_documents`). INSERT e SELECT cobertos; sem DELETE (histórico é imutável).

### 6. `apps/web/src/lib/partograph-storage.ts` (novo, server-only)
```ts
export async function uploadPartographImage({
  supabaseAdmin, pregnancyId, buffer,
}): Promise<{ storagePath: string }>
```
Upload em `${pregnancyId}/partograma_${Date.now()}.png`, sem tabela nova — histórico é
apenas os objetos do bucket sob esse prefixo (consistente com a decisão de manter histórico
ao invés de sobrescrever).

### 7. `apps/web/src/lib/partograph-pdf.ts` + `partograph-pdf-document.tsx` (reescritos)
- Remove todo o código atual de bandas SVG desenhadas (`LineTrackBand`, `EventTrackBand`,
  escalas manuais).
- `PartographPdfDocument` passa a receber `{ headerInfo, imageBuffer }`:
  - Cabeçalho: logo Ventre (`src/assets/ventre.png`) + nome da paciente + informações da
    gestação (idade gestacional no momento da exportação, DUM, DPP).
  - Corpo: `<Image src={imageBuffer} />` ocupando a página (A4 retrato, já que o template é
    retrato — muda de landscape para portrait em relação ao PDF atual).

### 8. `export-partograph-pdf-action.ts` (alterado)
- Passa a buscar também dados de cabeçalho da gestação (nova função
  `fetchPregnancyHeaderInfo(supabase, pregnancyId)` em `birth-mode-timeline-data.ts` ou
  arquivo próprio — nome da paciente, DUM, DPP).
- Fluxo: gera o buffer da imagem → faz upload (storage) → usa o mesmo buffer para montar o
  PDF (não baixa de volta do storage).

## Tratamento de erros
- Falha no upload da imagem para o Storage não deve bloquear a geração do PDF — loga o erro
  e segue (o PDF já tem o buffer em memória). Consistente com o padrão de "melhor esforço"
  para artefatos auxiliares; a ação principal do usuário é baixar o PDF.
- Falha ao montar o overlay (dados insuficientes, ex: sem eventos) mantém o comportamento
  atual: mensagem "Sem dados suficientes para gerar o partograma" no lugar da imagem.

## Testes
Sem infraestrutura de visual diff no repo. Verificação manual: rodar a exportação contra uma
gestação com dados representativos do modo parto, inspecionar visualmente o PDF resultante
comparando com o template de referência, e confirmar via `mcp__supabase__execute_sql` (ou
dashboard) que o objeto foi criado no bucket/pasta corretos.
