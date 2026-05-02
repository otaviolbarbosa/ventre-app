# Feature: Enterprise Home Screen Refactor (Staff Hub)

## Summary

Refatora a `HomeEnterpriseScreen` para ser um hub de navegação gerencial para usuários staff (manager/secretary). Remove o carrossel DPP e o seletor de profissionais; adiciona 5 action cards de navegação rápida e um gráfico Doughnut (Chart.js) mostrando distribuição de gestantes por profissional. Oculta o sidebar e bottom-nav na rota `/home` para staff. Os dados já disponíveis em `HomeEnterpriseData.professionals` são suficientes — sem alterações no backend.

## User Story

As a usuário staff (manager/secretary)
I want to ver um hub de navegação com distribuição de gestantes por profissional
So that eu possa navegar rapidamente para qualquer área do sistema e ter visão gerencial da organização

## Problem Statement

A home enterprise atual replica a home do profissional individual (carrossel DPP + lista de gestantes), sem oferecer visão gerencial. Usuários staff precisam de acesso rápido às diferentes áreas do sistema e de uma visão consolidada da distribuição de gestantes por profissional.

## Solution Statement

1. Ocultar sidebar e bottom-nav na `/home` para staff — a navegação ocorre pelos action cards.
2. Substituir o `DppMonthCarousel` + `ProfessionalsSelector` por 5 action cards com ícone e label.
3. Substituir a lista de gestantes por um gráfico Doughnut (Chart.js) usando `professionals[].patient_count`.
4. Remover toda a lógica de estado ligada à listagem de gestantes.
5. Atualizar o skeleton de loading para refletir o novo layout.

## Metadata

| Field            | Value                                             |
| ---------------- | ------------------------------------------------- |
| Type             | ENHANCEMENT                                       |
| Complexity       | MEDIUM                                            |
| Systems Affected | sidebar, bottom-nav, home-enterprise-screen       |
| Dependencies     | chart.js@^4.5.1, react-chartjs-2@^5.3.1          |
| Estimated Tasks  | 6                                                 |

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  ┌──────────────┐   ┌──────────────────────────────┐   ┌──────────────────┐  ║
║  │    Sidebar   │   │   HomeEnterpriseScreen        │   │  AppointmentTimeline║
║  │  (sempre     │   │   ─────────────────────────   │   │                  │  ║
║  │   visível)   │   │   ProfessionalsSelector       │   │  (coluna direita)│  ║
║  │              │   │   DppMonthCarousel            │   │                  │  ║
║  │  Home        │   │   [busca + filtro]            │   │                  │  ║
║  │  Gestantes   │   │   PatientCard × N             │   │                  │  ║
║  │  Agenda      │   │                               │   │                  │  ║
║  │  Financeiro  │   │                               │   │                  │  ║
║  └──────────────┘   └──────────────────────────────┘   └──────────────────┘  ║
║                                                                               ║
║  USER_FLOW: Staff abre /home → vê lista de gestantes filtrada por profissional║
║  PAIN_POINT: Não há visão gerencial; navegação duplica a sidebar               ║
║  DATA_FLOW: professionals[], patients[] → ProfessionalsSelector, PatientCard  ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  ┌─────────────────────────────────────────────────┐   ┌──────────────────┐  ║
║  │   HomeEnterpriseScreen (sem sidebar)            │   │  AppointmentTimeline║
║  │   ───────────────────────────────────           │   │                  │  ║
║  │   Header: "Bom dia, [Nome]!"                    │   │  (coluna direita)│  ║
║  │                                                 │   │                  │  ║
║  │   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │   │                  │  ║
║  │   │Equipe│ │Gest. │ │Agenda│ │Financ│ │Perfil│ │   │                  │  ║
║  │   │  👜  │ │  👥  │ │  📅  │ │  💰  │ │  👤  │ │   │                  │  ║
║  │   └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ │   │                  │  ║
║  │                                                 │   │                  │  ║
║  │   Gestantes por Profissional                    │   │                  │  ║
║  │   ┌─────────────────────────┐                  │   │                  │  ║
║  │   │       [Doughnut]        │                  │   │                  │  ║
║  │   │    Chart.js rendered    │                  │   │                  │  ║
║  │   └─────────────────────────┘                  │   │                  │  ║
║  │   ● Dr. A (12 gestantes)                       │   │                  │  ║
║  │   ● Dra. B (8 gestantes)                       │   │                  │  ║
║  └─────────────────────────────────────────────────┘   └──────────────────┘  ║
║                                                                               ║
║  USER_FLOW: Staff abre /home → action cards visíveis → clica na área desejada ║
║  VALUE_ADD: navegação direta, visão gerencial de distribuição de gestantes     ║
║  DATA_FLOW: professionals[] → PatientsDonutChart (name, patient_count)        ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| `sidebar.tsx` | Sempre visível em /home | `null` quando staff em /home | Staff navega pelos action cards |
| `bottom-nav.tsx` | Sempre visível em /home | `null` quando staff em /home | Tela mais limpa no mobile |
| `home-enterprise-screen.tsx` | ProfessionalsSelector + DppMonthCarousel | 5 action cards em grid | Navegação direta às áreas |
| `home-enterprise-screen.tsx` | Lista de gestantes com busca/filtro | Gráfico donut | Visão gerencial da distribuição |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|---------------|
| P0 | `apps/web/src/screens/home-enterprise-screen.tsx` | all | Componente principal — entender estado atual antes de qualquer mudança |
| P0 | `apps/web/src/components/layouts/sidebar.tsx` | 1-70 | Padrão de null return + isStaff check |
| P0 | `apps/web/src/components/layouts/bottom-nav.tsx` | 1-80 | Mesmo padrão de null return |
| P1 | `apps/web/src/lib/access-control.ts` | 1-30 | `isStaff()` — como importar e usar |
| P1 | `apps/web/src/services/home-enterprise.ts` | 1-50 | Tipos `EnterpriseProfessional`, `HomeEnterpriseData` |
| P2 | `apps/web/app/globals.css` | 1-80 | Variáveis CSS `--chart-1` ... `--chart-5` para paleta do gráfico |

**External Documentation:**

| Source | Section | Why Needed |
|--------|---------|------------|
| [Chart.js Doughnut Docs](https://www.chartjs.org/docs/latest/charts/doughnut.html) | Doughnut config | `cutout`, `data.datasets` format |
| [Chart.js Module Registration](https://www.chartjs.org/docs/latest/getting-started/integration.html) | Tree-shaking | Quais módulos registrar — omitir causa erro runtime |
| [Chart.js Colors](https://www.chartjs.org/docs/latest/general/colors.html) | Color formats | CSS vars não funcionam no canvas — resolver via `getComputedStyle` |
| [Chart.js Responsive Config](https://www.chartjs.org/docs/latest/configuration/responsive.html) | maintainAspectRatio | O wrapper div DEVE ter `position: relative` + altura explícita |
| [react-chartjs-2 FAQ](https://react-chartjs-2.js.org/faq/registered-element/) | Registered element | Contexto sobre o erro "not a registered element" |

---

## Patterns to Mirror

**SIDEBAR NULL RETURN:**

```tsx
// SOURCE: apps/web/src/components/layouts/sidebar.tsx:57-59
// COPY THIS PATTERN — adicionar APÓS o check de /onboarding:
if (pathname === "/onboarding") {
  return null;
}
// NOVO — adicionar logo após:
if (isStaff(profile) && pathname === "/home") {
  return null;
}
```

**BOTTOM-NAV NULL RETURN:**

```tsx
// SOURCE: apps/web/src/components/layouts/bottom-nav.tsx:69-71
// MESMO PADRÃO — adicionar após:
if (pathname === "/onboarding") {
  return null;
}
// NOVO:
if (isStaff(profile) && pathname === "/home") {
  return null;
}
```

**CARD COM LINK (action card pattern):**

```tsx
// SOURCE: apps/web/src/screens/home-enterprise-screen.tsx:471-473
// PatientCard já usa Link wrapping a component — mesma ideia para action cards:
<Link key={patient.id} href={`/patients/${patient.id}`}>
  <PatientCard patient={patient} teamMembers={teamMembers} />
</Link>
// PARA ACTION CARDS: Link wrapping um Card do Shadcn com ícone centralizado
```

**ÍCONE DO LUCIDE-REACT:**

```tsx
// SOURCE: apps/web/src/components/layouts/sidebar.tsx:15-21
import { BriefcaseMedicalIcon, Calendar, DollarSign, Home, Users } from "lucide-react";
// Ícone renderizado como componente JSX:
<item.icon className="h-5 w-5 shrink-0" />
```

**CARD DO SHADCN:**

```tsx
// SOURCE: apps/web/src/screens/home-enterprise-screen.tsx (skeleton, linhas 95-108)
import { Card, CardContent } from "@ventre/ui/card";
<Card className="shrink-0">
  <CardContent className="px-4 py-3">...</CardContent>
</Card>
```

**SKELETON PATTERN:**

```tsx
// SOURCE: apps/web/src/screens/home-enterprise-screen.tsx:83-145
// HomeEnterpriseScreenSkeleton usa Skeleton de @ventre/ui/skeleton
// Cada placeholder espelha as dimensões do componente real
import { Skeleton } from "@ventre/ui/skeleton";
<div className="-mx-4 no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
  {[0, 1, 2, 3].map((i) => (
    <Card key={i} className="shrink-0">
      <CardContent className="px-4 py-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </CardContent>
    </Card>
  ))}
</div>
```

**CSS VARIABLES PARA CHART.JS (GOTCHA CRÍTICO):**

```ts
// Chart.js renderiza em canvas — não lê CSS custom properties.
// Os valores em globals.css são canais HSL sem hsl(), ex: "12 55% 48%"
// DEVE resolver assim (dentro de useEffect ou após mount):
function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
// Uso:
const colors = ['--chart-1','--chart-2','--chart-3','--chart-4','--chart-5']
  .map(v => `hsl(${getCssVar(v)})`)
```

---

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `apps/web/package.json` | UPDATE | Adicionar `chart.js` e `react-chartjs-2` |
| `apps/web/src/components/layouts/sidebar.tsx` | UPDATE | Retornar `null` para staff em `/home` |
| `apps/web/src/components/layouts/bottom-nav.tsx` | UPDATE | Retornar `null` para staff em `/home` |
| `apps/web/src/components/shared/patients-donut-chart.tsx` | CREATE | Componente client-only do gráfico Doughnut |
| `apps/web/src/screens/home-enterprise-screen.tsx` | UPDATE | Refatoramento principal da UI e remoção de estado |

---

## NOT Building (Scope Limits)

- Lógica de filtro e busca de gestantes — permanecem nas telas dedicadas `/patients`
- Alterações na home do profissional individual (`HomeScreen`)
- Mudanças no backend / Supabase (serviços, actions, tipos permanecem inalterados)
- Contagem ou badge nos action cards (contagens ficam nas telas dedicadas)
- Toggle ou interatividade de segmentos no gráfico donut além do hover tooltip

---

## Step-by-Step Tasks

Execute em ordem. Cada task é atômica e verificável independentemente.

---

### Task 1: Instalar dependências chart.js e react-chartjs-2

- **ACTION**: UPDATE `apps/web/package.json` — adicionar dependências
- **IMPLEMENT**: Executar `pnpm add chart.js react-chartjs-2 --filter @ventre/web`
- **VERSIONS**: `chart.js@^4.5.1`, `react-chartjs-2@^5.3.1`
- **GOTCHA**: react-chartjs-2 v5 requer chart.js v4 como peer dep — instalar ambos juntos
- **VALIDATE**: `cat apps/web/package.json | grep -E "chart"` — ambos devem aparecer nas dependencies

---

### Task 2: UPDATE `apps/web/src/components/layouts/sidebar.tsx`

- **ACTION**: ADD null return para staff em `/home`
- **IMPLEMENT**: Após o bloco `if (pathname === "/onboarding") { return null; }` (linha ~57), adicionar:
  ```tsx
  if (isStaff(profile) && pathname === "/home") {
    return null;
  }
  ```
- **MIRROR**: `sidebar.tsx:57-59` — mesmo padrão do check de `/onboarding`
- **IMPORTS**: `isStaff` já está importado (`import { isStaff } from "@/lib/access-control";` linha 6); `usePathname` já está em uso (linha 43); `profile` vem de `useAuth()` (linha 44) — nenhum import novo necessário
- **GOTCHA**: `profile` pode ser `null` — `isStaff()` já trata `undefined`/`null` retornando `false`, então é seguro
- **VALIDATE**: `pnpm check-types` deve passar sem erros

---

### Task 3: UPDATE `apps/web/src/components/layouts/bottom-nav.tsx`

- **ACTION**: ADD null return para staff em `/home`
- **IMPLEMENT**: Após o bloco `if (pathname === "/onboarding") { return null; }` (linha ~69), adicionar:
  ```tsx
  if (isStaff(profile) && pathname === "/home") {
    return null;
  }
  ```
- **MIRROR**: `bottom-nav.tsx:69-71` — mesmo padrão
- **IMPORTS**: `isStaff` já importado (linha 3); `pathname` de `usePathname()` (linha 38); `profile` de `useAuth()` (linha 42) — nenhum import novo
- **GOTCHA**: O check deve acontecer APÓS `const { profile } = useAuth()` e `const pathname = usePathname()` — não mover para antes dessas declarações (violaria regras de hooks)
- **VALIDATE**: `pnpm check-types` deve passar sem erros

---

### Task 4: CREATE `apps/web/src/components/shared/patients-donut-chart.tsx`

- **ACTION**: CREATE componente client-only para o gráfico Doughnut
- **IMPLEMENT**: Componente `PatientsDonutChart` com as seguintes características:
  ```tsx
  'use client'

  import { useEffect, useState } from 'react'
  import { Chart as ChartJS, ArcElement, DoughnutController, Tooltip, Legend } from 'chart.js'
  import type { ChartData } from 'chart.js'
  import { Doughnut } from 'react-chartjs-2'
  import type { EnterpriseProfessional } from '@/services/home-enterprise'

  ChartJS.register(ArcElement, DoughnutController, Tooltip, Legend)

  type PatientsDonutChartProps = {
    professionals: EnterpriseProfessional[]
  }

  function getCssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  }

  export function PatientsDonutChart({ professionals }: PatientsDonutChartProps) {
    const [colors, setColors] = useState<string[]>([])

    useEffect(() => {
      const vars = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5']
      setColors(vars.map((v) => `hsl(${getCssVar(v)})`))
    }, [])

    const withPatients = professionals.filter((p) => p.patient_count > 0)

    if (withPatients.length === 0) {
      return (
        <p className="text-muted-foreground text-sm">Nenhuma gestante distribuída</p>
      )
    }

    if (colors.length === 0) return null  // aguarda resolução de CSS vars

    const data: ChartData<'doughnut'> = {
      labels: withPatients.map((p) => p.name ?? 'Profissional'),
      datasets: [{
        data: withPatients.map((p) => p.patient_count),
        backgroundColor: withPatients.map((_, i) => colors[i % colors.length]),
        borderWidth: 2,
        borderColor: 'hsl(var(--background))',
        hoverOffset: 4,
      }],
    }

    return (
      <div className="flex flex-col gap-4">
        <div className="relative h-[240px] w-full">
          <Doughnut
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              cutout: '65%',
              plugins: {
                legend: { display: false },
                tooltip: { enabled: true },
              },
            }}
          />
        </div>
        {/* Legenda React (mais simples que htmlLegendPlugin) */}
        <ul className="flex flex-wrap justify-center gap-3">
          {withPatients.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 text-sm">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: colors[i % colors.length] }}
              />
              <span>{p.name ?? 'Profissional'}</span>
              <span className="text-muted-foreground">
                ({p.patient_count} {p.patient_count === 1 ? 'gestante' : 'gestantes'})
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  ```
- **MIRROR**: Padrão de cliente component com `'use client'` — ver `home-enterprise-screen.tsx:1`
- **IMPORTS**: `EnterpriseProfessional` de `@/services/home-enterprise` — o type está exportado do serviço
- **GOTCHA 1**: `ChartJS.register()` deve incluir `DoughnutController` — omitir causa erro runtime "doughnut is not a registered controller"
- **GOTCHA 2**: CSS vars (`--chart-1` etc.) em `globals.css` são valores HSL sem `hsl()` wrapper (ex: `12 55% 48%`) — envolver em `hsl(${getCssVar('--chart-1')})` na resolução
- **GOTCHA 3**: `getComputedStyle` só existe no browser — chamar dentro de `useEffect` para evitar erro SSR
- **GOTCHA 4**: O wrapper div **deve ter `position: relative`** (via `relative` class Tailwind) + altura explícita quando `maintainAspectRatio: false` — sem isso o canvas colapsa para altura 0
- **GOTCHA 5**: NÃO usar `dynamic(() => import(...), { ssr: false })` aqui — o componente já tem `'use client'`; o pai (`home-enterprise-screen.tsx`) também é um client component, então não há risco de execução no servidor
- **VALIDATE**: `pnpm check-types` deve passar; componente deve compilar sem erros TS

---

### Task 5: UPDATE `apps/web/src/screens/home-enterprise-screen.tsx`

Este é o refatoramento principal. Executar as seguintes mudanças no arquivo:

#### 5a. Remover imports desnecessários

Remover os seguintes imports (deixar de ser utilizados após o refatoramento):
- `DppMonthCarousel` (de `@/components/shared/dpp-month-carousel`)
- `ProfessionalsSelector` (de `@/components/shared/professionals-selector`)
- `getEnterpriseHomePatientsAction` (de `@/actions/...`)
- `PatientCard` (de `@/components/shared/patient-card`)
- `PatientCardSkeleton` (definido localmente, linhas 42-53 — remover a função)

Adicionar novos imports:
```tsx
import Link from 'next/link'
import {
  BriefcaseMedicalIcon,
  Calendar,
  DollarSign,
  Users,
  UserCircle,
} from 'lucide-react'
import { PatientsDonutChart } from '@/components/shared/patients-donut-chart'
```

#### 5b. Remover tipo e estados não utilizados

Remover:
- `type DppFilter = { month: number; year: number } | null` (linha 228)
- `type FilterType = ...` (linha 33) — apenas se não mais usada em nenhum lugar
- `const [activeFilter, setActiveFilter] = useState<FilterType>('all')` (linha 232)
- `const [professionalFilter, setProfessionalFilter] = useState<string | null>(null)` (linha 233)
- `const [dppFilter, setDppFilter] = useState<DppFilter>(null)` (linha 234)
- `const [searchQuery, setSearchQuery] = useState('')` (linha 235)
- `const searchInputRef = useRef<HTMLInputElement>(null)` (linha 236)
- `const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)` (linha 237)
- `const { execute: fetchPatients, result: patientsResult, isExecuting: isLoadingPatients } = useAction(getEnterpriseHomePatientsAction)` (linhas 244-249)

Manter:
- `const [showNewPatient, setShowNewPatient] = useState(false)` (linha 231)
- `const { execute: fetchHomeData, result: homeDataResult, isExecuting: isLoadingHome } = useAction(getHomeEnterpriseDataAction)` (linhas 239-243)

#### 5c. Remover handlers não utilizados

Remover completamente as funções:
- `handleFilterChange` (usada apenas pelo filtro da lista de gestantes)
- `handleProfessionalFilterChange` (usada pelo ProfessionalsSelector)
- `handleDppFilterChange` (usada pelo DppMonthCarousel)
- `handleClearDppFilter` (usada pelo badge de DPP filter)
- `handleSearchChange` (usada pelo campo de busca)

#### 5d. Simplificar `refreshAll`

`refreshAll` atualmente chama `fetchPatients`. Simplificar:
```ts
const refreshAll = useCallback(() => {
  fetchHomeData({})
}, [fetchHomeData])
```

#### 5e. Remover `dppByMonth` e `patientItems`

Remover:
```ts
const dppByMonth = homeData?.dppByMonth ?? []
const patientItems = ...  // toda a lógica de fallback patients/patientsResult
```

Manter:
```ts
const professionals = (homeData?.professionals ?? []) as EnterpriseProfessional[]
```

#### 5f. Remover o `useEffect` de cleanup do search timeout

Remover o `useEffect` que faz `clearTimeout(searchTimeoutRef.current)` no unmount (linhas 333-337).

#### 5g. Substituir a seção visual principal

No JSX, substituir as seções `ProfessionalsSelector`, `DppMonthCarousel`, e a listagem de gestantes (busca, filtro, `PatientCard`) por:

**Action cards:**
```tsx
{/* Action Cards */}
<div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
  {ACTION_CARDS.map((card) => (
    <Link key={card.href} href={card.href} className="shrink-0">
      <Card className="cursor-pointer transition-colors hover:bg-muted/50">
        <CardContent className="flex flex-col items-center justify-center gap-2 px-4 py-4">
          <card.icon className="h-6 w-6 text-primary" />
          <span className="font-poppins text-sm font-medium">{card.label}</span>
        </CardContent>
      </Card>
    </Link>
  ))}
</div>
```

Onde `ACTION_CARDS` é uma constante definida FORA do componente (não recriada a cada render):
```tsx
const ACTION_CARDS = [
  { label: 'Equipe', href: '/users', icon: BriefcaseMedicalIcon },
  { label: 'Gestantes', href: '/patients', icon: Users },
  { label: 'Agenda', href: '/appointments', icon: Calendar },
  { label: 'Financeiro', href: '/billing', icon: DollarSign },
  { label: 'Perfil', href: '/profile', icon: UserCircle },
] as const
```

**Seção do gráfico Doughnut:**
```tsx
{/* Distribuição de gestantes por profissional */}
<div className="space-y-3">
  <h2 className="font-poppins text-xl font-semibold">Gestantes por Profissional</h2>
  <PatientsDonutChart professionals={professionals} />
</div>
```

#### 5h. Atualizar `HomeEnterpriseScreenSkeleton`

Substituir o skeleton do `ProfessionalsSelector` (linha ~89) e do `DppMonthCarousel` (linhas ~92-109) por:

**Skeleton dos action cards:**
```tsx
{/* Action cards skeleton */}
<div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
  {[0, 1, 2, 3, 4].map((i) => (
    <Card key={i} className="shrink-0">
      <CardContent className="flex flex-col items-center gap-2 px-4 py-4">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </CardContent>
    </Card>
  ))}
</div>
```

**Skeleton do gráfico donut:**
```tsx
{/* Donut chart skeleton */}
<div className="space-y-3">
  <Skeleton className="h-6 w-52" />
  <div className="flex justify-center">
    <Skeleton className="h-[240px] w-[240px] rounded-full" />
  </div>
</div>
```

Remover da skeleton:
- A linha `<Skeleton className="h-12 w-full rounded-full sm:w-56" />` (professionals selector skeleton)
- O bloco inteiro do DPP cards skeleton (4 cards)
- O bloco de patient list skeleton (5 PatientCardSkeletons)

#### 5i. Remover `useEffect` que chamava `fetchPatients`

No `useEffect` de mount (linha ~251), remover a chamada a `fetchPatients`:
```ts
// ANTES:
useEffect(() => {
  fetchHomeData({})
  fetchPatients({ filter: activeFilter, search: searchQuery })
}, [])

// DEPOIS:
useEffect(() => {
  fetchHomeData({})
}, [])
```

- **MIRROR**: Padrão de ícone/Card/Link já identificado na codebase
- **IMPORTS FINAIS ESPERADOS** após o refatoramento:
  - `Card`, `CardContent` de `@ventre/ui/card`
  - `Skeleton` de `@ventre/ui/skeleton`
  - `Link` de `next/link`
  - `BriefcaseMedicalIcon`, `Calendar`, `DollarSign`, `Users`, `UserCircle` de `lucide-react`
  - `Baby` de `lucide-react` (usado no empty state — manter)
  - `PatientsDonutChart` de `@/components/shared/patients-donut-chart`
- **VALIDATE**: `pnpm check-types && npx biome lint --write --unsafe apps/web/src/screens/home-enterprise-screen.tsx`

---

### Task 6: Verificação final e correção de Biome

- **ACTION**: Rodar lint completo e corrigir warnings
- **IMPLEMENT**:
  ```bash
  pnpm check-types
  npx biome lint --write --unsafe apps/web/src/components/layouts/sidebar.tsx
  npx biome lint --write --unsafe apps/web/src/components/layouts/bottom-nav.tsx
  npx biome lint --write --unsafe apps/web/src/components/shared/patients-donut-chart.tsx
  npx biome lint --write --unsafe apps/web/src/screens/home-enterprise-screen.tsx
  ```
- **GOTCHA**: Biome pode reclamar de class ordering (`lint/suspicious/noConsoleLog`, `useImportType` para tipos) — o `--unsafe` resolve a maioria automaticamente
- **VALIDATE**: `pnpm check-types` deve retornar exit 0 sem erros

---

## Testing Strategy

### Manual Testing Checklist

| Scenario | Expected |
|----------|----------|
| Login como staff, acessar `/home` | Sidebar e bottom-nav invisíveis |
| Clicar em cada action card | Navega para a rota correta |
| Gráfico exibe com profissionais com patients | Doughnut renderiza, legenda abaixo |
| Todos profissionais com `patient_count === 0` | Mensagem "Nenhuma gestante distribuída" |
| Loading state | 5 card skeletons + circle skeleton aparecem |
| Mobile: action cards | Scroll horizontal funciona |
| Desktop: action cards | Grid de 5 colunas, sem scroll |
| Coluna agenda | Aparece idêntica à versão anterior |
| Empty state (sem gestantes na organização) | Baby icon + botão "Adicionar Gestante" |
| Login como profissional (não staff) | Sidebar e bottom-nav continuam visíveis em /home |

### Edge Cases Checklist

- [ ] `professionals` array vazio → `PatientsDonutChart` exibe "Nenhuma gestante distribuída"
- [ ] Profissional com `name === null` → exibe "Profissional" como fallback
- [ ] Mais de 5 profissionais com gestantes → cores ciclam (`i % colors.length`)
- [ ] `profile === null` no sidebar/bottom-nav → `isStaff(null)` retorna `false` — sidebar permanece visível (correto)
- [ ] Navegação de `/home` para outra rota e volta → gráfico re-renderiza corretamente

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```

**EXPECT**: Exit 0, sem erros de TypeScript

### Level 2: BIOME LINT

```bash
npx biome lint --write --unsafe apps/web/src/components/layouts/sidebar.tsx
npx biome lint --write --unsafe apps/web/src/components/layouts/bottom-nav.tsx
npx biome lint --write --unsafe apps/web/src/components/shared/patients-donut-chart.tsx
npx biome lint --write --unsafe apps/web/src/screens/home-enterprise-screen.tsx
```

**EXPECT**: Sem warnings não resolvidos

### Level 3: BUILD

```bash
cd apps/web && pnpm build
```

**EXPECT**: Build bem-sucedido sem erros

### Level 4: BROWSER_VALIDATION

Iniciar dev server (`pnpm dev`) e verificar manualmente:
- [ ] Staff vê a nova home sem sidebar
- [ ] Action cards navegam corretamente
- [ ] Gráfico donut renderiza no browser
- [ ] Responsividade mobile/desktop funciona

---

## Acceptance Criteria

- [ ] Sidebar não é exibido na `/home` para usuários staff
- [ ] Bottom-nav não é exibido na `/home` para usuários staff
- [ ] 5 action cards são exibidos em linha (mobile scroll / desktop grid-cols-5)
- [ ] Cada action card navega para a rota correta
- [ ] Gráfico donut exibe distribuição de gestantes por profissional usando Chart.js
- [ ] Gráfico renderiza corretamente no mobile e desktop
- [ ] Estado vazio do gráfico ("Nenhuma gestante distribuída") funciona
- [ ] Coluna de agenda permanece funcional e idêntica
- [ ] Empty state geral (sem gestantes na organização) continua funcionando
- [ ] Skeleton de loading reflete o novo layout
- [ ] `pnpm check-types` retorna exit 0
- [ ] Sem warnings de Biome após `npx biome lint --write --unsafe`

---

## Completion Checklist

- [ ] Task 1 — chart.js + react-chartjs-2 instalados
- [ ] Task 2 — sidebar oculto para staff em /home
- [ ] Task 3 — bottom-nav oculto para staff em /home
- [ ] Task 4 — PatientsDonutChart criado e compilando
- [ ] Task 5 — home-enterprise-screen refatorado (estado removido, action cards, donut chart, skeleton atualizado)
- [ ] Task 6 — lint e type-check passando
- [ ] Todos os acceptance criteria verificados manualmente no browser

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Chart.js erro "not a registered controller" | MEDIUM | HIGH | Registrar `DoughnutController` explicitamente junto de `ArcElement` |
| CSS vars não resolvem no canvas | HIGH | HIGH | Resolver via `getComputedStyle` em `useEffect` — nunca passar `hsl(var(...))` diretamente |
| `getComputedStyle` executado no servidor | MEDIUM | HIGH | Chamar apenas dentro de `useEffect` (browser-only) |
| Wrapper sem `position: relative` colapsa canvas | MEDIUM | MEDIUM | Usar classe `relative` no div wrapper do Doughnut |
| Remoção incompleta de estado deixa referências quebradas | MEDIUM | HIGH | Verificar `pnpm check-types` após cada sub-task de remoção |
| Biome warnings em imports de tipo | LOW | LOW | `npx biome lint --write --unsafe` resolve automaticamente |
| `EnterpriseProfessional` type não exportado do service | LOW | MEDIUM | Verificar export antes de importar em `patients-donut-chart.tsx` — se não exportado, mover o type para um arquivo de tipos ou redeclarar localmente |

---

## Notes

- O `PatientsDonutChart` usa uma legenda React pura (não o `htmlLegendPlugin` do Chart.js) para evitar manipulação imperativa do DOM e manter compatibilidade com Tailwind/design system.
- O componente espera que `professionals` inclua profissionais com `patient_count === 0` — o filtro `withPatients.filter(p => p.patient_count > 0)` é feito dentro do componente.
- `ACTION_CARDS` é definido fora do componente React para evitar recriação a cada render (segue o princípio de não criar objetos em render sem necessidade).
- O skeleton de loading tem 5 cards (não 4 como antes) para espelhar os 5 action cards.
- A coluna de `AppointmentTimeline` não requer nenhuma alteração — ela já recebe `appointments={upcomingAppointments}` que continua disponível após o refatoramento.
