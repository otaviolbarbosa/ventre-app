# Feature: Billing Dashboard Month Navigator

## Summary

Redesign `dashboard-metrics.tsx` to include a month navigator header and improved card visuals, so that the financial summary (recebido, próx. vencimentos, em atraso) is always scoped to a selected month. Both screens (`billing-dashboard-screen.tsx` and `billing-dashboard-enterprise-screen.tsx`) are wired to respond to month changes — the solo professional screen via URL (`?month=YYYY-MM`), the enterprise screen via client-side action re-fetch. A "Todos" mode shows all-time data.

## User Story

As a professional or staff member  
I want to see my financial metrics filtered to the current month with easy prev/next navigation  
So that I can quickly understand my monthly cashflow without manually constructing date filters

## Problem Statement

Currently, the billing dashboard metrics show all-time data unless the user manually opens the `PeriodFilterDropdown` and selects a range. There is no concept of "current month" as a default, no month-by-month navigation, and no month label displayed on the metrics cards. The `getDashboardMetrics` service function also incorrectly filters on `billings.created_at` instead of `installments.due_date`, making the paid/overdue counts inconsistent with the installment list below.

## Solution Statement

Add a month navigator header inside `DashboardMetrics` (prev/next buttons + month label + mode selector for "Todos"). Wire both screens to pass `activeMonth` (YYYY-MM string) and `onMonthChange` callbacks. Update `page.tsx` to default to the current month when no `?month=` param is present. Fix `getDashboardMetrics` to filter on `installments.due_date` for consistency. Use `frontend-design` skill to improve the visual quality of the component.

## Metadata

| Field | Value |
|---|---|
| Type | ENHANCEMENT |
| Complexity | MEDIUM |
| Systems Affected | dashboard-metrics component, billing-dashboard-screen, billing-dashboard-enterprise-screen, billing page, services/billing, period-range utility |
| Dependencies | dayjs (already installed), lucide-react (already installed), Shadcn Button/Badge (already installed) |
| Estimated Tasks | 7 |

---

## UX Design

### Before State

```
╔══════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  ┌────────────────────────────────────────────────────────────────────┐  ║
║  │  Header: Financeiro                           [PeriodDropdown] [+] │  ║
║  └────────────────────────────────────────────────────────────────────┘  ║
║                                                                          ║
║  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                     ║
║  │  Recebido   │  │ Próx. Venc. │  │  Em Atraso  │                     ║
║  │  R$ X,XX    │  │  R$ X,XX   │  │  R$ X,XX    │                     ║
║  └─────────────┘  └─────────────┘  └─────────────┘                     ║
║                                                                          ║
║  USER_FLOW: User opens PeriodDropdown → selects "Último mês"            ║
║  PAIN_POINT: No default month filter; no idea what period cards show;   ║
║              no month-by-month navigation; metrics use wrong date field  ║
║  DATA_FLOW: searchParams.period → getPeriodRange() → getBillings() +    ║
║             getDashboardMetrics() (filters billings.created_at, wrong!) ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔══════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  ┌────────────────────────────────────────────────────────────────────┐  ║
║  │  Header: Financeiro                               [Todos] [+]      │  ║
║  └────────────────────────────────────────────────────────────────────┘  ║
║                                                                          ║
║  ┌────────────────────────────────────────────────────────────────────┐  ║
║  │  ◀  Junho de 2025  ▶                              [Todos]          │  ║
║  ├─────────────────┬─────────────────┬──────────────────────────────┤  ║
║  │  ✅ Recebido    │ ⏰ Próx. Venc.  │  ⚠️ Em Atraso                │  ║
║  │  R$ X,XX        │  R$ X,XX        │  R$ X,XX                      │  ║
║  └─────────────────┴─────────────────┴──────────────────────────────┘  ║
║                                                                          ║
║  USER_FLOW: User sees current month by default → clicks ◀ / ▶ to       ║
║             navigate months → clicks "Todos" to see all-time data       ║
║  VALUE_ADD: Immediate monthly cashflow clarity; no clicks to get default;║
║             month label tells user what period they are looking at       ║
║  DATA_FLOW: searchParams.month → getMonthRange() → getBillings() +      ║
║             getDashboardMetrics() (NOW filters installments.due_date)   ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|---|---|---|---|
| `dashboard-metrics.tsx` | Bare metric cards, no date context | Month navigator header + redesigned cards | User always knows what period the numbers represent |
| `billing/page.tsx` | No `?month` param support; no default | Defaults to current month; reads `?month=YYYY-MM` and `?view=all` | First load shows current month data |
| `billing-dashboard-screen.tsx` | `onMonthChange` not wired | Wired; navigates via `router.push("?month=YYYY-MM")` | URL changes are shareable and bookmarkable |
| `billing-dashboard-enterprise-screen.tsx` | No month state | `activeMonth` state + re-fetch on change | Enterprise staff navigates months without page reload |
| `services/billing.ts getDashboardMetrics` | Filters `billings.created_at` | Filters `installments.due_date` | Metrics match the installment list displayed below |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|---|---|---|---|
| P0 | `apps/web/src/components/billing/dashboard-metrics.tsx` | 1-59 | File being redesigned — current props contract and styles |
| P0 | `apps/web/src/screens/billing-dashboard-screen.tsx` | 1-137 | Where `onMonthChange` will be wired for solo professional |
| P0 | `apps/web/src/screens/billing-dashboard-enterprise-screen.tsx` | 1-196 | Where `onMonthChange` will be wired for enterprise |
| P0 | `apps/web/app/(dashboard)/billing/page.tsx` | 1-49 | Server entry point — reads searchParams, calls services |
| P1 | `apps/web/src/lib/billing/period-range.ts` | 1-35 | Pattern to mirror for `getMonthRange()` utility |
| P1 | `apps/web/src/lib/billing/dashboard.ts` | 1-78 | `buildBillingMetrics`, `FILTER_LABELS`, `PERIOD_OPTIONS` |
| P1 | `apps/web/src/hooks/use-billing-dashboard.ts` | 1-50 | Hook receiving `activePeriod` — needs `activeMonth` added |
| P1 | `apps/web/src/services/billing.ts` | 228-295 | `getDashboardMetrics` — date filter bug to fix |
| P2 | `apps/web/src/lib/dpp-filter.ts` | 1-20 | `getDppDateRange(month, year)` — analogous month range utility |
| P2 | `apps/web/src/components/shared/appointment-list-view.tsx` | 278-320 | Month prev/next nav pattern with dayjs + ChevronLeft/Right |
| P2 | `apps/web/src/lib/dayjs.ts` | all | Dayjs singleton with pt-BR locale — import from here, not from 'dayjs' directly |

**External Documentation:**

| Source | Section | Why Needed |
|---|---|---|
| [dayjs startOf/endOf](https://day.js.org/docs/en/manipulate/start-of) | Manipulate | `startOf('month')` / `endOf('month')` for date range |
| [dayjs format](https://day.js.org/docs/en/display/format) | Display | `MMMM` for month name, `YYYY-MM` for URL param |
| [Next.js 15 searchParams](https://nextjs.org/docs/app/api-reference/file-conventions/page) | Page props | `searchParams` is a Promise in Next.js 15 — must `await` |

---

## Patterns to Mirror

**NAMING_CONVENTION — month range utility:**
```typescript
// SOURCE: apps/web/src/lib/dpp-filter.ts:13-17
// COPY THIS PATTERN:
export function getDppDateRange(dppMonth: number, dppYear: number): DppDateRange {
  const startDate = dayjs().year(dppYear).month(dppMonth).startOf('month').format('YYYY-MM-DD')
  const endDate   = dayjs().year(dppYear).month(dppMonth).endOf('month').format('YYYY-MM-DD')
  return { startDate, endDate }
}
// New version takes YYYY-MM string instead of separate number args
```

**MONTH_NAVIGATION — UI pattern (prev/next buttons):**
```typescript
// SOURCE: apps/web/src/components/shared/appointment-list-view.tsx:278-320
// COPY THIS PATTERN:
const [visibleMonth, setVisibleMonth] = useState(now.startOf('month').format('YYYY-MM-DD'))

function changeMonth(direction: 'previous' | 'next') {
  const nextMonth =
    direction === 'previous'
      ? dayjs(visibleMonth).subtract(1, 'month')
      : dayjs(visibleMonth).add(1, 'month')
  setVisibleMonth(nextMonth.startOf('month').format('YYYY-MM-DD'))
}
// UI uses: ChevronLeft/ChevronRight, Button variant="ghost" size="icon"
// Month label: dayjs(visibleMonth).format('MMMM') — capitalize first letter (pt-BR is lowercase)
```

**PERIOD_RANGE — existing pattern to extend:**
```typescript
// SOURCE: apps/web/src/lib/billing/period-range.ts:1-35
// COPY THIS PATTERN for getMonthRange:
import { dayjs } from '../dayjs'  // always import from this singleton

export function getMonthRange(month: string): { startDate: string; endDate: string } {
  const fmt = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD')
  const m = dayjs(month)  // parses YYYY-MM string
  return {
    startDate: fmt(m.startOf('month')),
    endDate: fmt(m.endOf('month')),
  }
}
```

**DASHBOARD_METRICS — current props contract (extend, don't break):**
```typescript
// SOURCE: apps/web/src/components/billing/dashboard-metrics.tsx:23-27
// CURRENT TYPE (extend with new props):
type MetricsProps = {
  metrics: MetricItem[];
  activeFilter: FilterKey | null;
  onFilterClick: (filter: FilterKey) => void;
  // NEW PROPS TO ADD:
  activeMonth: string         // YYYY-MM format
  onMonthChange: (month: string | null) => void  // null = "all time / Todos"
}
```

**SERVER_ACTION_ENTERPRISE — existing client re-fetch pattern:**
```typescript
// SOURCE: apps/web/src/screens/billing-dashboard-enterprise-screen.tsx:52-62
// COPY THIS PATTERN for month changes:
const fetchData = useCallback(
  (profId: string | null, currentPeriod: BillingPeriod | null) => {
    const dateRange = currentPeriod ? getPeriodRange(currentPeriod) : undefined
    execute({
      professionalId: profId ?? undefined,
      startDate: dateRange?.startDate,
      endDate: dateRange?.endDate,
    })
  },
  [execute],
)
// For month navigation: replace `getPeriodRange(currentPeriod)` with `getMonthRange(activeMonth)`
```

**DAYJS_CAPITALIZE — pt-BR month names are lowercase:**
```typescript
// GOTCHA: dayjs pt-BR locale returns lowercase month names ("junho" not "Junho")
// MITIGATION (inline, no dependency):
const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)
// Usage:
const label = `${capitalize(dayjs(activeMonth).format('MMMM'))} de ${dayjs(activeMonth).format('YYYY')}`
// → "Junho de 2025"
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/web/src/lib/billing/period-range.ts` | UPDATE | Add `getMonthRange(month: string)` utility |
| `apps/web/app/(dashboard)/billing/page.tsx` | UPDATE | Read `?month=` and `?view=all`; default to current month |
| `apps/web/src/services/billing.ts` | UPDATE | Fix `getDashboardMetrics` to filter `installments.due_date` not `billings.created_at` |
| `apps/web/src/components/billing/dashboard-metrics.tsx` | UPDATE | Add month navigator + visual redesign (use frontend-design skill) |
| `apps/web/src/hooks/use-billing-dashboard.ts` | UPDATE | Accept `activeMonth` param; compute `activeMonthLabel` |
| `apps/web/src/screens/billing-dashboard-screen.tsx` | UPDATE | Pass `activeMonth` + `onMonthChange` to `DashboardMetrics`; handle via router |
| `apps/web/src/screens/billing-dashboard-enterprise-screen.tsx` | UPDATE | Add `activeMonth` state; wire `onMonthChange` to action re-fetch |

---

## NOT Building (Scope Limits)

- **Custom date range picker (calendar popover)**: the spec says "range customizado" but this adds significant complexity (react-day-picker dependency, additional UI). Defer to next iteration. The "Todos" mode covers the all-time case.
- **Changes to other billing pages**: patient-level billing detail pages, installment detail, add-billing modal — spec explicitly says only `dashboard-metrics.tsx` UI changes.
- **Period dropdown removal**: the `PeriodFilterDropdown` is left untouched; it still filters the installment list below the metrics. The new month navigator controls only the `DashboardMetrics` section.
- **URL-based month param for enterprise screen**: enterprise screen already uses client-side state + action re-fetch; keeping that pattern avoids a full-page reload and is consistent with the existing enterprise approach.

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

---

### Task 1: ADD `getMonthRange` to `apps/web/src/lib/billing/period-range.ts`

- **ACTION**: ADD function at the bottom of the file (after existing exports)
- **IMPLEMENT**:
  ```typescript
  export function getMonthRange(month: string): { startDate: string; endDate: string } {
    const fmt = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD')
    const m = dayjs(month)
    return {
      startDate: fmt(m.startOf('month')),
      endDate: fmt(m.endOf('month')),
    }
  }
  ```
- **MIRROR**: `period-range.ts:11-35` — same `fmt` helper, same dayjs import from `'../dayjs'`
- **IMPORTS**: No new imports needed — `dayjs` is already imported at line 1
- **GOTCHA**: Import dayjs from `'../dayjs'` (the configured singleton), not from `'dayjs'` directly
- **VALIDATE**: `pnpm check-types`

---

### Task 2: FIX `getDashboardMetrics` in `apps/web/src/services/billing.ts`

- **ACTION**: UPDATE the date filter in `getDashboardMetrics` to use `installments.due_date` instead of `billings.created_at`
- **LOCATE**: `apps/web/src/services/billing.ts` around line 241-245 — find the `.gte("created_at", startDate)` and `.lte("created_at", endDate)` calls inside `getDashboardMetrics`
- **IMPLEMENT**: Change those two filter calls to:
  ```typescript
  if (startDate) query = query.gte('installments.due_date', startDate)
  if (endDate)   query = query.lte('installments.due_date', endDate)
  ```
- **MIRROR**: `services/billing.ts:220-221` — the same pattern used in `getBillings`
- **GOTCHA**: The query already selects `installments(*)` so the related table is available for filtering. Verify the select statement includes installments before adding the filter.
- **VALIDATE**: `pnpm check-types`

---

### Task 3: UPDATE `apps/web/app/(dashboard)/billing/page.tsx` to support `?month=` param

- **ACTION**: UPDATE — add `month` and `view` param reading; default to current month when neither is present
- **IMPLEMENT**: Replace the `{ period }` destructure with:
  ```typescript
  const { period, month, view } = await searchParams

  const activePeriod = period as BillingPeriod | undefined
  const activeMonth = month ?? dayjs().format('YYYY-MM')  // default: current month
  const isAllTime = view === 'all'

  const dateRange = isAllTime
    ? undefined
    : activePeriod
      ? getPeriodRange(activePeriod)
      : getMonthRange(activeMonth)
  ```
- **IMPORTS**: Add `import { getMonthRange } from '@/lib/billing/period-range'` and `import { dayjs } from '@/lib/dayjs'`
- **PASS TO SCREENS**: Add `activeMonth` and `isAllTime` as props to both screen components:
  - `BillingDashboardScreen`: add `activeMonth={activeMonth}` prop
  - `BillingDashboardEnterpriseScreen`: add `activeMonth={activeMonth}` prop
- **GOTCHA**: `searchParams` is a `Promise` in Next.js 15 — already awaited at line 13; keep the `await`
- **VALIDATE**: `pnpm check-types`

---

### Task 4: UPDATE `apps/web/src/hooks/use-billing-dashboard.ts`

- **ACTION**: UPDATE — add `activeMonth: string` to hook options; compute `activeMonthLabel`
- **IMPLEMENT**:
  ```typescript
  type UseBillingDashboardOptions = {
    billings: BillingWithInstallments[]
    metrics: DashboardMetrics | null
    activePeriod: BillingPeriod | null
    activeMonth: string  // ADD: YYYY-MM string
  }

  // Inside the hook, add:
  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)
  const activeMonthLabel = `${capitalize(dayjs(activeMonth).format('MMMM'))} de ${dayjs(activeMonth).format('YYYY')}`

  // Return it:
  return {
    activeFilter,
    handleFilterClick,
    filteredInstallments,
    billingMetrics,
    activePeriodLabel,
    activeMonthLabel,  // ADD
    sectionTitle,
  }
  ```
- **IMPORTS**: Add `import { dayjs } from '@/lib/dayjs'`
- **GOTCHA**: `dayjs` pt-BR locale returns lowercase month names — the `capitalize` function handles this
- **VALIDATE**: `pnpm check-types`

---

### Task 5: REDESIGN `apps/web/src/components/billing/dashboard-metrics.tsx`

- **ACTION**: UPDATE — add month navigator header + improve visual design using the `frontend-design` skill
- **NEW PROPS CONTRACT**:
  ```typescript
  type MetricsProps = {
    metrics: MetricItem[]
    activeFilter: FilterKey | null
    onFilterClick: (filter: FilterKey) => void
    activeMonth: string         // YYYY-MM format
    activeMonthLabel: string    // e.g. "Junho de 2025"
    onMonthChange: (month: string | null) => void  // null = "Todos"
    isAllTime?: boolean
  }
  ```
- **IMPLEMENT the month navigator section** (above the metric cards):
  ```tsx
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={() => {
        const prev = dayjs(activeMonth).subtract(1, 'month').format('YYYY-MM')
        onMonthChange(prev)
      }}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="font-semibold text-sm min-w-[140px] text-center">
        {isAllTime ? 'Todos os meses' : activeMonthLabel}
      </span>
      <Button variant="ghost" size="icon" onClick={() => {
        const next = dayjs(activeMonth).add(1, 'month').format('YYYY-MM')
        onMonthChange(next)
      }}
        disabled={isAllTime}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
    <Button
      variant={isAllTime ? 'secondary' : 'ghost'}
      size="sm"
      onClick={() => onMonthChange(null)}
    >
      Todos
    </Button>
  </div>
  ```
- **INVOKE FRONTEND-DESIGN SKILL**: After wiring the logic, invoke `/frontend-design` to improve the visual quality of the component. Tell the skill: "Redesign the DashboardMetrics component in `apps/web/src/components/billing/dashboard-metrics.tsx`. It now includes a month navigator header (prev/next buttons, month label, 'Todos' toggle) above three metric cards (Recebido, Próx. Vencimentos, Em Atraso). Improve the visual quality — the cards should feel polished, with clear color coding (green for paid, amber for upcoming, red for overdue). The month navigator should feel lightweight and elegant. Keep all existing props and logic intact. Use Tailwind only."
- **IMPORTS to add**: `import { ChevronLeft, ChevronRight } from 'lucide-react'`, `import { dayjs } from '@/lib/dayjs'`, `import { Button } from '@ventre/ui/button'`
- **GOTCHA**: The `onMonthChange(null)` case means "Todos" (all time) — the parent screen interprets `null` as removing the month filter
- **VALIDATE**: `pnpm check-types` — then visually verify in browser

---

### Task 6: UPDATE `apps/web/src/screens/billing-dashboard-screen.tsx`

- **ACTION**: UPDATE — add `activeMonth` prop; wire `onMonthChange` to router navigation
- **NEW PROPS TYPE**:
  ```typescript
  type BillingDashboardScreenProps = {
    billings: BillingWithInstallments[]
    metrics: DashboardMetricsType | null
    activePeriod: BillingPeriod | null
    activeMonth: string  // ADD: received from page.tsx
  }
  ```
- **IMPLEMENT `onMonthChange`**:
  ```typescript
  const handleMonthChange = useCallback(
    (month: string | null) => {
      if (month === null) {
        router.push('/billing?view=all')
      } else {
        router.push(`/billing?month=${month}`)
      }
    },
    [router],
  )
  ```
- **PASS TO `DashboardMetrics`**:
  ```tsx
  <DashboardMetrics
    metrics={billingMetrics}
    activeFilter={activeFilter}
    onFilterClick={handleFilterClick}
    activeMonth={activeMonth}
    activeMonthLabel={activeMonthLabel}
    onMonthChange={handleMonthChange}
    isAllTime={!activeMonth}
  />
  ```
- **HOOK CALL**: Add `activeMonth` to the `useBillingDashboard` call; destructure `activeMonthLabel`
- **VALIDATE**: `pnpm check-types`

---

### Task 7: UPDATE `apps/web/src/screens/billing-dashboard-enterprise-screen.tsx`

- **ACTION**: UPDATE — add `activeMonth` state; wire `onMonthChange` to existing `execute` action pattern
- **NEW PROPS**:
  ```typescript
  type BillingDashboardEnterpriseScreenProps = {
    initialBillings: BillingWithInstallments[]
    initialMetrics: DashboardMetricsType | null
    initialProfessionals: EnterpriseBillingProfessional[]
    activePeriod: BillingPeriod | null
    activeMonth: string  // ADD: received from page.tsx
  }
  ```
- **ADD STATE**:
  ```typescript
  const [currentMonth, setCurrentMonth] = useState<string | null>(activeMonth)
  ```
- **IMPORT `getMonthRange`**:
  ```typescript
  import { getMonthRange } from '@/lib/billing/period-range'
  ```
- **UPDATE `fetchData`** to accept `month` instead of `period`:
  ```typescript
  const fetchData = useCallback(
    (profId: string | null, month: string | null) => {
      const dateRange = month ? getMonthRange(month) : undefined
      execute({
        professionalId: profId ?? undefined,
        startDate: dateRange?.startDate,
        endDate: dateRange?.endDate,
      })
    },
    [execute],
  )
  ```
- **ADD `handleMonthChange`**:
  ```typescript
  const handleMonthChange = (month: string | null) => {
    setCurrentMonth(month)
    fetchData(professionalFilter, month)
  }
  ```
- **PASS TO `DashboardMetrics`** (same as Task 6 pattern, using `currentMonth` state)
- **HOOK CALL**: Pass `activeMonth: currentMonth ?? dayjs().format('YYYY-MM')` to `useBillingDashboard`; destructure `activeMonthLabel`
- **VALIDATE**: `pnpm check-types`

---

## Testing Strategy

### Edge Cases Checklist

- [ ] Page loads with no `?month=` param → shows current month data (not all time)
- [ ] User navigates to January 2025 from February 2025 → year changes correctly in label
- [ ] User navigates past December → wraps to January of next year (dayjs handles this automatically)
- [ ] User clicks "Todos" → metrics show all-time data, nav arrows are disabled
- [ ] Enterprise screen: month change triggers `execute()` action without URL change
- [ ] Enterprise screen: month + professional filter combination works (both passed to action)
- [ ] `getDashboardMetrics` fix: overdue count now matches installments listed in the overdue filter
- [ ] `activePeriod` (period dropdown) still works alongside month filter — when a period is set, it takes precedence in the page.tsx logic

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```

**EXPECT**: Exit 0, no TypeScript errors across all packages

### Level 2: LINT

```bash
npx biome lint --write apps/web/src/components/billing/dashboard-metrics.tsx
npx biome lint --write apps/web/src/screens/billing-dashboard-screen.tsx
npx biome lint --write apps/web/src/screens/billing-dashboard-enterprise-screen.tsx
npx biome lint --write apps/web/src/hooks/use-billing-dashboard.ts
npx biome lint --write apps/web/src/lib/billing/period-range.ts
npx biome lint --write apps/web/app/(dashboard)/billing/page.tsx
```

**EXPECT**: Exit 0, no lint errors

### Level 3: BROWSER_VALIDATION (UI changes)

Start dev server (`pnpm dev`), then verify:

- [ ] `/billing` loads with current month label in metrics (e.g. "Junho de 2025")
- [ ] Clicking ◀ changes label to previous month AND metrics values change
- [ ] Clicking ▶ returns to current month AND metrics values change back
- [ ] Clicking "Todos" shows all-time data and disables nav arrows
- [ ] URL updates correctly for solo professional: `/billing?month=2025-05` after ◀ click
- [ ] Enterprise screen month navigation works without URL change
- [ ] Existing period dropdown still works (installment list filters correctly)
- [ ] Mobile: metric cards still scroll horizontally on small screens

### Level 4: DATA_CONSISTENCY (manual check)

In the app, compare:
- [ ] Metrics "Recebido" amount matches sum of installments with status "pago" for that month
- [ ] Metrics "Em Atraso" amount matches sum of installments with status "atrasado" for that month
- [ ] The installment list filtered by "Em Atraso" shows the same installments counted in the metric

---

## Acceptance Criteria

- [ ] `/billing` defaults to current month data with no URL params required
- [ ] Month navigator shows correct formatted label ("Junho de 2025" not "junho de 2025")
- [ ] Prev/Next navigation loads correct monthly data for both professional and enterprise screens
- [ ] "Todos" mode shows all-time data and disables month navigation arrows
- [ ] `getDashboardMetrics` correctly filters on `installments.due_date` (not `billings.created_at`)
- [ ] `pnpm check-types` passes with exit 0
- [ ] No regressions: existing period filter dropdown still works
- [ ] All user-facing text is in Portuguese (pt-BR)
- [ ] Visual design of `dashboard-metrics.tsx` is improved (use frontend-design skill output)

---

## Completion Checklist

- [ ] Task 1: `getMonthRange` added to period-range.ts — `pnpm check-types` passes
- [ ] Task 2: `getDashboardMetrics` bug fixed — filters `installments.due_date`
- [ ] Task 3: `page.tsx` reads `?month=` param; defaults to current month
- [ ] Task 4: `useBillingDashboard` hook returns `activeMonthLabel`
- [ ] Task 5: `dashboard-metrics.tsx` redesigned with month navigator — frontend-design skill applied
- [ ] Task 6: `billing-dashboard-screen.tsx` wired for month navigation via URL
- [ ] Task 7: `billing-dashboard-enterprise-screen.tsx` wired for month navigation via action
- [ ] Level 1: `pnpm check-types` passes
- [ ] Level 2: Biome lint passes on changed files
- [ ] Level 3: Browser validation — all checks pass
- [ ] Level 4: Data consistency — metrics match installment counts

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `getDashboardMetrics` filter change alters metrics for users who had `created_at` semantics | MEDIUM | MEDIUM | Bug fix — the old behavior was incorrect. Document in PR that numbers may shift to be correct |
| Enterprise screen initial SSR data uses old default (no month) until client re-fetch | LOW | LOW | `page.tsx` now passes `activeMonth` to enterprise screen so SSR data is already month-scoped |
| dayjs pt-BR lowercase months in month navigator label | HIGH | LOW | Use `capitalize()` helper — pattern is documented and in the task |
| `onMonthChange(null)` for "Todos" conflicts with existing `activePeriod` period param in URL | LOW | MEDIUM | In `page.tsx`, `view=all` takes priority; `period` param behavior unchanged |
| Supabase embedded filter `installments.due_date` excludes billings with no installments | LOW | LOW | Only billings with installments matter for metrics; empty billings are edge cases |

---

## Notes

**Why month-based URL param instead of extending `BillingPeriod`**: Adding `"current_month"` to the `BillingPeriod` union would be dynamic (changes each request) and would pollute the period utility which is designed for relative offsets. A `?month=YYYY-MM` param is static, bookmarkable, and precisely describes the selected range.

**`getDashboardMetrics` vs `getBillings` date column inconsistency**: This is a pre-existing bug where `getBillings` filters `installments.due_date` (correct — the installment list is due-date based) but `getDashboardMetrics` filters `billings.created_at` (wrong — creates inconsistency where you can see an installment in the list but it's not counted in metrics). Task 2 fixes this.

**frontend-design skill scope**: Task 5 explicitly invokes the frontend-design skill for the visual redesign portion. The skill should be given the wired component (after Task 5 logic is in place) and asked to improve the aesthetic without changing props or logic.

**`activePeriod` coexistence**: The period dropdown is left intact. In `page.tsx` the priority order is: `isAllTime (view=all)` → `activePeriod (period param)` → `activeMonth (month param)` → `current month (default)`. This means the period dropdown can still override month navigation, which is existing behavior preserved.
