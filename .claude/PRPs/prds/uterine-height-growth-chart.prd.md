# Gráfico de Altura Uterina (AU) na EvolutionsSection

## Problema

Hoje, os valores de altura uterina (AU) registrados em cada evolução pré-natal (`uterine_height_cm`) são exibidos apenas como números soltos dentro de cada card de consulta, em `EvolutionsSection` (`apps/web/src/components/shared/prenatal-card.tsx:536-777`). Não há nenhuma visualização que permita ao profissional ver, de forma rápida, se a curva de crescimento da AU da gestante está dentro da faixa de normalidade (P10–P90) ao longo da gestação — é preciso lembrar os valores de referência de cabeça ou abrir a Caderneta da Gestante física.

## Solução proposta

Adicionar um gráfico de linha (Chart.js, via `react-chartjs-2`, já instalado) em uma coluna à direita da lista de evoluções dentro de `EvolutionsSection`, plotando:

1. **Três curvas de referência** (fixas, baseadas na tabela INTERGROWTH-21st — fonte oficial referenciada pela Caderneta da Gestante do MS 2024, ver `prompts/008-AU-data.md`):
   - P90 (limite superior) — linha vermelha, 80% transparência
   - P10 (limite inferior) — linha vermelha, 80% transparência
   - Mediana (P50) — linha azul, 80% transparência
   - Preenchimento vermelho 20% transparência acima do P90 e abaixo do P10
2. **Linha dos valores reais** da gestante, lida de `evolutions[].uterine_height_cm` por `evolutions[].gestational_weeks` (+ `gestational_days`), na cor primária do app (`hsl(var(--primary))`), com pontos circulares.

## Fonte de dados de referência

Tabela INTERGROWTH-21st (Papageorghiou et al., BMJ 2016) — semanas 16 a 41, valores P10/P50/P90 em cm, fornecida em `prompts/008-AU-data.md`. Será hardcoded como array estático no componente (não é dado de banco — é uma constante clínica).

```ts
// exemplo da forma dos dados
const AU_REFERENCE: { week: number; p10: number; p50: number; p90: number }[] = [
  { week: 16, p10: 14.0, p50: 15.8, p90: 17.6 },
  { week: 17, p10: 14.9, p50: 16.8, p90: 18.6 },
  // ... até semana 41
];
```

## Escopo técnico

### Onde entra no layout

`EvolutionsSection` (prenatal-card.tsx:574-777) hoje é single-column, lista de cards empilhados (`space-y-3`). Não existe padrão de grid/coluna lateral em `PrenatalCard` ainda — será introduzido aqui:

```tsx
<div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
  <div className="space-y-3">{/* lista de evolution cards, como já existe */}</div>
  <UterineHeightChart evolutions={evolutions} />
</div>
```

Em mobile (`< lg`), o gráfico cai abaixo da lista (stack vertical natural do grid).

### Novo componente

`apps/web/src/components/shared/uterine-height-chart.tsx` — Client Component (`"use client"`), seguindo o padrão já estabelecido por `trimester-semi-chart.tsx`:

- Registra no Chart.js: `LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler` (necessário `Filler` para o preenchimento de área acima/abaixo das bandas).
- Lê cor primária via `getComputedStyle` em `useEffect` (evita mismatch de SSR), igual ao padrão `getCssVar`.
- Eixo X: semana gestacional (16–41, fixo, cobrindo a faixa da tabela de referência).
- Eixo Y: cm, de 10 a ~45 (com folga acima do P90 max).
- 4 datasets no `<Line />`:
  1. P90 — `borderColor: red/80%`, `fill: '+1'` (preenche até o dataset seguinte = topo do gráfico) — na prática Chart.js precisa de um dataset "topo" auxiliar ou `fill: 'end'`/valor fixo para sombrear "acima do P90"; ver nota de implementação abaixo.
  2. Mediana (P50) — `borderColor: blue/80%`, sem fill.
  3. P10 — `borderColor: red/80%`, `fill: 'origin'`/eixo inferior fixo para sombrear "abaixo do P10".
  4. Valores reais da gestante — `borderColor: hsl(var(--primary))`, `pointStyle: 'circle'`, `pointRadius: 4`, conectando apenas os pontos existentes (não interpola onde não há dado).
- Curvas P10/Mediana/P90 com `tension` (ex.: `0.4`) para suavização — usar a tabela INTERGROWTH como pontos de controle, sem necessidade de interpolação adicional (Chart.js já desenha bezier entre os 26 pontos da tabela).

**Nota de implementação (fills):** para sombrear "acima do P90" e "abaixo do P10" sem sombrear a faixa P10–P90 inteira, a abordagem mais simples no Chart.js é:
- Dataset auxiliar invisível no topo do eixo Y (ex. y=45 constante) com `fill: '-1'` relativo ao P90 → preenche a área acima do P90.
- Dataset auxiliar invisível na base do eixo Y (ex. y=10 constante) com `fill: '-1'` relativo ao P10 → preenche a área abaixo do P10.
- Esses datasets auxiliares devem ter `borderWidth: 0`, `pointRadius: 0`, sem entrada na legenda (`display: false` no item de legend).

### Conversão semana gestacional

`gestational_weeks` (int) + `gestational_days` (int, 0-6) → `x = gestational_weeks + gestational_days / 7`. Quando `gestational_weeks` é `null`, o ponto é omitido do dataset de valores reais (não há fallback via DUM nesta primeira versão — está fora de escopo).

### Empty state

Se nenhuma evolução tiver `uterine_height_cm` e `gestational_weeks` preenchidos simultaneamente, o gráfico ainda renderiza as curvas de referência (útil por si só), só sem a linha de valores reais.

## Fora de escopo

- Cálculo de IG via DUM como fallback quando `gestational_weeks` é nulo (usar dado já registrado apenas).
- Tornar a tabela de referência configurável/editável pelo usuário.
- Exportar/imprimir o gráfico isoladamente.
- Alertas automáticos quando um ponto cai fora da faixa P10-P90 (puramente visual nesta versão).

## Arquivos a tocar

| Arquivo | Mudança |
|---|---|
| `apps/web/src/components/shared/uterine-height-chart.tsx` | **Novo** — componente do gráfico |
| `apps/web/src/components/shared/prenatal-card.tsx` | Importar e renderizar `UterineHeightChart` dentro de `EvolutionsSection`, ajustar layout para grid 2 colunas |

Nenhuma mudança de banco, action ou tipo é necessária — todos os dados (`uterine_height_cm`, `gestational_weeks`, `gestational_days`) já são buscados por `getPrenatalCardAction` e já chegam ordenados por `consultation_date`.

## Critério de sucesso

- Gráfico renderiza as 3 curvas de referência corretamente (cores/transparências/preenchimento conforme imagem de referência fornecida).
- Pontos reais da gestante aparecem corretamente posicionados por semana gestacional, com círculos.
- Responsivo: coluna lateral em desktop (`lg:`), empilhado em mobile.
- Sem erros de SSR/hydration mismatch (seguindo padrão `getCssVar` em `useEffect`).

---

*Gerado: 2026-06-20*
*Status: DRAFT — pronto para implementação direta (spec técnica, não PRD de produto completo)*
