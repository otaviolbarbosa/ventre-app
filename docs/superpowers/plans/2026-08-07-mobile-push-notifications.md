# Mobile Push Notifications (Firebase Cloud Messaging) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get real FCM device push tokens (Android + iOS) from `apps/mobile` into the existing `push_subscriptions` table, using `@react-native-firebase/messaging`, so mobile devices start receiving the ~15 notification events that already fire from `apps/web` — with zero backend changes.

**Architecture:** The native app watches WebView navigation state for the login transition, requests notification permission, fetches an FCM token via `@react-native-firebase/messaging`, and hands it to the WebView's authenticated JS context via `webViewRef.current.postMessage(...)`. `apps/web`'s existing `useNotifications` hook gains a bridge-detection branch that listens for that message and calls the existing `subscribeNotificationsAction`/`unsubscribeNotificationsAction` server actions — the same ones the browser flow already uses. `expo-notifications` is used only as a local-display layer for foreground FCM messages; RNFirebase remains the only thing that manages tokens.

**Tech Stack:** Expo SDK 57, React Native 0.86.2, `@react-native-firebase/app` + `@react-native-firebase/messaging` (modular v22+ API), `expo-notifications`, `react-native-webview` 13.16.1, Next.js 15 / React 19 (`apps/web`), existing Firebase project + `firebase-admin`.

## Global Constraints

- Zero backend/DB/edge-function changes — see spec's "Non-goals" and "Backend: no changes."
- No EAS Build / `eas.json` setup — this only needs the config plugin wiring; the user runs `expo prebuild`/`expo run:*` locally as they already do.
- No native Supabase client / native auth — auth stays entirely in the WebView's cookie session; the token bridge is the only native↔web communication added.
- No in-app notification-center UI — OS-level push + tap-to-deep-link only.
- No changes to notification copy, payloads, or which events trigger sends.
- All user-facing strings in this repo are Portuguese (pt-BR) per `CLAUDE.md` — not applicable here since this plan adds no user-facing copy (no toasts, no new UI strings).
- **No test runner exists anywhere in this repo** (confirmed: no jest/vitest config, no `*.test.*`/`*.spec.*` files, no `test` script in any `package.json`). This plan does not fabricate a test framework for glue/config code that only becomes meaningful with a physical device and real Firebase credentials. Per the spec's own "Testing / verification scope" section, each task is verified with `pnpm --filter <pkg> check-types`, `pnpm --filter <pkg> lint`, and (for the app.json task) an `expo config` schema dry run — real push delivery is explicitly out of scope for this environment and is the user's responsibility once they've completed the manual prerequisites below.
- **Manual prerequisites (owner: user, cannot be done from this environment):** register `app.ventre.mobile` as an app inside the existing Firebase project apps/web uses, download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) and place them at `apps/mobile/google-services.json` / `apps/mobile/GoogleService-Info.plist`, and upload an APNs Auth Key to that Firebase project. `expo prebuild` (actually generating native projects) will fail until those two files exist — this plan's verification steps account for that and don't require them.

---

### Task 1: Install RNFirebase deps and wire `app.json`

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app.json`

**Interfaces:**
- Produces: `@react-native-firebase/app`, `@react-native-firebase/messaging`, `expo-notifications` as installed, importable packages for Task 2.
- Produces: `app.json` config keys `expo.ios.googleServicesFile` (`"./GoogleService-Info.plist"`) and `expo.android.googleServicesFile` (`"./google-services.json"`) — these paths are referenced by the config plugin but the files themselves are a manual prerequisite (not created by this task).

- [ ] **Step 1: Install the dependencies with Expo's SDK-aware installer**

Run from the repo root:

```bash
cd apps/mobile && npx expo install @react-native-firebase/app @react-native-firebase/messaging expo-notifications
```

This resolves versions compatible with Expo SDK 57 / RN 0.86.2 and writes them into `apps/mobile/package.json` directly (do not hand-pick versions).

- [ ] **Step 2: Verify the install**

Run: `git diff apps/mobile/package.json`
Expected: three new entries under `dependencies` — `@react-native-firebase/app`, `@react-native-firebase/messaging`, `expo-notifications`.

- [ ] **Step 3: Wire `app.json`**

Edit `apps/mobile/app.json` to match:

```json
{
  "expo": {
    "name": "Ventre",
    "slug": "ventre",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "mobile",
    "userInterfaceStyle": "automatic",
    "ios": {
      "icon": "./assets/expo.icon",
      "bundleIdentifier": "app.ventre.mobile",
      "googleServicesFile": "./GoogleService-Info.plist",
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      },
      "entitlements": {
        "aps-environment": "development"
      }
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/images/android-icon-foreground.png",
        "backgroundImage": "./assets/images/android-icon-background.png",
        "monochromeImage": "./assets/images/android-icon-monochrome.png"
      },
      "predictiveBackGestureEnabled": false,
      "package": "app.ventre.mobile",
      "googleServicesFile": "./google-services.json"
    },
    "web": {
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "backgroundColor": "#78130A",
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200
        }
      ],
      "@react-native-firebase/app",
      "@react-native-firebase/messaging"
    ],
    "experiments": {
      "typedRoutes": true,
      "reactCompiler": true
    }
  }
}
```

Note: `aps-environment` is set to `"development"` to match local `expo run:ios` debug builds (the only build path this project currently uses, per the spec's non-goals). Whoever later ships this to TestFlight/App Store via a release build will need to flip it to `"production"` — that's a release-config concern, not part of this plan.

- [ ] **Step 4: Verify the config resolves**

Run: `cd apps/mobile && npx expo config --json > /dev/null`
Expected: exits 0 — this resolves and validates the merged config (including the two new plugins) without needing `google-services.json`/`GoogleService-Info.plist` to physically exist yet (that's only required when `expo prebuild` actually copies them).

- [ ] **Step 5: Type-check and lint**

Run: `pnpm --filter mobile check-types && pnpm --filter mobile lint`
Expected: both pass (no source code changed yet, so this just confirms the install didn't break anything).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/package.json apps/mobile/pnpm-lock.yaml apps/mobile/app.json
git commit -m "chore(mobile): add react-native-firebase messaging + expo-notifications"
```

---

### Task 2: Native push-notifications module

**Files:**
- Create: `apps/mobile/src/lib/push-notifications.ts`

**Interfaces:**
- Consumes: `@react-native-firebase/messaging` modular API and `expo-notifications`, both installed in Task 1.
- Produces (consumed by Task 3):
  - `type PushPlatform = "ios" | "android"`
  - `getPushPlatform(): PushPlatform`
  - `requestPushPermissionAndGetToken(): Promise<string | null>` — resolves `null` if permission was denied.
  - `subscribeToTokenRefresh(onRefresh: (token: string) => void): () => void`
  - `subscribeToForegroundMessages(): () => void` — registers the RNFirebase `onMessage` listener that renders an `expo-notifications` local notification; returns an unsubscribe function.
  - `getInitialDeepLinkUrl(): Promise<string | null>` — the `data.url` from the notification that launched the app from a killed state, if any.
  - `subscribeToNotificationOpen(onOpen: (url: string) => void): () => void` — fires when a background→foreground tap opens the app.

- [ ] **Step 1: Write the module**

```ts
import { Platform, PermissionsAndroid } from "react-native";
import {
  AuthorizationStatus,
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestPermission,
} from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";

export type PushPlatform = "ios" | "android";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function getPushPlatform(): PushPlatform {
  return Platform.OS === "ios" ? "ios" : "android";
}

export async function requestPushPermissionAndGetToken(): Promise<string | null> {
  if (Platform.OS === "android") {
    // No-op on Android < 13; required for the OS to allow notifications on 13+.
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }

  const messaging = getMessaging();
  const authStatus = await requestPermission(messaging);
  const granted =
    authStatus === AuthorizationStatus.AUTHORIZED ||
    authStatus === AuthorizationStatus.PROVISIONAL;

  if (!granted) return null;

  return getToken(messaging);
}

export function subscribeToTokenRefresh(onRefresh: (token: string) => void): () => void {
  return onTokenRefresh(getMessaging(), onRefresh);
}

export function subscribeToForegroundMessages(): () => void {
  return onMessage(getMessaging(), async (remoteMessage) => {
    const { title, body } = remoteMessage.notification ?? {};
    if (!title) return;

    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  });
}

export async function getInitialDeepLinkUrl(): Promise<string | null> {
  const message = await getInitialNotification(getMessaging());
  const url = message?.data?.url;
  return typeof url === "string" ? url : null;
}

export function subscribeToNotificationOpen(onOpen: (url: string) => void): () => void {
  return onNotificationOpenedApp(getMessaging(), (remoteMessage) => {
    const url = remoteMessage.data?.url;
    if (typeof url === "string") onOpen(url);
  });
}
```

- [ ] **Step 2: Type-check and lint**

Run: `pnpm --filter mobile check-types && pnpm --filter mobile lint`
Expected: both pass. If `check-types` fails on the RNFirebase modular imports, re-check the exact export names against the installed package version's `.d.ts` (`node_modules/@react-native-firebase/messaging/lib/index.d.ts`) before changing anything else — the modular API surface is new as of v22 and names must match exactly.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/lib/push-notifications.ts
git commit -m "feat(mobile): add push-notifications module (permission, token, foreground display, deep link)"
```

---

### Task 3: Wire the WebView to the push-notifications module

**Files:**
- Modify: `apps/mobile/src/app/index.tsx`

**Interfaces:**
- Consumes: everything exported from `apps/mobile/src/lib/push-notifications.ts` (Task 2).
- Produces (consumed by Task 4): two JSON message shapes posted into the WebView's JS context via `webViewRef.current.postMessage(...)`:
  - `{"type":"push-token","token":"<fcm-token>","platform":"ios"|"android"}` — sent once on the unauthenticated→authenticated navigation transition, and again on every `subscribeToTokenRefresh` firing.
  - `{"type":"push-unsubscribe","token":"<fcm-token>"}` — sent on the authenticated→unauthenticated navigation transition (logout), using the last token this session obtained.

- [ ] **Step 1: Write the updated file**

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewNavigation } from "react-native-webview";
import {
  getInitialDeepLinkUrl,
  getPushPlatform,
  requestPushPermissionAndGetToken,
  subscribeToForegroundMessages,
  subscribeToNotificationOpen,
  subscribeToTokenRefresh,
} from "@/lib/push-notifications";

const LANDING_URI = "https://ventre.app/landing";
const UNAUTHENTICATED_PATHS = new Set(["/landing", "/login"]);

// Hermes doesn't ship a global URL polyfill, so parse the pathname by hand.
function getPathname(url: string) {
  return url.replace(/^https?:\/\/[^/]+/, "").split(/[?#]/)[0];
}

export default function Index() {
  const [isLanding, setIsLanding] = useState(true);
  const [webViewUri, setWebViewUri] = useState(LANDING_URI);
  const webViewRef = useRef<WebView>(null);
  const isAuthenticatedRef = useRef(false);
  const lastTokenRef = useRef<string | null>(null);

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    const pathname = getPathname(navState.url);
    setIsLanding(pathname === "/landing");

    const isAuthenticated = !UNAUTHENTICATED_PATHS.has(pathname);

    if (isAuthenticated && !isAuthenticatedRef.current) {
      isAuthenticatedRef.current = true;
      requestPushPermissionAndGetToken().then((token) => {
        if (!token) return;
        lastTokenRef.current = token;
        webViewRef.current?.postMessage(
          JSON.stringify({ type: "push-token", token, platform: getPushPlatform() }),
        );
      });
    } else if (!isAuthenticated && isAuthenticatedRef.current) {
      isAuthenticatedRef.current = false;
      if (lastTokenRef.current) {
        webViewRef.current?.postMessage(
          JSON.stringify({ type: "push-unsubscribe", token: lastTokenRef.current }),
        );
      }
    }
  }, []);

  // Foreground FCM messages: rendered as a local system notification.
  useEffect(() => subscribeToForegroundMessages(), []);

  // Refreshed tokens must reach the WebView the same way the initial one did.
  useEffect(() => {
    return subscribeToTokenRefresh((token) => {
      lastTokenRef.current = token;
      if (isAuthenticatedRef.current) {
        webViewRef.current?.postMessage(
          JSON.stringify({ type: "push-token", token, platform: getPushPlatform() }),
        );
      }
    });
  }, []);

  // Tap-to-deep-link: killed-state launch and background→foreground tap.
  useEffect(() => {
    getInitialDeepLinkUrl().then((url) => {
      if (url) setWebViewUri(`https://ventre.app${url}`);
    });
    return subscribeToNotificationOpen((url) => {
      setWebViewUri(`https://ventre.app${url}`);
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

- [ ] **Step 2: Type-check and lint**

Run: `pnpm --filter mobile check-types && pnpm --filter mobile lint`
Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/app/index.tsx
git commit -m "feat(mobile): bridge push token to WebView on login, handle deep-link taps"
```

---

### Task 4: `apps/web` bridge-detection branch in `useNotifications`

**Files:**
- Modify: `apps/web/src/hooks/use-notifications.ts`

**Interfaces:**
- Consumes: the two message shapes produced in Task 3 (`push-token`, `push-unsubscribe`).
- Consumes unchanged, existing actions: `subscribeNotificationsAction({ fcmToken: string, deviceInfo?: Record<string, unknown> })` and `unsubscribeNotificationsAction({ fcmToken: string })` (both already defined in `apps/web/src/actions/`, no changes needed there).
- Produces: same public hook return shape as before (`permissionStatus`, `isSubscribed`, `unreadCount`, `requestPermission`, `subscribe`, `unsubscribe`, `markAsRead`, `setUnreadCount`) — callers (`notifications-provider.tsx`, `notification-bell.tsx`, `notification-permission-prompt.tsx`) need no changes.

- [ ] **Step 1: Write the updated file**

```ts
"use client";

import { getUnreadNotificationsCountAction } from "@/actions/get-unread-notifications-count-action";
import { markNotificationsReadAction } from "@/actions/mark-notifications-read-action";
import { subscribeNotificationsAction } from "@/actions/subscribe-notifications-action";
import { unsubscribeNotificationsAction } from "@/actions/unsubscribe-notifications-action";
import { useAuth } from "@/hooks/use-auth";
import { onForegroundMessage, requestFcmToken } from "@/lib/firebase/client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

// Set only inside apps/mobile's WebView (react-native-webview injects this global).
function isNativeBridge() {
  return typeof window !== "undefined" && "ReactNativeWebView" in window;
}

type NativePushMessage =
  | { type: "push-token"; token: string; platform: "ios" | "android" }
  | { type: "push-unsubscribe"; token: string };

function parseNativePushMessage(raw: unknown): NativePushMessage | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type === "push-token" && typeof parsed.token === "string") return parsed;
    if (parsed?.type === "push-unsubscribe" && typeof parsed.token === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

export function useNotifications() {
  const { user } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (isNativeBridge()) return;
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  // Fetch unread count
  useEffect(() => {
    if (!user) return;

    const fetchUnread = async () => {
      const result = await getUnreadNotificationsCountAction();
      if (result?.data) {
        setUnreadCount(result.data.unreadCount);
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 60_000);
    return () => clearInterval(interval);
  }, [user]);

  // Listen for foreground messages (browser only — native foreground display
  // is handled in-app by apps/mobile's RNFirebase onMessage listener).
  useEffect(() => {
    if (typeof window === "undefined" || !user || isNativeBridge()) return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    onForegroundMessage((payload) => {
      const { title, body } = payload.notification ?? {};
      if (title) {
        toast(title, { description: body });
        setUnreadCount((c) => c + 1);
      }
    }).then((unsub) => {
      if (cancelled) {
        unsub();
      } else {
        unsubscribe = unsub;
      }
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user]);

  // Native bridge: apps/mobile posts the FCM token it collected natively;
  // subscribe/unsubscribe through the same server actions the browser flow uses.
  useEffect(() => {
    if (typeof window === "undefined" || !user || !isNativeBridge()) return;

    const handleMessage = (event: MessageEvent) => {
      const message = parseNativePushMessage(event.data);
      if (!message) return;

      if (message.type === "push-token") {
        subscribeNotificationsAction({
          fcmToken: message.token,
          deviceInfo: { platform: message.platform },
        }).then((result) => {
          if (result?.data?.success) setIsSubscribed(true);
        });
      } else {
        unsubscribeNotificationsAction({ fcmToken: message.token }).then(() => {
          setIsSubscribed(false);
        });
      }
    };

    document.addEventListener("message", handleMessage as EventListener);
    return () => document.removeEventListener("message", handleMessage as EventListener);
  }, [user]);

  const subscribe = useCallback(async () => {
    if (isNativeBridge()) return false;
    const token = await requestFcmToken();
    if (!token) return false;

    const result = await subscribeNotificationsAction({
      fcmToken: token,
      deviceInfo: { userAgent: navigator.userAgent },
    });

    if (result?.data?.success) {
      setIsSubscribed(true);
      localStorage.setItem("ventre_push_subscribed", "true");
      return true;
    }
    return false;
  }, []);

  const unsubscribe = useCallback(async () => {
    if (isNativeBridge()) return;
    const token = await requestFcmToken();
    if (!token) return;

    await unsubscribeNotificationsAction({ fcmToken: token });

    setIsSubscribed(false);
    localStorage.removeItem("ventre_push_subscribed");
  }, []);

  const requestPermission = useCallback(async () => {
    if (isNativeBridge()) return false;
    if (!("Notification" in window)) return false;

    const permission = await Notification.requestPermission();
    setPermissionStatus(permission);

    if (permission === "granted") {
      return subscribe();
    }
    return false;
  }, [subscribe]);

  // Auto-subscribe if permission already granted (refreshes FCM token)
  useEffect(() => {
    if (typeof window === "undefined" || !user || isNativeBridge()) return;
    if (!("Notification" in window)) return;

    const alreadySubscribed = localStorage.getItem("ventre_push_subscribed") === "true";
    setIsSubscribed(alreadySubscribed);

    if (Notification.permission === "granted") {
      subscribe();
    }
  }, [user, subscribe]);

  const markAsRead = useCallback(async (ids?: string[]) => {
    const result = await markNotificationsReadAction({ ids });
    if (result?.serverError) {
      console.error("[subscribe] action error:", result.serverError);
    }

    if (result?.data?.success) {
      if (ids) {
        setUnreadCount((c) => Math.max(0, c - ids.length));
      } else {
        setUnreadCount(0);
      }
    }
  }, []);

  return {
    permissionStatus,
    isSubscribed,
    unreadCount,
    requestPermission,
    subscribe,
    unsubscribe,
    markAsRead,
    setUnreadCount,
  };
}
```

Note on `document.addEventListener("message", ...)`: react-native-webview's native `postMessage` dispatches the `MessageEvent` on `document` on Android, and on `window` on iOS — but the iOS event bubbles from `window` to `document`, so a single `document` listener catches both platforms (verified against react-native-webview's own reference docs and example app).

- [ ] **Step 2: Type-check and lint**

Run: `pnpm --filter web check-types && pnpm --filter web lint`
Expected: both pass. If lint flags anything, use `npx biome lint --write --unsafe apps/web/src/hooks/use-notifications.ts` per this repo's convention for auto-fixable warnings.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/use-notifications.ts
git commit -m "feat(web): add native WebView bridge branch to useNotifications"
```

---

### Task 5: Full-repo verification

**Files:** none (verification only — no commit).

- [ ] **Step 1: Root type-check**

Run: `pnpm check-types`
Expected: passes across all workspace packages (`mobile`, `web`, `@ventre/supabase`, `@ventre/ui`).

- [ ] **Step 2: Root lint**

Run: `pnpm lint`
Expected: passes.

- [ ] **Step 3: Confirm `expo config` still resolves after all mobile changes**

Run: `cd apps/mobile && npx expo config --json > /dev/null`
Expected: exits 0.

- [ ] **Step 4: Record what's still blocked on the user**

No command to run here — this is a checklist, not a test. Confirm (by inspection) that nothing in Tasks 1–4 silently assumed `google-services.json` / `GoogleService-Info.plist` exist. Per this plan's Global Constraints, actual push delivery, an `expo prebuild` that fully succeeds, and on-device verification are the user's responsibility once they've completed the Firebase console steps listed there.

---

## Self-Review Notes

- **Spec coverage:** library choice (Task 1/2), token→DB bridge steps 1–5 (Tasks 2–4), foreground display (Task 2/3), tap→deep link (Task 2/3), `app.json` entitlements/background modes (Task 1), `use-notifications.ts` bridge branch (Task 4), zero backend changes (no task touches Supabase/edge functions). Manual prerequisites are explicitly called out as out-of-scope-for-code in Global Constraints.
- **No placeholders:** every step has literal, complete code — no "add error handling" or "similar to Task N" stand-ins.
- **Type consistency:** the native→web message contract (`push-token` / `push-unsubscribe`, exact field names `token`/`platform`) is defined once in Task 3's interfaces block and consumed with matching field names in Task 4's `NativePushMessage` type. `push-notifications.ts`'s exported function names in Task 2's interfaces block match their call sites in Task 3 exactly (`requestPushPermissionAndGetToken`, `subscribeToTokenRefresh`, `subscribeToForegroundMessages`, `getInitialDeepLinkUrl`, `subscribeToNotificationOpen`, `getPushPlatform`).
