import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import { signInWithGoogleNatively } from "@/lib/google-signin";
import {
  getInitialDeepLinkUrl,
  getPushPlatform,
  requestPushPermissionAndGetToken,
  subscribeToForegroundMessages,
  subscribeToNotificationOpen,
  subscribeToTokenRefresh,
} from "@/lib/push-notifications";
import { supabase } from "@/lib/supabase";

const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_BASE_URL;
const LANDING_URI = `${WEB_BASE_URL}/landing`;
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

  // Web→native requests, correlated by requestId. See
  // apps/web/src/lib/native-bridge.ts's requestNative().
  //
  // react-native-webview has no origin/targetOrigin concept for this channel — any script
  // running in the WebView (including a compromised third-party asset) can call
  // window.ReactNativeWebView.postMessage. event.nativeEvent.url (the WebView's current
  // top-level URL) is the one signal available here; it's not airtight on its own, but
  // combined with strict message-shape validation it rules out messages arriving while the
  // WebView is on an unexpected host.
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    if (!event.nativeEvent.url.startsWith(WEB_BASE_URL ?? "")) return;

    let message: { type?: unknown; requestId?: unknown } | null = null;
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (!message || typeof message.type !== "string" || typeof message.requestId !== "string") {
      return;
    }

    switch (message.type) {
      case "ping":
        webViewRef.current?.postMessage(
          JSON.stringify({ type: "pong", requestId: message.requestId }),
        );
        break;
      case "google-signin-request": {
        const { requestId } = message;
        (async () => {
          const { idToken, error: signInError } = await signInWithGoogleNatively();
          if (!idToken) {
            webViewRef.current?.postMessage(
              JSON.stringify({ type: "google-signin-result", requestId, error: signInError }),
            );
            return;
          }

          const { data, error: authError } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: idToken,
          });

          if (authError || !data.session) {
            webViewRef.current?.postMessage(
              JSON.stringify({ type: "google-signin-result", requestId, error: "auth-failed" }),
            );
            return;
          }

          webViewRef.current?.postMessage(
            JSON.stringify({
              type: "google-signin-result",
              requestId,
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            }),
          );
        })();
        break;
      }
      default:
        break;
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
      if (url) setWebViewUri(`${WEB_BASE_URL}${url}`);
    });
    return subscribeToNotificationOpen((url) => {
      setWebViewUri(`${WEB_BASE_URL}${url}`);
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
