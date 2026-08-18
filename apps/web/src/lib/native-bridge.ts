// Shared between apps/web/src/hooks/use-notifications.ts and
// apps/web/src/providers/auth-provider.tsx.

// Set only inside apps/mobile's WebView (react-native-webview injects this global).
export function isNativeBridge() {
  return typeof window !== "undefined" && "ReactNativeWebView" in window;
}

// Caches the last FCM token apps/mobile handed to this WebView session, so
// sign-out can unsubscribe it synchronously — before the Supabase session
// that authorizes the unsubscribe action is cleared — without waiting on a
// native round-trip that may never arrive in time (see logout race).
export const NATIVE_PUSH_TOKEN_KEY = "ventre_native_push_token";
