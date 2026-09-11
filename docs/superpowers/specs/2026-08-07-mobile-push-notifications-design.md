# Mobile Push Notifications (Firebase Cloud Messaging) — Design

## Context

`apps/mobile` is currently a thin Expo Router shell around a single `WebView` pointing at `https://ventre.app` (`apps/mobile/src/app/index.tsx`). There is no native auth, no native Supabase client, and no notification infrastructure of any kind yet (`apps/mobile/package.json` has zero notification-related deps).

`apps/web` already has a full push-notification system built on Firebase Cloud Messaging (FCM):
- Client SDK init: `apps/web/src/lib/firebase/client.ts`
- Admin SDK init + send helpers: `apps/web/src/lib/firebase/admin.ts`
- Orchestration: `apps/web/src/lib/notifications/send.ts` (`sendNotificationToUser`, `sendNotificationToTeam`)
- Dynamic service worker: `apps/web/app/firebase-messaging-sw.js/route.ts`
- Subscribe/unsubscribe server actions used by `apps/web/src/hooks/use-notifications.ts`
- DB: `push_subscriptions` table (`fcm_token text unique`, `device_info jsonb`, `is_active`, `user_id`) with RLS `auth.uid() = user_id`, defined in `packages/supabase/supabase/migrations/20260209000000_push_notifications.sql`
- Two parallel send paths that already fan out to every active token for a `user_id`, regardless of platform:
  - Next.js server code → `firebase-admin` (`apps/web/src/lib/notifications/send.ts`)
  - Supabase Edge Functions → raw FCM v1 HTTP calls (`packages/supabase/supabase/functions/ventre-send-notification`, `.../process-notifications`)
- ~15 business events already trigger sends via Postgres triggers + `pg_net`, defined in `packages/supabase/supabase/migrations/20260503000002_push_notification_triggers.sql`.

**Goal:** get real device push tokens (Android + iOS) into `push_subscriptions`, using the same Firebase project and the same delivery infrastructure as web — with **zero backend changes** — so mobile devices start receiving the existing notification events for free.

## Non-goals

- No EAS Build / `eas.json` / cloud build pipeline setup. This design only requires *a* custom dev client to exist, which the project already has locally (gitignored `apps/mobile/ios` and `apps/mobile/android`, evidence of a prior `expo prebuild`/`expo run:*`).
- No native Supabase client / native auth session in the RN app. Auth continues to live entirely in the WebView's cookie session.
- No in-app (custom UI) notification center on mobile — this design only covers OS-level push delivery and tap-to-deep-link, not an inbox/bell UI.
- No changes to which events trigger notifications, or to notification copy/payloads.

## Architecture

### Library choice: `@react-native-firebase/app` + `@react-native-firebase/messaging`

Confirmed against current docs (Context7, Expo SDK 57 versioned docs + react-native-firebase docs):

- `expo-notifications`'s `getDevicePushTokenAsync()` returns a true FCM token on Android, but a **raw APNs token** on iOS — not directly usable with `firebase-admin`/FCM v1, which expect FCM registration tokens. iOS would be a dead end without extra bridging work.
- Expo's own push service (`getExpoPushTokenAsync()`) introduces a third delivery path (Expo's relay) alongside the two that already exist (firebase-admin, edge-function FCM v1 HTTP), and a different token format in the DB — diverges from "use Firebase Messaging like web".
- `@react-native-firebase/messaging` gives real FCM tokens on **both** platforms (it performs the APNs→FCM exchange internally on iOS), so tokens are drop-in compatible with the existing `push_subscriptions` schema and both existing send paths, unchanged.

This requires a custom dev client (native module, not available in Expo Go) — acceptable since the project already prebuilds locally.

### Token → DB bridge (no new backend endpoint)

The mobile app has no native auth session, but the WebView does (it's an authenticated browser session against `ventre.app`). Rather than duplicating auth natively, the native token is hand delivered into the WebView's JS context, which then calls the **existing** subscribe server action using its own cookies:

1. **Native**: watch WebView navigation state (the same navigation-state tracking `index.tsx` already does for safe-area coloring) for the transition from `/landing`/`/login` → an authenticated route. On that transition, call `messaging().requestPermission()`, then `messaging().getToken()`.
2. **Native → Web**: send `{ type: 'push-token', token, platform: 'ios' | 'android' }` via `webViewRef.current.postMessage(...)` (react-native-webview's native→web channel — not `injectJavaScript`).
3. **Web**: `apps/web/src/hooks/use-notifications.ts` gains a bridge-detection branch — when `window.ReactNativeWebView` is present, skip the browser-only flow (`Notification.requestPermission()`, service-worker registration, `requestFcmToken()`) and instead listen for the `message` event carrying the token, then call the existing `subscribeNotificationsAction` with `device_info: { platform }`.
4. **Token refresh**: `messaging().onTokenRefresh()` repeats step 2–3.
5. **Logout**: on WebView navigation back to `/landing`/`/login`, fire the existing unsubscribe action through the same bridge, deactivating the token.

Because delivery (both send paths) already treats every active `push_subscriptions` row identically regardless of platform, no backend/DB/edge-function changes are needed — mobile tokens participate in all ~15 existing trigger events immediately once stored.

### Foreground display

FCM suppresses "notification"-payload messages while the app is foregrounded on Android by default, and iOS foreground presentation isn't guaranteed out of the box either. To get consistent system-banner behavior across foreground/background/killed states:

- RNFirebase's `onMessage()` (foreground listener) calls `expo-notifications`' `Notifications.scheduleNotificationAsync({ content: {...}, trigger: null })` to immediately render the same title/body as a local system notification.
- `expo-notifications` is used **only** as a local-display layer here — it never touches tokens or talks to FCM. RNFirebase remains the only thing that manages tokens/receipt.

### Tap → deep link

- `messaging().onNotificationOpenedApp()` (background → foreground tap) and `messaging().getInitialNotification()` (killed → launch tap) both expose `remoteMessage.data`.
- Read `data.url` (the same field the web service worker already reads via `notification.data.url` in `apps/web/app/firebase-messaging-sw.js/route.ts`) and point the WebView at `https://ventre.app${url}`.

## Data flow diagram

```
[Postgres trigger / cron] → pg_net → ventre-send-notification / process-notifications (edge fn)
                                   ↘ (or) apps/web server code → firebase-admin
                                              ↓
                                   push_subscriptions (fcm_token, user_id, platform in device_info)
                                              ↑
                     subscribeNotificationsAction (existing, reused as-is)
                                              ↑
                          apps/web use-notifications.ts (bridge-detection branch)
                                              ↑ postMessage
                          apps/mobile WebView ← RNFirebase messaging().getToken()
                                              ↑
                                   messaging().requestPermission() on login transition
```

## Manual prerequisites (outside code, owner: user)

These block real end-to-end delivery and cannot be done from this environment:

1. Register a new Firebase "app" for bundle/package `app.ventre.mobile` **inside the same Firebase project apps/web uses** (so `FIREBASE_PROJECT_ID` and existing service-account credentials keep working unchanged for sending). Produces `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) — these are provided by the user and consumed by the RNFirebase config plugin, not generated by code.
2. Upload an APNs Auth Key (from Apple Developer account) to that Firebase project — required for iOS remote notifications to function at all.
3. `app.json` needs `ios.entitlements.aps-environment` and `ios.infoPlist.UIBackgroundModes: ["remote-notification"]` — this part is code and will be done as part of implementation.

## Testing / verification scope

- Automated: `pnpm check-types`, lint, and a local `expo prebuild` dry run to confirm the config plugin wiring doesn't break the native project generation.
- **Not verifiable from this environment**: an actual push arriving on a simulator/device (no Firebase console access, no physical device, no APNs sandbox connectivity here). Real end-to-end verification (send a test event, confirm arrival + correct deep link) is the user's responsibility once the config files from the prerequisites above are in place.

## Summary of changes

**apps/mobile:**
- Add `@react-native-firebase/app`, `@react-native-firebase/messaging`, `expo-notifications` deps.
- `app.json`: add RNFirebase config plugin, iOS entitlements/background modes.
- New native bridge module: permission request + token fetch/refresh, tied to WebView navigation-state transitions already tracked in `index.tsx`.
- WebView tap-to-deep-link and foreground local-notification display wiring.

**apps/web:**
- `use-notifications.ts`: add bridge-detection branch (native WebView vs. browser), reusing `subscribeNotificationsAction`/`unsubscribeNotificationsAction` as-is.

**Backend (Supabase, edge functions, DB):** no changes.
