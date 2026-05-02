# PRD 004 — Nova Home para Usuários Staff (Enterprise)

## Contexto

A home enterprise atual (`HomeEnterpriseScreen`) exibe:
- Seletor de profissional
- Carrossel de cards DPP por mês
- Lista de gestantes com busca e filtro
- Timeline de agenda (coluna direita)

Esse layout replica a home do profissional individual, sem tirar proveito da visão gerencial que o usuário staff (manager/secretary) precisa ter. O objetivo desse refatoramento é criar uma experiência dedicada para staff, com navegação rápida e visão consolidada da organização.

---

## Objetivos

1. Transformar a home enterprise em um hub de navegação rápida para staff.
2. Exibir informações gerenciais relevantes (distribuição de gestantes por profissional).
3. Ocultar o menu lateral na home enterprise — a navegação ocorre pelos action cards.
4. Preservar a coluna de agenda.

---

## Escopo

### Fora do escopo
- Lógica de filtro e busca de gestantes (permanecem nas telas dedicadas `/patients`)
- Alterações na home do profissional individual (`HomeScreen`)
- Mudanças no backend / Supabase

---

## Layout

### Estrutura geral (desktop e mobile)

```
┌─────────────────────────────────────────────┐
│  Header: "Bom dia, [Nome]!"                 │
├──────────────────────────-──────────────────┤
│                                             │
│  Action Cards (5)                           │
│  ────────────────────────┬────────────────  │
│                          │                  │
│  Gráfico Donut           │   Agenda         │
│  (gestantes/profissional)│   (coluna fixa)  │
│                          │                  │
└──────────────────────────┴──────────────────┘
```

No mobile, a coluna de agenda aparece abaixo do conteúdo principal (mesmo comportamento atual).

---

## Mudanças Detalhadas

### 1. Ocultar o Sidebar na home enterprise

**Arquivo:** `apps/web/src/components/layouts/sidebar.tsx`

Adicionar verificação de rota: quando o usuário é staff (`isStaff(profile)`) e o `pathname === "/home"`, retornar `null` — ocultando o sidebar completamente.

```tsx
// Lógica a adicionar no Sidebar, junto ao check de /onboarding:
if (pathname === "/home" && isStaff(profile)) {
  return null;
}
```

> A `BottomNav` mobile também deve ser ocultada nessa página para staff. Verificar se é necessário o mesmo tratamento no componente `BottomNav`.

---

### 2. Substituir o carrossel DPP por Action Cards

**Arquivo:** `apps/web/src/screens/home-enterprise-screen.tsx`

Remover o componente `<DppMonthCarousel>` e o `<ProfessionalsSelector>`. No lugar, renderizar 5 action cards em grid horizontal (scroll no mobile):

| Card       | Ícone (lucide)       | Rota destino    |
|------------|----------------------|-----------------|
| Equipe     | `BriefcaseMedicalIcon` | `/users`       |
| Gestantes  | `Users`              | `/patients`     |
| Agenda     | `Calendar`           | `/appointments` |
| Financeiro | `DollarSign`         | `/billing`      |
| Perfil     | `UserCircle`         | `/profile`      |

**Comportamento dos cards:**
- Cada card é um `<Link href={rota}>` estilizado como `Card` do Shadcn.
- Layout: ícone acima, label abaixo, centralizado verticalmente.
- Tamanho fixo: mínimo 80px de largura, altura proporcional.
- No mobile: exibidos em linha horizontal com scroll (`overflow-x-auto`, `no-scrollbar`).
- No desktop: grid com 5 colunas (`grid-cols-5`).
- Sem contagem ou badge nos cards da home (contagens pertencem às telas dedicadas).

---

### 3. Substituir a lista de gestantes por gráfico donut (Chart.js)

**Arquivo:** `apps/web/src/screens/home-enterprise-screen.tsx`

Remover a seção de listagem de gestantes (busca, filtro, `PatientCard`). Substituir por um **gráfico donut** mostrando a distribuição de gestantes ativas por profissional.

#### Dependência

Usar **Chart.js** via `react-chartjs-2` (não usar Recharts). Verificar se já está instalado; se não, adicionar ao `apps/web/package.json`:

```
chart.js
react-chartjs-2
```

#### Dados necessários

O `HomeEnterpriseData` já retorna `professionals: EnterpriseProfessional[]`, onde cada item tem `{ name, patient_count }`. Usar esses dados diretamente — sem novo endpoint.

#### Configuração do gráfico

- Tipo: `Doughnut` do `react-chartjs-2`
- Dados: um slice por profissional com `patient_count > 0`
- Labels: nome do profissional
- Paleta: usar as cores CSS variables do tema (`--chart-1` … `--chart-5` se disponíveis, senão uma paleta fixa harmoniosa com o design system)
- Legenda: posicionada abaixo do gráfico, exibindo nome + contagem de gestantes
- Estado vazio: se todos os profissionais têm `patient_count === 0`, exibir mensagem "Nenhuma gestante distribuída"
- Responsivo: `responsive: true`, `maintainAspectRatio: false` com container de altura definida (`h-[240px]` ou similar)
- Registrar apenas os módulos necessários do Chart.js (não importar tudo):
  ```ts
  import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
  ChartJS.register(ArcElement, Tooltip, Legend)
  ```

#### Título da seção

Exibir título "Gestantes por Profissional" acima do gráfico, mesmo estilo tipográfico das outras seções (`font-poppins font-semibold text-xl`).

---

### 4. Preservar a coluna de Agenda

Sem alterações no componente `AppointmentTimeline`. A coluna direita com a agenda permanece idêntica à implementação atual.

---

### 5. Remover estados e lógica não mais utilizados

Com a remoção da listagem de gestantes, os seguintes estados e calls deixam de ser necessários na home enterprise:

- `activeFilter`, `setActiveFilter`
- `professionalFilter`, `setProfessionalFilter`
- `dppFilter`, `setDppFilter`
- `searchQuery`, `setSearchQuery`, `searchInputRef`, `searchTimeoutRef`
- `fetchPatients` / `getEnterpriseHomePatientsAction`
- `handleFilterChange`, `handleProfessionalFilterChange`, `handleDppFilterChange`, `handleClearDppFilter`, `handleSearchChange`
- `patientItems` e derivados

Manter apenas:
- `fetchHomeData` / `getHomeEnterpriseDataAction`
- `homeData`, `upcomingAppointments`, `professionals`
- `showNewPatient` / `NewPatientModal` (manter o modal — pode ser útil no estado vazio)

---

### 6. Skeleton de loading

Atualizar `HomeEnterpriseScreenSkeleton` para refletir o novo layout:
- 5 cards skeleton em linha (no lugar do carrossel DPP e professionals selector)
- Um bloco de círculo skeleton para o gráfico donut
- A coluna de agenda skeleton permanece igual

---

## Estado vazio

Quando `allPatientIds.length === 0` (nenhum paciente na organização), manter o empty state atual (ícone `Baby`, mensagem, botão "Adicionar Gestante") — sem alterações.

---

## Arquivos impactados

| Arquivo | Tipo de mudança |
|---------|----------------|
| `apps/web/src/components/layouts/sidebar.tsx` | Ocultar sidebar para staff em `/home` |
| `apps/web/src/screens/home-enterprise-screen.tsx` | Refatoramento principal da UI |
| `apps/web/package.json` | Adicionar `chart.js` e `react-chartjs-2` (se não instalados) |
| `apps/web/src/components/layouts/bottom-nav.tsx` | Avaliar ocultação para staff em `/home` |

Os arquivos de serviço (`home-enterprise.ts`), actions (`get-home-enterprise-data-action.ts`) e tipos permanecem sem alteração — os dados já disponíveis são suficientes.

---

## Critérios de aceite

- [ ] Sidebar não é exibido na `/home` para usuários staff
- [ ] 5 action cards são exibidos em linha, com ícone e label, cada um navegando para a rota correta
- [ ] Gráfico donut exibe distribuição de gestantes por profissional usando Chart.js
- [ ] Gráfico renderiza corretamente no mobile e desktop
- [ ] Coluna de agenda permanece funcional e com aparência idêntica
- [ ] Estado vazio (sem gestantes) continua funcionando
- [ ] Skeleton de loading reflete o novo layout
- [ ] Sem erros de TypeScript (`pnpm check-types`)
- [ ] Sem warnings de Biome após `npx biome lint --write --unsafe`
