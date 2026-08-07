import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewNavigation } from "react-native-webview";

const LANDING_URI = "https://ventre.app/landing";

// Hermes doesn't ship a global URL polyfill, so parse the pathname by hand.
function getPathname(url: string) {
  return url.replace(/^https?:\/\/[^/]+/, "").split(/[?#]/)[0];
}

export default function Index() {
  const [isLanding, setIsLanding] = useState(true);

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    setIsLanding(getPathname(navState.url) === "/landing");
  };

  return (
    <View style={styles.container}>
      {/* Matches apps/web's viewport.themeColor / manifest theme_color */}
      <SafeAreaView edges={["top"]} style={styles.topSafeArea} />
      <WebView
        style={[styles.container, styles.topSafeArea]}
        source={{ uri: LANDING_URI }}
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
