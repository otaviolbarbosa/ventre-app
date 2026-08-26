# Mobile Push Notifications — Hardening Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Important-severity findings from the final whole-branch review of `docs/superpowers/plans/2026-08-07-mobile-push-notifications.md` (commits `bae0088..7086078`, already merged into `feature/mobile-app-scaffold`): missing iOS native build config, an unreliable login-token-delivery path, an over-eager permission prompt, and two small hardening gaps introduced while fixing that review's two Critical findings.

**Architecture:** No new architecture beyond what's already merged. Task 1 adds a missing native-build config plugin. Task 2 hardens the already-merged sign-out unsubscribe call (try/catch, conditional cache-clear). Task 3 replaces `apps/mobile/src/app/index.tsx`'s navigation-path-based auth detection with an explicit web→native handshake message — the web side already knows its own auth state via `useAuth()`, so it declares it, rather than native inferring it from a hardcoded, incomplete list of "unauthenticated" URL paths.

**Tech Stack:** Same as the parent plan — Expo SDK 57, React Native 0.86.2, `@react-native-firebase/messaging`, `expo-notifications`, `react-native-webview` 13.16.1, Next.js 15 / React 19.

## Global Constraints

- This plan is additive on top of `bae0088..7086078` (already merged) — do not redo or re-verify the parent plan's four tasks or its Critical-fix commit.
- Zero backend/DB/edge-function changes — same as the parent plan.
- No test runner exists anywhere in this repo (still true — recheck was not needed, nothing added one). Verification per task is `pnpm --filter <pkg> check-types` / `lint`, and for `app.json` changes, `npx expo config --json`.
- All user-facing strings in this repo are Portuguese (pt-BR) — not applicable here, this plan adds no new user-facing copy (only `console.error` diagnostics, which the existing file already writes in English).
- The native↔web message contract already in place must not change field names for the two existing messages (`push-token`, `push-unsubscribe`) — only a new message type is added (`native-authenticated`).

---

### Task 1: Add `expo-build-properties` for iOS static frameworks

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app.json`

**Interfaces:**
- Produces: `expo-build-properties` as an installed, importable-by-config-plugin package.

**Context:** RNFirebase's iOS integration requires CocoaPods static frameworks (`use_frameworks! :linkage => :static`), which on Expo-managed projects is configured via the `expo-build-properties` config plugin — without it, `pod install` fails once the manual-prerequisite Firebase files are in place. This wasn't caught by the parent plan's `expo config --json` check because that only validates config *resolution*, not native pod integration.

- [ ] **Step 1: Install the plugin**

Run: `cd apps/mobile && npx expo install expo-build-properties`

- [ ] **Step 2: Add the plugin to `app.json`**

In `apps/mobile/app.json`, append to the `plugins` array (after the two existing `@react-native-firebase/*` entries):

```json
      "@react-native-firebase/app",
      "@react-native-firebase/messaging",
      [
        "expo-build-properties",
        {
          "ios": {
            "useFrameworks": "static",
            "forceStaticLinking": ["RNFBApp", "RNFBMessaging"]
          }
        }
      ]
```

`forceStaticLinking` lists only the two RNFirebase native modules actually installed (`RNFBApp`, `RNFBMessaging`) — do not add entries for modules this app doesn't use (e.g. `RNFBAuth`, `RNFBAnalytics`).

- [ ] **Step 3: Verify**

Run: `cd apps/mobile && npx expo config --json > /dev/null` — expect exit 0.
Run: `pnpm --filter mobile check-types && pnpm --filter mobile lint` — expect both to pass.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/pnpm-lock.yaml apps/mobile/app.json
git commit -m "fix(mobile): add expo-build-properties for RNFirebase iOS static frameworks"
```

---

### Task 2: Harden the sign-out unsubscribe call

**Files:**
- Modify: `apps/web/src/providers/auth-provider.tsx`

**Interfaces:**
- Consumes: `unsubscribeNotificationsAction`, `NATIVE_PUSH_TOKEN_KEY`, `isNativeBridge` — all already imported in this file as of commit `7086078`.

**Context:** The final review's Critical-fix re-review found two gaps in the already-merged `signOut()` change (`apps/web/src/providers/auth-provider.tsx:109-119`): the new `unsubscribeNotificationsAction` call has no `try/catch` (a transport-level failure — e.g. the device is offline at the moment of logout — would throw uncaught and block sign-out entirely), and the `localStorage` cache is cleared unconditionally even when the action resolves with a server-side failure (losing the only record that would let a retry find the token). Both were adjudicated as non-blocking for that fix (the file already had an equally-unguarded `invalidateUserCacheAction` call before this change), but are real, worthwhile hardening.

- [ ] **Step 1: Update `signOut`**

In `apps/web/src/providers/auth-provider.tsx`, replace:

```ts
  const signOut = async () => {
    if (isNativeBridge()) {
      const cachedToken = localStorage.getItem(NATIVE_PUSH_TOKEN_KEY);
      if (cachedToken) {
        // Unsubscribe while the session is still valid — waiting for native
        // to detect the post-logout navigation and relay it back is too late,
        // the session (and the WebView document) may already be gone by then.
        await unsubscribeNotificationsAction({ fcmToken: cachedToken });
        localStorage.removeItem(NATIVE_PUSH_TOKEN_KEY);
      }
    }
    await invalidateUserCacheAction({});
```

with:

```ts
  const signOut = async () => {
    if (isNativeBridge()) {
      const cachedToken = localStorage.getItem(NATIVE_PUSH_TOKEN_KEY);
      if (cachedToken) {
        // Unsubscribe while the session is still valid — waiting for native
        // to detect the post-logout navigation and relay it back is too late,
        // the session (and the WebView document) may already be gone by then.
        // Never let this block sign-out itself (e.g. device offline): only
        // clear the cached token once the unsubscribe is confirmed, so a
        // failed attempt can retry on the next logout instead of losing the
        // only record of which token to deactivate.
        try {
          const result = await unsubscribeNotificationsAction({ fcmToken: cachedToken });
          if (result?.data?.success) {
            localStorage.removeItem(NATIVE_PUSH_TOKEN_KEY);
          } else {
            console.error("[signOut] failed to unsubscribe push token:", result?.serverError);
          }
        } catch (err) {
          console.error("[signOut] failed to unsubscribe push token:", err);
        }
      }
    }
    await invalidateUserCacheAction({});
```

Nothing else in this function or file changes.

- [ ] **Step 2: Verify**

Run: `pnpm --filter web check-types && pnpm --filter web lint` — expect both to pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/providers/auth-provider.tsx
git commit -m "fix(web): guard sign-out push-unsubscribe against transport failure"
```

---

### Task 3: Replace navigation-path auth detection with a web→native handshake

**Files:**
- Modify: `apps/web/src/lib/native-bridge.ts`
- Modify: `apps/web/src/hooks/use-notifications.ts`
- Modify: `apps/mobile/src/app/index.tsx`

**Interfaces:**
- Produces (in `native-bridge.ts`): `postToNative(message: unknown): void` — JSON-stringifies and posts to `window.ReactNativeWebView`, no-ops if absent (browser / no bridge).
- Produces (native→web message, unchanged): `{"type":"push-token","token":string,"platform":"ios"|"android"}`.
- Produces (new, web→native message): `{"type":"native-authenticated"}` — posted once whenever this WebView session has a `user` under the native bridge.
- Consumes (mobile side): `requestPushPermissionAndGetToken`, `getPushPlatform` from `apps/mobile/src/lib/push-notifications.ts` (unchanged from the parent plan).

**Context:** The final review found two related Important-severity gaps, both rooted in `apps/mobile/src/app/index.tsx` inferring authentication from a hardcoded 2-entry path allowlist (`UNAUTHENTICATED_PATHS = new Set(["/landing", "/login"])`) against an app with ~40 routes:
- **Dropped first login:** `apps/web/app/(auth)/login/page.tsx` completes login with a *hard* navigation (`window.location.href`). By the time native detects the new URL and requests a token, the destination page may not have hydrated yet (its `useAuth().user` not resolved), so the `push-token` message lands before any listener is attached and is silently dropped — with no retry, since native's "already authenticated" flag has already latched.
- **Permission requested before the user has an account:** `apps/web/src/screens/landing-screen.tsx` routes first-run users from `/landing` to `/welcome` — not in `UNAUTHENTICATED_PATHS` — so native classifies `/welcome` (and `/register`, `/terms`, etc.) as "authenticated" and fires the OS permission dialog before login. On iOS a denial here is effectively permanent (no re-prompt short of the user finding Settings), so this is the worst possible moment to ask.

Both are fixed by the same change: stop inferring auth from paths. The web side already knows its own auth state (`useAuth()`); have it tell native explicitly. Native then requests permission/token only in response to that message, and reposts on every occurrence (idempotent — the OS permission APIs no-op if already granted/denied, and the DB write is an upsert), which also gives the flow a natural retry instead of a one-shot latch.

Logout is unaffected by this task — that's already handled by Task 2's hardened `auth-provider.tsx` unsubscribe, entirely on the web side, with no dependency on native at all.

- [ ] **Step 1: Add `postToNative` to the shared bridge module**

Replace the full contents of `apps/web/src/lib/native-bridge.ts` with:

```ts
// Shared between apps/web/src/hooks/use-notifications.ts and
// apps/web/src/providers/auth-provider.tsx.

type ReactNativeWebViewBridge = {
  postMessage: (message: string) => void;
};

function getReactNativeWebView(): ReactNativeWebViewBridge | undefined {
  return (window as unknown as { ReactNativeWebView?: ReactNativeWebViewBridge })
    .ReactNativeWebView;
}

// Set only inside apps/mobile's WebView (react-native-webview injects this global).
export function isNativeBridge() {
  return typeof window !== "undefined" && "ReactNativeWebView" in window;
}

// Posts a JSON message up to apps/mobile's native layer. No-ops outside the
// native WebView (e.g. in a browser tab, or before the bridge global exists).
export function postToNative(message: unknown) {
  if (typeof window === "undefined") return;
  getReactNativeWebView()?.postMessage(JSON.stringify(message));
}

// Caches the last FCM token apps/mobile handed to this WebView session, so
// sign-out can unsubscribe it synchronously — before the Supabase session
// that authorizes the unsubscribe action is cleared — without waiting on a
// native round-trip that may never arrive in time (see logout race).
export const NATIVE_PUSH_TOKEN_KEY = "ventre_native_push_token";
```

- [ ] **Step 2: Post the handshake message from `useNotifications`**

In `apps/web/src/hooks/use-notifications.ts`, add a new import and a new effect. Change the import line:

```ts
import { NATIVE_PUSH_TOKEN_KEY, isNativeBridge } from "@/lib/native-bridge";
```

to:

```ts
import { NATIVE_PUSH_TOKEN_KEY, isNativeBridge, postToNative } from "@/lib/native-bridge";
```

Then add this effect immediately after the existing native-bridge message-listener effect (the one ending with `}, [user]);` around line 119 — i.e. right before `const subscribe = useCallback(...)`):

```ts
  // Tell native this WebView session is authenticated, so it can request
  // permission/token — more reliable than native inferring auth from
  // navigation paths, which don't cover every unauthenticated route.
  useEffect(() => {
    if (!user || !isNativeBridge()) return;
    postToNative({ type: "native-authenticated" });
  }, [user]);
```

Do not change anything else in this file — the rest of the hook (including the message-listener effect that handles incoming `push-token`/`push-unsubscribe`) stays exactly as merged in `7086078`.

- [ ] **Step 3: Replace `apps/mobile/src/app/index.tsx`**

Replace the full file with:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import {
  getInitialDeepLinkUrl,
  getPushPlatform,
  requestPushPermissionAndGetToken,
  subscribeToForegroundMessages,
  subscribeToNotificationOpen,
  subscribeToTokenRefresh,
} from "@/lib/push-notifications";

const ORIGIN = "https://ventre.app";
const LANDING_URI = `${ORIGIN}/landing`;

// Hermes doesn't ship a global URL polyfill, so parse the pathname by hand.
function getPathname(url: string) {
  return url.replace(/^https?:\/\/[^/]+/, "").split(/[?#]/)[0];
}

export default function Index() {
  const [isLanding, setIsLanding] = useState(true);
  const [webViewUri, setWebViewUri] = useState(LANDING_URI);
  const webViewRef = useRef<WebView>(null);

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setIsLanding(getPathname(navState.url) === "/landing");
  }, []);

  // Web tells native when this WebView session is authenticated (it already
  // knows via its own auth state) — more reliable than inferring auth from
  // navigation paths, which don't cover every unauthenticated route (e.g.
  // /welcome, /register). Reposting is safe: requestPermission/getToken are
  // idempotent, and the DB write on the web side is an upsert.
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    let message: unknown;
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if ((message as { type?: string })?.type !== "native-authenticated") return;

    requestPushPermissionAndGetToken()
      .then((token) => {
        if (!token) return;
        webViewRef.current?.postMessage(
          JSON.stringify({ type: "push-token", token, platform: getPushPlatform() }),
        );
      })
      .catch((err) => console.error("[push] failed to get permission/token:", err));
  }, []);

  // Foreground FCM messages: rendered as a local system notification.
  useEffect(() => subscribeToForegroundMessages(), []);

  // Refreshed tokens must reach the WebView the same way the initial one did.
  // Safe to post unconditionally: the web listener itself no-ops when logged out.
  useEffect(() => {
    return subscribeToTokenRefresh((token) => {
      webViewRef.current?.postMessage(
        JSON.stringify({ type: "push-token", token, platform: getPushPlatform() }),
      );
    });
  }, []);

  // Tap-to-deep-link: killed-state launch and background→foreground tap.
  useEffect(() => {
    getInitialDeepLinkUrl().then((url) => {
      if (url) setWebViewUri(`${ORIGIN}${url}`);
    });
    return subscribeToNotificationOpen((url) => {
      setWebViewUri(`${ORIGIN}${url}`);
    });
  }, []);

  return (
    <View style={styles.container}>
      {/* Matches apps/web's viewport.themeColor / manifest theme_color */}
      <SafeAreaView edges={["top"]} style={styles.topSafeArea} />
      <WebView
        ref={webViewRef}
        style={[styles.container, styles.topSafeArea]}
        source={{ uri: webViewUri }}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={handleMessage}
        startInLoadingState
        renderLoading={() => <View style={[styles.container, styles.topSafeArea]} />}
      />
      {/* /landing has no bottom nav, so it keeps the brand red; every other
          route matches apps/web's globals.css --background (light mode). */}
      <SafeAreaView
        edges={["bottom"]}
        style={isLanding ? styles.topSafeArea : styles.bottomSafeArea}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topSafeArea: { backgroundColor: "#78130A" },
  bottomSafeArea: { backgroundColor: "#faf7f4" },
});
```

This removes `UNAUTHENTICATED_PATHS`, `isAuthenticatedRef`, and `lastTokenRef` entirely (no longer needed — auth is now message-driven, not path-inferred, and logout no longer needs a native-side token cache since Task 2's `auth-provider.tsx` handles it). It also adds the `onMessage` prop (required for `window.ReactNativeWebView.postMessage` to be injected into the WebView's JS context at all — without an `onMessage` handler set on the native `WebView` component, `postToNative` in Task 2 would be calling into a global that react-native-webview never injects).

- [ ] **Step 4: Verify**

Run: `pnpm --filter web check-types && pnpm --filter web lint`
Run: `pnpm --filter mobile check-types && pnpm --filter mobile lint`
Expect all four to pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/native-bridge.ts apps/web/src/hooks/use-notifications.ts apps/mobile/src/app/index.tsx
git commit -m "fix(mobile,web): replace navigation-path auth detection with web-to-native handshake"
```

---

### Task 4: Full-repo verification

**Files:** none (verification only — no commit).

- [ ] **Step 1:** Run `pnpm check-types` — expect pass across all workspace packages.
- [ ] **Step 2:** Run `pnpm lint` — expect pass.
- [ ] **Step 3:** Run `cd apps/mobile && npx expo config --json > /dev/null` — expect exit 0.

---

## Deferred Minor findings (from the 2026-08-07 final review — not tasked, for future triage)

These were judged Minor (not blocking, not addressed by this plan) when the parent plan's final review ran. Two are already closed by this plan's Task 3 in passing (noted below); the rest remain open for whoever picks this up next:

- ~~`requestPushPermissionAndGetToken().then()` had no `.catch()` in `index.tsx`~~ — closed by Task 3, Step 3 above.
- ~~`"https://ventre.app"` origin duplicated as a string literal in the deep-link effect~~ — closed by Task 3, Step 3 above (now the `ORIGIN` constant).
- **Likely duplicate notification banner on iOS foreground**: `expo-notifications`' `shouldShowBanner: true` handler applies to the incoming *remote* FCM notification too, not just the locally-scheduled copy `subscribeToForegroundMessages` schedules — iOS foreground may show two banners per event. Needs a physical device to confirm; if confirmed, likely fix is skipping the local re-post on iOS (it's really an Android-only necessity) or returning `shouldShowBanner: false` for remote-origin notifications in the handler.
- **`aps-environment: "development"` hardcoded** in `apps/mobile/app.json` — correct for local `expo run:ios` debug builds (the only build path this project has today), but silently wrong for a future TestFlight/App Store release build (pushes just never arrive, no error anywhere). Worth a comment or a `README.md` note before anyone ships a release build.
- **No error surfacing on the web side of the bridge** beyond what Task 2 added to `signOut()` — the `push-token`/`push-unsubscribe` message handler in `use-notifications.ts` still uses bare `.then()` with no `serverError`/`validationErrors` handling (the file's own `markAsRead` does log `serverError` — worth matching that convention here too).
- **Deep-link tap is a no-op when the URL matches the current `webViewUri`** — `setWebViewUri` with an unchanged value doesn't trigger a WebView reload, so two consecutive notifications for the same patient leave the second tap doing nothing visible. `webViewUri` also only tracks deep links, never in-app navigation, so it can drift from the WebView's actual current URL.
- **`permissionStatus` is permanently `"default"` under the bridge.** The only thing stopping `NotificationPermissionPrompt` from rendering natively today is `"Notification" in window` being false inside the WebView — an implicit dependency. Cheap fix if picked up: an explicit `isNativeBridge()` guard in that component's effect, or drive `permissionStatus` from the bridge.
- **Firebase config files (`google-services.json`, `GoogleService-Info.plist`) are neither gitignored nor documented** in `apps/mobile/.gitignore` / `README.md` / `AGENTS.md` — only in the original plan doc. The next person to run `expo prebuild` without having read that plan gets a bare "file not found."
- **No origin check on the new `window` message listener** (`use-notifications.ts`, added when Critical #1 was fixed) — a `window`-level listener also receives cross-origin `postMessage` from any embedded iframe/opener. `apps/web` embeds no third-party iframes today, so this is defense-in-depth rather than an active hole, but the RN-injected event has an empty `origin` and `source === null`, so `if (event.origin !== "" || event.source !== null) return;` at the top of `handleMessage` would close it cheaply if anyone wants to harden it.

## Self-Review Notes

- **Spec coverage:** all four Important findings from the parent plan's final review are covered — #5 (build-properties) in Task 1, #3 (dropped login token) and #4 (over-eager permission prompt) together in Task 3 (per the final reviewer's own recommendation that one handshake fixes both), and the two gaps surfaced by the Critical-fix re-review in Task 2.
- **No placeholders:** every step has complete, literal code.
- **Type consistency:** `postToNative` (Task 3, Step 1) is defined once in `native-bridge.ts` and consumed with the same signature in Step 2 (`use-notifications.ts`) — no other file calls it. The new `native-authenticated` message type is produced in Step 2 and consumed with the matching literal string in Step 3 (`index.tsx`). `NATIVE_PUSH_TOKEN_KEY`/`isNativeBridge` signatures are unchanged from the parent plan, so Task 2 (`auth-provider.tsx`) needs no updates beyond what it already imports.
