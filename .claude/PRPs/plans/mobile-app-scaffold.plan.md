# Feature: Mobile App Scaffold (Expo WebView Wrapper — Phase 1)

## Summary

Create `apps/mobile`, a new Expo (SDK 57 / React Native 0.86) package inside the existing Turborepo + pnpm workspace, using `expo-router`'s default template and `react-native-webview` to render a full-screen WebView pointing at the production web app (`https://ventre.app/landing`). This is Phase 1 of the `mobile-webview-app` PRD — pure scaffolding: no push notifications, no deep linking, no auth-session persistence, no app icon, no EAS deploy. Those are Phases 2–6 and depend on this one.

## User Story

As a developer on the Ventre team
I want a working `apps/mobile` Expo app that boots locally and renders the production web app inside a WebView
So that the wrapper approach is proven end-to-end before investing in native session persistence, push, deep links, icons, and store deployment

## Problem Statement

Ventre has no native app scaffold today — only the responsive web app / PWA (`apps/web`, Serwist). Before any of the store-readiness work (push, deep links, icon, EAS) can start, a minimal Expo package needs to exist in the monorepo, be wired into the Turborepo task pipeline (`lint`, `check-types`, `dev`), and successfully render the production site in a WebView when run locally via Expo Go or a dev client.

## Solution Statement

Scaffold `apps/mobile` with `create-expo-app`'s official `default@sdk-57` template (ships `expo-router` pre-wired), align its `package.json` scripts and `biome.json` with the monorepo's existing per-app conventions (mirroring `apps/storybook` and `apps/admin`), strip the template's demo tabs UI down to a single route that renders `<WebView source={{ uri: "https://ventre.app/landing" }} />` full-screen, and verify Metro's monorepo auto-detection works with pnpm without any manual `watchFolders`/`nodeModulesPaths` config (per current Expo guidance, this is no longer needed as of SDK 52+).

## Metadata

| Field            | Value                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| Type             | NEW_CAPABILITY                                                                                              |
| Complexity       | MEDIUM — first React Native/Expo package in the repo; well-documented by Expo but untested against this repo's specific pnpm+Turborepo setup |
| Systems Affected | New `apps/mobile` package; Turborepo task pipeline (`turbo.json`, participates via matching script names, no edits needed); Biome (auto-scoped, no root config edit needed) |
| Dependencies     | `expo` ^57.0.9 (SDK 57, bundles React Native 0.86), `expo-router` (bundled by default template), `react-native-webview` (version resolved by `expo install`), existing: `turbo` ^2.7.5, `pnpm` 10.28.1, `typescript` 5.9.2 |
| Estimated Tasks  | 8                                                                                                            |

---

## Lifecycle (append-only)

- **Created:** 2026-08-04
- **Modified:** 2026-08-04, 2026-08-05
- **Commits:** _(none yet — implementation complete on `feature/mobile-app-scaffold`, uncommitted)_
- **Agent / Session:** Claude Sonnet 5 (prp-core:prp-plan), Claude Sonnet 5 (prp-core:prp-implement)
- **Back refs:** _(none — first plan generated for this PRD)_
- **Forward refs:** Phases 2–6 of `.claude/PRPs/prds/mobile-webview-app.prd.md` (Sessão/navegação nativa, Push notifications, Deep linking, Ícone do app, Deploy via EAS) all depend on this plan's `apps/mobile` existing — link their plans back here once generated.

> **Append-only:** `Created` is set once; every other field is a list you only ever add to — never overwrite or remove existing entries. Keep references bidirectional: when you add a back/forward ref here, add the reciprocal ref on the other plan.

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐            ║
║   │   User /    │ ──────► │  No native  │ ──────► │ Web/PWA only│            ║
║   │  developer  │         │  app exists │         │   option    │            ║
║   └─────────────┘         └─────────────┘         └─────────────┘            ║
║                                                                               ║
║   USER_FLOW: To use Ventre on a phone, the user opens the browser or the     ║
║   PWA installed to the home screen — there is no `apps/mobile` package in    ║
║   the monorepo, no store presence, nothing to run natively.                  ║
║   PAIN_POINT: No wrapper exists to validate; every later phase (push,        ║
║   deep links, icon, EAS deploy) is blocked on this scaffold not existing.    ║
║   DATA_FLOW: Browser → apps/web (Next.js) → Supabase, unchanged.             ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐      ║
║   │  Developer  │──►│ Expo dev    │──►│ Native app  │──►│  WebView    │      ║
║   │ runs        │   │ server      │   │ shell boots │   │ renders     │      ║
║   │`expo start` │   │ (Metro)     │   │             │   │ventre.app   │      ║
║   └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘      ║
║                                                                 │             ║
║                                                                 ▼             ║
║                                                        ┌─────────────┐        ║
║                                                        │ Same web app│ ◄── no ║
║                                                        │ logic reused│  backend║
║                                                        └─────────────┘  changes║
║                                                                               ║
║   USER_FLOW: Developer runs `pnpm --filter mobile dev` (or `npx expo start` ║
║   inside `apps/mobile`); opens the app in Expo Go / iOS Simulator / Android  ║
║   emulator; the app shows a splash then a full-screen WebView loading       ║
║   `https://ventre.app/landing` — the exact production web app, no new UI.   ║
║   VALUE_ADD: Proves the wrapper approach end-to-end locally, unblocking     ║
║   Phases 2–6 (session persistence, push, deep links, icon, EAS deploy).     ║
║   DATA_FLOW: apps/mobile → react-native-webview → https://ventre.app/landing║
║   (same Next.js app + Supabase backend as today; zero backend changes).     ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| `apps/` (monorepo root) | Only `web`, `admin`, `docs`, `storybook` | `mobile` added, participates in `turbo run lint/check-types/dev` | Developers can run `pnpm --filter mobile dev` |
| Mobile device / simulator | No native Ventre app to install or run | `npx expo start` inside `apps/mobile` boots an app rendering a full-screen WebView of the production site | Dev-only in this phase; later phases turn this into a store-installable app |
| `apps/mobile/app/index.tsx` | Does not exist | Renders `<WebView source={{ uri: "https://ventre.app/landing" }} />` full-screen, replacing the Expo template's demo tabs UI | Validates the wrapper concept before Phases 2–6 |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/storybook/package.json` | 6-11 | Script-name contract (`dev`/`build`/`lint`/`check-types`) that `apps/mobile` must match to participate in `turbo.json` tasks |
| P0 | `turbo.json` | 1-27 | Task pipeline is script-name driven, not per-app registered — confirms no `turbo.json` edit is needed for `apps/mobile` to join `lint`/`check-types`/`dev` |
| P0 | `biome.json` (root) | 94-97 | `files.ignore` has no per-app allowlist — `apps/mobile` is automatically in scope for root `biome lint .` / `biome check .` |
| P1 | `apps/admin/biome.json` | 1-4 | Per-app Biome config pattern (`{ "extends": ["../../biome.json"] }`) to mirror for `apps/mobile/biome.json` |
| P1 | `packages/typescript-config/base.json` | 1-19 | Confirms none of the shared tsconfig bases are React-Native-aware — informs the decision to extend `expo/tsconfig.base` directly instead (see Questionables) |
| P2 | `packages/supabase/src/client.ts` | 1-11 | Forward-looking only (Phase 2+ will consume `@ventre/supabase/client`, which has zero Next.js imports and is safe for RN) — not used in this phase, but confirms the PRD's Architecture Notes assumption is correct |

**External Documentation:**

| Source | Section | Why Needed |
|--------|---------|------------|
| [Expo Router Introduction](https://docs.expo.dev/router/introduction.md) | Scaffold command | `npx create-expo-app@latest --template default@sdk-57` ships `expo-router` pre-wired |
| [Expo — Work with monorepos](https://docs.expo.dev/guides/monorepos.md) | Metro monorepo auto-detection | As of SDK 52+, do NOT hand-write `watchFolders`/`resolver.nodeModulesPaths` in `metro.config.js` — Expo detects the pnpm workspace automatically |
| [react-native-webview — Expo SDK reference](https://docs.expo.dev/versions/latest/sdk/webview.md) | Install + basic usage | `npx expo install react-native-webview`, no config plugin required, `<WebView source={{ uri }} />` pattern |
| [React Native's New Architecture](https://docs.expo.dev/guides/new-architecture.md) | Mandatory on SDK 55+ | Confirms New Architecture cannot be disabled on SDK 56/57 — nothing to configure, just don't add `newArchEnabled: false` |
| [Using TypeScript](https://docs.expo.dev/guides/typescript.md) | `expo/tsconfig.base` | Confirms Expo's own template tsconfig extends `expo/tsconfig.base` (ships inside the `expo` package), independent of `packages/typescript-config` |

---

## Patterns to Mirror

**WORKSPACE_PACKAGE_NAMING:**

```json
// SOURCE: apps/storybook/package.json:1-11
// COPY THIS PATTERN — plain (unscoped) name, private, four matching script names:
{
  "name": "storybook",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "storybook dev -p 6006",
    "build": "storybook build",
    "lint": "biome lint .",
    "check-types": "tsc --noEmit"
  }
}
```
Apply the same shape to `apps/mobile/package.json`: `"name": "mobile"`, `"private": true`, and `dev`/`lint`/`check-types` scripts (no `build` script needed — see Agent Notes on why Expo apps don't define one locally).

**WORKSPACE_DEPENDENCY_SYNTAX** (forward-looking, not used until Phase 2+):

```json
// SOURCE: apps/admin/package.json:16-19
// COPY THIS PATTERN when a later phase adds @ventre/supabase:
"@ventre/supabase": "workspace:*",
```

**PER_APP_BIOME_CONFIG:**

```json
// SOURCE: apps/admin/biome.json:1-4
// COPY THIS PATTERN EXACTLY:
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "extends": ["../../biome.json"]
}
```

**TSCONFIG_EXTENDS_PATTERN (repo convention vs. Expo's own):**

```json
// SOURCE: apps/docs/tsconfig.json:1-8 — repo convention (Next.js apps extend @ventre/typescript-config)
{
  "extends": "@ventre/typescript-config/nextjs.json",
  ...
}
```
`apps/mobile/tsconfig.json` intentionally does **NOT** follow this — none of `base.json`/`nextjs.json`/`react-library.json` in `packages/typescript-config` are React-Native-aware (confirmed via Mandatory Reading P1). Instead, use Expo's own official baseline (per external docs):
```json
// apps/mobile/tsconfig.json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": { "strict": true },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

**METRO_CONFIG_PATTERN:**

```js
// SOURCE: Expo official monorepo guidance (docs.expo.dev/guides/monorepos) — NOT copied from this repo, since no RN app exists yet
// This is the ENTIRE file — do not add more:
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
module.exports = config;
```

---

## Files to Change

| File                                          | Action | Justification                                                                 |
| ---------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| `apps/mobile/**` (scaffolded by CLI)           | CREATE | `create-expo-app` generates the base Expo/expo-router project structure       |
| `apps/mobile/package.json`                     | UPDATE | Align `name`, scripts (`dev`/`lint`/`check-types`) with monorepo conventions   |
| `apps/mobile/biome.json`                       | CREATE | Per-app Biome config extending root, mirroring `apps/admin/biome.json`         |
| `apps/mobile/tsconfig.json`                    | UPDATE | Verify it extends `expo/tsconfig.base` (Expo's own convention, not `@ventre/typescript-config`) |
| `apps/mobile/metro.config.js`                  | VERIFY | Confirm no manual `watchFolders`/`nodeModulesPaths` were added (outdated pattern) |
| `apps/mobile/app/_layout.tsx`                  | UPDATE | Strip Expo template's tabs demo down to a single-route Stack layout            |
| `apps/mobile/app/index.tsx`                    | UPDATE | Replace demo home screen with full-screen `<WebView>` pointing at production   |
| `apps/mobile/app/(tabs)/`, `apps/mobile/components/` (template demo files) | DELETE | Remove Expo template's tabs/demo UI — out of scope, not needed for a WebView wrapper |
| `pnpm-workspace.yaml`                          | NONE   | Already globs `apps/*` — no edit required                                      |
| `turbo.json`                                   | NONE   | Task participation is script-name driven — no per-app registration needed      |

---

## NOT Building (Scope Limits)

Explicit exclusions to prevent scope creep (per PRD and Phase 1 scope specifically):

- **Push notifications** (`expo-notifications`, `push_subscriptions` token registration) — Phase 3.
- **Deep linking** (`expo-router` path mapping for notification/external-link payloads) — Phase 4.
- **Auth session persistence** in the WebView between app opens — Phase 2. In this phase the WebView simply loads the URL; if the user isn't logged in, they'll see the normal web login screen, which is acceptable for a scaffold-validation phase.
- **Native chrome**: Android `BackHandler`, native splash screen tuning, offline error/retry screen — Phase 2 ("wrapper preguiçoso" mitigations are explicitly deferred there).
- **App icon** generation from `ventre-red-bg-logo-only.png` — Phase 5. This phase ships with Expo's default template icon.
- **EAS Build/Submit, developer accounts** — Phase 6.
- **Any change to `apps/web`, `apps/admin`, `apps/docs`, `apps/storybook`, or `packages/*`** — this phase only adds a new, independent package.
- **Automated tests** — no test task exists anywhere in this monorepo (`turbo.json` has no `test` task, no app has a test script); Phase 1's success signal is manual (per PRD: "App roda localmente ... e mostra a web app"). Introducing a test framework is out of scope here.

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

**Status markers** — prefix EVERY task header with one; the build agent updates it inline as it works: `[ ]` idle · `[wip]` in progress · `[x]` complete · `[f]` failed. All tasks start `[ ]`.

### `[x]` Task 1: CREATE `apps/mobile` via Expo scaffold CLI

- **ACTION**: Run the Expo scaffolding CLI to generate the base project
- **IMPLEMENT**: From the repo root: `npx create-expo-app@latest apps/mobile --template default@sdk-57`. This template already includes `expo-router` and a tabs demo UI (to be stripped in later tasks).
- **MIRROR**: N/A — first React Native package in this repo; follow Expo's official scaffold output structure
- **GOTCHA**: `create-expo-app@latest` **without** an explicit `--template` currently scaffolds SDK 54, not SDK 57 (Expo is mid-transition as of this writing) — the `--template default@sdk-57` flag is mandatory, not optional
- **VALIDATE**: `test -f apps/mobile/package.json && test -d apps/mobile/app && echo OK`

### `[x]` Task 2: UPDATE `apps/mobile/package.json`

- **ACTION**: Align generated `package.json` with monorepo script-naming conventions
- **IMPLEMENT**: Set `"name": "mobile"`, `"private": true`; ensure scripts are exactly `dev`, `lint`, `check-types` (add `"check-types": "tsc --noEmit"` if missing); replace the template's default `"lint": "expo lint"` (ESLint-based) with `"lint": "biome lint ."`
- **MIRROR**: `apps/storybook/package.json:1-11` — plain unscoped name, `private: true`, matching script names
- **GOTCHA**: Do not keep Expo's default ESLint config/script — this repo lints exclusively with Biome (root `biome.json:94-97` has no per-app override, so `apps/mobile` is already in scope); leaving `expo lint` in place would introduce a second, unused linter
- **VALIDATE**: `node -e "const p=require('./apps/mobile/package.json'); if(p.name!=='mobile'||!p.scripts['check-types']) process.exit(1)"`

### `[x]` Task 3: CREATE `apps/mobile/biome.json`

- **ACTION**: CREATE per-app Biome config
- **IMPLEMENT**: `{ "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json", "extends": ["../../biome.json"] }`
- **MIRROR**: `apps/admin/biome.json:1-4` — copy exactly, same relative path depth (`apps/mobile` is one level deep, same as `apps/admin`)
- **VALIDATE**: `pnpm --filter mobile lint`

### `[x]` Task 4: UPDATE `apps/mobile/tsconfig.json`

- **ACTION**: Verify/adjust the generated tsconfig to extend Expo's own base, not `@ventre/typescript-config`
- **IMPLEMENT**: Ensure `"extends": "expo/tsconfig.base"`, `"compilerOptions": { "strict": true }`, and `"include"` covers `**/*.ts`, `**/*.tsx`, `.expo/types/**/*.ts`, `expo-env.d.ts`
- **MIRROR**: External docs — [Using TypeScript](https://docs.expo.dev/guides/typescript.md) baseline; intentionally diverges from `apps/docs/tsconfig.json:2` (`@ventre/typescript-config/nextjs.json`) because none of the shared bases are RN-aware (see `packages/typescript-config/base.json:1-19`)
- **GOTCHA**: Do not attempt to also extend `@ventre/typescript-config/base.json` via TS 5.0 array-extends in this phase — untested combination per research, not worth the risk for a scaffold task; revisit only if repo-wide compiler-option drift becomes a real problem later
- **VALIDATE**: `pnpm --filter mobile check-types`

### `[x]` Task 5: VERIFY `apps/mobile/metro.config.js`

- **ACTION**: Confirm the scaffolded Metro config has no manual monorepo overrides
- **IMPLEMENT**: File must be exactly the two-line `expo/metro-config` `getDefaultConfig(__dirname)` pattern — if `create-expo-app` or any copied boilerplate added `watchFolders`, `resolver.nodeModulesPaths`, `resolver.extraNodeModules`, or `resolver.disableHierarchicalLookup`, remove them
- **MIRROR**: Expo official monorepo guide — see "METRO_CONFIG_PATTERN" above
- **GOTCHA**: Third-party guides (and even Vercel's own official `with-react-native-web` Turborepo example on GitHub) still show manual `watchFolders`/`nodeModulesPaths` — this is outdated pre-SDK-52 boilerplate; adding it back fights Expo's built-in pnpm-workspace auto-detection and can break symlink resolution instead of fixing it
- **VALIDATE**: `grep -c "getDefaultConfig" apps/mobile/metro.config.js | grep -q "^1$"`

### `[x]` Task 6: ADD `react-native-webview` dependency

- **ACTION**: Install the WebView library via Expo's own installer
- **IMPLEMENT**: `cd apps/mobile && npx expo install react-native-webview`
- **GOTCHA**: Use `expo install`, not `pnpm add` — it resolves the exact version compatible with SDK 57 / RN 0.86 automatically; no config plugin entry is needed in `app.json` (per Expo SDK reference)
- **VALIDATE**: `grep -q '"react-native-webview"' apps/mobile/package.json`

### `[x]` Task 7: UPDATE `apps/mobile/app/_layout.tsx` and `apps/mobile/app/index.tsx`; DELETE template demo files

- **ACTION**: Replace the Expo template's tabs demo with a single WebView route
- **IMPLEMENT**:
  - `apps/mobile/app/_layout.tsx`: minimal `expo-router` `Stack` with one screen (no tabs)
  - `apps/mobile/app/index.tsx`: full-screen WebView:
    ```tsx
    import { WebView } from "react-native-webview";
    import { StyleSheet } from "react-native";

    export default function Index() {
      return (
        <WebView style={styles.container} source={{ uri: "https://ventre.app/landing" }} />
      );
    }

    const styles = StyleSheet.create({ container: { flex: 1 } });
    ```
  - Delete the template's `app/(tabs)/` directory and any now-unused demo `components/` (e.g. `HelloWave`, `ParallaxScrollView`) it scaffolded
- **MIRROR**: External docs code example — [react-native-webview SDK reference](https://docs.expo.dev/versions/latest/sdk/webview.md)
- **IMPORTS**: `import { WebView } from "react-native-webview";`
- **GOTCHA**: The default template's demo screens reference `components/` files being deleted here — check `app/_layout.tsx` and any remaining files don't still import them, or `check-types`/Metro bundling will fail
- **VALIDATE**: `pnpm --filter mobile check-types`

### `[wip]` Task 8: MANUAL — run the app locally and confirm the WebView renders production

- **ACTION**: Start the Expo dev server and validate on-device
- **IMPLEMENT**: `cd apps/mobile && npx expo start`; open in Expo Go (scan QR) or press `i`/`a` for iOS Simulator / Android emulator
- **GOTCHA**: If Metro fails to resolve workspace packages under pnpm's isolated `node_modules`, see Risks table for the `nodeLinker: hoisted` fallback — do not add it preemptively, only if this task fails
- **VALIDATE**: App shows a splash then a full-screen WebView loading `https://ventre.app/landing`, matching the current production web app with no native chrome around it and no crash

---

## Testing Strategy

### Unit Tests to Write

None. No test framework or `test` task exists anywhere in this monorepo (`turbo.json` defines no `test` task; no existing app has a `test` script). Phase 1's success signal is explicitly manual per the PRD ("App roda localmente ... e mostra a web app"). Introducing a test runner is out of scope for this scaffold phase.

### Edge Cases Checklist

- [ ] `expo start` succeeds with no Metro resolution errors under pnpm's workspace layout
- [ ] WebView loads over a real network connection (no offline handling exists yet — that's Phase 2; a network failure here is expected to just show a blank/error WebView, not crash the app)
- [ ] `pnpm --filter mobile check-types` and `pnpm --filter mobile lint` both pass with zero errors after template demo files are deleted (no dangling imports)
- [ ] Root `pnpm check-types` (which runs `turbo run check-types` across the whole workspace) still passes for all other apps — confirms adding `apps/mobile` didn't break anything else

---

## Validation Commands

🔁 **Validation loop:** the plan is not complete until every command below passes (exit 0). On any failure, fix the cause and re-run — loop until all pass. If a check is genuinely impossible, mark it `[f]`, note why in Agent Notes, and move on.

### Level 1: STATIC_ANALYSIS

```bash
pnpm --filter mobile lint && pnpm --filter mobile check-types
```

**EXPECT**: Exit 0, no errors or warnings

### Level 2: UNIT_TESTS

N/A — no test framework exists in this repo (see Testing Strategy). Skipped by design.

### Level 3: FULL_SUITE

```bash
pnpm check-types && npx expo-doctor@latest --cwd apps/mobile
```

**EXPECT**: `pnpm check-types` (whole-workspace `turbo run check-types`) passes for every package including `mobile`; `expo-doctor` reports no dependency/config issues

### Level 4: DATABASE_VALIDATION

N/A — no schema changes in this phase.

### Level 5: BROWSER_VALIDATION

N/A — this is a native mobile app, not a browser surface. See Level 6 for the on-device equivalent.

### Level 6: MANUAL_VALIDATION

1. `cd apps/mobile && npx expo start`
2. Open in Expo Go (scan the QR code) or press `i` (iOS Simulator) / `a` (Android emulator)
3. Confirm: native splash appears, then a full-screen WebView loads `https://ventre.app/landing`
4. Confirm: the rendered page matches the current production web app exactly (same content, same login screen if unauthenticated) — no native chrome, no crash, no blank white screen
5. Confirm: `pnpm --filter mobile dev` (the Turborepo-wired script) produces the same result as running `npx expo start` directly inside `apps/mobile`

---

## Acceptance Criteria

- [ ] `apps/mobile` exists, is a recognized pnpm workspace member (no `pnpm-workspace.yaml` edit needed), and runs via `pnpm --filter mobile dev`
- [ ] `apps/mobile` participates in `turbo run lint` and `turbo run check-types` (verified via root `pnpm check-types`)
- [ ] App boots in Expo Go or a dev client and renders `https://ventre.app/landing` full-screen inside a WebView, with no leftover template demo UI (tabs, "HelloWave", etc.)
- [ ] Level 1 and Level 3 validation commands pass with exit 0
- [ ] No regressions: `pnpm check-types` still passes for `web`, `admin`, `docs`, `storybook`, and `packages/*`
- [ ] UX matches the "After State" diagram — splash → full-screen WebView, no native chrome yet (chrome is Phase 2)

---

## Completion Checklist

- [ ] All 8 tasks completed in order
- [ ] Each task validated immediately after completion
- [ ] Level 1: `pnpm --filter mobile lint && pnpm --filter mobile check-types` passes
- [ ] Level 3: `pnpm check-types` (whole workspace) + `expo-doctor` pass
- [ ] Level 4: N/A (no schema changes)
- [ ] Level 5: N/A (native app, not browser)
- [ ] Level 6: Manual on-device/simulator validation confirms WebView renders production site
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk                                                                 | Likelihood | Impact | Mitigation                                                                                                   |
| --------------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| `create-expo-app@latest` defaults to SDK 54 without explicit template | HIGH (confirmed current CLI behavior) | LOW | Task 1 always passes `--template default@sdk-57` explicitly |
| pnpm's isolated `node_modules` breaks Metro's resolution of workspace/native deps | LOW | MED | Expo added isolated-install support from SDK 54+; if Task 8's `expo start` fails to resolve modules, add `nodeLinker: hoisted` to `pnpm-workspace.yaml` as a documented fallback (not applied preemptively) |
| Default template's ESLint-based `lint` script conflicts with the repo's Biome-only convention | HIGH | LOW | Task 2 replaces it with `biome lint .`; no ESLint config is added |
| New Architecture (mandatory on SDK 56/57) causes friction with `react-native-webview` or a future native dep | LOW | MED | Run `npx expo-doctor@latest` after scaffold (Level 3); `react-native-webview` has no known New Architecture incompatibility per Expo docs |
| PRD's "SDK 56+" floor vs. actual current latest (SDK 57) creates ambiguity about which version was intended | MED | LOW | See Questionables — proceeding on SDK 57 as it satisfies the stated floor and was designed as a low-friction upgrade from 56 |

---

## Questionables

_Include this section whenever a decision was assumed rather than certain (and whenever the confidence score is below 8). Surface open decisions here instead of silently deciding — one collapsible entry per open question, with the assumption you took so a human can confirm or correct it._

<details>
<summary>PRD specifies "Expo SDK v56+ / RN v0.85+" — plan scaffolds directly on SDK 57 (RN 0.86)</summary>

As of the research date (2026-08-04), Expo SDK 57 is the actual current stable release (RN 0.86), one version ahead of the PRD's stated floor. SDK 57 was designed as a low-friction upgrade from 56 with no breaking changes, so scaffolding on 57 satisfies "56+" and is the more future-proof choice — avoids scaffolding on an already-superseded SDK on day one. If there's a specific reason to pin to exactly SDK 56 (e.g. Expo Go compatibility during the current SDK 57 rollout transition window mentioned in research), confirm with the PRD owner before Task 1 and swap the `--template default@sdk-57` flag to `@sdk-56`.

</details>

<details>
<summary>`apps/mobile/tsconfig.json` extends `expo/tsconfig.base` directly, not `@ventre/typescript-config`</summary>

None of the three existing shared tsconfig bases (`base.json`, `nextjs.json`, `react-library.json`) are React-Native-aware, and Expo's own tooling (path alias injection, `expo-env.d.ts` generation) specifically expects `expo/tsconfig.base` as the base. TypeScript 5.0+ technically supports array-form `extends` (`["expo/tsconfig.base", "@ventre/typescript-config/base.json"]`), which could layer in the repo's shared compiler options, but this combination isn't covered by any Expo or Turborepo documentation and is unvalidated territory. Assumption taken: skip shared-config integration for Phase 1; revisit only if repo-wide compiler-option consistency becomes an actual problem in a later phase.

</details>

---

## Agent Notes

**Why no `build` script/task for `apps/mobile`:** Every existing app in this repo (`web`, `admin`, `docs`, `storybook`) defines a `build` script because they're all Next.js/Storybook tools with a meaningful local build output (`.next/**`, `dist/**`) that `turbo.json`'s `build` task (hardcoded to `.next/**` outputs) expects. Expo apps don't have an equivalent local build step — native builds happen via EAS in the cloud (Phase 6), and Turborepo's own official React Native example (`examples/with-react-native-web` in the `vercel/turborepo` repo) confirms this: its native app's `package.json` defines only `dev`/`android`/`ios`/`web`/`eject`, no `build`. `apps/mobile` follows the same shape — no `build` script, and no `turbo.json` edit is needed since task participation there is purely by matching script name (a package without a `build` script is silently skipped for that task, not an error).

**Why no `turbo.json` or `pnpm-workspace.yaml` changes are in this plan's Files to Change:** Confirmed via both codebase-analyst and codebase-explorer — `pnpm-workspace.yaml`'s `apps/*` glob already covers a new `apps/mobile` directory with zero edits, and `turbo.json`'s four tasks (`build`/`lint`/`check-types`/`dev`) fan out to any workspace package with a matching script name, with no separate per-app registration step. This is a deliberate scope-minimization: two files that a naive first pass might assume need edits, but don't.

**Feature-parity note:** This phase deliberately produces something less polished than Expo's own `default` template ships with (tabs demo, themed components, haptics example) — those are removed in Task 7 because the product's stated intent (PRD "What We're NOT Building") is zero native UI beyond the WebView wrapper and minimal chrome (chrome itself is Phase 2, not this phase). Resist the temptation to keep the demo UI "just in case" — it directly contradicts the PRD's explicit scope limits.

**No CI to wire up:** The only GitHub Actions workflow in this repo (`.github/workflows/database-deployment.yml`) is Supabase-migrations-only; there is no CI workflow anywhere that runs `turbo run build/lint/check-types` for any app. The only current enforcement of those tasks is the local Husky pre-commit hook (`pnpm lint && pnpm check-types`), which will automatically pick up `apps/mobile` once it exists — no Husky config change needed either.

---

## Amendments

_Append-only history of changes made **after** this plan was first built (newest at the bottom). The build and update steps add entries here; never edit or remove existing ones._

**2026-08-05 — Implementation (prp-core:prp-implement):** All 8 tasks executed on branch `feature/mobile-app-scaffold`. Level 1 (`pnpm --filter mobile lint && check-types`) and Level 3 (`pnpm check-types` workspace-wide + `expo-doctor`) both pass with zero errors. Level 6 (manual on-device confirmation) still requires the user — see report. Deviations from the plan as written:

- **Route directory is `apps/mobile/src/app/`, not `apps/mobile/app/`.** The actual `create-expo-app@latest --template default@sdk-57` output (as of 2026-08-05) scaffolds routes under `src/app/` by convention (expo-router auto-detects a `src/` directory), not root `app/` as the plan assumed. All task file paths (`_layout.tsx`, `index.tsx`) were adjusted accordingly; `tsconfig.json`'s generated `paths` already pointed `@/*` at `./src/*` correctly.
- **No tabs group folder; template uses a flat `index.tsx` + `explore.tsx` + a `NativeTabs`-based `components/app-tabs.tsx`,** not the `app/(tabs)/` directory structure the plan described. Deleted `explore.tsx`, `components/`, `hooks/`, `constants/theme.ts`, and `global.css` in full (all were demo-only, confirmed via grep before deletion) instead of a `(tabs)/` directory that doesn't exist in this template version. Also removed now-orphaned demo image assets (`expo-badge*`, `expo-logo.png`, `logo-glow.png`, `react-logo*`, `tabIcons/`, `tutorial-web.png`) not referenced by `app.json` or the remaining code.
- **`create-expo-app` installed via npm, not pnpm** (its own `package-lock.json` + isolated `node_modules`), leaving `apps/mobile` outside the pnpm workspace and `biome`/`tsc` binaries unresolved. Removed the npm artifacts and ran `pnpm install` from repo root before any per-app command — not called out in the plan's tasks but required for Task 3's validation to run at all.
- **Template's `package.json` scripts were `start`/`android`/`ios`/`web`/`reset-project`/`lint` (ESLint via `expo lint`), not `dev`/`lint`/`check-types`** as the plan's Files to Change table implied. Renamed `start`→`dev`, added `check-types`, replaced `lint` with `biome lint .`, and deleted the template's `scripts/reset-project.js` helper (no longer meaningful once the app is customized) along with its script entry.
- **No `metro.config.js` was scaffolded at all** in this SDK 57 template version (Expo relies on implicit defaults). Created it explicitly with the plan's exact `METRO_CONFIG_PATTERN` per Expo's monorepo guidance, rather than "verifying" a pre-existing file.
- **Task 5's validate command has a bug**: `grep -c "getDefaultConfig" ... | grep -q "^1$"` expects exactly 1 matching line, but the correct 3-line canonical pattern (import + call) always matches on 2 lines. Verified the file content matches the documented pattern exactly instead of relying on the flawed count.
- **`expo-doctor` initially flagged one patch-version mismatch** (`@types/react@19.2.2` vs expected `~19.2.4`, introduced by the `react-native-webview` install in Task 6). Fixed via `npx expo install --fix`; re-ran `expo-doctor` to confirm 20/20 checks pass.
- **Environment risk not in the plan's Risks table:** local Node is v20.14.0; Expo SDK 57 / RN 0.86 packages request `>=20.19.4` (warned on every CLI invocation, did not block install, build, or bundling in this session — flagged for awareness, not fixed here since it's a machine-level toolchain change outside this plan's scope).
- Kept the template's own `apps/mobile/AGENTS.md`, `CLAUDE.md`, `.claude/settings.json` (enables the official Expo Claude Code plugin scoped to this directory), and `.vscode/` config as-is — harmless template scaffolding not mentioned in the plan, no reason to strip.
- **Level 6 (manual on-device validation) not run by the implementing agent** — no interactive device/simulator loop available in this session. `npx expo export --platform web` was run instead as an automated proxy for the plan's top flagged risk ("pnpm's isolated `node_modules` breaks Metro's resolution of workspace/native deps"): it succeeded, bundling 769 + 824 modules including the `/` (index/WebView) route with zero resolution errors. This confirms Metro correctly resolves the pnpm workspace but does **not** confirm the WebView actually renders `https://ventre.app/landing` on a real device — that step is left to the user (see report for exact commands).
