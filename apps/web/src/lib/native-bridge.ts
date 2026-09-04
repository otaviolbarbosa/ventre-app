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

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

const pendingRequests = new Map<string, PendingRequest>();

function isNativeResponse(value: unknown): value is { requestId: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "requestId" in value &&
    typeof (value as { requestId: unknown }).requestId === "string"
  );
}

function handleNativeResponse(event: MessageEvent) {
  if (typeof event.data !== "string") return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(event.data);
  } catch {
    alert("[native-bridge] JSON.parse of event.data threw");
    return;
  }
  if (!isNativeResponse(parsed)) {
    alert(`[native-bridge] message did not match isNativeResponse shape: ${event.data}`);
    return;
  }

  const pending = pendingRequests.get(parsed.requestId);
  alert(`[native-bridge] parsed ok, pending found=${!!pending}, requestId=${parsed.requestId}`);
  if (!pending) return;

  pendingRequests.delete(parsed.requestId);
  pending.resolve(parsed);
  alert("[native-bridge] pending.resolve() returned");
}

// Android WebView fires "message" on `document`, iOS on `window` — same
// dual-listener requirement as apps/web/src/hooks/use-notifications.ts.
if (typeof window !== "undefined") {
  window.addEventListener("message", handleNativeResponse as EventListener);
  document.addEventListener("message", handleNativeResponse as EventListener);
}

// Android's WebView can silently ignore a direct `window.location.href = url`
// assignment made right after the WebView regains focus from a covering native
// Activity (e.g. the Google account picker) — see
// https://github.com/react-native-community/react-native-webview/issues/1129.
// Routing through a real, clicked <a> goes through the WebView's normal
// link-navigation path instead, which Android does pick up reliably. iOS
// isn't affected, but the anchor click works there too, so this is safe to
// use unconditionally for native-bridge hard navigations.
export function hardNavigate(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Sends `{ type, requestId, ...payload }` to the native app and resolves
// with its correlated `{ type, requestId, ... }` response, or rejects on
// timeout. There's no origin/targetOrigin concept for
// window.ReactNativeWebView.postMessage (confirmed in react-native-webview's
// own docs), so this is deliberately not treated as a trusted channel —
// callers must not rely on it for anything security-critical beyond
// triggering a native UI flow.
export function requestNative<T>(
  type: string,
  payload: Record<string, unknown> = {},
  timeoutMs = 10_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!isNativeBridge()) {
      reject(new Error(`[native-bridge] requestNative("${type}") called outside the app`));
      return;
    }

    const requestId = crypto.randomUUID();
    const timeoutId = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`[native-bridge] timeout waiting for "${type}" response`));
    }, timeoutMs);

    pendingRequests.set(requestId, {
      resolve: (value) => {
        clearTimeout(timeoutId);
        resolve(value as T);
      },
      reject: (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    });

    window.ReactNativeWebView?.postMessage(JSON.stringify({ type, requestId, ...payload }));
  });
}
