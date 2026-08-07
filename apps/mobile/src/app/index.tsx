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
